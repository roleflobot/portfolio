# Gemini Live Voice Lab

Daily English Hub의 뉴스 요약, True / False, 빈칸 문제를 받아 Gemini Live API와 3분간 실시간 영어 음성 대화를 하는 독립 실험 앱입니다.

## Isolation

- 원래 Daily English Hub와 다른 Next.js 패키지 및 Vercel 프로젝트로 배포합니다.
- Supabase나 기존 학습 테이블에 접근하지 않습니다.
- Section 6 접근 코드는 메인 앱 서버에서만 해시로 검증합니다.
- 메인 앱이 발급한 5분짜리 HMAC 서명 티켓이 있어야 Gemini 토큰을 요청할 수 있습니다.
- 학습자료는 허용된 메인 앱 origin의 `postMessage`만 받아 `sessionStorage`에 보관합니다.
- 원본 음성은 저장하지 않습니다.
- 브라우저에는 장기 API 키 대신 단일 사용 ephemeral token만 전달합니다.

## Environment

`.env.local.example`을 참고해 다음 서버 전용 값을 설정합니다.

```env
GEMINI_API_KEY=
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
VOICE_LAB_SHARED_SECRET=
NEXT_PUBLIC_MAIN_APP_ORIGIN=http://localhost:3000
```

메인 앱에는 동일한 `VOICE_LAB_SHARED_SECRET`과 접근 코드의 SHA-256 값인
`VOICE_LAB_ACCESS_CODE_HASH`를 서버 전용 환경변수로 설정합니다. 접근 코드 원문은
코드베이스나 브라우저 환경변수에 저장하지 않습니다.

공개 배포에서는 원래 앱과 쿼터를 분리할 수 있도록 실험 앱 전용 Gemini API 키를 권장합니다.

## Local development

```bash
npm install
npm run dev
```

앱은 외부 네트워크에 노출되지 않도록 `http://127.0.0.1:3001`에서 실행됩니다. 원래 앱은 개발 환경에서 이 주소를 자동으로 사용합니다.

## Verification

개발 서버가 실행 중일 때 다음 명령은 실제 ephemeral token과 Gemini Live 음성 응답을 확인합니다.

```bash
VOICE_LAB_SHARED_SECRET=<shared-secret> npm run smoke:live
```

프로덕션 배포 후 원래 Daily English Hub의 빌드 환경에 다음 값을 추가합니다.

```env
NEXT_PUBLIC_VOICE_LAB_URL=https://your-separate-voice-lab.vercel.app
```

이 값이 없는 프로덕션 빌드에서는 Section 6 링크가 렌더링되지 않아 기존 앱의 동작에 영향을 주지 않습니다.
실험 앱 URL만 직접 열면 학습자료나 Gemini 토큰을 받을 수 없으며, 메인 앱의 Section 6
버튼에서 접근 코드를 통과해야 합니다.
