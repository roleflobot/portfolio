-- Daily English Hub — News English
-- Supabase SQL Editor에서 실행하세요.

create table if not exists learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  topic text,
  category text,
  news_title text not null,
  news_url text,
  news_description text,
  ai_content jsonb not null,
  -- 지문 낭독 TTS 오디오(WAV)를 base64 텍스트로 저장한다. 새벽 배치가 daily_topics에
  -- 미리 만들어둔 걸 그대로 복사해오므로, 재생 버튼을 눌러도 API 호출 없이 즉시 재생된다.
  audio_base64 text,
  user_answers jsonb,
  score integer,
  created_at timestamptz not null default now()
);

create index if not exists learning_sessions_created_at_idx
  on learning_sessions (created_at desc);

create index if not exists learning_sessions_user_id_idx
  on learning_sessions (user_id);

-- 로그인은 필수가 아니지만(REQ-03), 모든 방문자는 Supabase 익명 로그인으로
-- 고유한 auth.uid()를 부여받는다(AuthProvider 참고). 그래서 user_id가 비는 경우가
-- 없고, "본인 것만" 정확히 제한할 수 있다 — 예전처럼 user_id is null을 열어두면
-- 모든 게스트가 서로의 기록을 보게 되므로 그 예외는 두지 않는다.
alter table learning_sessions enable row level security;

create policy "select own sessions"
  on learning_sessions for select
  using (auth.uid() = user_id);

create policy "insert own sessions"
  on learning_sessions for insert
  with check (auth.uid() = user_id);

create policy "update own sessions"
  on learning_sessions for update
  using (auth.uid() = user_id);

-- 하루치 "오늘의 뉴스 5개" 캐시.
-- 여러 사용자가 같은 날 홈 화면을 열 때마다 Gemini를 다시 호출하면 비용도 늘고
-- 사용자마다 다른 5개를 보게 되므로, 날짜(KST)당 한 번만 선정해 모든 사용자가 공유한다.
-- 최근 며칠치 topics를 다음 날 주제 선정 시 "반복 회피 참고용"으로도 사용한다.
-- 개인 데이터가 아니라 그날의 공용 콘텐츠이므로 RLS는 비활성으로 둔다.
create table if not exists daily_topics (
  date date primary key,
  topics jsonb not null,
  -- 새벽 pregenerate 배치가 학습자료를 만드는 중이면 true.
  -- 이 시간에는 즉석 생성으로 폴백하지 않고 "업데이트 중" 안내만 보여줘
  -- 학습자마다 다른 버전의 자료를 보는 상황을 막는다.
  is_pregenerating boolean not null default false,
  created_at timestamptz not null default now()
);

alter table daily_topics disable row level security;

-- 지문 낭독 TTS 오디오는 daily_topics.topics(jsonb)에 넣지 않고 여기 따로 둔다.
-- 홈 화면은 매 방문마다 topics 전체를 읽는데, 오디오(약 200~300KB/개)를 같이 넣으면
-- 아무도 안 쓰는 홈 화면 요청마다 5개 x 250KB ≈ 1.2MB를 매번 전송하게 되어 느려진다.
create table if not exists topic_audio (
  date date not null,
  representative_title text not null,
  audio_base64 text not null,
  created_at timestamptz not null default now(),
  primary key (date, representative_title)
);

alter table topic_audio disable row level security;

-- 복습(리뷰) 페이지에서 "그 주에 낸 문제"를 기록해, 다 낼 때까지 같은 단어/문장을
-- 중복 출제하지 않게 한다. week_key는 달력 주(월요일 시작) 기준 고정 키라 매일 바뀌지 않는다.
-- 중복 없이 낼 수 있는 항목이 모자라면(< 요청 개수) 해당 (user, week, kind) 행을 지우고
-- 처음부터 다시 무작위+중복 금지를 수행한다 — 그래서 delete 정책도 필요하다.
create table if not exists review_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key text not null,
  kind text not null check (kind in ('vocab', 'blank')),
  item_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_key, kind, item_key)
);

create index if not exists review_progress_lookup_idx
  on review_progress (user_id, week_key, kind);

alter table review_progress enable row level security;

create policy "select own review progress"
  on review_progress for select
  using (auth.uid() = user_id);

create policy "insert own review progress"
  on review_progress for insert
  with check (auth.uid() = user_id);

create policy "delete own review progress"
  on review_progress for delete
  using (auth.uid() = user_id);
