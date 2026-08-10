import { NextResponse } from "next/server";
import { generateSpeech } from "@/lib/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "읽을 텍스트가 없습니다." }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "텍스트가 너무 깁니다." }, { status: 400 });
  }

  try {
    const wav = await generateSpeech(text);
    return new NextResponse(new Uint8Array(wav), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[/api/tts]", error);
    const message =
      error instanceof Error ? error.message : "음성 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
