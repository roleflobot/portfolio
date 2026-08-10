import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningSession, PartOfSpeech } from "./supabase/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 2024-01-01(UTC)은 월요일이다. 이 시점을 기준으로 몇 번째 "월요일 시작 주"인지 세면,
// "이번 주"가 매일 바뀌는 롤링 7일이 아니라 고정된 달력 주가 되어 복습 진행 상황을
// week_key로 안정적으로 저장/조회할 수 있다.
const EPOCH_MONDAY_MS = Date.UTC(2024, 0, 1);

function weekIndexOf(iso: string): number {
  const kstMs = new Date(iso).getTime() + KST_OFFSET_MS;
  return Math.floor((kstMs - EPOCH_MONDAY_MS) / WEEK_MS);
}

export type WeekBucket = {
  weekKey: string;
  weeksAgo: number;
  label: string;
  sessions: LearningSession[];
};

/** 같은 뉴스를 여러 번 학습했으면(재학습, 테스트 등) 가장 최근 것 하나만 남긴다. */
function dedupeByArticle(sessions: LearningSession[]): LearningSession[] {
  const latestByTitle = new Map<string, LearningSession>();
  for (const s of sessions) {
    const existing = latestByTitle.get(s.news_title);
    if (!existing || new Date(s.created_at) > new Date(existing.created_at)) {
      latestByTitle.set(s.news_title, s);
    }
  }
  return Array.from(latestByTitle.values());
}

