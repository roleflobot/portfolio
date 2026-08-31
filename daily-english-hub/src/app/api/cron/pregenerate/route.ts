import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pregenerateTodayMaterials } from "@/lib/topics-service";

export const dynamic = "force-dynamic";
// Hobby 플랜에서 Fluid Compute 적용 시 허용되는 최대치(300초)로 설정한다.
// 이전엔 60초로 제한돼 있어 5개 토픽을 다 처리하기 전에 함수가 강제 종료될 수 있었다.
export const maxDuration = 300;

/**
 * 매일 새벽 3시(KST, vercel.json에 UTC 18:00으로 등록)에 Vercel Cron이 호출한다.
 * 오늘 5개 주제의 학습자료를 미리 생성해 daily_topics에 저장해두면,
 * 학습자가 처음 클릭했을 때 Gemini 응답을 기다리지 않고 바로 열람할 수 있다.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const result = await pregenerateTodayMaterials(supabase);
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error("[/api/cron/pregenerate]", error);
    const message =
      error instanceof Error ? error.message : "사전 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
