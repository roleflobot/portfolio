import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SCHEMA = {
  type: "object",
  properties: {
    usedAllWords: { type: "boolean" },
    missingWords: { type: "array", items: { type: "string" } },
    corrected: { type: "string" },
    feedback: { type: "string" },
  },
  required: ["usedAllWords", "missingWords", "corrected", "feedback"],
};

const SYSTEM_PROMPT = `당신은 한국인 영어 학습자의 영작문을 채점하는 다정하지만 정확한 English tutor입니다.
학습자는 뉴스 요약 문장 1~3개(총 50단어 내외, 어렵지 않은 영어)를 직접 작성하는 과제를 받았고,
반드시 주어진 필수 단어를 전부 사용해야 합니다.

다음을 판단해 JSON으로만 답하세요:
- usedAllWords: 학습자의 문장이 주어진 필수 단어를 전부 사용했는가(단어의 형태 변화, 예: run→ran도 사용한 것으로 인정).
- missingWords: 사용하지 않은 단어 목록(다 사용했으면 빈 배열).
- corrected: 학습자의 문장을 자연스러운 영어로 다듬은 버전. 원래 의미와 사용된 단어는 최대한 유지하되,
  문법 오류를 고치고 어색한 표현을 자연스럽게 바꾼다. 이미 완벽하면 그대로 반환한다.
- feedback: 한국어로 2~3문장의 피드백. 잘한 점을 먼저 언급하고, 문법·자연스러움·내용 정확성 중
  개선할 점이 있으면 구체적으로 짚어준다. 완벽했다면 그렇게 칭찬한다. 항상 격려하는 톤을 유지한다.

절대 학습자가 쓴 언어(한국어 등)로 반말하거나 무시하는 투로 쓰지 마세요.`;

export async function POST(request: Request) {
  let body: { text?: unknown; requiredWords?: unknown; summary?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const requiredWords = Array.isArray(body.requiredWords)
    ? body.requiredWords.map((w) => String(w))
    : [];
  const summary = Array.isArray(body.summary) ? body.summary.map((s) => String(s)) : [];

  if (!text) {
    return NextResponse.json({ error: "작성한 문장이 없습니다." }, { status: 400 });
  }
  if (requiredWords.length < 1) {
    return NextResponse.json({ error: "필수 단어 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "문장이 너무 깁니다." }, { status: 400 });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API 키가 설정되지 않았습니다.");

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const userText = `뉴스 원문 요약(참고용):\n${summary.join(" ")}\n\n반드시 사용해야 할 단어 ${requiredWords.length}개:\n${requiredWords.join(", ")}\n\n학습자가 작성한 문장:\n${text}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini 호출 실패 (${res.status}): ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const rawText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Gemini 응답에서 텍스트를 찾을 수 없습니다.");

    const parsed = JSON.parse(rawText);

    return NextResponse.json({
      usedAllWords: Boolean(parsed?.usedAllWords),
      missingWords: Array.isArray(parsed?.missingWords)
        ? parsed.missingWords.map((w: unknown) => String(w))
        : [],
      corrected: String(parsed?.corrected ?? ""),
      feedback: String(parsed?.feedback ?? ""),
    });
  } catch (error) {
    console.error("[/api/writing-feedback]", error);
    const message =
      error instanceof Error ? error.message : "피드백 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
