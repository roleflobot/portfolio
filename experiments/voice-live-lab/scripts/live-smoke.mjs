import { createHmac, randomUUID } from "node:crypto";
import { GoogleGenAI, Modality } from "@google/genai";

const baseUrl = process.env.LAB_URL || "http://127.0.0.1:3001";
const labOrigin = new URL(baseUrl).origin;
const mainOrigin =
  process.env.MAIN_APP_ORIGIN ||
  process.env.NEXT_PUBLIC_MAIN_APP_ORIGIN ||
  "http://localhost:3000";
const sharedSecret = process.env.VOICE_LAB_SHARED_SECRET;
if (!sharedSecret || sharedSecret.length < 32) {
  throw new Error("VOICE_LAB_SHARED_SECRET is required for the authenticated smoke test");
}

const context = {
  sessionId: randomUUID(),
  newsTitle: "Cities open cooling centers during a heat wave",
  category: "Society",
  summary: [
    "Cities opened more cooling centers during record heat.",
    "Officials asked residents to check on older neighbors.",
  ],
  translation: [],
  vocabulary: [{ word: "resident", meaning: "주민" }],
  quiz: [
    {
      question: "Cities closed all cooling centers.",
      answer: false,
      explanation: "They opened more centers.",
      hints: [],
    },
  ],
  blanks: [
    {
      sentence: "Cities opened more ______ centers.",
      options: ["cooling", "shopping", "music", "travel"],
      answer: "cooling",
      translation: "도시들은 더 많은 무더위 쉼터를 열었습니다.",
      hints: [],
    },
  ],
  writingWords: ["cities", "heat"],
};

const issuedAt = Math.floor(Date.now() / 1000);
const encodedPayload = Buffer.from(
  JSON.stringify({
    v: 1,
    iss: "daily-english-hub",
    aud: "daily-english-voice-lab",
    sub: "live-smoke-test",
    sid: context.sessionId,
    origin: mainOrigin,
    iat: issuedAt,
    exp: issuedAt + 300,
    jti: randomUUID(),
  })
).toString("base64url");
const signature = createHmac("sha256", sharedSecret)
  .update(encodedPayload)
  .digest("base64url");
const accessTicket = `${encodedPayload}.${signature}`;

const tokenResponse = await fetch(`${baseUrl}/api/live-token`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessTicket}`,
    "Content-Type": "application/json",
    Origin: labOrigin,
  },
  body: JSON.stringify({ context }),
});
const tokenData = await tokenResponse.json();
if (!tokenResponse.ok || !tokenData.token || !tokenData.model) {
  throw new Error(tokenData.error || "Token endpoint failed");
}

const ai = new GoogleGenAI({
  apiKey: tokenData.token,
  httpOptions: { apiVersion: "v1alpha" },
});

let audioBytes = 0;
let outputTranscript = "";
let resolveTurn;
let rejectTurn;
const turnFinished = new Promise((resolve, reject) => {
  resolveTurn = resolve;
  rejectTurn = reject;
});
const timeout = setTimeout(() => rejectTurn(new Error("Live response timed out")), 60_000);

const session = await ai.live.connect({
  model: tokenData.model,
  config: {
    responseModalities: [Modality.AUDIO],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  },
  callbacks: {
    onmessage(message) {
      for (const part of message.serverContent?.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) audioBytes += Buffer.from(part.inlineData.data, "base64").length;
      }
      if (message.serverContent?.outputTranscription?.text) {
        outputTranscript += message.serverContent.outputTranscription.text;
      }
      if (message.serverContent?.turnComplete) resolveTurn();
    },
    onerror(event) {
      rejectTurn(event.error || new Error(event.message || "Live socket error"));
    },
    onclose() {},
  },
});

session.sendClientContent({
  turns: "Begin now with one brief greeting and the first news question.",
  turnComplete: true,
});

try {
  await turnFinished;
} finally {
  clearTimeout(timeout);
  session.close();
}

if (audioBytes === 0) throw new Error("Live API returned no audio");

console.log(`LIVE_MODEL=${tokenData.model}`);
console.log(`LIVE_AUDIO_BYTES=${audioBytes}`);
console.log(`LIVE_TRANSCRIPT_PRESENT=${Boolean(outputTranscript.trim())}`);
