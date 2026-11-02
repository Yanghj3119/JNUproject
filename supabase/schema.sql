-- 새로 시작할 때: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- (이미 예전 schema 를 실행했다면 이 파일 대신 migrate_auth.sql 을 실행하세요)
-- 모든 테이블은 RLS 로 "로그인한 본인의 행"만 읽고 쓸 수 있습니다.

-- 위시리스트: 사진·장소
create table if not exists favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source text not null,          -- 'photo' | 'place'
  item_id text not null,
  title text not null,
  image text,
  created_at timestamptz default now(),
  unique (user_id, source, item_id)
);
alter table favorites enable row level security;
create policy "favorites own read"   on favorites for select using (auth.uid() = user_id);
create policy "favorites own insert" on favorites for insert with check (auth.uid() = user_id);
create policy "favorites own delete" on favorites for delete using (auth.uid() = user_id);

-- AI 가이드가 만들어 준 코스(경로) 저장
create table if not exists routes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  summary text,
  stops jsonb not null,          -- [{name, note, id, addr, lat, lng, image, leg_km}]
  created_at timestamptz default now()
);
alter table routes enable row level security;
create policy "routes own read"   on routes for select using (auth.uid() = user_id);
create policy "routes own insert" on routes for insert with check (auth.uid() = user_id);
create policy "routes own delete" on routes for delete using (auth.uid() = user_id);

-- AI 가이드 대화 기록 (로그인한 경우만 저장)
create table if not exists chat_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  question text not null,
  answer text not null,
  tools jsonb,                   -- 에이전트가 호출한 도구 목록
  created_at timestamptz default now()
);
alter table chat_logs enable row level security;
create policy "chat own read"   on chat_logs for select using (auth.uid() = user_id);
create policy "chat own insert" on chat_logs for insert with check (auth.uid() = user_id);
