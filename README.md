# Portfolio

## 프로젝트 목록

- [`gemini-api-basics/`](./gemini-api-basics) — Node.js·Python으로 Google Gemini API를 최소 구성으로 호출하는 예제
- [`saju-fortune-app/`](./saju-fortune-app) — 사주풀이·오늘의 운세·고민 상담을 제공하는 FastAPI + Gemini 웹앱
- [`project1-voc-agent/`](./project1-voc-agent) — n8n으로 만든 고객 VOC 분석 Agent (Google Form → Sheet → n8n → Discord)

---

## gemini-api-basics/ — Gemini API 예제

콘솔에 입력한 텍스트를 Google Gemini API로 보내고, 응답을 출력하는 최소 예제입니다. (Node.js, Python 두 버전)

### Gemini API 키 설정 방법

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 API 키를 발급받습니다.
2. `gemini-api-basics/.env.example` 파일을 복사해 같은 폴더에 `.env` 파일을 만듭니다.
3. `.env` 파일의 `GEMINI_API_KEY=` 뒤에 발급받은 키를 붙여넣습니다.

```bash
cd gemini-api-basics
cp .env.example .env
```

### Node.js 버전

```bash
cd gemini-api-basics
npm install
npm start
```

또는 `node gemini-chat.js`

### Python 버전

```bash
cd gemini-api-basics
pip install -r requirements.txt
python gemini_chat.py
```

또는 질문을 인자로 바로 전달:

```bash
python gemini_chat.py "파이썬 데코레이터를 한 문장으로 설명해줘"
```

실행 후 프롬프트에 메시지를 입력하면 Gemini의 응답이 콘솔에 출력됩니다.

---

## saju-fortune-app/ — 사주 & 고민 상담

생년월일 기반 사주풀이, 오늘의 운세, 사주 기반 고민/진로 상담, 날씨를 고려한 행운의 음식 추천까지
제공하는 웹 페이지입니다. `main.py`(FastAPI)가 `saju.html`을 서빙하고, Gemini API 호출은 전부
서버에서만 처리합니다. **API 키가 브라우저에 절대 노출되지 않습니다.**

기획 배경은 [`기획문서.md`](./saju-fortune-app/기획문서.md) 참고.

### 설치 방법

```bash
cd saju-fortune-app
pip install -r requirements.txt
```

### Gemini API 키 설정 방법

```bash
cd saju-fortune-app
cp .env.example .env
```

`.env` 파일의 `GEMINI_API_KEY=` 뒤에 [Google AI Studio](https://aistudio.google.com/apikey)에서 발급받은 키를 붙여넣습니다.

### 실행 명령어

```bash
cd saju-fortune-app
python main.py
```

브라우저에서 `http://localhost:8000` 접속하면 됩니다.

개발 중 코드 수정 시 자동 재시작이 필요하면 아래처럼 실행해도 됩니다.

```bash
cd saju-fortune-app
uvicorn main:app --reload
```

Windows에서는 `saju-fortune-app/run.bat`을 더블클릭해도 됩니다. (서버 실행 + 브라우저 자동 열기를 한 번에 처리하는 편의 스크립트일 뿐, 위 명령어와 동일한 서버를 띄웁니다.)

### ⚠️ 주의사항

**절대로 `.env` 파일이나 실제 API 키를 GitHub에 커밋/푸시하지 마세요.** 이 저장소는 공개(Public) 저장소이므로, API 키가 노출되면 누구나 해당 키로 API를 호출해 요금이 청구될 수 있습니다. `.env`는 `.gitignore`에 등록되어 있지만, 커밋 전에 `git status`로 한 번 더 확인하는 것을 권장합니다.

---

## project1-voc-agent/ — 고객 VOC 분석 Agent

Google Form으로 접수된 고객 문의를 n8n이 자동으로 감지해 중복을 거르고, LLM(Gemini)으로 분류·요약한 뒤 Google Sheet에 기록하고, 긴급 건은 Discord로 즉시 알림을 보내는 자동화 워크플로우입니다.

자세한 설계·구현 내용은 [`미니프로젝트1_박정호.md`](./project1-voc-agent/미니프로젝트1_박정호.md)를, 개발 방식과 엔지니어링 이슈 해결 과정은 [`ENGINEERING_NOTES.md`](./project1-voc-agent/ENGINEERING_NOTES.md)를 참고하세요.
