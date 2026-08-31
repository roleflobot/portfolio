import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createVoiceLabTicket,
  VOICE_LAB_TICKET_TTL_SECONDS,
} from "@/lib/voice-lab-ticket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 2_000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failedAttempts = new Map<string, number[]>();

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function recentFailures(key: string) {
  const now = Date.now();
  const recent = (failedAttempts.get(key) ?? []).filter(
    (time) => now - time < FAILURE_WINDOW_MS
  );
  if (recent.length > 0) failedAttempts.set(key, recent);
  else failedAttempts.delete(key);
  return recent;
}

function recordFailure(key: string) {
  failedAttempts.set(key, [...recentFailures(key), Date.now()]);
}

function accessCodeMatches(accessCode: string) {
  const expectedHex = process.env.VOICE_LAB_ACCESS_CODE_HASH?.trim().toLowerCase();
  if (!expectedHex || !/^[a-f0-9]{64}$/.test(expectedHex)) {
    throw new Error("VOICE_LAB_ACCESS_CODE_HASH is not configured.");
  }

  const actual = createHash("sha256").update(accessCode, "utf8").digest();
  const expected = Buffer.from(expectedHex, "hex");
  return timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  if (request.headers.get("origin") !== requestOrigin) {
    return json({ error: "허용되지 않은 요청 출처입니다." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "요청이 너무 큽니다." }, 413);
  }

  let sessionId = "";
  let accessCode = "";
  try {
    const body = (await request.json()) as { sessionId?: unknown; accessCode?: unknown };
    sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    accessCode = typeof body.accessCode === "string" ? body.accessCode.trim() : "";
  } catch {
    return json({ error: "올바른 요청이 필요합니다." }, 400);
  }

  if (!sessionId || sessionId.length > 100 || !accessCode || accessCode.length > 100) {
    return json({ error: "학습 세션과 Section 6 접근 코드를 확인해 주세요." }, 400);
  }

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (recentFailures(clientKey).length >= MAX_FAILURES) {
    return json({ error: "코드 입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요." }, 429);
  }

  try {
    if (!accessCodeMatches(accessCode)) {
      recordFailure(clientKey);
      return json({ error: "Section 6 접근 코드가 올바르지 않습니다." }, 401);
    }
  } catch (error) {
    console.error("[/api/voice-lab-ticket] access code configuration failed", error);
    return json({ error: "Section 6 접근 코드가 아직 설정되지 않았습니다." }, 503);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return json({ error: "메인 앱에서 학습 세션을 연 뒤 다시 시도해 주세요." }, 401);
  }

  const { data: ownedSession, error: sessionError } = await supabase
    .from("learning_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sessionError) {
    console.error("[/api/voice-lab-ticket] session lookup failed", sessionError);
    return json({ error: "학습 세션을 확인하지 못했습니다." }, 500);
  }
  if (!ownedSession) {
    return json({ error: "이 학습자료에 접근할 권한이 없습니다." }, 403);
  }

  try {
    failedAttempts.delete(clientKey);
    return json({
      ticket: createVoiceLabTicket({ userId: user.id, sessionId, origin: requestOrigin }),
      expiresInSeconds: VOICE_LAB_TICKET_TTL_SECONDS,
    });
  } catch (error) {
    console.error("[/api/voice-lab-ticket] ticket creation failed", error);
    return json({ error: "음성 실험실 인증이 아직 설정되지 않았습니다." }, 503);
  }
}
