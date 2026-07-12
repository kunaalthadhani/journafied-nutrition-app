-- Water log: one row per user per day, milliliters drunk. A tap counter, not
-- an entry ledger, so the natural key is (user, day) and writes are upserts.
-- Conventions match the live schema: app_users FK, my_app_user_id() RLS.
-- Run in the Supabase SQL editor on project oljzqoznxqbuocdykmpw.

create table public.water_log (
  user_id uuid not null references public.app_users(id) on delete cascade,
  logged_date date not null,
  ml integer not null default 0 check (ml >= 0 and ml <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, logged_date)
);

alter table public.water_log enable row level security;

create policy water_log_select_own on public.water_log
  for select using (user_id = my_app_user_id());

create policy water_log_insert_own on public.water_log
  for insert with check (user_id = my_app_user_id());

create policy water_log_update_own on public.water_log
  for update using (user_id = my_app_user_id());

create policy water_log_delete_own on public.water_log
  for delete using (user_id = my_app_user_id());
