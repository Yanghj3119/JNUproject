-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ※ 아래 정책은 실습용(누구나 읽고 쓰기)입니다. 실제 서비스에서는 Supabase Auth 로 로그인한 사용자만 쓰게 바꾸세요.

-- 보관함(즐겨찾기): 사진·장소
create table if not exists favorites (
  id bigint generated always as identity primary key,
  nickname text not null,
  source text not null,          -- 'photo' | 'place'
  item_id text not null,
  title text not null,
  image text,
  created_at timestamptz default now(),
  unique (nickname, source, item_id)
);
alter table favorites enable row level security;
create policy "favorites read"   on favorites for select using (true);
create policy "favorites insert" on favorites for insert with check (true);
create policy "favorites delete" on favorites for delete using (true);

-- AI 가이드 대화 기록
create table if not exists chat_logs (
  id bigint generated always as identity primary key,
  nickname text not null,
  question text not null,
  answer text not null,
  tools jsonb,                   -- 에이전트가 호출한 도구 목록
  created_at timestamptz default now()
);
alter table chat_logs enable row level security;
create policy "chat read"   on chat_logs for select using (true);
create policy "chat insert" on chat_logs for insert with check (true);
