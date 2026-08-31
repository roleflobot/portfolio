# Codex 작업 지시서 — 평양냉면 혼자 먹기 (quest)

이 문서는 VS Code 안의 Codex에게 그대로 붙여넣어 시작하는 지시문입니다. 목표는 지금까지 Claude Code가 이 저장소에서 해온 것과 같은 방식으로 — 코드 수정, Git, Vercel 배포, Supabase 연동을 Codex가 알아서 하도록 만드는 것입니다.

---

## 0. 먼저 읽을 것

- [AGENTS.md](./AGENTS.md) — 이 프로젝트의 Next.js 버전 관련 주의사항 (Pages Router 문법 금지 등)
- [PYEONGNAENG_SOLO_QUEST_PLAN.md](./PYEONGNAENG_SOLO_QUEST_PLAN.md) — 전체 기획서, DB 스키마, 완료 현황
- [README.md](./README.md) — 기능 요약, 실행 방법
- [SUPABASE_MCP_SETUP.md](./SUPABASE_MCP_SETUP.md) — Supabase 플러그인 실패 원인과 공식 MCP 직접 연결 기록

이 네 문서를 먼저 읽고 프로젝트 구조를 파악한 뒤 아래 절차를 시작하세요.

---

## 1. 프로젝트 개요

- **무엇**: 서울 평양냉면집을 저장·관리하는 개인 웹 서비스. CRUD + Gemini API 기반 AI 기능(리뷰요약, 자치구 추천) 포함.
- **스택**: Next.js 16(App Router) + TypeScript + Supabase(DB/Auth/Storage) + Tailwind CSS v4 + Gemini API + 네이버 지역검색 API + Vercel
- **배포 주소**: https://quest-theta-cyan.vercel.app
- **GitHub**: roleflobot/quest, `main` 브랜치에 push하면 Vercel이 자동 배포(Git 연동, `vercel.json` 참고)
- **테스트 계정**: demo@pynm.com / demo1234 (수강생 공유용, 함부로 데이터 초기화하지 말 것)

---

## 2. 사람이 제공해야 하는 것 (Codex가 직접 만들면 안 되는 값들)

Codex는 아래 값을 **절대로 지어내거나 코드에 직접 쓰지 말고**, 필요할 때마다 사람에게 물어서 받으세요. 받은 값은 항상 `.env.local`(로컬)과 Vercel 프로젝트의 Environment Variables(배포용)에만 넣습니다.

| 변수 | 용도 | 발급처 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Supabase 대시보드 → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트용 공개 키 | 위와 동일 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 관리자 키 (절대 클라이언트 코드에 노출 금지) | 위와 동일 |
| `SUPABASE_DB_PASSWORD` | 직접 PostgreSQL 마이그레이션용 비밀번호 (로컬 전용·선택) | Supabase 대시보드 → Project Settings → Database |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 지역검색 API | 네이버 개발자센터 |
| `GEMINI_API_KEY` | Gemini API (AI 기능) | Google AI Studio |
| Vercel 로그인 | 배포 권한 | `vercel login` 실행 시 브라우저 인증창으로 사람이 직접 로그인 |

**규칙**:
- 이 표의 값들은 `git commit`에 절대 포함되면 안 됩니다. 커밋 전에 `git status`로 `.env.local`이 스테이징되지 않았는지 항상 확인하세요.
- `.env.local.example`에는 값 없이 변수 이름만 추가/유지합니다.
- 스크립트(`scripts/*.js`)에 키를 하드코딩하지 마세요. 이 저장소에는 과거에 그렇게 만들어졌다가 나중에 제거된 스크립트들이 있었습니다 — 같은 실수를 반복하지 마세요.
- `SUPABASE_DB_PASSWORD`는 로컬에서 직접 SQL 마이그레이션을 실행할 때만 사용하며 Vercel 환경변수에는 등록하지 않습니다.

---

## 3. 최초 1회 연동 절차

