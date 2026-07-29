# main.py
# saju.html을 서빙하고, Gemini API 호출을 대신 처리해주는 FastAPI 서버입니다.
# GEMINI_API_KEY는 여기(서버)에서만 사용되고 브라우저에는 절대 전달되지 않습니다.
#
# 실행 방법:
#   uvicorn main:app --reload

import os
from datetime import datetime
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from google import genai
from google.genai import errors
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent
MODEL = "gemini-3.5-flash-lite"  # 토큰 절약을 위해 가볍고 저렴한 모델 사용

load_dotenv(BASE_DIR / ".env")

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError(
        ".env 파일에 GEMINI_API_KEY가 설정되어 있지 않습니다. .env.example을 참고하세요."
    )

client = genai.Client(api_key=api_key)

app = FastAPI()

CITY_COORDS = {
    "서울": (37.5665, 126.9780),
    "부산": (35.1796, 129.0756),
    "인천": (37.4563, 126.7052),
    "대구": (35.8714, 128.6014),
    "대전": (36.3504, 127.3845),
    "광주": (35.1595, 126.8526),
    "제주": (33.4996, 126.5312),
}

WEATHER_CODE_TEXT = {
    0: "맑음",
    1: "대체로 맑음",
    2: "구름 조금",
    3: "흐림",
    45: "안개",
    48: "짙은 안개",
    51: "약한 이슬비",
    53: "이슬비",
    55: "강한 이슬비",
    61: "약한 비",
    63: "비",
    65: "강한 비",
    71: "약한 눈",
    73: "눈",
    75: "강한 눈",
    80: "약한 소나기",
    81: "소나기",
    82: "강한 소나기",
    95: "천둥번개",
}


class SajuRequest(BaseModel):
    birthDate: str
    birthTime: str = ""
    gender: str


class TodayRequest(BaseModel):
    birthDate: str
    gender: str


class WorryRequest(BaseModel):
    birthDate: str
    gender: str
    worry: str


class FoodRequest(BaseModel):
    birthDate: str
    gender: str
    city: str


def gender_text(gender: str) -> str:
    return "남성" if gender == "male" else "여성"


def season_text() -> str:
    month = datetime.now().month
    if 3 <= month <= 5:
        return "봄"
    if 6 <= month <= 8:
        return "여름"
    if 9 <= month <= 11:
        return "가을"
    return "겨울"


def ask_gemini(prompt: str) -> str:
    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config={"max_output_tokens": 300},
        )
    except errors.APIError as error:
        # Gemini API가 반환하는 오류를 그대로 클라이언트에 전달합니다.
        raise HTTPException(status_code=error.code or 500, detail=error.message)

    return response.text or "(응답이 비어있습니다)"


def get_weather(latitude: float, longitude: float) -> tuple[float, str]:
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}&longitude={longitude}"
        "&current=temperature_2m,weather_code&timezone=auto"
    )
    response = httpx.get(url, timeout=10)
    if response.is_error:
        raise HTTPException(status_code=502, detail="날씨 정보를 가져오지 못했습니다.")

    data = response.json()
    temp_c = data["current"]["temperature_2m"]
    weather_code = data["current"]["weather_code"]
    return temp_c, WEATHER_CODE_TEXT.get(weather_code, "알 수 없음")


@app.get("/")
def index():
    return FileResponse(BASE_DIR / "saju.html")


@app.get("/saju.js")
def saju_js():
    return FileResponse(BASE_DIR / "saju.js", media_type="application/javascript")


@app.post("/api/saju")
def api_saju(req: SajuRequest):
    time_text = req.birthTime or "모름"
    prompt = "\n".join([
        "너는 사주팔자를 봐주는 전문가야. 아래 정보를 바탕으로 간단한 사주 풀이를 해줘.",
        f"- 생년월일: {req.birthDate}",
        f"- 태어난 시간: {time_text}",
        f"- 성별: {gender_text(req.gender)}",
        "",
        "성격, 올해의 운세, 조언을 각각 소제목으로 나눠서 총 3~4문장으로 아주 간결하게 알려줘.",
        "재미로 보는 것이니 너무 심각하지 않게, 짧고 핵심만 답해줘.",
    ])
    return {"text": ask_gemini(prompt)}


@app.post("/api/today")
def api_today(req: TodayRequest):
    today_date = datetime.now().strftime("%Y-%m-%d")
    prompt = "\n".join([
        "너는 사주팔자를 봐주는 전문가야. 아래 사람의 오늘 하루 운세만 짧게 봐줘.",
        f"- 생년월일: {req.birthDate}",
        f"- 성별: {gender_text(req.gender)}",
        f"- 오늘 날짜: {today_date}",
        "",
        "총운, 주의할 점을 합쳐서 2~3문장으로 아주 간결하게 답해줘.",
        "재미로 보는 것이니 가볍고 핵심만 답해줘.",
    ])
    return {"text": ask_gemini(prompt)}


@app.post("/api/worry")
def api_worry(req: WorryRequest):
    prompt = "\n".join([
        "너는 사주팔자와 심리 상담을 함께 해주는 전문가야.",
        "아래 사람의 사주(생년월일/성별)를 바탕으로 타고난 성향과 기운을 먼저 간단히 짚고,",
        "그 사주 성향과 연결지어서 고민에 공감하고 조언해줘.",
        "특히 진로/직업 관련 고민이면, 사주 기운상 어울리는 방향성이나 강점을 살릴 수 있는 분야를 구체적으로 제안해줘.",
        "",
        f"- 생년월일: {req.birthDate}",
        f"- 성별: {gender_text(req.gender)}",
        f"- 고민: {req.worry}",
        "",
        "형식: 1) 사주 성향 한 줄 짚기 2) 고민 공감 3) 사주 기반 조언(진로 고민이면 구체적 방향 포함).",
        "전체 5~6문장으로 따뜻하지만 간결하게 답해줘.",
        "전문적인 의료/법률/재정 상담이 필요한 내용이면, 조언과 함께 관련 전문가와 상담해보길 권해줘.",
    ])
    return {"text": ask_gemini(prompt)}


@app.post("/api/food")
def api_food(req: FoodRequest):
    if req.city not in CITY_COORDS:
        raise HTTPException(status_code=400, detail="지원하지 않는 지역입니다.")

    latitude, longitude = CITY_COORDS[req.city]
    temp_c, weather_text = get_weather(latitude, longitude)
    today_date = datetime.now().strftime("%Y-%m-%d")

    prompt = "\n".join([
        "너는 사주와 날씨를 함께 고려해서 음식을 추천해주는 전문가야.",
        f"- 생년월일: {req.birthDate}",
        f"- 성별: {gender_text(req.gender)}",
        f"- 오늘 날짜: {today_date} ({season_text()})",
        f"- 지역: {req.city}",
        f"- 현재 기온: {temp_c}°C, 날씨: {weather_text}",
        "",
        "이 사람의 사주 기운과 오늘 날씨/계절을 함께 고려했을 때 어울리는 '행운의 음식'과",
        "그 이유를 3~4문장으로 간결하게 추천해줘. 실제로 먹을 수 있는 구체적인 음식 이름을 알려줘.",
    ])
    return {"text": ask_gemini(prompt)}
