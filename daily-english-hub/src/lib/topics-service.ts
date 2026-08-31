import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchTopHeadlines, fetchNaverArticles } from "./news";
import {
  selectTopTopics,
  generateArticleCore,
  generateQuiz,
  generateBlanks,
  TOPIC_CATEGORIES,
  type TopicCandidate,
} from "./gemini";
import { generateSpeech } from "./tts";
import {
  getCachedTopicsForDate,
  cacheTopicsForDate,
  getRecentDaysTopics,
  setPregenerating,
  isPregenerating,
  getTopicAudio,
  setTopicAudio,
  deleteTopicAudio,
  mergeTopicIntoCache,
} from "./supabase/topics";
import { getKstDateString } from "./date";
import type { AiContent } from "./supabase/types";

/** 현재 스키마(빈칸 3개, 어휘 10개, 품사 태그)를 모두 만족하는 완전한 학습자료인지 확인한다. */
function hasCompleteAiContent(t: TopicCandidate): boolean {
  return (
    !!t.aiContent &&
    Array.isArray(t.aiContent.blanks) &&
    t.aiContent.blanks.length === 3 &&
    Array.isArray(t.aiContent.vocabulary) &&
    t.aiContent.vocabulary.length === 10 &&
    Array.isArray(t.aiContent.quiz?.[0]?.hints) &&
    Array.isArray(t.aiContent.blanks?.[0]?.hints) &&
    !!t.aiContent.vocabulary[0]?.pos &&
    Array.isArray(t.aiContent.blanks?.[0]?.optionHints) &&
    t.aiContent.blanks[0].optionHints.length === 4 &&
    !!t.aiContent.blanks[0]?.translation
  );
}

/**
 * 요약·번역·어휘·영작단어(1단계 article core)까지는 만들어져 있는지 확인한다.
 * true면 뉴스 검색·1단계 Gemini 호출을 다시 하지 않고, 아직 없는 quiz/blanks만 이어서 만든다.
 */
function hasArticleCore(t: TopicCandidate): boolean {
  return (
    !!t.aiContent &&
    Array.isArray(t.aiContent.summary) &&
    t.aiContent.summary.length === 5 &&
    Array.isArray(t.aiContent.translation) &&
    t.aiContent.translation.length === 5 &&
    Array.isArray(t.aiContent.vocabulary) &&
    t.aiContent.vocabulary.length === 10 &&
    !!t.aiContent.vocabulary[0]?.pos
  );
}

/**
 * 오늘(KST) 주제 5개를 캐시에서 가져오거나, 없으면 새로 선정해 캐싱한다.
 * /api/news와 동일한 로직이지만, 새벽 배치(cron)에서도 독립적으로 호출할 수 있도록 분리했다.
 */
async function getOrSelectTodayTopics(
  supabase: SupabaseClient
): Promise<TopicCandidate[]> {
  const today = getKstDateString();

  const cached = await getCachedTopicsForDate(supabase, today);
  // category 필드 도입 이전에 캐싱된 항목은 무효로 보고 다시 선정한다(재선정 비용은 저렴하다).
  const cacheIsFresh =
    !!cached &&
    cached.length === 5 &&
    cached.every((t) => (TOPIC_CATEGORIES as readonly string[]).includes(t.category));
  if (cacheIsFresh) return cached!;

  const headlines = await fetchTopHeadlines(30);
  if (headlines.length === 0) {
    throw new Error("오늘의 뉴스를 가져오지 못했습니다.");
  }

  let topics: TopicCandidate[];
  try {
    const recentTopics = await getRecentDaysTopics(supabase, 3);
    topics = await selectTopTopics(headlines, recentTopics);
  } catch (error) {
    console.error("[topics-service] Gemini topic selection failed, falling back", error);
    topics = headlines.slice(0, 5).map((h) => ({
      topic: h.title,
      searchQuery: h.title,
      representativeTitle: h.title,
      category: "사회" as const,
      url: h.url,
    }));
  }

  await cacheTopicsForDate(supabase, today, topics);
  return topics;
}

