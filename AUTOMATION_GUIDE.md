# 프로젝트 자동화 가이드 (GitHub + Vercel + Supabase)

이 문서는 특정 프로젝트에 종속되지 않은 범용 지시문입니다. 새 프로젝트를 시작할 때 이 파일을 프로젝트 루트에 복사해두고, Claude Code나 Codex 같은 코딩 에이전트에게 "이 문서 읽고 시작해"라고 주면 됩니다.

같이 볼 문서: [CREDENTIALS_GUIDE.md](./CREDENTIALS_GUIDE.md) — 키/토큰을 누가 어디에 넣는지에 대한 규칙.

---

## 0. 이 가이드가 다루는 범위

- GitHub 저장소 ↔ Vercel 배포 자동 연동
- Supabase(또는 유사 BaaS) DB/Auth 연동
- 코드 수정 → 확인 → 커밋 → 배포까지의 반복 사이클
- 여기 없는 것: 특정 프레임워크 문법, 특정 프로젝트의 기능 요구사항 — 그건 각 프로젝트의 README/기획서를 따로 읽을 것.

---

## 1. 새 프로젝트 시작 시 확인할 것 (에이전트용 체크리스트)

1. `git status`, `git remote -v`로 현재 저장소 상태와 원격 연결 여부 확인
2. `package.json`(또는 해당 언어의 매니페스트)을 읽어서 빌드/타입체크/개발 서버 명령어 파악
3. `.gitignore` 확인 — 아래 항목이 빠짐없이 있는지, 그리고 **예시 파일(`*.example`)까지 같이 무시되고 있지 않은지** 확인
   ```gitignore
   node_modules
   .next        # Next.js면
   .git
   .vercel
   .env*
   !.env*.example
   ```
4. 이미 Vercel/Supabase가 연동되어 있는지 확인 (`.vercel/project.json` 존재 여부, `NEXT_PUBLIC_SUPABASE_URL` 등 환경변수 존재 여부)
5. 위 확인이 끝나기 전에는 코드를 대량으로 작성하지 않는다.

---

## 2. 최초 1회 연동

### 2.1 GitHub

```bash
git remote -v                 # 이미 연결돼 있는지 확인
gh auth status                # GitHub CLI 로그인 상태 확인
```

연결이 안 돼 있으면 사람에게 저장소 URL과 접근 권한을 확인받은 뒤 `git remote add origin <url>`.

### 2.2 Vercel

```bash
npx vercel login              # 브라우저 인증 — 사람이 직접 로그인 화면에서 승인
npx vercel link                # 프로젝트 연결, 팀/프로젝트 이름은 사람에게 확인
```

Git 저장소와 Vercel 프로젝트가 연동되면(대시보드 Settings → Git에서 확인), `main`(또는 지정 브랜치) push마다 자동 배포된다. 자동 배포가 안 되면 3.4 참고.

### 2.3 Supabase

Supabase는 CLI 로그인 없이도 URL + 키만 있으면 앱에서 바로 쓸 수 있다. 새 프로젝트라면:

1. 사람이 Supabase 대시보드에서 프로젝트를 만들고 Project Settings → API에서 URL/키를 확인
2. 그 값을 [CREDENTIALS_GUIDE.md](./CREDENTIALS_GUIDE.md)의 절차대로 `.env.local`과 Vercel 환경변수에 등록
3. 테이블/RLS 정책은 SQL Editor나 Supabase MCP 도구로 적용

### 2.4 환경변수를 로컬로 가져오기

Vercel에 이미 등록된 값이 있다면, 사람이 값을 다시 안 불러줘도 CLI로 받아올 수 있다.

```bash
npx vercel env pull .env.local
```

이 방법을 쓰면 에이전트가 실제 키 값을 직접 보지 않고도(터미널에 값이 출력되지 않음) 로컬 개발 환경을 세팅할 수 있다. 가능하면 이 방법을 우선 사용할 것.

---

