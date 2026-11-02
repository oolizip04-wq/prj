-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run 하세요.
-- 즐겨찾기(장바구니) 테이블: parking.html 과 src/store/useAppStore.js 가 함께 사용합니다.
create table if not exists public.favorites (
  id         uuid primary key default gen_random_uuid(),
  nickname   text not null default '익명',
  source     text not null,                 -- 'parking' 등 데이터 출처
  item_id    text not null,                 -- 주차장 관리번호 등
  title      text not null,
  data       jsonb,                         -- 담을 때의 주차장 정보 전체 (주소·좌표·요금 등)
  created_at timestamptz not null default now(),
  unique (nickname, source, item_id)
);

-- 로그인 없는 학습용 앱이라 anon 키로 읽기/담기/삭제를 허용합니다.
-- ※ 누구나 다른 닉네임의 즐겨찾기를 보고 지울 수 있으니, 실서비스 전에는 로그인(Auth)과 정책을 바꾸세요.
alter table public.favorites enable row level security;

create policy "favorites select" on public.favorites for select to anon using (true);
create policy "favorites insert" on public.favorites for insert to anon with check (true);
create policy "favorites delete" on public.favorites for delete to anon using (true);