/**
 * 오늘의 5개 주제 중 아직 학습자료(aiContent)가 없는 것만 생성해 daily_topics에 채워 넣는다.
 * 새벽 3시 크론(/api/cron/pregenerate)에서 호출되어, 학습자가 처음 클릭할 때 대기 없이
 * 바로 학습자료를 볼 수 있게 한다. 실패한 항목은 aiContent 없이 그대로 두어(기존 on-demand
 * 생성 경로로 폴백) 배치 전체가 하나의 실패로 멈추지 않도록 한다.
 *
 * 토픽 하나 안에서도 조각(article core → quiz/blanks/오디오)이 완성되는 즉시 그 조각만
 * 캐시에 저장한다 — 5개 전부, 혹은 한 토픽의 모든 조각이 끝나야만 저장되는 게 아니다.
 * 그래서 함수가 시간 제한이나 오류로 중간에 끊겨도, 그 시점까지 이미 완성된 조각은
 * (다른 토픽 것이든, 같은 토픽의 quiz만이든) 잃지 않고 그대로 남는다.
 * 재실행 시에는 hasArticleCore로 이미 있는 조각은 건너뛰고 없는 조각만 이어서 만든다.
 */
export async function pregenerateTodayMaterials(
  supabase: SupabaseClient
): Promise<{ total: number; generated: number; alreadyCached: number; failed: number }> {
  const today = getKstDateString();
  const topics = await getOrSelectTodayTopics(supabase);

  let generated = 0;
  let alreadyCached = 0;
  let failed = 0;

  // 이 구간 동안 /api/generate는 즉석 생성으로 폴백하지 않고 "업데이트 중" 안내를 보여준다.
  // 실패해도 반드시 풀리도록 finally로 해제한다.
  await setPregenerating(supabase, today, true);
  try {
    await Promise.all(
      topics.map(async (rawTopic) => {
        // 오디오를 별도 테이블로 옮기기 전 버전이 topics jsonb 안에 audioBase64를 직접
        // 넣어뒀을 수 있다 — 그대로 두면 캐시를 다시 쓸 때마다 그 큰 값이 계속 따라다니므로
        // 여기서 확실히 걷어낸다.
        const { audioBase64: _legacyAudio, ...t } = rawTopic as TopicCandidate & {
          audioBase64?: string;
        };
        let topic: TopicCandidate = t;
        const key = topic.representativeTitle || topic.topic;

        if (hasCompleteAiContent(topic)) {
          const existingAudio = await getTopicAudio(supabase, today, key);
          if (!existingAudio) {
            try {
              const wav = await generateSpeech(topic.aiContent!.summary.join(" "));
              await setTopicAudio(supabase, today, key, wav.toString("base64"));
            } catch (error) {
              console.error("[pregenerateTodayMaterials] tts failed for topic", topic.topic, error);
            }
          }
          alreadyCached++;
          return;
        }

        try {
          // 1단계: article core (없으면 새로 만든다 — 있으면 재사용하고 건너뛴다)
          if (!hasArticleCore(topic)) {
            let articles = await fetchNaverArticles(topic.searchQuery, 5);
            if (articles.length === 0) {
              const shortQuery = topic.searchQuery.split(/[\s,·]+/).slice(0, 3).join(" ");
              articles = await fetchNaverArticles(shortQuery, 5);
            }
            if (articles.length === 0) {
              failed++;
              return;
            }

            const core = await generateArticleCore(topic.representativeTitle || topic.topic, articles);
            topic = {
              ...topic,
              aiContent: { ...core, quiz: [], blanks: [] },
              newsDescription: articles[0]?.description ?? null,
            };
            // 요약·번역·어휘·영작단어가 끝나는 즉시 저장한다 — quiz/blanks를 기다리지 않는다.
            await mergeTopicIntoCache(supabase, today, topic);
          }

          const content = topic.aiContent!;
          const needsQuiz = content.quiz.length !== 3;
          const needsBlanks = content.blanks.length !== 3;

          // 오디오는 summary만 있으면 만들 수 있어 quiz/blanks와 상관없이 독립적으로 진행한다.
          const audioPromise = getTopicAudio(supabase, today, key).then((existing) => {
            if (existing) return;
            return generateSpeech(content.summary.join(" "))
              .then((wav) => setTopicAudio(supabase, today, key, wav.toString("base64")))
              .catch((error) => {
                // 오디오 실패는 학습자료 완성 여부와 무관하다 — StudyView가 즉석 TTS로 폴백한다.
                console.error("[pregenerateTodayMaterials] tts failed for topic", topic.topic, error);
              });
          });

          const [quizResult, blanksResult] = await Promise.all([
            needsQuiz
              ? generateQuiz(topic.representativeTitle || topic.topic, content.summary).catch(
                  (error) => {
                    console.error("[pregenerateTodayMaterials] quiz failed for topic", topic.topic, error);
                    return null;
                  }
                )
              : Promise.resolve(content.quiz),
            needsBlanks
              ? generateBlanks(
                  topic.representativeTitle || topic.topic,
                  content.summary,
                  content.vocabulary
                ).catch((error) => {
                  console.error("[pregenerateTodayMaterials] blanks failed for topic", topic.topic, error);
                  return null;
                })
              : Promise.resolve(content.blanks),
          ]);

          if (quizResult && needsQuiz) {
            topic = { ...topic, aiContent: { ...topic.aiContent!, quiz: quizResult } };
            await mergeTopicIntoCache(supabase, today, topic);
          }
          if (blanksResult && needsBlanks) {
            topic = { ...topic, aiContent: { ...topic.aiContent!, blanks: blanksResult } };
            await mergeTopicIntoCache(supabase, today, topic);
          }

          await audioPromise;

          if (quizResult && blanksResult) generated++;
          else failed++;
        } catch (error) {
          console.error("[pregenerateTodayMaterials] failed for topic", topic.topic, error);
          failed++;
        }
      })
    );
  } finally {
    await setPregenerating(supabase, today, false);
  }

  return { total: topics.length, generated, alreadyCached, failed };
}

