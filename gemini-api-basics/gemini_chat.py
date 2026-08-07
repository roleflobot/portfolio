# gemini_chat.py
# 고정된 프롬프트를 Google Gemini API로 보내고, 응답을 콘솔에 출력하는 최소 예제입니다.
# 실행 전 준비물: .env 파일에 GEMINI_API_KEY 설정 (.env.example 참고)
#
# 실행 방법:
#   python gemini_chat.py

import os
import sys

from dotenv import load_dotenv
from google import genai
from google.genai import errors

MODEL = "gemini-3.6-flash"
PROMPT = "'안녕하세요'를 영어로 번역해줘"

# .env 파일이 있으면 그 안의 값을 환경변수로 불러옵니다.
load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY")

# API 키가 없으면 여기서 바로 안내하고 종료합니다. (키 값 자체는 절대 출력하지 않습니다)
if not api_key:
    print("환경변수 GEMINI_API_KEY가 설정되어 있지 않습니다.")
    print(".env.example을 복사해 .env 파일을 만들고 키를 입력한 뒤 다시 실행하세요.")
    sys.exit(1)

client = genai.Client(api_key=api_key)


def ask(prompt: str) -> str:
    response = client.models.generate_content(model=MODEL, contents=prompt)
    return response.text


def main() -> None:
    try:
        print("\n--- Gemini 응답 ---")
        print(ask(PROMPT))
    except errors.APIError as error:
        # Gemini API가 반환하는 오류를 사람이 읽기 쉬운 형태로 출력합니다.
        print(f"\n[오류] HTTP 상태 코드: {error.code}")
        print(f"오류 내용: {error.message}")
        sys.exit(1)


if __name__ == "__main__":
    main()
