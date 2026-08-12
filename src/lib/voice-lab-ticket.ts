import { createHmac, randomUUID } from "node:crypto";

export const VOICE_LAB_TICKET_TTL_SECONDS = 5 * 60;

type VoiceLabTicketPayload = {
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

function getSigningSecret() {
  const secret = process.env.VOICE_LAB_SHARED_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("VOICE_LAB_SHARED_SECRET must contain at least 32 characters.");
  }
  return secret;
}

export function createVoiceLabTicket(input: {
  userId: string;
  sessionId: string;
  origin: string;
}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: VoiceLabTicketPayload = {
    v: 1,
    iss: "daily-english-hub",
    aud: "daily-english-voice-lab",
    sub: input.userId,
    sid: input.sessionId,
    origin: input.origin,
    iat: issuedAt,
    exp: issuedAt + VOICE_LAB_TICKET_TTL_SECONDS,
    jti: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}
