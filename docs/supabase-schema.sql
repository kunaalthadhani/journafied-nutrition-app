-- TrackKcal Supabase Schema
-- Run this file in the Supabase SQL editor to (re)create the core tables.

create extension if not exists "uuid-ossp";

-- Users table (app-specific metadata; link to Supabase Auth via auth_user_id)
create table if not exists app_users (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique,
  email text unique,
  display_name text,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_users_phone_number on app_users (phone_number);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_users_updated on app_users;
create trigger trg_app_users_updated
before update on app_users
for each row execute function set_updated_at();

-- Food logs (daily prompts + parsed data)
create table if not exists food_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  prompt text not null,
  parsed_payload jsonb,
  logged_date date not null,
  total_calories numeric,
  total_protein numeric,
  total_carbs numeric,
  total_fat numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_food_logs_updated on food_logs;
create trigger trg_food_logs_updated
before update on food_logs
for each row execute function set_updated_at();

-- Food items (optional per-ingredient detail)
create table if not exists food_items (
  id uuid primary key default uuid_generate_v4(),
  food_log_id uuid references food_logs(id) on delete cascade,
  name text,
  quantity text,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric
);

-- Exercise logs
create table if not exists exercise_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  description text not null,
  duration_minutes numeric,
  calories_burned numeric,
  logged_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_exercise_logs_updated on exercise_logs;
create trigger trg_exercise_logs_updated
before update on exercise_logs
for each row execute function set_updated_at();

-- Weight tracker
create table if not exists weight_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  logged_date date not null,
  weight_kg numeric not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_weight_entries_updated on weight_entries;
create trigger trg_weight_entries_updated
before update on weight_entries
for each row execute function set_updated_at();

-- Nutrition goals / custom plan
create table if not exists nutrition_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  calories_target numeric,
  protein_target numeric,
  carbs_target numeric,
  fat_target numeric,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_nutrition_goals_updated on nutrition_goals;
create trigger trg_nutrition_goals_updated
before update on nutrition_goals
for each row execute function set_updated_at();

-- Engagement / bonus tasks
create table if not exists engagement_tasks (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  title text,
  description text,
  reward_entries integer default 0
);

create table if not exists user_task_status (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  task_id uuid references engagement_tasks(id) on delete cascade,
  completed boolean default false,
  completed_at timestamptz,
  unique (user_id, task_id)
);

-- Push notification tokens
create table if not exists push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  expo_token text not null,
  device_info jsonb,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Push notification history
create table if not exists push_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  push_token_id uuid references push_tokens(id) on delete set null,
  title text,
  body text,
  sent_at timestamptz not null default now(),
  clicked boolean default false,
  clicked_at timestamptz
);

-- Saved prompts (optional)
create table if not exists saved_prompts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  prompt text not null,
  created_at timestamptz not null default now()
);

