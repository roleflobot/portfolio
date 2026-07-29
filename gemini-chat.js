// gemini-chat.js
// 사용자가 콘솔에 입력한 텍스트를 Google Gemini API로 보내고, 응답을 출력하는 최소 예제입니다.
// 실행 전 준비물: .env 파일에 GEMINI_API_KEY 설정 (.env.example 참고)

import { GoogleGenAI } from "@google/genai";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// dotenv 없이도 동작하도록, .env 파일이 있으면 직접 읽어서 환경변수로 등록합니다.
import { existsSync, readFileSync } from "node:fs";
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf-8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const [, key, value = ""] = match;
      if (!(key in process.env)) process.env[key] = value.trim();
    }
  }
}

const apiKey = process.env.GEMINI_API_KEY;

// API 키가 없으면 여기서 바로 안내하고 종료합니다. (키 값 자체는 절대 출력하지 않습니다)
if (!apiKey) {
  console.error("환경변수 GEMINI_API_KEY가 설정되어 있지 않습니다.");
  console.error(".env.example을 복사해 .env 파일을 만들고 키를 입력한 뒤 다시 실행하세요.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function main() {
  const rl = readline.createInterface({ input, output });
  const userText = await rl.question("Gemini에게 보낼 메시지를 입력하세요: ");
  rl.close();

  if (!userText.trim()) {
    console.error("빈 메시지는 보낼 수 없습니다.");
    process.exit(1);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: userText,
    });

    console.log("\n--- Gemini 응답 ---");
    console.log(response.text);
  } catch (error) {
    // Gemini API가 반환하는 오류를 사람이 읽기 쉬운 형태로 출력합니다.
    const status = error?.status ?? error?.response?.status ?? "알 수 없음";
    console.error(`\n[오류] HTTP 상태 코드: ${status}`);
    console.error(`오류 내용: ${error?.message ?? error}`);
    process.exit(1);
  }
}

main();
