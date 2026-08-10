import type { SupabaseClient } from "@supabase/supabase-js";
import type { TopicCandidate } from "../gemini";

/**
 * 오늘(KST) 하루 동안 보여줄 주제 5개를 daily_topics 캐시에서 조회한다.
 *
 * 여러 사용자가 같은 날 각자 홈 화면을 열 때마다 Gemini를 다시 호출하면
 * (1) 비용이 늘고 (2) 같은 날인데도 사용자마다 다른 5개가 보이는 문제가 생긴다.
 * 그래서 "오늘의 뉴스 5개"는 하루 단위로 한 번만 선정해 캐싱하고 모든 사용자가 공유한다.
 */
export async function getCachedTopicsForDate(
  client: SupabaseClient,
  date: string
): Promise<TopicCandidate[] | null> {
  try {
    const { data, error } = await client
      .from("daily_topics")
      .select("topics")
      .eq("date", date)
      .maybeSingle();

    if (error || !data) return null;
    return data.topics as TopicCandidate[];
  } catch (error) {
    console.error("[getCachedTopicsForDate]", error);
    return null;
  }
}

export async function cacheTopicsForDate(
  client: SupabaseClient,
  date: string,
  topics: TopicCandidate[]
): Promise<void> {
  try {
    await client.from("daily_topics").upsert({ date, topics }, { onConflict: "date" });
  } catch (error) {
    console.error("[cacheTopicsForDate]", error);
  }
}

/**
 * 새벽 pregenerate 배치가 진행 중인지 표시한다.
 * 이 값이 true인 동안 /api/generate는 즉석 생성으로 폴백하지 않고
 * "업데이트 중" 안내를 보여줘, 학습자마다 다른 자료를 보는 상황을 막는다.
 */
export async function setPregenerating(
  client: SupabaseClient,
  date: string,
  value: boolean
): Promise<void> {
  try {
    await client
      .from("daily_topics")
      .upsert({ date, is_pregenerating: value }, { onConflict: "date" });
  } catch (error) {
    console.error("[setPregenerating]", error);
  }
}

/** 마이그레이션 전이거나 조회 실패 시에는 안전하게 false(막지 않음)로 취급한다. */
export async function isPregenerating(
  client: SupabaseClient,
  date: string
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from("daily_topics")
      .select("is_pregenerating")
      .eq("date", date)
      .maybeSingle();

    if (error || !data) return false;
    return !!data.is_pregenerating;
  } catch (error) {
    console.error("[isPregenerating]", error);
    return false;
  }
}

/**
 * TTS 오디오는 daily_topics.topics(jsonb)에 같이 넣지 않고 별도 테이블에 둔다.
 * 홈 화면(/api/news)은 매 방문마다 topics 전체를 읽는데, 오디오(약 200~300KB/개)를
 * 같이 넣으면 그 큰 값을 아무도 안 쓰는 홈 화면 요청마다 매번 전송하게 되어
 * (5개 x 250KB ≈ 1.2MB) 눈에 띄게 느려진다. 실제로 오디오가 필요한 시점
 * (특정 주제를 클릭해 세션을 만들 때)에만 이 테이블에서 그 한 건만 조회한다.
 */
export async function getTopicAudio(
  client: SupabaseClient,
  date: string,
  representativeTitle: string
): Promise<string | null> {
  try {
    const { data, error } = await client
      .from("topic_audio")
      .select("audio_base64")
      .eq("date", date)
      .eq("representative_title", representativeTitle)
      .maybeSingle();

    if (error || !data) return null;
    return data.audio_base64 as string;
  } catch (error) {
    console.error("[getTopicAudio]", error);
    return null;
  }
}

export async function setTopicAudio(
  client: SupabaseClient,
  date: string,
  representativeTitle: string,
  audioBase64: string
): Promise<void> {
  try {
    await client
      .from("topic_audio")
      .upsert(
        { date, representative_title: representativeTitle, audio_base64: audioBase64 },
        { onConflict: "date,representative_title" }
      );
  } catch (error) {
    console.error("[setTopicAudio]", error);
  }
}

/** aiContent(지문)가 다시 만들어져 문장이 바뀌었을 때, 안 맞게 된 옛 오디오를 지운다. */
export async function deleteTopicAudio(
  client: SupabaseClient,
  date: string,
  representativeTitle: string
): Promise<void> {
  try {
    await client
      .from("topic_audio")
      .delete()
      .eq("date", date)
      .eq("representative_title", representativeTitle);
  } catch (error) {
    console.error("[deleteTopicAudio]", error);
  }
}

/**
 * 새로 완성된 학습자료 하나를 캐시에 즉시 병합해 저장한다.
 * 5개 토픽을 전부 만든 뒤 한 번에 저장하면, 그 전에 함수가 타임아웃 등으로 중단될 경우
 * 이미 완성된 토픽까지 통째로 사라진다 — 그래서 토픽 하나가 끝날 때마다 바로 호출한다.
 * 병합 직전에 캐시를 다시 읽어와, 동시에 끝나는 다른 토픽의 저장과 덮어쓰기 충돌할
 * 가능성을 최소화한다(완전히 없애려면 DB 쪽 원자적 업데이트가 필요하지만, 하루 5개
 * 규모에서는 이 정도로 충분하다).
 */
export async function mergeTopicIntoCache(
  client: SupabaseClient,
  date: string,
  updatedTopic: TopicCandidate
): Promise<void> {
  try {
    const cached = await getCachedTopicsForDate(client, date);
    if (!cached) return;

    const index = cached.findIndex(
      (t) => t.representativeTitle === updatedTopic.representativeTitle
    );
    if (index === -1) return;

    cached[index] = updatedTopic;
    await cacheTopicsForDate(client, date, cached);
  } catch (error) {
    console.error("[mergeTopicIntoCache]", error);
  }
}

/**
 * 오늘의 주제 선정에서 "어제와 사실상 같은 뉴스" 반복을 피하는 참고용 목록.
 * learning_sessions(실제로 학습한 것)가 아니라 daily_topics(그날 보여준 5개 전체)를 기준으로 삼는다 —
 * 사용자가 많아지면 "누군가 학습한 것"만으로는 그날 노출된 나머지 주제들을 놓치기 때문이다.
 * 오늘 캐시가 아직 없는 상태에서 호출되므로 결과에는 지난 며칠치만 담긴다.
 */
export async function getRecentDaysTopics(
  client: SupabaseClient,
  days = 3
): Promise<string[]> {
  try {
    const { data, error } = await client
      .from("daily_topics")
      .select("topics")
      .order("date", { ascending: false })
      .limit(days);

    if (error || !data) return [];

    return data.flatMap((row) =>
      (row.topics as TopicCandidate[]).map((t) => t.topic)
    );
  } catch (error) {
    console.error("[getRecentDaysTopics]", error);
    return [];
  }
}
