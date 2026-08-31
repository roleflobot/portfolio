import { NextResponse } from "next/server";
import { fetchNaverArticles } from "@/lib/news";
import { generateLearningMaterial } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";
import {
  findPregeneratedMaterial,
  cacheOnDemandMaterial,
  isTodayPregenerating,
} from "@/lib/topics-service";
import type { AiContent } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    topic?: unknown;
    searchQuery?: unknown;
    representativeTitle?: unknown;
    category?: unknown;
    url?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const representativeTitle =
    typeof body.representativeTitle === "string"
      ? body.representativeTitle.trim()
      : "";
  const searchQuery =
    typeof body.searchQuery === "string" && body.searchQuery.trim()
      ? body.searchQuery.trim()
      : representativeTitle || topic;
  const url = typeof body.url === "string" ? body.url : null;
  const category = typeof body.category === "string" ? body.category : null;

  if (!topic && !representativeTitle) {
    return NextResponse.json(
      { error: "뉴스 주제를 선택해주세요." },
      { status: 400 }
    );
  }

  if (!searchQuery) {
    return NextResponse.json(
      { error: "검색어가 비어 있습니다. 다른 뉴스를 선택해주세요." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    // 새벽 배치가 이 주제를 미리 만들어뒀으면 Gemini/뉴스 API를 다시 호출하지 않고 바로 쓴다.
    const pregenerated = await findPregeneratedMaterial(
      supabase,
      representativeTitle || topic
    );

    let aiContent: AiContent;
    let newsDescription: string | null;
    let audioBase64: string | null = null;

    if (pregenerated?.aiContent) {
      aiContent = pregenerated.aiContent;
      newsDescription = pregenerated.newsDescription ?? null;
      audioBase64 = pregenerated.audioBase64 ?? null;
    } else if (await isTodayPregenerating(supabase)) {
      // 새벽 배치가 한창 학습자료를 만드는 중이면, 학습자마다 다른 버전을 보게 되는
      // 즉석 생성 대신 잠시 기다리라고 안내한다. 배치가 끝나면 자연히 위 분기로 빠진다.
      return NextResponse.json(
        {
          updating: true,
          error: "현재 학습 시스템 업데이트 중입니다. 잠시만 기다려 주세요.",
        },
        { status: 503 }
      );
    } else {
      let articles = await fetchNaverArticles(searchQuery, 5);

      if (articles.length === 0) {
        // 검색어가 너무 구체적이면 결과가 없을 수 있으므로 앞부분 키워드로 한 번 더 시도한다.
        const shortQuery = searchQuery.split(/[\s,·]+/).slice(0, 3).join(" ");
        articles = await fetchNaverArticles(shortQuery, 5);
      }

      if (articles.length === 0) {
        return NextResponse.json(
          {
            error:
              "이 주제와 관련된 뉴스 기사를 찾지 못했습니다. 다른 뉴스를 선택해주세요.",
          },
          { status: 404 }
        );
      }

      aiContent = await generateLearningMaterial(representativeTitle || topic, articles);
      newsDescription = articles[0]?.description ?? null;

      // 다음 방문자와 새벽 pregenerate 배치가 재사용할 수 있도록 캐시에 되돌려 쓴다.
      if (representativeTitle || topic) {
        await cacheOnDemandMaterial(
          supabase,
          representativeTitle || topic,
          aiContent,
          newsDescription
        );
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("learning_sessions")
      .insert({
        user_id: user?.id ?? null,
        topic: topic || null,
        category,
        news_title: representativeTitle || topic,
        news_url: url,
        news_description: newsDescription,
        ai_content: aiContent,
        audio_base64: audioBase64,
      })
      .select()
      .single();

    if (error) {
      console.error("[/api/generate] supabase insert error", error);
      return NextResponse.json(
        { error: "학습 기록 저장 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ session: data });
  } catch (error) {
    console.error("[/api/generate]", error);
    const message =
      error instanceof Error ? error.message : "학습자료 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
