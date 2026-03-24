-- TrackKcal — Row Level Security Policies
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- This enables users to read/write their own data after authenticating.

-- ============================================================
-- Helper function: returns the app_users.id for the current
-- authenticated Supabase Auth user (auth.uid()).
-- SECURITY DEFINER so it can always read app_users even with RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION my_app_user_id()
RETURNS uuid AS $$
  SELECT id FROM public.app_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 1. app_users
-- ============================================================
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Users can read their own row
CREATE POLICY "app_users_select_own"
  ON app_users FOR SELECT
  USING (auth_user_id = auth.uid());

-- Users can insert their own row (auth_user_id must match their JWT)
CREATE POLICY "app_users_insert_own"
  ON app_users FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

-- Users can update their own row
CREATE POLICY "app_users_update_own"
  ON app_users FOR UPDATE
  USING (auth_user_id = auth.uid());

-- Users can delete their own row
CREATE POLICY "app_users_delete_own"
  ON app_users FOR DELETE
  USING (auth_user_id = auth.uid());

-- ============================================================
-- 2. food_logs
-- ============================================================
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_logs_select_own"
  ON food_logs FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "food_logs_insert_own"
  ON food_logs FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "food_logs_update_own"
  ON food_logs FOR UPDATE
  USING (user_id = my_app_user_id());

CREATE POLICY "food_logs_delete_own"
  ON food_logs FOR DELETE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 3. food_items (linked via food_log_id)
-- ============================================================
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_items_select_own"
  ON food_items FOR SELECT
  USING (food_log_id IN (SELECT id FROM food_logs WHERE user_id = my_app_user_id()));

CREATE POLICY "food_items_insert_own"
  ON food_items FOR INSERT
  WITH CHECK (food_log_id IN (SELECT id FROM food_logs WHERE user_id = my_app_user_id()));

CREATE POLICY "food_items_update_own"
  ON food_items FOR UPDATE
  USING (food_log_id IN (SELECT id FROM food_logs WHERE user_id = my_app_user_id()));

CREATE POLICY "food_items_delete_own"
  ON food_items FOR DELETE
  USING (food_log_id IN (SELECT id FROM food_logs WHERE user_id = my_app_user_id()));

-- ============================================================
-- 4. exercise_logs
-- ============================================================
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_logs_select_own"
  ON exercise_logs FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "exercise_logs_insert_own"
  ON exercise_logs FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "exercise_logs_update_own"
  ON exercise_logs FOR UPDATE
  USING (user_id = my_app_user_id());

CREATE POLICY "exercise_logs_delete_own"
  ON exercise_logs FOR DELETE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 5. weight_entries
-- ============================================================
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weight_entries_select_own"
  ON weight_entries FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "weight_entries_insert_own"
  ON weight_entries FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "weight_entries_update_own"
  ON weight_entries FOR UPDATE
  USING (user_id = my_app_user_id());

CREATE POLICY "weight_entries_delete_own"
  ON weight_entries FOR DELETE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 6. nutrition_goals
-- ============================================================
ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_goals_select_own"
  ON nutrition_goals FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "nutrition_goals_insert_own"
  ON nutrition_goals FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "nutrition_goals_update_own"
  ON nutrition_goals FOR UPDATE
  USING (user_id = my_app_user_id());

CREATE POLICY "nutrition_goals_delete_own"
  ON nutrition_goals FOR DELETE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 7. engagement_tasks (shared reference data — read-only for all authenticated)
-- ============================================================
ALTER TABLE engagement_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "engagement_tasks_select_all"
  ON engagement_tasks FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- 8. user_task_status
-- ============================================================
ALTER TABLE user_task_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_task_status_select_own"
  ON user_task_status FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "user_task_status_insert_own"
  ON user_task_status FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "user_task_status_update_own"
  ON user_task_status FOR UPDATE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 9. push_tokens
-- ============================================================
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_select_own"
  ON push_tokens FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "push_tokens_insert_own"
  ON push_tokens FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "push_tokens_update_own"
  ON push_tokens FOR UPDATE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 10. push_history
