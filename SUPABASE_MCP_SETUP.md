# Supabase MCP 연동 기록

작성일: 2026-08-04  
대상 프로젝트: `quest`

이 문서는 Supabase Codex 플러그인 설치가 실패한 과정과, 공식 Supabase 원격 MCP를 직접 등록해 성공한 과정을 재현 가능하게 기록한다. OAuth URL, 액세스 토큰, API 키, 비밀번호는 기록하지 않는다.

## 최종 상태

- MCP 이름: `supabase`
- 전송 방식: Streamable HTTP
- 인증 방식: OAuth
- 상태: `enabled`
- 접근 범위: 현재 Supabase 프로젝트 하나로 제한
- 활성 기능: Database, Debugging, Development, Edge Functions, Storage
- 계정 전체 관리 기능: 활성화하지 않음
- 쓰기 도구: 실행 전에 승인을 요청하도록 프로젝트 설정에 지정

프로젝트 설정은 [`.codex/config.toml`](./.codex/config.toml)에 있다. OAuth 자격증명 자체는 이 저장소에 저장하지 않는다.

## 처음에 실패한 방법

추천 플러그인 목록의 `supabase@openai-curated-remote` 설치를 두 번 요청했다. 두 번 모두 브라우저에서 Supabase 인증을 승인했지만 Codex가 받은 최종 결과는 다음과 같았다.

```text
completed: false
user_confirmed: false
```

첫 시도와 재시도 모두 긴 대기 후 같은 결과로 끝났다. 따라서 Supabase 계정 로그인이 틀렸다고 보기보다, 다음 두 단계 사이에서 완료 신호가 전달되지 않은 것으로 판단했다.

```text
브라우저의 Supabase OAuth 승인
        ↓
플러그인 설치 화면이 Codex 세션에 완료 콜백 전달
```

핵심은 **Supabase 플러그인 설치와 Supabase MCP 연결이 같은 것이 아니라는 점**이다. 플러그인은 MCP와 관련 스킬을 한 번에 묶어 설치하는 편의 기능이고, 공식 원격 MCP는 플러그인 없이도 Codex에 직접 등록할 수 있다.

## 성공한 방법

플러그인 설치 경로를 우회하고 Codex CLI의 공식 MCP 등록 명령을 사용했다.

```powershell
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=tyfacrovbcwpnuudqeus&features=database%2Cdebugging%2Cdevelopment%2Cfunctions%2Cstorage"
```

이 명령은 다음 순서로 동작했다.

1. `supabase`라는 전역 MCP 서버 항목을 Codex 설정에 추가했다.
2. 서버가 OAuth를 지원하는 것을 Codex CLI가 감지했다.
3. 브라우저에서 Supabase 조직 접근을 승인했다.
4. 로컬 OAuth 콜백이 Codex CLI로 정상 복귀했다.
5. CLI가 `Successfully logged in.`을 출력했다.

일반 터미널 권한으로 실행한 확인 명령은 제한된 샌드박스 때문에 전역 Codex 설정을 보지 못한 적이 있었다. 샌드박스 밖의 일반 터미널에서 다시 확인하자 다음 상태가 표시됐다.

```text
Name      Status   Auth
supabase  enabled  OAuth
```

즉, 성공 여부는 브라우저에서 승인 화면을 눌렀는지만 보지 말고 **`codex mcp list`의 최종 상태까지** 확인해야 한다.

## 현재 프로젝트 설정

`.codex/config.toml`에는 다음 안전장치를 적용했다.

- `project_ref`로 이 프로젝트만 접근
- 필요한 기능 그룹만 활성화
- 계정 전체 프로젝트 관리 기능 제외
- 쓰기 도구는 승인 요청
- MCP가 일시적으로 응답하지 않아도 Codex 자체 시작은 허용

## 재시작이 필요한 이유

Codex 앱과 IDE 확장은 세션을 시작할 때 MCP 도구 목록을 읽는다. 실행 중에 MCP를 새로 설치해도 이미 열린 대화의 도구 목록은 자동으로 바뀌지 않을 수 있다.

설치 후에는 다음 순서로 확인한다.

1. Codex 또는 VS Code의 Codex 확장을 재시작한다.
2. 새 대화를 연다.
3. `Supabase MCP로 현재 테이블 목록을 확인해줘`라고 요청한다.
4. `list_tables`, `execute_sql`, `apply_migration` 같은 도구가 보이는지 확인한다.

## 재연결 및 점검 명령

```powershell
# 등록 상태 확인
codex mcp list

# Supabase MCP 상세 확인
codex mcp get supabase

# OAuth가 만료됐거나 인증이 풀린 경우
codex mcp login supabase
```

목록에 `supabase` 자체가 없다면 위의 `codex mcp add` 명령부터 다시 실행한다.

## 보안 규칙

- OAuth URL의 `state`, 인증 코드, 토큰을 문서·코드·채팅에 복사하지 않는다.
- 운영 데이터에 SQL이나 마이그레이션을 실행하기 전에는 실제 명령을 검토한다.
- 데이터 삭제, RLS 변경, 스키마 변경은 사용자의 명시적 지시 없이 실행하지 않는다.
- 가능하면 개발 프로젝트나 브랜치에서 먼저 검증한다.
- 프로젝트 범위 제한과 쓰기 승인 설정을 제거하지 않는다.

## 공식 문서

- [Supabase MCP Server](https://supabase.com/docs/guides/ai-tools/mcp)
- [Codex MCP 설정](https://learn.chatgpt.com/docs/extend/mcp.md)
