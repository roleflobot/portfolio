import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_TICKET_LIFETIME_SECONDS = 5 * 60;

export type VoiceLabTicketPayload = {
  v: 1;
  iss: "daily-english-hub";
  aud: "daily-english-voice-lab";
  sub: string;
  sid: string;
  origin: string;
  iat: number;
  exp: number;
  jti: string;
};

export function configuredMainOrigin() {
  const value = process.env.NEXT_PUBLIC_MAIN_APP_ORIGIN?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== value) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function verifyVoiceLabTicket(ticket: string): VoiceLabTicketPayload | null {
  const secret = process.env.VOICE_LAB_SHARED_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("VOICE_LAB_SHARED_SECRET must contain at least 32 characters.");
  }

  const [encodedPayload, encodedSignature, extra] = ticket.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;

  const actual = Buffer.from(encodedSignature, "base64url");
  const expected = createHmac("sha256", secret).update(encodedPayload).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<VoiceLabTicketPayload>;
    const now = Math.floor(Date.now() / 1000);
    const mainOrigin = configuredMainOrigin();

    if (
      payload.v !== 1 ||
      payload.iss !== "daily-english-hub" ||
      payload.aud !== "daily-english-voice-lab" ||
      typeof payload.sub !== "string" ||
      !payload.sub ||
      payload.sub.length > 100 ||
      typeof payload.sid !== "string" ||
      !payload.sid ||
      payload.sid.length > 100 ||
      typeof payload.jti !== "string" ||
      !payload.jti ||
      payload.jti.length > 100 ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.iat > now + 30 ||
      payload.exp <= now ||
      payload.exp - payload.iat > MAX_TICKET_LIFETIME_SECONDS ||
      !mainOrigin ||
      payload.origin !== mainOrigin
    ) {
      return null;
    }

    return payload as VoiceLabTicketPayload;
  } catch {
    return null;
  }
}