-- ============================================================
ALTER TABLE push_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_history_select_own"
  ON push_history FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "push_history_insert_own"
  ON push_history FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "push_history_update_own"
  ON push_history FOR UPDATE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 11. saved_prompts
-- ============================================================
ALTER TABLE saved_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_prompts_select_own"
  ON saved_prompts FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "saved_prompts_insert_own"
  ON saved_prompts FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "saved_prompts_update_own"
  ON saved_prompts FOR UPDATE
  USING (user_id = my_app_user_id());

CREATE POLICY "saved_prompts_delete_own"
  ON saved_prompts FOR DELETE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 12. user_preferences
-- ============================================================
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own"
  ON user_preferences FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "user_preferences_insert_own"
  ON user_preferences FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "user_preferences_update_own"
  ON user_preferences FOR UPDATE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 13. user_settings
-- ============================================================
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select_own"
  ON user_settings FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "user_settings_insert_own"
  ON user_settings FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "user_settings_update_own"
  ON user_settings FOR UPDATE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 14. entry_tasks
-- ============================================================
ALTER TABLE entry_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entry_tasks_select_own"
  ON entry_tasks FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "entry_tasks_insert_own"
  ON entry_tasks FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "entry_tasks_update_own"
  ON entry_tasks FOR UPDATE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 15. referral_codes
-- Readable by all authenticated users (to validate codes),
-- but only the owner can insert/update.
-- ============================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_codes_select_all"
  ON referral_codes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "referral_codes_insert_own"
  ON referral_codes FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "referral_codes_update_own"
  ON referral_codes FOR UPDATE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 16. referral_redemptions
-- Authenticated users can read/insert (validated by email in app logic)
-- ============================================================
ALTER TABLE referral_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_redemptions_select_all"
  ON referral_redemptions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "referral_redemptions_insert_all"
  ON referral_redemptions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "referral_redemptions_update_all"
  ON referral_redemptions FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ============================================================
-- 17. referral_rewards
-- ============================================================
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_rewards_select_own"
  ON referral_rewards FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "referral_rewards_insert_own"
  ON referral_rewards FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

-- ============================================================
-- 18. streak_freezes
-- ============================================================
ALTER TABLE streak_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streak_freezes_select_own"
  ON streak_freezes FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "streak_freezes_insert_own"
  ON streak_freezes FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "streak_freezes_update_own"
  ON streak_freezes FOR UPDATE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 19. grocery_items
-- ============================================================
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grocery_items_select_own"
  ON grocery_items FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "grocery_items_insert_own"
  ON grocery_items FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "grocery_items_update_own"
  ON grocery_items FOR UPDATE
  USING (user_id = my_app_user_id());

CREATE POLICY "grocery_items_delete_own"
  ON grocery_items FOR DELETE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 20. analytics_events
-- ============================================================
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_events_select_own"
  ON analytics_events FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "analytics_events_insert_own"
  ON analytics_events FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

-- ============================================================
-- 21. nutrition_library (shared — all authenticated can read/write)
-- ============================================================
ALTER TABLE nutrition_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_library_select_all"
  ON nutrition_library FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "nutrition_library_insert_all"
  ON nutrition_library FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "nutrition_library_update_all"
  ON nutrition_library FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ============================================================
-- 22. daily_user_metrics
-- ============================================================
ALTER TABLE daily_user_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_user_metrics_select_own"
  ON daily_user_metrics FOR SELECT
  USING (user_id = my_app_user_id());

CREATE POLICY "daily_user_metrics_insert_own"
  ON daily_user_metrics FOR INSERT
  WITH CHECK (user_id = my_app_user_id());

CREATE POLICY "daily_user_metrics_update_own"
  ON daily_user_metrics FOR UPDATE
  USING (user_id = my_app_user_id());

-- ============================================================
-- 23. waitlist (public — anyone can sign up from landing page)
-- ============================================================
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_insert_anon"
  ON waitlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "waitlist_select_authenticated"
  ON waitlist FOR SELECT
  USING (auth.role() = 'authenticated');
