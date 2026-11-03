-- 여행자 포토 스팟(내 사진 올리기) — Supabase 대시보드 → SQL Editor 에 붙여넣고 Run (한 번만)
-- ① 테이블: 누구나 읽고, 로그인한 본인만 추가·삭제 (한 사람당 최대 5장)
-- ② 저장소(Storage) 버킷 user-spots: 공개 읽기, 본인 폴더에만 업로드·삭제, JPEG·장당 2MB 이하

create table if not exists user_spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  caption text check (char_length(caption) <= 200),
  place_name text,
  lat double precision not null check (lat between 33 and 34),
  lng double precision not null check (lng between 126 and 127.1),
  image_path text not null,
  created_at timestamptz not null default now()
);
alter table user_spots enable row level security;
create policy "user_spots read"   on user_spots for select using (true);
create policy "user_spots insert" on user_spots for insert with check (auth.uid() = user_id);
create policy "user_spots delete" on user_spots for delete using (auth.uid() = user_id);

-- 한 사람이 올릴 수 있는 사진 수 제한 (저장공간 보호)
create or replace function user_spots_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from user_spots where user_id = new.user_id) >= 5 then
    raise exception '사진은 한 사람당 최대 5장까지 올릴 수 있어요';
  end if;
  return new;
end $$;
drop trigger if exists user_spots_limit_trg on user_spots;
create trigger user_spots_limit_trg before insert on user_spots for each row execute function user_spots_limit();

-- 저장소 버킷 (공개 읽기, JPEG, 2MB 이하)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-spots', 'user-spots', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "user-spots read"   on storage.objects for select using (bucket_id = 'user-spots');
create policy "user-spots upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-spots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "user-spots delete" on storage.objects for delete to authenticated
  using (bucket_id = 'user-spots' and (storage.foldername(name))[1] = auth.uid()::text);
