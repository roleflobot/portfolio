# 인수인계 — Daily English Hub (project3-news-english) → Codex

작성일: 2026-08-10
작성자: 이전 세션의 Claude Code (Codex가 맥락 없이도 바로 이어서 작업할 수 있게 하기 위한 문서)

이전 문서 [HANDOFF_2026-08-10.md](./HANDOFF_2026-08-10.md)에 있던 작업(Section 5 렌더/검증 버그)은
전부 끝났고 배포·검증까지 완료됨. 이 문서는 그 이후 같은 날 진행된 훨씬 큰 작업(새벽 배치 구조
리팩터링, 여러 UI 수정, GitHub 저장소 신설)을 다룸 — **이 문서가 최신본**.

## 지금 상태 한 줄 요약

배포 주소 `https://daily-english-hub-liard.vercel.app` 정상 운영 중. 오늘 발견된 "새벽 배치가
타임아웃으로 부분 실패하는" 치명적 버그를 근본적으로 고쳐 배포·실증까지 마쳤고, 그 외 자잘한
UI/문구 개선도 여러 건 반영·배포됨. 모든 변경사항은 커밋되어 GitHub에 푸시된 상태
(`https://github.com/roleflobot/daily-english-hub`, private, 최신 커밋 `3a2156a`).

## 오늘 세션에서 고친 것 (시간순)

### 1. 새벽 배치 부분 실패 버그 — 근본 원인과 수정
**증상**: 하루는 5개 토픽 중 2개는 학습자료(aiContent) 자체가 없고, 완성된 3개도 미리 만든
오디오가 하나도 없었음. 반대로 텍스트 없는 토픽 하나엔 오디오만 덩그러니 남아있는 모순 발견.

**근본 원인**: [pregenerate/route.ts](src/app/api/cron/pregenerate/route.ts)의 `maxDuration`이
60초였는데(→ 실제로는 Fluid Compute 적용 시 Hobby 플랜도 300초까지 가능, 60은 코드가 스스로 건
불필요한 제한이었음), 그리고 [topics-service.ts](src/lib/topics-service.ts)의
`pregenerateTodayMaterials`가 **5개 토픽을 전부 처리한 뒤 한 번에** `cacheTopicsForDate`로
저장하는 구조였음 — 그래서 함수가 시간 제한에 걸려 중간에 죽으면, 이미 완성된 토픽까지 통째로
증발함. (오디오만 `setTopicAudio`로 토픽별 즉시 저장이라 그것만 살아남았던 것.)

**수정 내용**:
1. `maxDuration` 60 → 300 ([pregenerate/route.ts](src/app/api/cron/pregenerate/route.ts))
2. [gemini.ts](src/lib/gemini.ts)의 `generateLearningMaterial`(단일 호출)을 3단계로 분리:
   - `generateArticleCore` — summary/translation/vocabulary/writingWords
   - `generateQuiz` — summary만 있으면 독립적으로 생성 가능
   - `generateBlanks` — summary+vocabulary만 있으면 독립적으로 생성 가능
   - (온디맨드 `/api/generate`용으로 세 단계를 이어 호출하는 `generateLearningMaterial` 래퍼는
     그대로 유지 — 그쪽은 한 번에 응답해야 해서 단계별 저장이 필요 없음)
3. [supabase/topics.ts](src/lib/supabase/topics.ts)에 `mergeTopicIntoCache` 추가 — 토픽 하나의
   결과를 캐시 배열에 즉시 병합 저장.
4. `pregenerateTodayMaterials`를 토픽 하나 안에서도 **article core → quiz/blanks(병렬) → 오디오**
   각 조각이 끝나는 즉시 `mergeTopicIntoCache`로 저장하도록 재작성. 재실행 시 `hasArticleCore`로
   이미 있는 조각은 재사용하고 없는 조각만 이어서 만듦(불필요한 재생성 방지).

**실증 검증**: 프로덕션에서 한 토픽의 blanks만 일부러 비운 뒤 배치 재실행 →
summary/quiz는 그대로 재사용(재생성 안 됨), blanks만 0→3개로 새로 채워짐, 15초 만에 완료(전체
재생성 시 56.8초였음). 나머지 4개 토픽은 손 안 댐. 의도대로 동작 확인 완료.

