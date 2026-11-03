create table if not exists public.ai_usage_user (
  day date not null,
  user_id uuid not null,
  used int not null default 0,
  primary key (day, user_id)
);
create table if not exists public.ai_usage_total (
  day date primary key,
  used int not null default 0
);
-- 정책을 만들지 않아서 테이블은 직접 읽거나 쓸 수 없고, 아래 함수로만 접근한다
alter table public.ai_usage_user enable row level security;
alter table public.ai_usage_total enable row level security;

-- 한 번 쓸 때마다 호출: 한도 안이면 1 올리고 남은 횟수를, 넘었으면 이유를 돌려준다
create or replace function public.use_ai_edit()
returns json language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
  u uuid := auth.uid();
  n int;
  t int;
begin
  if u is null then return json_build_object('ok', false, 'reason', 'login'); end if;
  insert into ai_usage_total(day, used) values (d, 0) on conflict do nothing;
  insert into ai_usage_user(day, user_id, used) values (d, u, 0) on conflict do nothing;
  select used into t from ai_usage_total where day = d for update;
  select used into n from ai_usage_user where day = d and user_id = u for update;
  if t >= 500 then return json_build_object('ok', false, 'reason', 'total', 'left', 0); end if;
  if n >= 10 then return json_build_object('ok', false, 'reason', 'user', 'left', 0); end if;
  update ai_usage_total set used = used + 1 where day = d;
  update ai_usage_user set used = used + 1 where day = d and user_id = u;
  return json_build_object('ok', true, 'used', n + 1, 'left', 10 - n - 1);
end $$;

-- 화면에 남은 횟수를 보여 주려고 읽기만 하는 함수
create or replace function public.ai_edit_left()
returns json language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
  n int := 0;
  t int := 0;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'reason', 'login'); end if;
  select coalesce(max(used), 0) into n from ai_usage_user where day = d and user_id = auth.uid();
  select coalesce(max(used), 0) into t from ai_usage_total where day = d;
  return json_build_object('ok', true, 'left', greatest(0, least(10 - n, 500 - t)), 'limit', 10, 'totalFull', t >= 500);
end $$;

revoke all on function public.use_ai_edit() from public, anon;
revoke all on function public.ai_edit_left() from public, anon;
grant execute on function public.use_ai_edit() to authenticated;
grant execute on function public.ai_edit_left() to authenticated;

-- 지난 날짜 행은 필요 없으니 가끔 지워도 됩니다:
-- delete from public.ai_usage_user where day < current_date - 7;
-- delete from public.ai_usage_total where day < current_date - 7;
-- 사진 AI 편집 사용량 제한: 1인 하루 10회, 전체 하루 500회 (한국 시간 기준). service_role 키는 쓰지 않는다.
