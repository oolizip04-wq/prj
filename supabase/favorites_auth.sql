-- 로그인(이메일+비밀번호)을 쓰는 즐겨찾기: "내 것만 보고, 담고, 지우기"
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run 하세요. (favorites.sql 을 먼저 실행했어야 합니다)

-- 1) 사용자 번호 칸. 로그인 상태에서 담으면 자동으로 내 번호가 들어갑니다.
alter table public.favorites
  add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;

-- 2) 예전 "익명" 즐겨찾기는 주인이 없어서 새 정책에서는 아무에게도 안 보입니다.
--    필요 없으면 아래 줄의 앞 -- 를 지우고 함께 실행해서 정리하세요.
-- delete from public.favorites where user_id is null;

-- 3) 같은 이름("익명")으로 묶이던 중복 제한을 없애고, 사용자별로 한 번씩만 담게 바꿉니다.
alter table public.favorites drop constraint if exists favorites_nickname_source_item_id_key;
create unique index if not exists favorites_user_item on public.favorites (user_id, source, item_id);

-- 4) 누구나 읽고 지우던 예전 정책을 없애고, 로그인한 본인 것만 허용합니다.
drop policy if exists "favorites select" on public.favorites;
drop policy if exists "favorites insert" on public.favorites;
drop policy if exists "favorites delete" on public.favorites;
drop policy if exists "favorites own select" on public.favorites;
drop policy if exists "favorites own insert" on public.favorites;
drop policy if exists "favorites own delete" on public.favorites;

create policy "favorites own select" on public.favorites for select to authenticated using (auth.uid() = user_id);
create policy "favorites own insert" on public.favorites for insert to authenticated with check (auth.uid() = user_id);
create policy "favorites own delete" on public.favorites for delete to authenticated using (auth.uid() = user_id);
