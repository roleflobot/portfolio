# 수동 재구현 작업 로그 — 프로젝트 1 (고객 VOC 분석 Agent)

## ✅ 2026-08-06 세션 — 다중 아이템 버그 수정 완료 (사용자 지시로 이번엔 AI가 MCP로 직접 수정)

**배경**: 아래 "다음 세션 인수인계" 절의 미해결 버그를 사용자가 이어서 확인해달라고 요청. 이번 세션은 원래 원칙(사용자가 UI로 직접 수동 재구현)과 달리, 제출 기한이 임박한 점을 고려해 **사용자가 명시적으로 "MCP로 네가 직접 찾아서 수정해"라고 지시**하여 Claude가 n8n MCP 쓰기 도구로 `zZxpxTUVhUh2Vvon`을 직접 수정함.

### 원인 확정 (execution #455 실측)

- `02_Google_Sheets_Trigger`가 T1(물품번호 12345)·T4(물품번호 45678) 2개 아이템을 동시 감지 → `02_Normalize_Input`까지는 정상(pairedItem 0/1 개별 유지)
- `03_Search_Analysis_Sheet`(Google Sheets "Get row(s)")는 **여러 입력 아이템을 받아도 아이템별 독립 실행을 하지 않음** — 첫 번째 아이템(T1)의 필터값으로 딱 한 번만 실행되어 T1 매칭 행 3개만 반환, T4는 완전히 버려짐(출력 아이템들의 `pairedItem`이 0/1/2로 그냥 순차 부여된 것으로 "1회만 실행됨"을 직접 확인). 로그에 적어둔 가설 (a) 확정.

### 적용한 수정 (MCP `update_workflow`)