### 3.1 Vercel 연동

```bash
npx vercel login
npx vercel link
```

`vercel link`는 대화형으로 팀/프로젝트를 물어봅니다 — `possuntix-9644s-projects/quest`를 선택하세요.

### 3.2 환경변수 가져오기

Vercel 대시보드에 이미 등록된 값이 있다면 CLI로 그대로 받아올 수 있습니다(사람이 값을 직접 안 알려줘도 됨).

```bash
npx vercel env pull .env.local
```

새 환경변수가 필요한데 아직 Vercel에 없다면, 사람에게 값을 물어본 뒤:

```bash
npx vercel env add <이름> production
npx vercel env add <이름> preview
npx vercel env add <이름> development
```

### 3.3 Supabase 확인

Supabase는 별도 CLI 로그인 없이 위 환경변수(`NEXT_PUBLIC_SUPABASE_URL` 등)만 있으면 앱의 데이터·Auth·Storage API에 연결됩니다. `SUPABASE_SERVICE_ROLE_KEY`로 서버/로컬 관리자 작업을 할 수 있지만 임의 SQL, DDL, RLS 정책 변경까지 실행할 수 있는 키는 아닙니다. 스키마·RLS 변경은 Supabase 연결 도구나 대시보드 SQL Editor를 우선 사용하고, 직접 PostgreSQL 접속이 꼭 필요할 때만 로컬의 `SUPABASE_DB_PASSWORD`를 사용하세요.

### 3.4 GitHub

이미 `origin`이 `roleflobot/quest`로 연결되어 있어야 합니다. 확인:

```bash
git remote -v
```

푸시 권한 문제가 있으면 사람에게 GitHub 인증(gh auth login 또는 SSH 키)을 요청하세요.

---

## 4. 매 작업 사이클 (코드를 고칠 때마다 이 순서를 지킬 것)

1. **작업 범위 확인** — 사용자가 요청한 것만 고친다. 요청하지 않은 리팩터링·디자인 변경을 같이 하지 않는다.
2. **코드 수정**
3. **타입/빌드 확인** (이 두 개를 건너뛰고 커밋한 적이 있으면 안 됨)
   ```bash
   npx tsc --noEmit
   npm run build
   ```
   - 빌드 에러가 코드와 무관해 보이면(예: `.next/dev/types/...`에서 에러) 캐시 문제일 수 있습니다. `rm -rf .next` 후 다시 빌드해보세요.
4. **로컬에서 실제로 동작 확인** — 가능하면 `npm run dev`로 띄워서 브라우저로 직접 클릭해본다. 최소한 API 응답/로그로 확인한다.
5. **커밋** — 커밋 메시지는 이 저장소의 기존 스타일을 따른다: `fix:`, `feat:`, `docs:` 접두사 + 한국어 설명.
   ```bash
   git add <바뀐 파일만 명시적으로>
   git commit -m "fix: 무엇을 왜 고쳤는지 한 줄"
   ```
   `git add -A`나 `git add .`로 통째로 올리지 말고, 바뀐 파일을 명시적으로 골라서 add하세요(스크린샷·zip·임시 파일이 같이 들어가는 사고 방지).
6. **푸시**
   ```bash
   git push origin main
   ```
7. **배포 확인** — push 후 보통 20~40초 안에 Vercel이 자동 배포합니다.
   ```bash
   npx vercel ls quest
   ```
   방금 커밋 시각과 비슷한 새 배포가 `Ready` 상태로 뜨는지 확인. **몇 분이 지나도 새 배포가 안 보이면** 그때만 수동 배포로 보완합니다:
   ```bash
   npx vercel --prod --yes
   ```
   ⚠️ 자동 배포가 이미 성공했는데 습관적으로 수동 배포를 또 돌리면 같은 커밋이 중복 빌드됩니다(치명적이진 않지만 불필요한 빌드 낭비). **먼저 `vercel ls`로 확인하고, 필요할 때만** 수동 배포하세요.
