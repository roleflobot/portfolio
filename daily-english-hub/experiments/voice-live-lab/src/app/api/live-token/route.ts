import { GoogleGenAI, Modality, type LiveConnectConfig } from "@google/genai";
import { verifyVoiceLabTicket } from "@/lib/access-ticket";
import { buildTutorSystemInstruction } from "@/lib/tutor-prompt";
import { parseVoiceLearningContext } from "@/lib/voice-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 8;
const requestBuckets = new Map<string, number[]>();
const usedTickets = new Map<string, number>();

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (requestBuckets.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  requestBuckets.set(key, recent);

  if (requestBuckets.size > 500) {
    for (const [bucketKey, times] of requestBuckets) {
      if (times.every((time) => now - time >= WINDOW_MS)) requestBuckets.delete(bucketKey);
    }
  }

  return recent.length > MAX_REQUESTS;
}

function claimTicket(jti: string, expiresAt: number) {
  const now = Date.now();
  for (const [ticketId, expiry] of usedTickets) {
    if (expiry <= now) usedTickets.delete(ticketId);
  }
  if (usedTickets.has(jti)) return false;
  usedTickets.set(jti, expiresAt * 1000);
  return true;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) {
    return Response.json({ error: "허용되지 않은 요청 출처입니다." }, { status: 403 });
  }

  const authorization = request.headers.get("authorization");
  const rawTicket = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!rawTicket) {
    return Response.json(
      { error: "메인 앱의 Section 6 버튼에서 인증한 뒤 이용해 주세요." },
      { status: 401 }
    );
  }

  let ticket;
  try {
    ticket = verifyVoiceLabTicket(rawTicket);
  } catch (error) {
    console.error("[/api/live-token] ticket configuration failed", error);
    return Response.json({ error: "실험 앱 인증이 아직 설정되지 않았습니다." }, { status: 503 });
  }
  if (!ticket) {
    return Response.json({ error: "접근 티켓이 올바르지 않거나 만료되었습니다." }, { status: 401 });
  }
  if (!claimTicket(ticket.jti, ticket.exp)) {
    return Response.json({ error: "이미 사용한 접근 티켓입니다." }, { status: 409 });
  }

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(clientKey)) {
    usedTickets.delete(ticket.jti);
    return Response.json(
      { error: "연결 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 64_000) {
    usedTickets.delete(ticket.jti);
    return Response.json({ error: "학습자료가 너무 큽니다." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    usedTickets.delete(ticket.jti);
    return Response.json({ error: "올바른 학습자료가 필요합니다." }, { status: 400 });
  }

  const context = parseVoiceLearningContext(
    body && typeof body === "object" ? (body as Record<string, unknown>).context : null
  );
  if (!context) {
    usedTickets.delete(ticket.jti);
    return Response.json({ error: "학습자료 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (!context.sessionId || context.sessionId !== ticket.sid) {
    usedTickets.delete(ticket.jti);
    return Response.json({ error: "학습자료와 접근 티켓이 일치하지 않습니다." }, { status: 403 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    usedTickets.delete(ticket.jti);
    return Response.json({ error: "실험 앱의 Gemini API 키가 설정되지 않았습니다." }, { status: 503 });
  }

  const configuredModel = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
  const model = /^[a-zA-Z0-9._-]+$/.test(configuredModel)
    ? configuredModel
    : "gemini-3.1-flash-live-preview";

  const vocabulary = [
    ...context.vocabulary.map((item) => item.word),
    ...context.writingWords,
  ].filter(Boolean);

  const liveConfig: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    temperature: 0.6,
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
    },
    systemInstruction: buildTutorSystemInstruction(context),
    inputAudioTranscription: {
      languageCodes: ["en-US", "ko-KR"],
      customVocabulary: vocabulary.slice(0, 40),
    },
    outputAudioTranscription: {},
    realtimeInputConfig: {
      automaticActivityDetection: {
        prefixPaddingMs: 300,
        silenceDurationMs: 800,
      },
    },
  };

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "v1alpha" },
    });
    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        expireTime: new Date(now + 4 * 60_000).toISOString(),
        liveConnectConstraints: { model, config: liveConfig },
        lockAdditionalFields: [],
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    if (!token.name) throw new Error("Gemini가 일회성 토큰을 반환하지 않았습니다.");

    return Response.json(
      { token: token.name, model, expiresInSeconds: 240 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    usedTickets.delete(ticket.jti);
    console.error("[/api/live-token]", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Live 토큰을 만들지 못했습니다." },
      { status: 502 }
    );
  }
}
