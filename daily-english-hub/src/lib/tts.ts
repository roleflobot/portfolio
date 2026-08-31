const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_VOICE = "Kore";

/** Gemini TTS는 헤더 없는 raw PCM을 base64로 준다 — 브라우저에서 바로 재생 가능하도록 WAV로 감싼다. */
function pcmToWav(pcm: Buffer, sampleRate: number, numChannels = 1, bitDepth = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

/** 지문 텍스트를 Gemini TTS로 읽어 WAV 오디오 버퍼를 반환한다. */
export async function generateSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API 키가 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 채워주세요.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } },
        },
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini TTS 호출 실패 (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0];
  const base64: string | undefined = part?.inlineData?.data;
  const mimeType: string = part?.inlineData?.mimeType ?? "audio/L16;rate=24000";

  if (!base64) {
    throw new Error("TTS 응답에서 오디오 데이터를 찾지 못했습니다.");
  }

  const rateMatch = mimeType.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

  return pcmToWav(Buffer.from(base64, "base64"), sampleRate);
}