/**
 * 오늘 새벽 배치가 아직 학습자료를 만드는 중인지 확인한다.
 * true인 동안 /api/generate는 즉석 생성으로 폴백하지 않는다.
 */
export async function isTodayPregenerating(supabase: SupabaseClient): Promise<boolean> {
  return isPregenerating(supabase, getKstDateString());
}

/**
 * 오늘 캐시된 주제 중 클릭된 뉴스(representativeTitle 기준)와 일치하는 항목을 찾아
 * 미리 생성된 학습자료가 있으면 반환한다. 없으면 null(호출부가 즉석 생성으로 폴백).
 * 오디오는 daily_topics와 별도 테이블에 있으므로, 이 한 건에 대해서만 따로 조회해 붙인다
 * (홈 화면의 getCachedTopicsForDate 호출까지 오디오가 딸려가 커지는 걸 막기 위함).
 */
export async function findPregeneratedMaterial(
  supabase: SupabaseClient,
  representativeTitle: string
): Promise<(TopicCandidate & { audioBase64?: string | null }) | null> {
  const today = getKstDateString();
  const cached = await getCachedTopicsForDate(supabase, today);
  if (!cached) return null;

  const match = cached.find((t) => t.representativeTitle === representativeTitle);
  // 스키마가 바뀌기 전에 캐싱된 항목은 무효로 보고 즉석 생성으로 폴백한다.
  if (!match || !hasCompleteAiContent(match)) return null;

  const audioBase64 = await getTopicAudio(supabase, today, representativeTitle);
  return { ...match, audioBase64 };
}

/**
 * 즉석 생성(on-demand) 경로에서 만든 학습자료를 daily_topics 캐시에 되돌려 쓴다.
 * 이게 없으면 다음 방문자와 새벽 pregenerate 배치가 이미 만든 걸 모르고 또 생성해
 * API 호출이 낭비되고, 같은 뉴스인데 방문마다 내용이 달라질 수 있다.
 */
export async function cacheOnDemandMaterial(
  supabase: SupabaseClient,
  representativeTitle: string,
  aiContent: AiContent,
  newsDescription: string | null
): Promise<void> {
  const today = getKstDateString();
  const cached = await getCachedTopicsForDate(supabase, today);
  if (!cached) return;

  const index = cached.findIndex((t) => t.representativeTitle === representativeTitle);
  if (index === -1 || hasCompleteAiContent(cached[index])) return;

  cached[index] = { ...cached[index], aiContent, newsDescription };
  await cacheTopicsForDate(supabase, today, cached);
  // 지문(summary)이 방금 바뀌었으니, 옛 지문을 읽던 오디오가 있다면 지운다 —
  // 안 지우면 다음 방문자가 새 지문 화면에서 옛 오디오를 듣게 된다.
  await deleteTopicAudio(supabase, today, representativeTitle);
}