## 3. 매 작업 사이클

1. **요청 범위만 수정한다.** 요청하지 않은 리팩터링/디자인 변경을 같이 하지 않는다.
2. **코드 수정**
3. **타입체크 + 빌드** (프레임워크에 맞게)
   ```bash
   npx tsc --noEmit      # TypeScript 프로젝트
   npm run build
   ```
   - 코드와 무관해 보이는 이상한 빌드 에러가 나면 캐시 문제일 수 있다. Next.js라면 `rm -rf .next` 후 재시도.
4. **로컬에서 실제 동작 확인** (`npm run dev` 등으로 띄워서 직접 확인, 최소한 로그/응답으로 검증)
5. **변경 파일을 명시적으로 골라서 커밋**
   ```bash
   git add <파일1> <파일2>     # git add -A / git add . 지양
   git commit -m "fix: 무엇을 왜 고쳤는지"
   ```
6. **푸시**
   ```bash
   git push origin main
   ```
7. **자동 배포 확인** — 먼저 확인하고, 안 됐을 때만 수동 배포한다.
   ```bash
   npx vercel ls <project-name>
   ```
   방금 커밋 시각에 맞는 새 배포가 `Ready`로 보이면 끝. 몇 분 지나도 안 보이면:
   ```bash
   npx vercel --prod --yes
   ```
   ⚠️ **자동 배포가 이미 성공했는데 확인 없이 수동 배포를 또 돌리면 같은 커밋이 중복 빌드된다.** 큰 문제는 아니지만(빌드 시간 낭비 수준) 항상 먼저 `vercel ls`로 확인하는 습관을 들일 것.
8. **실제 배포 주소에서 최종 확인**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://<배포주소>/
   ```

---

## 4. 절대 하지 말 것

- API 키·토큰·비밀번호를 코드나 스크립트에 직접 쓰지 않는다. 항상 환경변수.
- `git add -A` / `git add .`로 무분별하게 커밋하지 않는다 — 스크린샷, 임시파일, `.env.local`이 같이 올라가는 사고를 막기 위함.
- `.env.local`, `.mcp.json`, `.vercel/`, `node_modules`, 빌드 캐시(`.next` 등)를 커밋하지 않는다.
- `git push --force`, `git reset --hard`, DB 삭제/초기화 스크립트, `vercel env rm` 같은 되돌리기 어려운 작업은 실행 전에 반드시 사람에게 알리고 확인받는다.
- 요청받지 않은 대규모 리팩터링·디자인 변경을 임의로 하지 않는다.
- 배포 전에 반드시 로컬에서 타입체크·빌드가 통과하는지 확인한다 — 안 하고 푸시하지 않는다.

---

## 5. 자주 겪는 문제 (프레임워크 공통)

- **로컬은 되는데 배포에서만 안 됨** → 거의 항상 Vercel 환경변수 누락/오타. `vercel env ls`로 등록된 변수 이름을 확인하고, 로컬 `.env.local`과 이름이 정확히 같은지 대조한다.
- **배포 웹훅이 간헐적으로 안 터짐** → 3번 섹션 7번 항목대로 `vercel ls`로 먼저 확인 후 필요할 때만 수동 배포.
- **개발 서버 캐시 꼬임(Next.js/Turbopack)** → 이유 없는 404나 무관한 타입 에러가 나면 `.next` 삭제 후 재시도.
- **외부 API(지역검색, 지도 등)에 조건을 너무 많이 붙이면 오히려 결과가 안 나옴** → 검색어/조건은 최소한으로 유지하고, 세부 필터링은 결과를 받은 뒤 코드에서 처리하는 편이 안정적이다.
- **AI 생성 기능에 참고용 DB 값을 프롬프트에 넣을 때** → "이 값은 참고용이고 검증된 사실이 아니다"를 프롬프트에 명확히 밝히지 않으면, AI가 그 값을 실시간으로 확인한 사실처럼 되풀이할 수 있다.