1. `02_Normalize_Input` → `03_Search_Analysis_Sheet` 사이에 **`Loop_Over_Items`(n8n-nodes-base.splitInBatches, batchSize=1)** 신규 삽입 — 트리거가 여러 행을 동시에 감지해도 파이프라인이 아이템 1개씩 순차 처리되도록 강제.
2. 종료 지점 3곳(`05_Stop_Duplicate`, `11_Send_Discord_Webhook`, 신규 `12_End_Normal`) 전부 `Loop_Over_Items`로 되돌리는 연결 추가 — 한 아이템 처리가 끝나면 다음 아이템으로 이어짐.
3. `12_End_Normal`(NoOp) 신규 생성, `10_Is_Urgency_High`의 false 분기에 연결(기존에 없던 노드, 남은 작업 목록 항목 중 하나였음).
4. **검증**: `test_workflow`로 T1+T4를 동시에 넣고 실행(execution #456) — `03_Search_Analysis_Sheet`/`04_Is_Duplicate`/`08_Generate_Ticket_Metadata`/`10_Is_Urgency_High`/`12_End_Normal` 전부 **2회씩 독립 실행**되었고, `08_Generate_Ticket_Metadata`의 두 실행 결과에 T1·T4 데이터가 각각 온전히 존재함을 실제 실행 데이터로 확인. `Loop_Over_Items`가 `noItemsLeft:true, done:true`로 정상 종료. **버그 수정 확정.**

### 부가 발견 및 수정 — 11_Send_Discord_Webhook

- 위 수정을 적용하는 `update_workflow` 호출에서 `validate_node_config` 경고 발생: 네이티브 Discord 노드(`n8n-nodes-base.discord`)에 필수 파라미터 `operation`이 비어있음. 로그에 이미 적어둔 GitHub #19741 위험(webhook 인증 시 content 필드 숨김)과 별개로, 설정 자체가 미완성 상태였음.
- 사용자 확인 후, 원본 워크플로우(`4Ag7zWpG2RHM9jtt`)가 실제로 채택한 해법과 동일하게 **HTTP Request 노드(`authentication: none`)로 교체**. `discordWebhookApi`(Discord Bot account, id `0rhepYU5d0r021FZ`) credential의 `webhookUri` 필드가 password 마스킹되어 있어 `$credentials.webhookUri` 표현식으로 URL을 읽을 수 없다는 것이 원본에서 이미 확인된 사실이므로, **url 필드는 빈 문자열로 남겨둠 — 사용자가 n8n UI에서 실제 Discord webhook URL을 직접 입력해야 함**(AI가 URL 값을 보거나 기록하지 않음). content 메시지 구성(5요소: 접수번호/category·sentiment/summary/원문/접수시각)은 기존 것 그대로 유지.
- 재검증 결과 `validationWarnings: []`로 통과.

### 원본 MCP 빌드 워크플로우(4Ag7zWpG2RHM9jtt)도 같은 잠재 버그 있음 — 미수정

- 사용자 질문에 답하기 위해 원본 워크플로우 구조·실행 이력을 직접 대조 확인. **구조가 완전히 동일**(`Get row(s)` 앞에 아이템별 격리 장치 없음) → 동일한 잠재 결함이 존재함.
- 다만 실제 `mode:"trigger"` 실행(#390~#392 등)을 열어보면 매번 신규 행이 정확히 1개씩만 감지됨 — 폴링 주기(everyMinute)와 실제 Form 제출 간격이 우연히 겹치지 않아 **버그가 발현될 기회 자체가 없었을 뿐**, "중복 호출이 없어서 문제가 없었다"는 뜻은 아님. 신규 문의 2건이 같은 1분 폴링 창에 들어오면 원본도 동일하게 데이터 유실 위험 있음.
- 원본은 백업용으로 보존 방침(D-016 등)이라 이번 세션에서 손대지 않음. 최종 제출물은 어차피 `zZxpxTUVhUh2Vvon`(수동 재구현본)로 확정되어 있으므로 실질적 영향 없음.

### 사용자 액션 완료 — Discord 실제 발송 성공 확인 (스크린샷으로 확인)

- 사용자가 n8n UI에서 `11_Send_Discord_Webhook`의 url 필드에 실제 webhook URL을 직접 입력(AI는 값을 보거나 기록하지 않음).
- `10_Is_Urgency_High` 입력에 T4 데이터(접수번호 VOC-20260806-457, category=결제, sentiment=부정, urgency=상)가 정상적으로 들어와 있는 상태에서 `11_Send_Discord_Webhook`을 Execute Step으로 실행 → **실제 Discord 채널("Spidey Bot")에 5요소(접수번호/분류/요약/원문/접수시각) 메시지가 정상 수신됨을 스크린샷으로 확인.**
- T4류(urgency=상) 케이스가 06_LLM_Classify~11_Send_Discord_Webhook까지 실제로 완주하고 Discord 발송까지 성공하는 것을 실증 완료. 위 "다음에 할 일" 1·2번 항목 모두 완료 처리.
- **주의**: url 필드에 평문 webhook URL이 그대로 저장되어 있음 — 기존에 알려진 Secret Scan 항목(제출용 JSON 다운로드 전 마스킹 필요)이 이 노드에도 동일하게 적용됨.

### T05~T12 테스트 완료 (2026-08-06, 같은 세션 이어서 진행)

`test_workflow` + Pin Data로 8건 전부 통과 확인(상세: `tests/test-results.md` "수동 재구현 워크플로우 — T05~T12" 절).

- T05/T06(urgency=상, 명시적 환불·언론제보): Discord 분기 정상
- T07/T08/T09(중복판정 3조합 — 완전동일/물품번호만 같음/문의내용만 같음): dedupe_key 설계(D-009) 정확히 동작
- T10/T11/T12(REQ-05 검증 안전판 — 잘못된 category/JSON 아님/summary 초과): fallback 정확히 적용, 워크플로 중단 없음

### REQ-05 Pin Data 4케이스 독립 검증 완료 (2026-08-06, 같은 세션 이어서 진행)

필드 누락/허용값 위반/타입 불일치/비-JSON 4건 전부 `test_workflow`로 통과 확인(상세: `tests/test-results.md` "REQ-05 안전판 4케이스" 절). 4건 모두 워크플로 중단 없이 fallback 적용, Sheet 저장 진행, Discord 미실행.

### 실제 Publish 후 실제 Form 제출 검증 완료 (2026-08-06, 같은 세션 이어서 진행)

사용자가 시트/Form 이름을 "원마켓 고객 문의 접수"로 정리(documentId는 불변, 이름만 변경 — 기능 영향 없음 확인)하고 워크플로우를 직접 Publish(`active:true`). 이후 실제 Google Form 5건 제출 → `mode:"trigger"` 실제 프로덕션 실행 5건(#470~#474) 전부 `status:success`, 실제 Gemini 분류·실제 Sheet 저장·urgency=상 2건(#472/#473) 실제 Discord 발송 성공까지 확인(사용자 Discord 스크린샷과 실행 로그 일치). 상세: `tests/test-results.md` "실제 Publish 후 실제 Form 제출 검증" 절.

**중요**: 이전까지의 T05~T12·REQ-05 4케이스는 전부 `test_workflow`(Pin Data)라서 03/06/09/11이 항상 가짜 데이터로 대체되어 실제 외부 서비스를 하나도 안 탔음 — 사용자가 이 한계를 정확히 지적하여 실제 Publish + 실제 Form 제출 단계로 넘어감. 이번 5건 실제 실행으로 결정론적 로직(Pin Data)과 실제 통합(Gemini/Sheets/Discord) 양쪽 모두 검증 완료.

### ⚠️ 중요 정정 — "필수 요건" 범위 재확인 (2026-08-06)

사용자가 실제 과제 원문(개발 요청서) 스크린샷을 공유하며 확인: **이 저장소의 `프로젝트1_VOC_분석_Agent_개발명세_v4_전체프로젝트연계.md`는 실제 과제 원문이 아니라, 이전 세션이 "Claude Code·Codex 공동 MCP 개발용"으로 자체 확장해서 만든 내부 작업 문서**(문서 1행에 스스로 명시). 실제 채점 기준은 REQ-01~REQ-07(핵심 기능)과 "4. 제출 안내"뿐이며, 다음은 전부 자체 추가한 범위로 실제 요건이 아님:

- T01~T15 테스트 카탈로그, Secret Scan을 별도 체크리스트 항목으로 명시한 것
- D-001~D-020 의사결정 기록, Task ID 체계, Agent Handoff 프로토콜
- 3개 프로젝트 사용량 배분 원칙

**실제 제출 요건(원문 그대로)**:
1. `미니프로젝트1_이름.md` — 구글폼 링크·구글 시트 링크 반드시 포함, 구현한 전체 워크플로우 설명
2. 구글폼 → 시트 → n8n 전체 워크플로우 → 디스코드 응답, 총 4장 스크린샷
3. n8n Download로 받은 workflow JSON
4. 위 파일들을 zip으로 압축
5. 제출 기한 2026-08-09(일) 23:59

이후 작업은 이 실제 요건 기준으로만 진행. T13~T15 별도 테스트는 진행하지 않기로 함(REQ 기능 자체는 이미 실제 운영 환경에서 충분히 검증됨).

### 제출 준비 진행 상황 (2026-08-06)

- 스크린샷 4장 전부 확보 완료: Google Form(`원마켓 고객 문의 접수`), Google Sheet(응답 탭 + 분석 결과 탭), n8n 전체 워크플로우 캔버스(Published 상태), Discord 응답(urgency=상 다건 실시간 발송 확인, "신규" 배지 포함 버전 채택)
  - 응답 탭 스크린샷에서 사용자가 직접 실제 중복 재제출 테스트(물품번호 45678 동일 내용 재입력)를 했고, 분석 결과 탭에 해당 중복 건이 추가되지 않았음을 시각적으로 확인 — REQ-03 실제 운영 검증 증거로 활용 가능
- `미니프로젝트1_박정호.md` 작성 완료(구글폼 viewform 링크, 구글시트 링크, 노드별 설명, REQ-01~07 충족 내역, 실제 운영 검증 내용 포함). 폼 edit 링크는 보안상 제외하고 viewform(공개 제출용) 링크만 사용.

### 노드 이름 정리 및 재-Publish (2026-08-06, 같은 세션 이어서 진행)

버그 수정 과정에서 나중에 추가되어 번호 없이 남아있던 두 노드 이름 정리:
- `Loop_Over_Items` → `03_Loop_Over_Items`
- `Code in JavaScript` → `07_Parse_Validate_JSON`

두 노드 모두 다른 노드에서 `$('이름')`으로 참조되지 않음을 사전 확인 후 진행(표현식 깨질 위험 없음 — `02_Normalize_Input`은 개명 대상이 아니라서 그 노드를 참조하는 `06_LLM_Classify`/`07_Parse_Validate_JSON`의 `$('02_Normalize_Input')` 참조도 영향 없음). `update_workflow`의 `renameNode` 연산이 connections까지 자동으로 갱신함을 `get_workflow_details` 재조회로 확인. 사용자 승인 후 재-Publish 완료(`activeVersionId=8b6d990c-9a56-4fb8-818d-b82e032a1c70`). 이 시점 이후 n8n 워크플로우 캔버스 스크린샷·Download JSON은 새 이름 기준으로 다시 확보 필요(이전에 캡처한 스크린샷은 옛 이름 기준이라 교체 필요).

### 남은 작업

1. n8n 캔버스 스크린샷 재캡처(새 노드 이름 반영) — 미니프로젝트 md의 노드 표는 이미 새 이름으로 작성되어 있어 그대로 사용 가능
2. n8n Download로 workflow JSON 파일 받기 → 사용자가 로컬에 저장한 경로 공유 → 11_Send_Discord_Webhook의 실제 webhook URL 마스킹한 제출용 복사본 제작
3. 위 파일들(md, 스크린샷 4장, 마스킹된 JSON) zip 압축

## 🔴 다음 세션 인수인계 (2026-08-06 작성, 컨텍스트 윈도우 초과로 세션 종료)

**제출 기한: 2026-08-09(일) 23:59 — 이 문서 작성 시점 기준 약 3일 남음.**

### 지금 당장 해야 할 일 — 미해결 치명적 버그

`03_Search_Analysis_Sheet`(중복 조회 노드)가 **트리거가 신규 행을 2개 이상 동시에 감지했을 때 오작동**한다.

- 실행 #455에서 T1(기존 행)과 T4(신규 행)가 동시에 감지됨
- `03_Search_Analysis_Sheet` 출력이 **T1의 매칭 결과 3개만** 나오고, **T4에 대한 결과가 전혀 없음**(매칭이든 빈 값이든 아무것도 안 나옴)
- 그 결과 `04_Is_Duplicate`가 이 3개를 전부 True(중복)로 판정 → `05_Stop_Duplicate`에서 종료 → **T4가 06~11번을 전혀 안 타고 사라짐**
- 지금까지 테스트는 항상 신규 행이 1개일 때만 했어서 이 문제가 안 드러났었음 — 여러 아이템이 동시에 들어올 때만 발생하는 버그

**다음 세션에서 확인할 것:**
1. "분석 결과" 시트(복사본, gid 566082185)를 직접 열어서 T1의 dedupe_key(`12345::오늘 출고된다고...`)와 일치하는 행이 몇 개 있는지 확인(09번 반복 테스트로 중복 저장된 것으로 추정, 아마 3개 이상)
2. `03_Search_Analysis_Sheet`가 여러 입력 아이템을 받을 때 정말로 아이템별 독립 조회를 하는지, 아니면 배치로 묶여서 처리되는지 실행 로그로 다시 확인
3. 원인에 따라 수정 — 가능성: (a) Google Sheets "Get row(s)" 노드가 다중 아이템 입력 시 실제로 per-item 실행이 안 되는 구조적 한계일 수 있음(이 경우 Split In Batches/Loop Over Items로 감싸서 한 번에 1개씩 처리하게 만들어야 할 수도 있음), (b) `alwaysOutputData`가 "일부 아이템은 매칭, 일부는 0건"인 상황에서 0건인 아이템에 빈 아이템을 못 만들어주는 것일 수 있음
4. 고친 후 T1+T4를 동시에 다시 넣고(또는 순차적으로) 재현 테스트

### 그 다음 — T4가 06~11까지 정상 도달하는지 확인

버그가 고쳐지면, T4(urgency=상 케이스)가 06(LLM 분류: category=결제 예상)→07→08→09→**10(True)→11(Discord 발송)**까지 가는지 최종 확인. 11번은 네이티브 Discord 노드(Connection Type: Webhook)로 만들어져 있는데, **이 노드가 webhook 인증 시 content 필드를 숨기는 알려진 n8n 버그(GitHub #19741)에 걸릴 수 있다는 경고를 이미 해뒀음** — 실제로 걸리면 HTTP Request 노드로 교체(원본 워크플로우가 실제로 이 이유로 그렇게 함).

### 현재까지 완성된 노드 상태 (workflow_id: zZxpxTUVhUh2Vvon, "Project 1 VOC")

| 노드 | 상태 |
|---|---|
| 02_Google_Sheets_Trigger ~ 05_Stop_Duplicate | 개별 테스트 완료, 정상 (다만 위 다중 아이템 버그 있음) |
| 06_LLM_Classify | 완성, 실제 Gemini 호출 성공 확인(Using Fields Below 방식으로 systemInstruction/contents/generationConfig 분리 입력). Retry On Fail(2회)/On Error(Continue using error output) 설정 완료, 에러 출력도 07로 연결됨 |
| 07(이름 미변경, "Code in JavaScript"로 표시됨) | 완성, Mode를 Run Once for Each Item으로 수정 완료, 정상 검증 확인 |
| 08_Generate_Ticket_Metadata | 완성, 정상 확인 |
| 09_Save_Analysis_Result | 완성, 실제 시트 저장 확인(다만 이 과정에서 T1 데이터로 반복 저장해서 "분석 결과"에 중복 행이 쌓여있을 가능성 높음 — 최종 제출 전 정리 필요). `discord_sent`가 문자열 `"false"`로 저장됨(boolean 아님, 낮은 우선순위 이슈) |
| 10_Is_Urgency_High | 완성, urgency=하일 때 False로 정상 라우팅 확인 |
| 11_Send_Discord_Webhook | 노드는 만들어짐(네이티브 Discord, Message 필드 작성 완료), **실제 발송 성공 여부는 위 버그 때문에 아직 검증 못함** |
| 12_End_Normal | **아직 안 만듦** — 10번 False 분기에 NoOp 추가 필요 |

### 기타 남은 작업 (버그 수정 후)

- 12_End_Normal 노드 추가
- T5~T12 나머지 xlsx 테스트 케이스 진행(REQ-03 중복 차단 T9/T10/T11은 T4가 먼저 저장 완료된 후에 순서대로)
- REQ-05 Pin Data 4케이스 독립 검증(필드 누락/허용값 위반/타입 불일치/비-JSON) — 아직 미착수
- "분석 결과" 시트의 테스트용 중복 행 정리
- 노드 07 이름을 `07_Parse_Validate_JSON`으로 변경(선택, 급하지 않음)
- 필수 스크린샷 4장, 제출용 Markdown 작성, Secret Scan(Discord webhook URL 마스킹 — 11번 노드에 실제 URL이 평문으로 들어있음, JSON 다운로드 전 반드시 마스킹)
- 원본 AI 빌드 워크플로우(4Ag7zWpG2RHM9jtt)는 백업용으로 보존 중, 건드리지 않음

### 이번 세션에서 별도로 처리한 것 (VOC와 무관, 참고용)

- 날씨 영어 디스코드 워크플로우(ZuReG65DM3u2wQGN): Simple Memory 미작동 문제 Data Table로 해결, credential 삭제 사고로 깨진 Gemini 참조 복구
- TelENGNews 워크플로우(Auw1F88eN37LenhC): 텔레그램 웹훅 충돌(다른 워크플로우와 봇 공유) 해결, 삭제된 Gemini credential 재연결, 모델을 3.6-flash로 통일, 뉴스 제목이 불확실한 전망을 단정적으로 표현하던 프롬프트 버그 수정
- 프로젝트 3 아키텍처 논의: 기존 n8n 워크플로우(날씨+뉴스)를 데이터 생성 엔진으로 유지하고, Next.js+Supabase+Vercel+Gemini로 최소 웹앱을 얹는 절충안으로 합의(과제가 실제 웹서비스 배포를 요구하기 때문). 아직 구현 시작 안 함 — 별도 문서화 필요할 수 있음.

---

> 목적: n8n MCP 자동화로 이미 완성·검증된 워크플로우(workflow_id: 4Ag7zWpG2RHM9jtt)를 사용자가 직접 UI로 수동 재구현하며 부트캠프 과제의 학습 의도(설계·디버깅 경험)를 되짚는 연습.
> 이 로그는 실제 워크플로우 파일과 무관한 **별도 문서**이며, 제출용 Markdown 작성 시 "직접 겪은 문제/해결" 근거로 활용 목적.
>
> **2026-08-06 결정**: 이 수동 재구현 워크플로우를 **최종 제출물로 사용**하기로 결정함. 원본 AI 빌드 워크플로우(4Ag7zWpG2RHM9jtt)는 삭제하지 않고 백업/보험용으로 보존(필요 시 재-Publish). 제출 기한: 2026-08-09(일) 23:59.
>
> **사고 기록 및 원인 규명**: 수동 워크플로우의 HTTP Request(LLM) 노드 Authentication 설정 중, 원본과 공유되는 유일한 "Google Gemini(PaLM) Api account" credential(id: uQfqFf6pGdihOFQM)의 API Key 필드가 반복적으로 Discord Webhook URL로 바뀌는 현상 발생. 처음엔 브라우저 자동완성/확장 프로그램 문제로 추정하고 시크릿 창·타 브라우저(Edge→Chrome) 테스트까지 진행했으나, **진짜 원인은 n8n의 마스킹된 credential 필드 동작 방식**이었음:
> - 저장된 비밀값(API Key)을 "Expression" 모드로 전환하면, n8n은 보안상 실제 값을 절대 노출하지 않고 `__n8n_BLANK_VALUE_{uuid}` 형태의 내부 placeholder 텍스트를 대신 보여준다.
> - 이 상태(placeholder가 보이는 상태)에서 실수로 **Save를 누르면, 그 placeholder 문자열 자체가 진짜 값으로 덮어써져** credential이 깨진다.
> - 결론: "Fixed/Expression" 토글은 저장된 값을 스스로 바꾸는 게 아니라, Expression 모드에서 보이는 더미 텍스트를 인지하지 못한 채 저장 버튼을 누르는 사용자 실수가 반복 원인이었음. 이후 Fixed 모드 유지 + Expression 모드에서는 절대 Save하지 않는 규칙으로 해결. 같은 credential을 참조하는 모든 워크플로우(원본 포함)에 동시에 반영됨(credential은 워크플로우별 복제가 아니라 단일 공유 레코드이기 때문).
> - 재발 방지를 위해 수동 워크플로우용 Gemini credential은 별도로 새로 생성 검토 중. 원본 워크플로우는 이 사고와 별개로 사용자가 의도적으로 unpublish한 상태였음(작업 중 안전을 위해) — 제출 대안으로 쓸 경우 재-Publish 필요.

## 격리 전략 (원본 데이터 보호)

- 처음엔 스프레드시트만 복사 → "분석 결과" 탭에 데이터/헤더 문제 발생 확인
- 최종적으로 **Google Form도 복사**하여 완전히 새로운 응답 시트를 자동 생성 → "분석 결과" 탭은 원본에서 헤더만 복사해서 수동 추가
- 원본 시트/Form은 절대 건드리지 않음 — 기존 활성 워크플로우(4Ag7zWpG2RHM9jtt)와 이중 트리거되는 것을 방지

## 01_Google_Sheets_Trigger

- Row Added + Every Minute 폴링으로 설정. REQ-02("수동 실행만 되면 미완성") 충족 확인.

## 02_Normalize_Input (Edit Fields / Set)

| 문제 | 원인 | 해결 |
|---|---|---|
| JSON Mode로 만들면 정규식 이스케이프가 복잡해짐 | Set 노드의 "JSON" 모드는 전체를 JSON 문법으로 다뤄야 해서 `\s+` 같은 정규식에 이중 escape 필요 | "Manual Mapping" 모드로 전환, Add Field로 필드별 개별 입력 |
| 필드를 자동 매핑하면 원본 열 이름이 그대로 유지됨(정규화 안 됨) | Schema에서 자동 매핑 시 원본 이름 그대로 셀프 매핑됨 | 표준 영문 필드명으로 직접 재입력 |
| `normalized_inquiry`, `dedupe_key` 필드가 통째로 빠짐 | 자동 매핑은 원본 열만 복사, 파생 필드는 안 만들어줌 | Add Field로 두 필드 수동 추가 |
| `물품 번호`가 Number 타입으로 자동 잡힘 | 자동 타입 추론이 숫자로 인식 | String으로 변경 — 5자리 숫자 앞자리 0(예: 01234)이 Number면 0이 사라져 dedupe_key 오작동 위험 |
| `dedupe_key`에 구분자(`::`)가 없어서 물품번호/문의내용 경계가 사라짐 | `{{물품번호}}{{문의내용}}`처럼 그냥 이어붙임 | `::` 리터럴 삽입 — 경계 없으면 "123"+"456..." 와 "1234"+"56..."이 같은 키가 되는 충돌 가능 |
| `dedupe_key`가 정규화 안 된 원본 문의내용을 참조 | n8n Set 노드는 **같은 노드 안에서 다른 필드(형제 출력)를 참조할 수 없음** — `$json`은 항상 노드의 원본 입력만 가리킴 | `normalized_inquiry`를 참조하는 게 아니라 `dedupe_key` 표현식 안에 `.toString().trim().replace(/\s+/g," ")`를 **독립적으로 다시** 작성 |
| `category`라는 필드명이 나중에 LLM 출력의 `category`와 이름이 겹쳐 덮어써질 위험 | REQ-04 LLM 출력 필드명도 정확히 `category` | `inquiry_type`으로 이름 변경해 충돌 회피 |
| `normalized_inquiry` 실제 계산값 앞에 리터럴 `=`가 붙어서 나옴(`"=오늘 출고된다고..."`) | 표현식 박스 맨 앞에 모드 전환용 `=`와는 별개로, 박스 **텍스트 자체에** `=`를 한 번 더 타이핑해서 `{{ }}` 바깥의 리터럴 문자로 남음 | 박스 맨 앞의 중복된 `=` 한 글자 삭제 |
| `inquiry_text`에 원본이 아니라 정규화된(공백 정리된) 값이 들어감 | 처음엔 원본/정규화본을 필드 하나로 합쳤음 | `inquiry_text`(원본 그대로)와 `normalized_inquiry`(정리된 버전, dedupe 전용)로 분리 |

### 정규화 로직(`.trim().replace(/\s+/g," ")`) 이해 정리
- `.trim()`: 문자열 **양 끝**의 공백/줄바꿈만 제거
- `.replace(/\s+/g," ")`: 문자열 **중간**에 낀 공백류(스페이스/탭/줄바꿈) 연속 덩어리를 스페이스 1개로 축소
- 이미 공백이 있던 자리에서 종류/개수만 다르면(`"결제가 안돼요"` vs `"결제가\n안돼요"`) → 정규화 후 같아짐
- 원래 공백이 없던 자리에 새로 공백이 생기면(`"안돼요"` vs `"안 돼요"`) → 정규화로도 다르게 남음(띄어쓰기 자체의 차이라 다른 영역의 문제)
- 공백을 완전히 삭제(collapse to "")하는 더 강한 정규화는 위험 — "아버지가 방에 들어가신다"와 "아버지 가방에 들어가신다"처럼 의미가 다른 문장이 우연히 같아질 수 있음 → 그래서 "삭제"가 아니라 "1개로 축소"만 적용(D-009와 동일한 설계 원칙)

## 03_Search_Analysis_Sheet (Get row(s) in sheet)

| 문제 | 원인 | 해결 |
|---|---|---|
| Sheet를 "응답"으로 잘못 설정 | 목적(과거 처리 결과 조회)과 다른 탭을 선택 | "분석 결과" 탭으로 수정 |
| Filter의 Column에 표현식 `{{ $json.dedupe_key }}`를 넣음 | Column은 "어떤 열 이름을 볼지"를 정하는 고정값이어야 하는데 표현식을 넣어서 실제 값(문의 내용)을 열 이름으로 오인 | Fixed 모드로 전환, 드롭다운에서 `dedupe_key` 열 직접 선택 |
| Column 드롭다운에 `dedupe_key`가 안 보임(응답 탭 열만 보임) | 복사본 시트의 "분석 결과" 탭에 헤더 문제(데이터 삭제 시 헤더까지 날아갔거나 캐시 문제) | 결국 Form을 복사해 새로 시작, "분석 결과" 탭 헤더를 원본에서 재복사 |
| 매칭 0건일 때 "No output data returned"로 워크플로우 정지 | 필터에 안 걸리면 기본적으로 아이템을 0개 출력 → n8n은 아이템 없는 노드에서 실행을 멈춤 | Settings → **"Always Output Data"** 켜기 — 0건이어도 빈 아이템 `{}`을 강제로 출력해서 다음 노드가 판단할 수 있게 함 |

## 04_Is_Duplicate (If)

| 문제 | 원인 | 해결 |
|---|---|---|
| Left Value를 `{{ $('Edit Fields').item.json.dedupe_key }}`로 참조 | 이건 **입력값(항상 존재)**의 dedupe_key라서 중복 여부와 무관하게 항상 true가 되는 치명적 로직 버그 | 바로 앞 노드(검색 결과)를 가리키는 `{{ $json.dedupe_key }}`로 수정 — 매칭 안 되면 undefined가 되어 정확히 판별 가능 |
| "Wrong type: ... is a string but was expecting a boolean" 에러 | 조건 타입이 Boolean으로 잡혀서 exists 비교와 안 맞음 | 타입을 String으로, 연산자는 `exists` 유지 |
| 빈 입력(`{}`)에서 드래그앤드롭으로 필드를 못 가져옴 | Schema 자체가 비어있어서(매칭 0건이라 필드가 없음) 드래그할 대상이 없음(기능 문제 아님) | 표현식 직접 타이핑(`{{ $json.dedupe_key }}`) |

**검증 결과**: 빈 아이템 입력 시 `Result: [undefined]` → False Branch(신규)로 정확히 라우팅 확인.

## 부가 디버깅 — 다른 워크플로우("날씨 영어 디스코드")의 Memory 미작동 문제 (프로젝트 3 대비)

VOC 프로젝트와는 별개인 개인 워크플로우에서, AI Agent에 연결된 `memoryBufferWindow`(Simple Memory)가 "형식 교대"와 "중복 회피" 둘 다 전혀 작동하지 않는 문제를 발견·해결. 이 경험은 프로젝트 3(에이전트/메모리 활용 예상)에 직결됨.

| 문제 | 원인 | 해결 |
|---|---|---|
| content_type이 매 실행 `expressions`로만 고정 | `memoryBufferWindow`는 **워크플로우 실행 간에 영속되지 않는 인메모리 방식** — 매 실행(스케줄/수동)마다 새 프로세스로 시작되어 `loadMemoryVariables`가 항상 `chatHistory: []`를 반환함(실제 실행 데이터로 확인: saveContext는 매번 성공하지만 다음 실행의 load는 항상 빈 배열) | n8n 내장 **Data Table**(자격증명 불필요, "workflow data storage"에 공식 추천)로 교체. AI Agent 실행 전에 최근 기록을 조회하고, **다음 content_type을 코드가 결정적으로 계산**해서 프롬프트에 주입(LLM의 판단에 맡기지 않음) — VOC 프로젝트에서 익힌 "결정적 로직은 코드로, 창의적 판단만 LLM에" 원칙을 그대로 적용 |
| 픽스 적용 중 "최근 기록 조회"(Data Table get)가 0건일 때 워크플로우가 멈춤 | 매칭 0건 → 기본적으로 아이템 0개 출력 (Google Sheets Get Row(s)와 동일한 n8n 공통 동작) | Always Output Data 설정 — VOC 프로젝트와 완전히 동일한 해결책 |
| Always Output Data가 만든 빈 아이템(`{}`)을 "실제 기록 1건"으로 오인해 `recent_history_text`가 `"- [undefined] (undefined) undefined"`로 오염됨 | 빈 아이템에는 `content_type` 필드가 없는데 이를 걸러내지 않고 그대로 사용 | Code 노드에서 `.filter(r => r && r.content_type)`으로 빈 아이템 제거 |
| "기록 저장"(Data Table insert)을 Agent와 Discord 사이에 끼워넣은 후 Discord 전송이 "Cannot send an empty message"로 실패 | Discord 노드의 `content`가 `{{ $json.output.discord_message }}`였는데, 이제 Discord의 직접 입력이 Agent가 아니라 "기록 저장"(Data Table insert 결과)이 되어 `output` 필드 자체가 없어짐 — VOC 프로젝트에서 3번 겪은 "노드를 거치며 필드명/구조가 바뀌는 지점" 버그의 4번째 사례 | `$('날씨 영어 학습자료 생성').item.json.output.discord_message`로 명시적 참조 |

**검증**: 실제 실행 2회 연속으로 `expressions → dialogue` 교대 확인, Data Table에 실제 행 2개 누적 확인, Discord 발송 성공(`{"success":true}`) 확인. 수정 완료 후 재-Publish까지 완료.

**교훈(프로젝트 3 사전 대비)**: n8n의 langchain `Simple Memory`/`Window Buffer Memory` 서브노드는 도구 호출을 반복하는 **단일 실행 내** 멀티턴에는 적합하지만, **스케줄/독립 트리거로 매번 새로 실행되는 워크플로우 간의 장기 기억에는 근본적으로 부적합**하다. 실행 간 상태를 유지해야 한다면 Data Table(또는 DB) 기반의 명시적 조회→주입→저장 패턴을 써야 한다.

## 진행 중 논의 — REQ-05 검증 방법론 (구현 전 사전 검토)

- Gemini에 `responseSchema`를 걸면 계약 위반이 자연 발생하기 거의 불가능 → Pin Data로 07(검증 노드) 앞에 가짜 응답을 주입하는 fault injection 방식이 정답(강사 확인 완료)
- `responseSchema` 없이 프롬프트만으로 JSON을 요청하면 실제 계약 위반이 더 자주 발생할 수 있음 — 강사가 상상한 "일반적인 구현"에 더 가까운 경로일 수 있음
- `needs_review`를 "무조건 false로 출력하라"는 프롬프트 지침만으로 강제하는 것은 코드 레벨 강제보다 약하지만(LLM이 지침을 무시할 잔여 위험 있음), 과제 범위에서는 충분하다고 판단
- 현재 다음 단계: True 분기 NoOp 완료 → False 분기에 LLM 분류 노드 연결 예정
