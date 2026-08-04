# 평양냉면 혼자 먹기

서울의 평양냉면집을 저장하고, 혼자 이용할 수 있는지 확인하며, 방문 여부·개인 평점·후기를 관리하는 개인 웹 서비스입니다. 자세한 기획 배경과 설계는 [PYEONGNAENG_SOLO_QUEST_PLAN.md](./PYEONGNAENG_SOLO_QUEST_PLAN.md)에 있습니다.

**배포 주소**: https://quest-theta-cyan.vercel.app
**테스트 계정**: `demo@pynm.com` / `demo1234`

## 스크린샷

_추가 예정 — 로그인 화면, 목록 화면, 상세 화면(AI 리뷰요약 포함), AI 추천 모달 스크린샷을 이 자리에 넣습니다._

## 주요 기능

### 기본 (CRUD)

- 이메일 회원가입 / 로그인, Supabase RLS로 본인 데이터만 조회·수정·삭제
- 식당 목록 조회, `가고 싶은 곳` / `다녀온 곳` 탭, 자치구 필터, 식당명 검색
- 식당 등록·수정·삭제, 사진 업로드(Supabase Storage)
- 방문 완료 토글(누르면 도장 스탬프 애니메이션), 개인 별점(1~5), 실제 방문 후기
- 네이버 지역검색 API로 등록 시 장소 자동 매칭 → 네이버 지도 링크 연결
- 평균 냉면 가격(현재 탭 기준) 표시

### AI 기능 (Gemini API)

- **AI 리뷰요약**: 식당 상세 화면에서 Gemini(`gemini-3.6-flash`)가 구글 검색으로 실제 방문자 리뷰를 찾아 평균적인 평가를 3문장으로 요약. 같은 상호의 다른 지점과 리뷰가 섞이지 않도록 이름+주소를 함께 대조.
- **AI 추천**: 자치구를 고르면 그 지역의 혼밥 가능한 평양냉면집을 검색해서 등록 폼을 채워줍니다(이미 등록된 곳은 자동 제외). 결과는 바로 저장되지 않고 사용자가 확인 후 저장.
- 사진은 실제로 확인되는 이미지가 있을 때만 채우고, 확신이 없으면 항상 빈칸으로 둡니다(서버에서 이미지 URL 유효성도 재검증).

자세한 구현 배경은 [PYEONGNAENG_SOLO_QUEST_PLAN.md의 17번 섹션](./PYEONGNAENG_SOLO_QUEST_PLAN.md#17-과제-확장--ai-기능-추가-2026-08)을 참고하세요.

## 기술 스택

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Database / Auth / Storage**: Supabase
- **Styling**: Tailwind CSS v4
- **AI**: Gemini API (`gemini-3.6-flash`, Google Search grounding)
- **지역 검색**: 네이버 지역검색 API
- **Deployment**: Vercel

## 시작하기

### 1. 환경변수 설정

`.env.local.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 클라이언트 연결 |
| `SUPABASE_SERVICE_ROLE_KEY` | 로컬 설정 스크립트 실행용 (브라우저에 노출 안 됨) |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 등록 시 네이버 장소 자동 검색 |
| `GEMINI_API_KEY` | AI 리뷰요약 / AI 추천 기능 |

Vercel에 배포할 때도 동일한 이름으로 Production/Preview 환경변수를 등록합니다.

### 2. 설치 및 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인합니다.

### 3. 빌드 확인

```bash
npx tsc --noEmit
npm run build
```

## 데이터베이스

Supabase `restaurants` 테이블 하나로 구성됩니다. 컬럼 정의와 RLS 정책은 [PYEONGNAENG_SOLO_QUEST_PLAN.md의 6번 섹션](./PYEONGNAENG_SOLO_QUEST_PLAN.md#6-데이터베이스-설계)을 참고하세요.

## 배포

`main` 브랜치에 push하면 Vercel이 자동으로 프로덕션에 배포합니다(`vercel.json`의 Git 연동). 웹훅이 지연될 경우 `npx vercel --prod` 로 직접 배포할 수 있습니다.