### 2. Section 5 안내 문구 변경
- "30단어 이내" → "30단어 내외" → 최종 "**영어 문장 1개~3개를 총 50단어 내외로**"
- [StudyView.tsx](src/components/StudyView.tsx)의 화면 문구와
  [writing-feedback/route.ts](src/app/api/writing-feedback/route.ts)의 채점 프롬프트 둘 다 동기화.
  이 텍스트는 토픽별 캐시 데이터가 아니라 코드에 고정된 문구라, 배포 즉시 모든 토픽에 적용됨.

### 3. 이메일 인증 관련 조사 + UI 정리
- Supabase 프로젝트(`tyfacrovbcwpnuudqeus`, 냉면/quest 프로젝트와 **공유**)는 현재
  `mailer_autoconfirm: true` — 이메일 인증이 꺼져 있어 가입/게스트→이메일 전환 시 인증 메일 없이
  즉시 로그인됨 (Supabase Auth API로 직접 검증 완료).
- 원인: Supabase 기본(비-커스텀 SMTP) 메일 서비스는 **그 프로젝트의 팀 멤버 이메일로만 발송
  가능**(공식 문서 확인) + 시간당 2통 제한 + SLA 없음. 실사용자 이메일로는 애초에 발송 자체가
  거부됨. 커스텀 SMTP(Resend 등) 없이는 이 프로젝트 규모에서 해결 불가 — 그래서 인증을 끈 이전
  결정이 맞는 판단이었음.
- [LoginOptions.tsx](src/components/LoginOptions.tsx)에 있던 오해 소지 있는 "가입 확인 이메일을
  보냈습니다. 메일함을 확인해주세요" 문구(실제로는 메일이 안 감)를 제거하고, 회원가입/게스트→이메일
  전환 성공 시 로그인과 동일하게 즉시 `onSuccess()` 호출하도록 변경. 안 쓰게 된 `notice` 상태도 정리.

### 4. 자잘한 UI 개선
- [AuthWidget.tsx](src/components/AuthWidget.tsx): 헤더 로그인 팝업에 닫기(✕) 버튼 추가(기존엔
  닫을 방법이 로그인 버튼 재클릭뿐이었음).
- [review/page.tsx](src/app/review/page.tsx): 주간 복습 헤더의 기사 제목 나열이
  `제목1 · 제목2 · ... 제목7`처럼 점으로 이어져 가독성이 나빴던 걸, **최대 3개 + "외 N건"**을
  각각 테두리 있는 칩으로 분리해서 표시하도록 변경.

### 5. GitHub 저장소 신설
- 상위 `D:\project1` 저장소는 커밋 이력 없고 이 프로젝트와 무관한 다른 자료가 섞여 있어서 그대로
  안 쓰고, `project3-news-english` 디렉터리 자체를 독립된 git 저장소로 `git init`.
- `.env*`는 `.gitignore`로 이미 제외돼 있어 시크릿 유출 없음(커밋 전 직접 확인함).
- `gh repo create daily-english-hub --private --source=. --remote=origin --push`로 신규 비공개
  저장소 생성 및 푸시. → https://github.com/roleflobot/daily-english-hub
- 이 문서 작성 직전, 위 4번(로그인 팝업 닫기 버튼 + 리뷰 페이지 칩) 변경분도 커밋·푸시 완료
  (커밋 `3a2156a`). **현재 로컬/배포/GitHub 세 곳이 모두 동기화된 상태.**

## 검토했지만 진행 안 하기로 한 것 (다시 꺼내지 않아도 됨)

- **Vercel/Supabase 리전을 서울로 이전**: 함수만 서울로 옮기면 DB(시드니)와 멀어져서 오히려
  느려질 수 있음(DB 왕복이 요청당 여러 번 있는 구조라). 진짜 이득 보려면 Supabase 프로젝트 자체를
  서울로 새로 만들어 데이터+인증(특히 익명 게스트 계정!)까지 마이그레이션해야 하는데, 이 프로젝트가
  quest(냉면)와 DB를 공유하고 있어 두 프로젝트 동시 전환이 필요하고, 효과 대비 리스크·공수가 커서
  보류하기로 함. (사용자 판단: "지금 굳이 할 가치는 없고 훨씬 빨라지는 것도 아닐 수 있다")

