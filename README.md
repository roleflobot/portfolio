# Portfolio

## Gemini API 예제 (gemini-chat.js)

콘솔에 입력한 텍스트를 Google Gemini API로 보내고, 응답을 출력하는 최소 Node.js 예제입니다.

### 설치 방법

```bash
npm install
```

### Gemini API 키 설정 방법

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 API 키를 발급받습니다.
2. `.env.example` 파일을 복사해 `.env` 파일을 만듭니다.
3. `.env` 파일의 `GEMINI_API_KEY=` 뒤에 발급받은 키를 붙여넣습니다.

```bash
cp .env.example .env
```

### 실행 명령어

```bash
npm start
```

또는

```bash
node gemini-chat.js
```

실행 후 프롬프트에 메시지를 입력하면 Gemini의 응답이 콘솔에 출력됩니다.

## Gemini API 예제 (gemini_chat.py)

같은 기능을 Python으로 구현한 버전입니다.

### 설치 방법

```bash
pip install -r requirements.txt
```

### Gemini API 키 설정 방법

Node 예제와 동일한 `.env` 파일을 그대로 사용합니다. (위 "Gemini API 키 설정 방법" 참고)

### 실행 명령어

```bash
python gemini_chat.py
```

또는 질문을 인자로 바로 전달:

```bash
python gemini_chat.py "파이썬 데코레이터를 한 문장으로 설명해줘"
```

### ⚠️ 주의사항

**절대로 `.env` 파일이나 실제 API 키를 GitHub에 커밋/푸시하지 마세요.** 이 저장소는 공개(Public) 저장소이므로, API 키가 노출되면 누구나 해당 키로 API를 호출해 요금이 청구될 수 있습니다. `.env`는 `.gitignore`에 등록되어 있지만, 커밋 전에 `git status`로 한 번 더 확인하는 것을 권장합니다.
