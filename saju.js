// saju.js
// 생년월일/시간/성별을 받아 Gemini API로 간단한 사주 풀이를 요청하는 스크립트입니다.
// GEMINI_API_KEY는 saju.config.js(gitignore 처리됨)에서 불러옵니다.

const MODEL = "gemini-3.5-flash-lite"; // 토큰 절약을 위해 가볍고 저렴한 모델 사용

const form = document.getElementById("saju-form");
const resultBox = document.getElementById("result");
const todayBtn = document.getElementById("today-btn");
const todayResultBox = document.getElementById("today-result");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const birthDate = document.getElementById("birth-date").value; // YYYY-MM-DD
  const birthTime = document.getElementById("birth-time").value; // HH:MM
  const gender = document.getElementById("gender").value; // "male" | "female"

  if (!birthDate) {
    resultBox.textContent = "생년월일을 입력해주세요.";
    return;
  }

  resultBox.textContent = "사주를 보는 중...";

  try {
    const prompt = buildPrompt({ birthDate, birthTime, gender });
    const text = await askGemini(prompt);
    resultBox.textContent = text;
  } catch (error) {
    resultBox.textContent = `오류가 발생했습니다: ${error.message}`;
  }
});

todayBtn.addEventListener("click", async () => {
  const birthDate = document.getElementById("birth-date").value;
  const gender = document.getElementById("gender").value;

  if (!birthDate) {
    todayResultBox.textContent = "생년월일을 먼저 입력해주세요.";
    return;
  }

  todayResultBox.textContent = "오늘의 운세를 보는 중...";

  try {
    const todayDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const prompt = buildTodayPrompt({ birthDate, gender, todayDate });
    const text = await askGemini(prompt);
    todayResultBox.textContent = text;
  } catch (error) {
    todayResultBox.textContent = `오류가 발생했습니다: ${error.message}`;
  }
});

// 생년월일/성별과 오늘 날짜를 바탕으로 오늘의 운세 프롬프트를 구성합니다.
function buildTodayPrompt({ birthDate, gender, todayDate }) {
  const genderText = gender === "male" ? "남성" : "여성";

  return [
    "너는 사주팔자를 봐주는 전문가야. 아래 사람의 오늘 하루 운세만 짧게 봐줘.",
    `- 생년월일: ${birthDate}`,
    `- 성별: ${genderText}`,
    `- 오늘 날짜: ${todayDate}`,
    "",
    "총운, 주의할 점을 합쳐서 2~3문장으로 아주 간결하게 답해줘.",
    "재미로 보는 것이니 가볍고 핵심만 답해줘.",
  ].join("\n");
}

// 생년월일/시간/성별을 바탕으로 사주 프롬프트를 구성합니다.
function buildPrompt({ birthDate, birthTime, gender }) {
  const genderText = gender === "male" ? "남성" : "여성";
  const timeText = birthTime ? `${birthTime}` : "모름";

  return [
    "너는 사주팔자를 봐주는 전문가야. 아래 정보를 바탕으로 간단한 사주 풀이를 해줘.",
    `- 생년월일: ${birthDate}`,
    `- 태어난 시간: ${timeText}`,
    `- 성별: ${genderText}`,
    "",
    "성격, 올해의 운세, 조언을 각각 소제목으로 나눠서 총 3~4문장으로 아주 간결하게 알려줘.",
    "재미로 보는 것이니 너무 심각하지 않게, 짧고 핵심만 답해줘.",
  ].join("\n");
}

// Gemini REST API(generateContent)를 호출하고 응답 텍스트를 반환합니다.
// 토큰 사용량을 아끼기 위해 thinking을 끄고 출력 길이도 제한합니다.
async function askGemini(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 300,
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    // Gemini API가 반환하는 오류를 사람이 읽기 쉬운 형태로 보여줍니다.
    const message = data?.error?.message ?? "알 수 없는 오류";
    throw new Error(`HTTP ${response.status} - ${message}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text).filter(Boolean).join("");

  return text || "(응답이 비어있습니다)";
}
