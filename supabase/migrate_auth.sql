-- 예전(닉네임 방식) schema.sql 을 이미 실행한 프로젝트용 — SQL Editor 에서 한 번만 Run
-- 기존 행(닉네임으로 저장된 것)은 user_id 가 비어 있어 로그인 후에는 보이지 않습니다. (실습 데이터라 그대로 둡니다)

-- 1) favorites : 닉네임 → 로그인 사용자
alter table favorites add column if not exists user_id uuid default auth.uid() references auth.users on delete cascade;
alter table favorites alter column nickname drop not null;
drop policy if exists "favorites read"   on favorites;
drop policy if exists "favorites insert" on favorites;
drop policy if exists "favorites delete" on favorites;
create policy "favorites own read"   on favorites for select using (auth.uid() = user_id);
create policy "favorites own insert" on favorites for insert with check (auth.uid() = user_id);
create policy "favorites own delete" on favorites for delete using (auth.uid() = user_id);
create unique index if not exists favorites_user_item on favorites (user_id, source, item_id);

-- 2) chat_logs
alter table chat_logs add column if not exists user_id uuid default auth.uid() references auth.users on delete cascade;
alter table chat_logs alter column nickname drop not null;
drop policy if exists "chat read"   on chat_logs;
drop policy if exists "chat insert" on chat_logs;
create policy "chat own read"   on chat_logs for select using (auth.uid() = user_id);
create policy "chat own insert" on chat_logs for insert with check (auth.uid() = user_id);

-- 3) routes : 새 테이블
create table if not exists routes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  summary text,
  stops jsonb not null,
  created_at timestamptz default now()
);
alter table routes enable row level security;
create policy "routes own read"   on routes for select using (auth.uid() = user_id);
create policy "routes own insert" on routes for insert with check (auth.uid() = user_id);
create policy "routes own delete" on routes for delete using (auth.uid() = user_id);