## 알아두면 좋은 아키텍처 불변식 (건드릴 때 주의)

- **3시 경계**: [date.ts](src/lib/date.ts)의 `getKstDateString()`은 모든 날짜 계산의 단일
  진입점. 자정 기준으로 되돌리면 예전 버그가 재발함.
- **오디오-텍스트 동기화**: summary가 재생성되면 오디오도 반드시 같이 재생성돼야 함
  (`madeAiContent`/`mergeTopicIntoCache` 흐름을 건드릴 때 이 불변식 유지할 것).
- **스키마 필드 추가 체크리스트**: `gemini.ts`에 새 필드를 추가할 때마다 최소 3곳을 함께 봐야 함
  — (1) `hasCompleteAiContent()`/`hasArticleCore()` 재생성 트리거 조건, (2) 렌더링 컴포넌트의
  하드코딩된 개수/조건(`StudyView.tsx` 등), (3) 그 필드를 받는 API route의 서버 검증 로직.
- **배치 저장은 "토픽 하나, 조각 하나" 단위로 즉시 커밋됨** (오늘 리팩터링 이후). `hasArticleCore`/
  `hasCompleteAiContent`/`needsQuiz`/`needsBlanks` 판단 로직을 수정할 때, "이미 있는 조각은
  건너뛰고 없는 것만 만든다"는 재실행 안전성이 깨지지 않는지 확인할 것.
- **Supabase 프로젝트(`tyfacrovbcwpnuudqeus`)는 quest(냉면 혼자 먹기) 프로젝트와 완전히 공유**
  중. 이 DB의 리전 이전, 스키마 변경, RLS 정책 변경 등은 항상 두 프로젝트 모두에 영향 준다는 것을
  염두에 둘 것.

## 다음에 할 일 (우선순위 순)

1. **내일 새벽 3시 실제 배치 확인**: 오늘 리팩터링한 로직(300초 제한 + 조각별 즉시 저장)이 실전
   크론에서 의도대로 5개 전부(텍스트+오디오) 완성하는지 확인. 문제 있으면 위 "1. 새벽 배치 부분
   실패 버그" 섹션의 코드가 1차 확인 대상.
2. **(선택, 사용자가 관심 표명한 아이디어) Section 6: AI와 STT 음성 대화**: 뉴스 주제/필수 단어를
   활용해 학습자가 영어로 자기 의견을 말하는 학습 장치. 논의된 방향:
   - 브라우저 내장 Web Speech API는 크로스브라우저 지원이 나빠서(Safari 등) 비추천.
   - 대신 `MediaRecorder`로 마이크 녹음만 브라우저에서 하고, 오디오 블롭을 서버로 올려
     Gemini(멀티모달 오디오 입력, 이미 TTS에 쓰는 것과 같은 계열)에 보내 "받아쓰기 + 이해도 평가"를
     한 번에 처리하는 방식을 추천함 — Section 5(영작 첨삭)와 동일한 "제출 → 대기 → AI 응답" 턴
     기반 UX 패턴이라 앱의 나머지 부분과 일관성 있음.
   - 이 방식은 "간단한 대화"(턴 기반, 몇 마디 주고받기) 수준엔 충분하지만, 실시간으로 자연스럽게
     끼어들 수 있는 "전화 통화"급 대화는 안 됨 — 그러려면 Gemini Live API 같은 스트리밍 전용 음성
     API가 필요(훨씬 큰 작업, 지금 범위 아님).
   - 멀티턴 대화 맥락은 Gemini 호출 시 이전 대화 내용을 계속 같이 넘겨주면 됨(어렵지 않음).
   - 아직 설계/구현 전혀 시작 안 함 — 사용자가 먼저 꺼내면 진행.
3. 사용자가 발표(미니프로젝트3 시연) 준비 중이었음 — 코드 관련 요청이 없으면 먼저 나서서 발표
   내용을 건드리지 말 것.

## 참고

- 배포: https://daily-english-hub-liard.vercel.app
- Vercel 프로젝트: `possuntix-9644s-projects/daily-english-hub`
- GitHub: https://github.com/roleflobot/daily-english-hub (private)
- Supabase 프로젝트 ref: `tyfacrovbcwpnuudqeus` (quest/냉면 프로젝트와 공유)
