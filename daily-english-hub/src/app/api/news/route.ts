import { NextResponse } from "next/server";
import { fetchTopHeadlines } from "@/lib/news";
import { selectTopTopics, type TopicCandidate } from "@/lib/gemini";
import {
  getCachedTopicsForDate,
  cacheTopicsForDate,
  getRecentDaysTopics,
} from "@/lib/supabase/topics";
import { createClient } from "@/lib/supabase/server";
import { getKstDateString } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const today = getKstDateString();

  // 오늘 이미 선정된 5개가 있으면 재사용한다 — 모든 사용자가 같은 날 같은 5개를 본다.
  const cached = await getCachedTopicsForDate(supabase, today);
  if (cached && cached.length === 5) {
    return NextResponse.json({ topics: cached, usedFallback: false, cached: true });
  }

  let headlines;
  try {
    headlines = await fetchTopHeadlines(30);
  } catch (error) {
    console.error("[/api/news] RSS fetch failed", error);
    return NextResponse.json(
      { error: "오늘의 뉴스를 가져오지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 502 }
    );
  }

  if (headlines.length === 0) {
    return NextResponse.json(
      { error: "오늘의 뉴스를 가져오지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 502 }
    );
  }

  let topics: TopicCandidate[];
  let usedFallback = false;

  try {
    const recentTopics = await getRecentDaysTopics(supabase, 3);
    topics = await selectTopTopics(headlines, recentTopics);
  } catch (error) {
    // Gemini 주제 선정 실패 시 exact-title dedup 결과를 그대로 사용한다 (rule-based fallback).
    console.error("[/api/news] Gemini topic selection failed, falling back", error);
    usedFallback = true;
    topics = headlines.slice(0, 5).map((h) => ({
      topic: h.title,
      searchQuery: h.title,
      representativeTitle: h.title,
      category: "사회" as const,
      url: h.url,
    }));
  }

  // 캐시 저장은 best-effort — 실패해도 오늘 화면에 보여줄 topics 자체는 이미 확보했으므로 응답은 그대로 반환한다.
  await cacheTopicsForDate(supabase, today, topics);

  return NextResponse.json({ topics, usedFallback, cached: false });
}