/** 세션들을 달력 주(월요일 시작) 단위로 묶는다. 데이터가 있는 주만 반환한다. */
export function groupSessionsByWeek(sessions: LearningSession[]): WeekBucket[] {
  const currentWeekIndex = weekIndexOf(new Date().toISOString());
  const buckets = new Map<number, LearningSession[]>();

  for (const s of dedupeByArticle(sessions)) {
    const idx = weekIndexOf(s.created_at);
    if (!buckets.has(idx)) buckets.set(idx, []);
    buckets.get(idx)!.push(s);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([weekIndex, weekSessions]) => {
      const weeksAgo = currentWeekIndex - weekIndex;
      return {
        weekKey: `w${weekIndex}`,
        weeksAgo,
        label: weeksAgo === 0 ? "이번 주" : `${weeksAgo}주 전`,
        sessions: weekSessions,
      };
    });
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "보내다 (-sent-sent)"처럼 붙는 불규칙 동사 활용 표기를 뜻에서 떼어낸다 — 그대로 두면 답이 너무 티가 난다. */
function stripConjugationNote(meaning: string): string {
  return meaning.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export type VocabQuestion = {
  itemKey: string;
  prompt: string;
  direction: "en-ko" | "ko-en";
  options: string[];
  answer: string;
};

type VocabCandidate = { word: string; meaning: string; pos?: PartOfSpeech };

function buildVocabCandidates(sessions: LearningSession[]): VocabCandidate[] {
  const pool = sessions
    .flatMap((s) => s.ai_content?.vocabulary ?? [])
    .map((v) => ({ word: v.word, meaning: stripConjugationNote(v.meaning), pos: v.pos }));
  return Array.from(new Map(pool.map((v) => [v.word.toLowerCase(), v])).values());
}

/**
 * 오답 보기를 정답과 같은 품사에서 우선 뽑는다 — 다르면 학습자가 뜻은 몰라도 품사만 보고
 * "이건 답이 아니네"라고 너무 쉽게 골라낼 수 있다. 같은 품사가 3개보다 적으면(옛날 세션처럼
 * pos가 없는 경우 포함) 부족한 만큼만 다른 품사에서 채워 화면이 비지 않게 한다.
 */
function pickDistractors<T extends { pos?: PartOfSpeech }>(
  pool: T[],
  answerPos: PartOfSpeech | undefined,
  count: number
): T[] {
  const samePos = answerPos ? pool.filter((v) => v.pos === answerPos) : [];
  const rest = pool.filter((v) => !samePos.includes(v));
  const picked = shuffle(samePos).slice(0, count);
  if (picked.length < count) {
    picked.push(...shuffle(rest).slice(0, count - picked.length));
  }
  return picked;
}

function toVocabQuestion(item: VocabCandidate, unique: VocabCandidate[]): VocabQuestion {
  const direction: "en-ko" | "ko-en" = Math.random() < 0.5 ? "en-ko" : "ko-en";
  const answer = direction === "en-ko" ? item.meaning : item.word;
  const distractors = pickDistractors(
    unique.filter((v) => v.word !== item.word),
    item.pos,
    3
  ).map((v) => (direction === "en-ko" ? v.meaning : v.word));

  return {
    itemKey: item.word.toLowerCase(),
    prompt: direction === "en-ko" ? item.word : item.meaning,
    direction,
    options: shuffle([answer, ...distractors]),
    answer,
  };
}

export type BlankQuestion = {
  itemKey: string;
  sentence: string;
  options: string[];
  answer: string;
  translation: string;
};

type BlankCandidate = {
  itemKey: string;
  sentence: string;
  answer: string;
  answerPos?: PartOfSpeech;
  translation: string;
};

function buildBlankCandidates(sessions: LearningSession[]): BlankCandidate[] {
  const vocabPool = Array.from(
    new Map(
      sessions
        .flatMap((s) => s.ai_content?.vocabulary ?? [])
        .map((v) => [v.word.toLowerCase(), v])
    ).values()
  );
  if (vocabPool.length < 2) return [];

  const candidates: BlankCandidate[] = [];

  for (const s of sessions) {
    const sentences = s.ai_content?.summary ?? [];
    sentences.forEach((sentence, i) => {
      for (const vocab of vocabPool) {
        const re = new RegExp(`\\b${escapeRegExp(vocab.word)}\\b`, "i");
        const match = sentence.match(re);
        if (!match) continue;

        candidates.push({
          itemKey: `${s.id}:${i}`,
          sentence: sentence.replace(re, "______"),
          // 정답만 원문 그대로의 대소문자를 유지하면 답이 티가 나므로 소문자로 통일한다.
          answer: match[0].toLowerCase(),
          answerPos: vocab.pos,
          translation: s.ai_content.translation?.[i] ?? s.news_title,
        });
        break;
      }
    });
  }

  return candidates;
}

function toBlankQuestion(
  item: BlankCandidate,
  vocabPool: { word: string; pos?: PartOfSpeech }[]
): BlankQuestion {
  const distractors = pickDistractors(
    vocabPool.filter((v) => v.word.toLowerCase() !== item.answer.toLowerCase()),
    item.answerPos,
    3
  ).map((v) => v.word.toLowerCase());

  return {
    itemKey: item.itemKey,
    sentence: item.sentence,
    options: shuffle([item.answer, ...distractors]),
    answer: item.answer,
    translation: item.translation,
  };
}

/**
 * 이미 출제된 항목(item_key)은 review_progress에서 조회해 제외하고 무작위로 count개를 뽑는다.
 * 중복 없이 낼 수 있는 만큼 남지 않으면(< count), 그 주/종류의 출제 기록을 초기화하고
 * 처음부터 다시 무작위 + 중복 금지를 수행한다.
 */
async function pickWithoutRepeat<T extends { itemKey: string }>(
  supabase: SupabaseClient,
  userId: string,
  weekKey: string,
  kind: "vocab" | "blank",
  candidates: T[],
  count: number
): Promise<T[]> {
  if (candidates.length === 0) return [];

  const { data: seenRows } = await supabase
    .from("review_progress")
    .select("item_key")
    .eq("user_id", userId)
    .eq("week_key", weekKey)
    .eq("kind", kind);

  const seen = new Set((seenRows ?? []).map((r) => r.item_key as string));
  let pool = candidates.filter((c) => !seen.has(c.itemKey));

  if (pool.length < Math.min(count, candidates.length)) {
    await supabase
      .from("review_progress")
      .delete()
      .eq("user_id", userId)
      .eq("week_key", weekKey)
      .eq("kind", kind);
    pool = candidates;
  }

  const picked = shuffle(pool).slice(0, Math.min(count, pool.length));

  if (picked.length > 0) {
    await supabase.from("review_progress").insert(
      picked.map((c) => ({
        user_id: userId,
        week_key: weekKey,
        kind,
        item_key: c.itemKey,
      }))
    );
  }

  return picked;
}

/** 뜻 맞추기 / 영단어 고르기를 섞어서 낸다. 같은 주 안에서는 다 낼 때까지 중복 없이 낸다. */
export async function getVocabReview(
  supabase: SupabaseClient,
  userId: string,
  weekKey: string,
  sessions: LearningSession[],
  count = 8
): Promise<VocabQuestion[]> {
  const candidates = buildVocabCandidates(sessions);
  const picked = await pickWithoutRepeat(
    supabase,
    userId,
    weekKey,
    "vocab",
    candidates.map((c) => ({ ...c, itemKey: c.word.toLowerCase() })),
    count
  );
  return picked.map((item) => toVocabQuestion(item, candidates));
}

/** 예전 뉴스 지문 원문(summary) 그대로, 배운 단어가 나온 문장을 빈칸으로 낸다. 중복 방지는 동일. */
export async function getBlankReview(
  supabase: SupabaseClient,
  userId: string,
  weekKey: string,
  sessions: LearningSession[],
  count = 5
): Promise<BlankQuestion[]> {
  const vocabPool = Array.from(
    new Map(
      sessions
        .flatMap((s) => s.ai_content?.vocabulary ?? [])
        .map((v) => [v.word.toLowerCase(), { word: v.word, pos: v.pos }])
    ).values()
  );
  const candidates = buildBlankCandidates(sessions);
  const picked = await pickWithoutRepeat(
    supabase,
    userId,
    weekKey,
    "blank",
    candidates,
    count
  );
  return picked.map((item) => toBlankQuestion(item, vocabPool));
}
