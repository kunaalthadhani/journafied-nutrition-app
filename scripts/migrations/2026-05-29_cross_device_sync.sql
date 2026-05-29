-- Cross device sync for derived/settings state.
-- Run this in Supabase Dashboard > SQL Editor as a single block.
-- Idempotent: safe to re-run.

-- 1. insights (AI weekly insights, one row per insight id, cloud overwrites local)
create table if not exists public.insights (
  id text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists insights_user_idx on public.insights(user_id);

alter table public.insights enable row level security;
drop policy if exists insights_owner_all on public.insights;
create policy insights_owner_all on public.insights
  for all
  using (user_id in (select id from public.app_users where auth_user_id = auth.uid()))
  with check (user_id in (select id from public.app_users where auth_user_id = auth.uid()));

-- 2. detected_patterns (single latest pattern per user)
create table if not exists public.detected_patterns (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  payload jsonb not null,
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.detected_patterns enable row level security;
drop policy if exists detected_patterns_owner_all on public.detected_patterns;
create policy detected_patterns_owner_all on public.detected_patterns
  for all
  using (user_id in (select id from public.app_users where auth_user_id = auth.uid()))
  with check (user_id in (select id from public.app_users where auth_user_id = auth.uid()));

-- 3. weekly_action_plans (single latest per user)
create table if not exists public.weekly_action_plans (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.weekly_action_plans enable row level security;
drop policy if exists weekly_action_plans_owner_all on public.weekly_action_plans;
create policy weekly_action_plans_owner_all on public.weekly_action_plans
  for all
  using (user_id in (select id from public.app_users where auth_user_id = auth.uid()))
  with check (user_id in (select id from public.app_users where auth_user_id = auth.uid()));

-- 4. insight_unlocks (which insights the user has unlocked + seen markers)
create table if not exists public.insight_unlocks (
  user_id uuid not null references public.app_users(id) on delete cascade,
  insight_id text not null,
  unlocked_at timestamptz not null default now(),
  seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, insight_id)
);
create index if not exists insight_unlocks_user_idx on public.insight_unlocks(user_id);
alter table public.insight_unlocks enable row level security;
drop policy if exists insight_unlocks_owner_all on public.insight_unlocks;
create policy insight_unlocks_owner_all on public.insight_unlocks
  for all
  using (user_id in (select id from public.app_users where auth_user_id = auth.uid()))
  with check (user_id in (select id from public.app_users where auth_user_id = auth.uid()));

-- 5. daily_summaries (per-day derived summary, used to bootstrap AI without re-deriving)
create table if not exists public.daily_summaries (
  user_id uuid not null references public.app_users(id) on delete cascade,
  summary_date date not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, summary_date)
);
create index if not exists daily_summaries_user_idx on public.daily_summaries(user_id);
alter table public.daily_summaries enable row level security;
drop policy if exists daily_summaries_owner_all on public.daily_summaries;
create policy daily_summaries_owner_all on public.daily_summaries
  for all
  using (user_id in (select id from public.app_users where auth_user_id = auth.uid()))
  with check (user_id in (select id from public.app_users where auth_user_id = auth.uid()));

-- 6. calorie_bank_completed_cycles (historical cycle records)
create table if not exists public.calorie_bank_completed_cycles (
  id text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  payload jsonb not null,
  completed_at timestamptz not null default now()
);
create index if not exists cbcc_user_idx on public.calorie_bank_completed_cycles(user_id);
alter table public.calorie_bank_completed_cycles enable row level security;
drop policy if exists cbcc_owner_all on public.calorie_bank_completed_cycles;
create policy cbcc_owner_all on public.calorie_bank_completed_cycles
  for all
  using (user_id in (select id from public.app_users where auth_user_id = auth.uid()))
  with check (user_id in (select id from public.app_users where auth_user_id = auth.uid()));

-- 7. calorie_bank_config column on user_settings
alter table public.user_settings
  add column if not exists calorie_bank_config jsonb;

-- updated_at triggers (use existing trigger function if present)
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create function public.set_updated_at() returns trigger language plpgsql as $f$
    begin
      new.updated_at := now();
      return new;
    end;
    $f$;
  end if;
end$$;

drop trigger if exists insights_set_updated_at on public.insights;
create trigger insights_set_updated_at before update on public.insights
  for each row execute function public.set_updated_at();

drop trigger if exists detected_patterns_set_updated_at on public.detected_patterns;
create trigger detected_patterns_set_updated_at before update on public.detected_patterns
  for each row execute function public.set_updated_at();

drop trigger if exists weekly_action_plans_set_updated_at on public.weekly_action_plans;
create trigger weekly_action_plans_set_updated_at before update on public.weekly_action_plans
  for each row execute function public.set_updated_at();

drop trigger if exists insight_unlocks_set_updated_at on public.insight_unlocks;
create trigger insight_unlocks_set_updated_at before update on public.insight_unlocks
  for each row execute function public.set_updated_at();

drop trigger if exists daily_summaries_set_updated_at on public.daily_summaries;
create trigger daily_summaries_set_updated_at before update on public.daily_summaries
  for each row execute function public.set_updated_at();