8. **실제 배포 주소에서 최종 확인**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://quest-theta-cyan.vercel.app/
   ```
   200이 나오는지, 그리고 실제로 그 기능이 화면에 반영됐는지 확인.

---

## 5. 절대 하지 말 것

- `SUPABASE_SERVICE_ROLE_KEY`를 클라이언트 컴포넌트(`'use client'`)나 브라우저에서 실행되는 코드에 쓰지 않는다. 서버 전용(API 라우트, 서버 컴포넌트)에서만 사용.
- API 키를 코드/스크립트에 하드코딩하지 않는다. 항상 `process.env.*`.
- `git add -A` / `git add .`로 무분별하게 커밋하지 않는다.
- `.env.local`, `.mcp.json`, `.vercel/`을 커밋하지 않는다(이미 `.gitignore`에 있음, 건드리지 말 것).
- `git push --force`, `git reset --hard`, `vercel env rm` 같은 되돌리기 어려운 명령은 실행 전에 반드시 사람에게 먼저 알리고 확인받는다.
- Pages Router 문법(`pages/`, `getServerSideProps`)을 쓰지 않는다 — 이 프로젝트는 App Router 전용이다.
- 요청받지 않은 대규모 리팩터링이나 디자인 변경을 임의로 하지 않는다.

---

## 6. 이 프로젝트에서 실제로 겪었던 함정들

- **Gemini + `responseSchema`(JSON 강제 응답)를 같이 쓰면 `google_search` 툴 호출이 스킵되는 경우가 있다.** 검색이 실제로 필요한 기능(리뷰요약, 장소 추천)에는 JSON 강제 모드 대신 자유 문장으로 답하게 하고, 마지막 줄에 `RESULT_JSON: {...}` 형식으로 결과를 붙이게 한 뒤 그 줄만 파싱하는 방식을 쓴다. 실제로 검색이 됐는지는 응답의 `groundingMetadata.webSearchQueries`로 확인할 것.
- **네이버 지역검색 API에는 지역 제한 파라미터가 없다.** 검색어에 지역 정보를 억지로 많이 넣으면(상세주소, "서울" 등) 오히려 0건이 되는 경우가 있었다. 검색어는 최소한으로(상호명 + 자치구/키워드 정도) 유지하고, 지역 필터링은 결과를 받은 뒤 코드에서 직접 한다(`lib/naverPlaceMatch.ts`의 `isSeoulAddress` 참고).
- **Next.js 개발 서버(Turbopack)가 가끔 `.next` 캐시가 꼬여서 존재하는 라우트를 404로 응답하거나, 무관한 타입 에러를 낸다.** 이런 증상이면 코드를 더 뒤지기 전에 `rm -rf .next`로 캐시부터 지워볼 것.
- **Vercel의 GitHub 연동 웹훅이 간헐적으로 안 터질 때가 있었다.** push 후 `vercel ls`로 몇 분간 새 배포가 안 보이면 `vercel --prod --yes`로 직접 배포. 다만 5번 항목처럼 중복 배포를 만들지 않도록 먼저 확인.
- **AI가 생성하는 내용에 우리 DB의 참고 정보(가격 등)를 그대로 프롬프트에 넣으면, AI가 그걸 마치 검색으로 확인한 사실처럼 되풀이할 수 있다.** 참고용 정보와 실제 검색 확인 정보를 프롬프트에서 명확히 구분해서 지시할 것.

---

## 7. 확인용 명령 모음

```bash
# 현재 상태 확인
git status
git log --oneline -5

# 타입/빌드
npx tsc --noEmit
npm run build

# 로컬 실행
npm run dev

# 배포 상태
npx vercel ls quest

# 배포 로그(에러 확인용)
npx vercel inspect <deployment-url> --logs

# 프로덕션 접속 확인
curl -s -o /dev/null -w "%{http_code}\n" https://quest-theta-cyan.vercel.app/
```
