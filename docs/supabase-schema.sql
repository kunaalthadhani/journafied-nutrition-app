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
  prompt text not null,
  exercises_jsonb jsonb not null, -- Full exercises array from ExerciseEntry
  description text not null, -- Original prompt text
  duration_minutes numeric, -- Total duration calculated from exercises
  calories_burned numeric, -- Total calories calculated from exercises
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
-- Stores user's nutrition targets and profile data from custom plan questions
create table if not exists nutrition_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  -- Nutrition targets
  calories_target numeric,
  protein_target numeric,
  carbs_target numeric,
  fat_target numeric,
  -- Profile data from custom plan questions
  name text,
  tracking_goal text,
  age integer,
  gender text, -- 'male', 'female', 'prefer_not_to_say'
  height_cm numeric,
  height_feet integer,
  height_inches integer,
  current_weight_kg numeric,
  target_weight_kg numeric,
  body_goal text, -- 'lose', 'maintain', 'gain'
  activity_rate numeric,
  activity_level text, -- 'sedentary', 'light', 'moderate', 'very'
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

create index if not exists idx_push_tokens_expo_token on push_tokens (expo_token);
create index if not exists idx_push_tokens_user_id on push_tokens (user_id) where revoked_at is null;

-- Push notification history (broadcast records)
create table if not exists push_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  push_token_id uuid references push_tokens(id) on delete set null,
  title text not null,
  message text not null,
  timestamp timestamptz not null default now(),
  target_count integer default 0,
  success_count integer default 0,
  failure_count integer default 0,
  click_count integer default 0,
  sent_at timestamptz not null default now(),
  clicked boolean default false,
  clicked_at timestamptz
);

create index if not exists idx_push_history_user_id on push_history (user_id);
alter table push_history
  add column if not exists "timestamp" timestamptz not null default now();
create index if not exists idx_push_history_timestamp on push_history (timestamp);

-- Saved prompts (optional)
create table if not exists saved_prompts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  prompt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_saved_prompts_updated on saved_prompts;
create trigger trg_saved_prompts_updated
before update on saved_prompts
for each row execute function set_updated_at();

create index if not exists idx_saved_prompts_user_id on saved_prompts (user_id);

-- User preferences
create table if not exists user_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade unique,
  weight_unit text default 'kg', -- 'kg' | 'lbs'
  notifications_enabled boolean default true,
  meal_reminders jsonb, -- { breakfast: { enabled, hour, minute }, lunch: {...}, dinner: {...} }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_preferences_updated on user_preferences;
create trigger trg_user_preferences_updated
before update on user_preferences
for each row execute function set_updated_at();

-- User settings (entry count, plan, device info)
create table if not exists user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade unique,
  entry_count integer default 0,
  user_plan text default 'free', -- 'free' | 'premium'
  device_info jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_settings_updated on user_settings;
create trigger trg_user_settings_updated
before update on user_settings
for each row execute function set_updated_at();

-- Entry tasks (custom plan completion, registration)
create table if not exists entry_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade unique,
  custom_plan_completed boolean default false,
  registration_completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_entry_tasks_updated on entry_tasks;
create trigger trg_entry_tasks_updated
before update on entry_tasks
for each row execute function set_updated_at();

-- Referral codes
create table if not exists referral_codes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  code text unique not null,
  created_at timestamptz not null default now(),
  total_referrals integer default 0,
  total_earned_entries integer default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_referral_codes_updated on referral_codes;
create trigger trg_referral_codes_updated
before update on referral_codes
for each row execute function set_updated_at();

create index if not exists idx_referral_codes_code on referral_codes (code);
create index if not exists idx_referral_codes_user_id on referral_codes (user_id);

-- Referral redemptions
create table if not exists referral_redemptions (
  id uuid primary key default uuid_generate_v4(),
  referral_code text not null,
  referrer_email text not null,
  referee_email text not null,
  referee_name text,
  redeemed_at timestamptz not null default now(),
  status text default 'pending', -- 'pending' | 'completed' | 'failed'
  meals_logged integer default 0,
  device_id text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_referral_redemptions_updated on referral_redemptions;
create trigger trg_referral_redemptions_updated
before update on referral_redemptions
for each row execute function set_updated_at();

create index if not exists idx_referral_redemptions_code on referral_redemptions (referral_code);
create index if not exists idx_referral_redemptions_referrer on referral_redemptions (referrer_email);
create index if not exists idx_referral_redemptions_referee on referral_redemptions (referee_email);

-- Referral rewards
create table if not exists referral_rewards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references app_users(id) on delete cascade,
  related_redemption_id uuid references referral_redemptions(id) on delete set null,
  earned_at timestamptz not null default now(),
  entries_awarded integer not null default 0,
  reason text not null, -- 'referrer_reward' | 'referee_reward'
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_rewards_user_id on referral_rewards (user_id);
create index if not exists idx_referral_rewards_redemption_id on referral_rewards (related_redemption_id);



