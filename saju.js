// saju.js
// 사주 풀이 / 오늘의 운세 / 고민 상담 / 행운의 음식을 FastAPI 서버(main.py)에 요청하는 스크립트입니다.
// Gemini API 호출과 GEMINI_API_KEY는 전부 서버 쪽에만 있고, 이 파일은 서버의 /api/* 엔드포인트만 호출합니다.

const form = document.getElementById("saju-form");
const resultBox = document.getElementById("result");
const todayBtn = document.getElementById("today-btn");
const todayResultBox = document.getElementById("today-result");
const worryBtn = document.getElementById("worry-btn");
const worryInput = document.getElementById("worry-input");
const worryResultBox = document.getElementById("worry-result");
const foodBtn = document.getElementById("food-btn");
const citySelect = document.getElementById("city-select");
const foodResultBox = document.getElementById("food-result");
const quoteBtn = document.getElementById("quote-btn");
const quoteResultBox = document.getElementById("quote-result");

// HTML 특수문자를 이스케이프해서 innerHTML에 안전하게 넣을 수 있게 합니다.
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Gemini 응답의 소제목(#)/굵게(**)/목록(*)/줄바꿈만 간단히 HTML로 변환합니다. (가벼운 마크다운 렌더링)
function renderMarkup(text) {
  return escapeHtml(text)
    .replace(/^#{1,6}\s+(.+)$/gm, "<strong>$1</strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^\* /gm, "• ")
    .replace(/\n/g, "<br>");
}

// 결과 박스에 로딩/에러 상태를 표시하는 작은 헬퍼입니다.
function setBoxState(box, text, state) {
  box.innerHTML = renderMarkup(text);
  box.classList.remove("loading", "error");
  if (state) box.classList.add(state);
}

// 서버의 /api/* 엔드포인트를 호출하고 결과 텍스트를 반환합니다.
async function callApi(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail ?? `HTTP ${response.status}`);
  }

  return data.text;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const birthDate = document.getElementById("birth-date").value;
  const birthTime = document.getElementById("birth-time").value;
  const gender = document.getElementById("gender").value;

  if (!birthDate) {
    setBoxState(resultBox, "생년월일을 입력해주세요.", "error");
    return;
  }

  setBoxState(resultBox, "사주를 보는 중...", "loading");

  try {
    const text = await callApi("/api/saju", { birthDate, birthTime, gender });
    setBoxState(resultBox, text);
  } catch (error) {
    setBoxState(resultBox, `오류가 발생했습니다: ${error.message}`, "error");
  }
});

todayBtn.addEventListener("click", async () => {
  const birthDate = document.getElementById("birth-date").value;
  const gender = document.getElementById("gender").value;

  if (!birthDate) {
    setBoxState(todayResultBox, "생년월일을 먼저 입력해주세요.", "error");
    return;
  }

  setBoxState(todayResultBox, "오늘의 운세를 보는 중...", "loading");

  try {
    const text = await callApi("/api/today", { birthDate, gender });
    setBoxState(todayResultBox, text);
  } catch (error) {
    setBoxState(todayResultBox, `오류가 발생했습니다: ${error.message}`, "error");
  }
});

worryBtn.addEventListener("click", async () => {
  const birthDate = document.getElementById("birth-date").value;
  const gender = document.getElementById("gender").value;
  const worry = worryInput.value.trim();

  if (!birthDate) {
    setBoxState(worryResultBox, "위 '사주 보기'에 생년월일을 먼저 입력해주세요.", "error");
    return;
  }

  if (!worry) {
    setBoxState(worryResultBox, "고민 내용을 입력해주세요.", "error");
    return;
  }

  setBoxState(worryResultBox, "사주를 바탕으로 상담하는 중...", "loading");

  try {
    const text = await callApi("/api/worry", { birthDate, gender, worry });
    setBoxState(worryResultBox, text);
  } catch (error) {
    setBoxState(worryResultBox, `오류가 발생했습니다: ${error.message}`, "error");
  }
});

quoteBtn.addEventListener("click", async () => {
  const birthDate = document.getElementById("birth-date").value;
  const gender = document.getElementById("gender").value;

  if (!birthDate) {
    setBoxState(quoteResultBox, "생년월일을 먼저 입력해주세요.", "error");
    return;
  }

  setBoxState(quoteResultBox, "오늘의 한마디를 준비하는 중...", "loading");

  try {
    const text = await callApi("/api/quote", { birthDate, gender });
    setBoxState(quoteResultBox, text);
  } catch (error) {
    setBoxState(quoteResultBox, `오류가 발생했습니다: ${error.message}`, "error");
  }
});

foodBtn.addEventListener("click", async () => {
  const birthDate = document.getElementById("birth-date").value;
  const gender = document.getElementById("gender").value;
  const city = citySelect.value;

  if (!birthDate) {
    setBoxState(foodResultBox, "생년월일을 먼저 입력해주세요.", "error");
    return;
  }

  setBoxState(foodResultBox, "날씨를 확인하고 음식을 추천하는 중...", "loading");

  try {
    const text = await callApi("/api/food", { birthDate, gender, city });
    setBoxState(foodResultBox, text);
  } catch (error) {
    setBoxState(foodResultBox, `오류가 발생했습니다: ${error.message}`, "error");
  }
});
