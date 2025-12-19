import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  AccountInfo,
  MealSyncPayload,
  WeightEntry,
  WeightSyncPayload,
  ExtendedGoalData,
  Preferences,
  PushBroadcastRecord,
  SavedPrompt,
  EntryTasksStatus,
  ReferralRedemption,
  ReferralReward,
  MealEntry,
  NutritionLibraryItem,
  ReferralCode
} from './dataStorage';

import { ExerciseEntry } from '../components/ExerciseLogSection';
import { AppUser, SupabaseFoodLog, SupabaseWeightEntry } from '../types';

const mapAppUser = (record: any): AppUser => ({
  id: record.id,
  authUserId: record.auth_user_id ?? undefined,
  email: record.email ?? undefined,
  displayName: record.display_name ?? undefined,
  phoneNumber: record.phone_number ?? undefined,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

const sumNutrient = (foods: MealEntry['foods'], key: 'calories' | 'protein' | 'carbs' | 'fat') =>
  foods.reduce((total, food) => total + (food[key] || 0), 0);

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 10);
};

async function findExistingUser(accountInfo?: AccountInfo | null) {
  if (!accountInfo) return null;
  if (!isSupabaseConfigured() || !supabase) return null;

  if (accountInfo.supabaseUserId) {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('auth_user_id', accountInfo.supabaseUserId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Supabase user by auth id:', error);
      return null;
    }
    if (data) return data;
  }

  if (accountInfo.email) {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', accountInfo.email.trim().toLowerCase())
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Supabase user by email:', error);
      return null;
    }
    if (data) return data;
  }

  return null;
}

async function getOrCreateUser(accountInfo?: AccountInfo | null): Promise<AppUser | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  if (!accountInfo?.supabaseUserId && !accountInfo?.email) return null;

  // If we have supabaseUserId but no email, fetch email from Supabase Auth
  let emailToUse = accountInfo.email;
  if (!emailToUse && accountInfo.supabaseUserId && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser(accountInfo.supabaseUserId);
      if (user?.email) emailToUse = user.email;
    } catch (error) {
      console.error('Error fetching user email from Supabase Auth:', error);
    }
  }

  const existing = await findExistingUser(accountInfo);

  if (existing) {
    const needsUpdate =
      (accountInfo.name && existing.display_name !== accountInfo.name) ||
      (accountInfo.phoneNumber && existing.phone_number !== accountInfo.phoneNumber) ||
      (accountInfo.supabaseUserId && existing.auth_user_id !== accountInfo.supabaseUserId) ||
      (emailToUse && existing.email !== emailToUse.trim().toLowerCase());

    if (needsUpdate) {
      const { data: updated, error: updateError } = await supabase
        .from('app_users')
        .update({
          display_name: accountInfo.name ?? existing.display_name,
          phone_number: accountInfo.phoneNumber ?? existing.phone_number,
          auth_user_id: accountInfo.supabaseUserId ?? existing.auth_user_id,
          email: emailToUse ? emailToUse.trim().toLowerCase() : existing.email,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating Supabase user:', updateError);
        return mapAppUser(existing);
      }
      return mapAppUser(updated);
    }

    return mapAppUser(existing);
  }

  // If we still don't have an email, we can't create a user
  if (!emailToUse) {
    console.error('Cannot create user: no email available');
    return null;
  }

  const { data, error } = await supabase
    .from('app_users')
    .insert({
      email: emailToUse.trim().toLowerCase(),
      display_name: accountInfo.name ?? null,
      phone_number: accountInfo.phoneNumber ?? null,
      auth_user_id: accountInfo.supabaseUserId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating Supabase user:', error);
    return null;
  }

  return data ? mapAppUser(data) : null;
}

async function getUserByEmail(email: string): Promise<AppUser | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error retrieving user by email:', error);
    return null;
  }

  return data ? mapAppUser(data) : null;
}

function mapFoodLogRowToMeals(records: SupabaseFoodLog[]): Record<string, MealEntry[]> {
  const grouped: Record<string, MealEntry[]> = {};

  records.forEach((record) => {
    const payload = (record.parsed_payload as MealEntry | null) ?? null;
    const meal: MealEntry = payload
      ? {
        ...payload,
        foods: Array.isArray(payload.foods) ? payload.foods : [],
        timestamp:
          typeof payload.timestamp === 'number'
            ? payload.timestamp
            : new Date(record.logged_date).getTime(),
      }
      : {
        id: record.id || `meal-${record.logged_date}`,
        prompt: record.prompt,
        foods: [],
        timestamp: new Date(record.logged_date).getTime(),
      };
    meal.id = meal.id || record.id || `meal-${record.logged_date}`;
    meal.updatedAt = payload?.updatedAt || record.updated_at || new Date().toISOString();

    const dateKey = record.logged_date ?? formatDate(meal.timestamp);
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(meal);
  });

  return grouped;
}

function mealPayloadToRow(userId: string, payload: { meal: MealEntry; dateKey: string }): SupabaseFoodLog {
  return {
    id: payload.meal.id,
    user_id: userId,
    prompt: payload.meal.prompt,
    parsed_payload: payload.meal as unknown as Record<string, unknown>,
    logged_date: payload.dateKey || formatDate(payload.meal.timestamp),
    total_calories: sumNutrient(payload.meal.foods, 'calories'),
    total_protein: sumNutrient(payload.meal.foods, 'protein'),
    total_carbs: sumNutrient(payload.meal.foods, 'carbs'),
    total_fat: sumNutrient(payload.meal.foods, 'fat'),
    created_at: new Date(payload.meal.timestamp).toISOString(),
    updated_at: payload.meal.updatedAt || new Date().toISOString(),
    deleted_at: null,
  };
}

function mapWeightRows(records: SupabaseWeightEntry[]): WeightEntry[] {
  return records
    .filter((record) => !record.deleted_at)
    .map((record) => ({
      id: record.id || record.logged_date,
      date: record.logged_date,
      weight: record.weight_kg ?? 0,
      updatedAt: record.updated_at || record.created_at || new Date().toISOString(),
    }));
}

function weightPayloadToRow(userId: string, payload: WeightSyncPayload): SupabaseWeightEntry {
  return {
    id: payload.id,
    user_id: userId,
    logged_date: payload.date.slice(0, 10),
    weight_kg: payload.weight,
    notes: null,
    created_at: payload.date,
    updated_at: payload.updatedAt,
    deleted_at: null,
  };
}

export const supabaseDataService = {
  async saveAccountToSupabase(info: AccountInfo): Promise<AppUser | null> {
    if (!info?.email) return null;
    return getOrCreateUser(info);
  },

  async fetchAccountByEmail(email: string): Promise<AppUser | null> {
    if (!email) return null;
    return getUserByEmail(email);
  },

  async upsertMeals(accountInfo: AccountInfo | null, payloads: MealSyncPayload[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || payloads.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const rows = payloads.map((payload) => mealPayloadToRow(user.id, payload));
    const { error } = await supabase.from('food_logs').upsert(rows, { onConflict: 'id' });
    if (error) {
      throw error;
    }
  },

  async deleteMeals(accountInfo: AccountInfo | null, mealIds: string[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || mealIds.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase
      .from('food_logs')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', mealIds);

    if (error) {
      throw error;
    }
  },

  async fetchMeals(accountInfo: AccountInfo | null): Promise<Record<string, MealEntry[]>> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return {};
    const user = await getOrCreateUser(accountInfo);
    if (!user) return {};

    const { data, error } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('logged_date', { ascending: true });

    if (error) {
      console.error('Error fetching food logs from Supabase:', error);
      return {};
    }

    return data ? mapFoodLogRowToMeals(data) : {};
  },

  async upsertWeightEntries(accountInfo: AccountInfo | null, payloads: WeightSyncPayload[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || payloads.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const rows = payloads.map((payload) => weightPayloadToRow(user.id, payload));
    const { error } = await supabase.from('weight_entries').upsert(rows, { onConflict: 'id' });
    if (error) {
      throw error;
    }
  },

  async deleteWeightEntries(accountInfo: AccountInfo | null, ids: string[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || ids.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;
    const { error } = await supabase
      .from('weight_entries')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids);
    if (error) {
      throw error;
    }
  },

  async fetchWeightEntries(accountInfo: AccountInfo | null) {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return [];
    const user = await getOrCreateUser(accountInfo);
    if (!user) return [];

    const { data, error } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('logged_date', { ascending: true });

    if (error) {
      console.error('Error fetching weight entries from Supabase:', error);
      return [];
    }

    return data ? mapWeightRows(data) : [];
  },

  async saveNutritionGoals(accountInfo: AccountInfo | null, goals: ExtendedGoalData): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    // First, deactivate all existing active goals for this user
    const { error: deactivateError } = await supabase
      .from('nutrition_goals')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (deactivateError) {
      console.error('Error deactivating previous nutrition goals:', deactivateError);
      // Continue anyway - we'll still create the new goal
    }

    // Insert the new active goal with all profile data
    const { error: insertError } = await supabase
      .from('nutrition_goals')
      .insert({
        user_id: user.id,
        calories_target: goals.calories || null,
        protein_target: goals.proteinGrams || null,
        carbs_target: goals.carbsGrams || null,
        fat_target: goals.fatGrams || null,
        name: goals.name || null,
        tracking_goal: goals.trackingGoal || null,
        age: goals.age || null,
        gender: goals.gender || null,
        height_cm: goals.heightCm || null,
        height_feet: goals.heightFeet || null,
        height_inches: goals.heightInches || null,
        current_weight_kg: goals.currentWeightKg || null,
        target_weight_kg: goals.targetWeightKg || null,
        body_goal: goals.goal || null,
        activity_rate: goals.activityRate || null,
        activity_level: goals.activityLevel || null,
        is_active: true,
      });

    if (insertError) {
      console.error('Error saving nutrition goals to Supabase:', insertError);
      throw insertError;
    }
  },

  async fetchNutritionGoals(accountInfo: AccountInfo | null): Promise<ExtendedGoalData | null> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return null;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return null;

    const { data, error } = await supabase
      .from('nutrition_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching nutrition goals from Supabase:', error);
      return null;
    }

    if (!data) return null;

    // Map Supabase row to ExtendedGoalData
    return {
      calories: data.calories_target || 1500,
      proteinPercentage: data.protein_target ? Math.round((data.protein_target * 4 / (data.calories_target || 1500)) * 100) : 30,
      carbsPercentage: data.carbs_target ? Math.round((data.carbs_target * 4 / (data.calories_target || 1500)) * 100) : 45,
      fatPercentage: data.fat_target ? Math.round((data.fat_target * 9 / (data.calories_target || 1500)) * 100) : 25,
      proteinGrams: data.protein_target || 0,
      carbsGrams: data.carbs_target || 0,
      fatGrams: data.fat_target || 0,
      currentWeightKg: data.current_weight_kg || null,
      targetWeightKg: data.target_weight_kg || null,
      age: data.age || undefined,
      gender: (data.gender as 'male' | 'female' | 'prefer_not_to_say') || undefined,
      heightCm: data.height_cm || undefined,
      heightFeet: data.height_feet || undefined,
      heightInches: data.height_inches || undefined,
      goal: (data.body_goal as 'lose' | 'maintain' | 'gain') || undefined,
      activityRate: data.activity_rate || undefined,
      name: data.name || undefined,
      trackingGoal: data.tracking_goal || undefined,
      activityLevel: (data.activity_level as 'sedentary' | 'light' | 'moderate' | 'very') || undefined,
    };
  },

  // Exercises
  async upsertExercises(accountInfo: AccountInfo | null, exercises: ExerciseEntry[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId || exercises.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const rows = exercises.map((entry) => {
      const loggedDate = new Date(entry.timestamp).toISOString().slice(0, 10);
      const totalDuration = entry.exercises.reduce((sum, ex) => sum + (ex.duration_minutes || 0), 0);
      const totalCalories = entry.exercises.reduce((sum, ex) => sum + (ex.calories || 0), 0);

      return {
        id: entry.id,
        user_id: user.id,
        prompt: entry.prompt,
        exercises_jsonb: entry.exercises,
        description: entry.prompt,
        duration_minutes: totalDuration,
        calories_burned: totalCalories,
        logged_date: loggedDate,
        created_at: new Date(entry.timestamp).toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
    });

    const { error } = await supabase.from('exercise_logs').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.error('Error upserting exercises to Supabase:', error);
      throw error;
    }
  },

  async deleteExercises(accountInfo: AccountInfo | null, ids: string[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId || ids.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase
      .from('exercise_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', ids);

    if (error) {
      console.error('Error deleting exercises from Supabase:', error);
      throw error;
    }
  },

  async fetchExercises(accountInfo: AccountInfo | null): Promise<Record<string, ExerciseEntry[]>> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return {};
    const user = await getOrCreateUser(accountInfo);
    if (!user) return {};

    const { data, error } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('logged_date', { ascending: true });

    if (error) {
      console.error('Error fetching exercises from Supabase:', error);
      return {};
    }

    if (!data || data.length === 0) return {};

    const grouped: Record<string, ExerciseEntry[]> = {};
    data.forEach((row) => {
      const dateKey = row.logged_date;
      if (!grouped[dateKey]) grouped[dateKey] = [];

      grouped[dateKey].push({
        id: row.id,
        prompt: row.prompt || row.description,
        exercises: (row.exercises_jsonb as any) || [],
        timestamp: new Date(row.created_at).getTime(),
      });
    });

    return grouped;
  },

  // Push Tokens
  async upsertPushToken(accountInfo: AccountInfo | null, token: string, deviceInfo?: any): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId || !token) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: user.id,
          expo_token: token,
          device_info: deviceInfo || null,
          revoked_at: null,
        },
        { onConflict: 'expo_token' }
      );

    if (error) {
      console.error('Error upserting push token to Supabase:', error);
      throw error;
    }
  },

  async revokePushToken(accountInfo: AccountInfo | null, token: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId || !token) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase
      .from('push_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('expo_token', token);

    if (error) {
      console.error('Error revoking push token in Supabase:', error);
      throw error;
    }
  },

  async fetchPushTokens(accountInfo: AccountInfo | null): Promise<string[]> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return [];
    const user = await getOrCreateUser(accountInfo);
    if (!user) return [];

    const { data, error } = await supabase
      .from('push_tokens')
      .select('expo_token')
      .eq('user_id', user.id)
      .is('revoked_at', null);

    if (error) {
      console.error('Error fetching push tokens from Supabase:', error);
      return [];
    }

    return data?.map((row) => row.expo_token) || [];
  },

  // Push History
  async savePushHistory(accountInfo: AccountInfo | null, record: PushBroadcastRecord): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase.from('push_history').insert({
      id: record.id,
      user_id: user.id,
      title: record.title,
      message: record.message,
      timestamp: record.timestamp,
      target_count: record.targetCount,
      success_count: record.successCount,
      failure_count: record.failureCount,
      click_count: record.clickCount,
      clicked: record.clickCount > 0,
      clicked_at: record.clickCount > 0 ? new Date().toISOString() : null,
    });

    if (error) {
      console.error('Error saving push history to Supabase:', error);
      throw error;
    }
  },

  async updatePushHistoryClick(accountInfo: AccountInfo | null, id: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    // Note: Supabase doesn't support raw SQL in update, so we fetch, increment, and update
    const { data: existing } = await supabase
      .from('push_history')
      .select('click_count')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('push_history')
        .update({
          clicked: true,
          clicked_at: new Date().toISOString(),
          click_count: (existing.click_count || 0) + 1,
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating push history click in Supabase:', error);
        throw error;
      }
    }
  },

  async fetchPushHistory(accountInfo: AccountInfo | null): Promise<PushBroadcastRecord[]> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return [];
    const user = await getOrCreateUser(accountInfo);
    if (!user) return [];

    const { data, error } = await supabase
      .from('push_history')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching push history from Supabase:', error);
      return [];
    }

    return (
      data?.map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        timestamp: row.timestamp,
        targetCount: row.target_count || 0,
        successCount: row.success_count || 0,
        failureCount: row.failure_count || 0,
        clickCount: row.click_count || 0,
      })) || []
    );
  },

  // Saved Prompts
  async upsertSavedPrompt(accountInfo: AccountInfo | null, prompt: SavedPrompt): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase
      .from('saved_prompts')
      .upsert(
        {
          id: prompt.id,
          user_id: user.id,
          prompt: prompt.text,
          created_at: prompt.createdAt,
          updated_at: prompt.updatedAt,
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('Error upserting saved prompt to Supabase:', error);
      throw error;
    }
  },

  async deleteSavedPrompt(accountInfo: AccountInfo | null, id: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase.from('saved_prompts').delete().eq('id', id).eq('user_id', user.id);

    if (error) {
      console.error('Error deleting saved prompt from Supabase:', error);
      throw error;
    }
  },

  async fetchSavedPrompts(accountInfo: AccountInfo | null): Promise<SavedPrompt[]> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return [];
    const user = await getOrCreateUser(accountInfo);
    if (!user) return [];

    const { data, error } = await supabase
      .from('saved_prompts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved prompts from Supabase:', error);
      return [];
    }

    return (
      data?.map((row) => ({
        id: row.id,
        text: row.prompt,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) || []
    );
  },

  // Preferences
  async savePreferences(accountInfo: AccountInfo | null, prefs: Preferences): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          weight_unit: prefs.weightUnit,
          notifications_enabled: prefs.notificationsEnabled,
          meal_reminders: prefs.mealReminders,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving preferences to Supabase:', error);
      throw error;
    }
  },

  async fetchPreferences(accountInfo: AccountInfo | null): Promise<Preferences | null> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return null;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching preferences from Supabase:', error);
      return null;
    }

    if (!data) return null;

    return {
      weightUnit: (data.weight_unit as 'kg' | 'lbs') || 'kg',
      notificationsEnabled: data.notifications_enabled ?? true,
      mealReminders: (data.meal_reminders as Preferences['mealReminders']) || {
        breakfast: { enabled: false, hour: 8, minute: 0 },
        lunch: { enabled: false, hour: 12, minute: 0 },
        dinner: { enabled: false, hour: 18, minute: 0 },
      },
      dynamicAdjustmentEnabled: data.dynamic_adjustment_enabled ?? false,
      dynamicAdjustmentThreshold: data.dynamic_adjustment_threshold ?? 3,
    };
  },

  // User Settings
  async saveUserSettings(
    accountInfo: AccountInfo | null,
    settings: { entryCount?: number; userPlan?: 'free' | 'premium'; deviceInfo?: any }
  ): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const updateData: any = {};
    if (settings.entryCount !== undefined) updateData.entry_count = settings.entryCount;
    if (settings.userPlan !== undefined) updateData.user_plan = settings.userPlan;
    if (settings.deviceInfo !== undefined) updateData.device_info = settings.deviceInfo;

    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          ...updateData,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving user settings to Supabase:', error);
      throw error;
    }
  },

  async fetchUserSettings(accountInfo: AccountInfo | null): Promise<{
    entryCount: number;
    userPlan: 'free' | 'premium';
    deviceInfo: any;
  } | null> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return null;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user settings from Supabase:', error);
      return null;
    }

    if (!data) return null;

    return {
      entryCount: data.entry_count || 0,
      userPlan: (data.user_plan as 'free' | 'premium') || 'free',
      deviceInfo: data.device_info || null,
    };
  },

  // Entry Tasks
  async saveEntryTasks(accountInfo: AccountInfo | null, tasks: EntryTasksStatus): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase
      .from('entry_tasks')
      .upsert(
        {
          user_id: user.id,
          custom_plan_completed: tasks.customPlanCompleted,
          registration_completed: tasks.registrationCompleted,
          completed_at: tasks.customPlanCompleted || tasks.registrationCompleted ? new Date().toISOString() : null,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving entry tasks to Supabase:', error);
      throw error;
    }
  },

  async fetchEntryTasks(accountInfo: AccountInfo | null): Promise<EntryTasksStatus | null> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return null;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return null;

    const { data, error } = await supabase
      .from('entry_tasks')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching entry tasks from Supabase:', error);
      return null;
    }

    if (!data) return null;

    return {
      customPlanCompleted: data.custom_plan_completed || false,
      registrationCompleted: data.registration_completed || false,
    };
  },

  // Referral Codes
  async saveReferralCode(accountInfo: AccountInfo | null, code: ReferralCode): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase
      .from('referral_codes')
      .upsert(
        {
          user_id: user.id,
          code: code.code.toUpperCase(),
          total_referrals: code.totalReferrals || 0,
          total_earned_entries: code.totalEarnedEntries || 0,
          created_at: code.createdAt,
        },
        { onConflict: 'code' }
      );

    if (error) {
      console.error('Error saving referral code to Supabase:', error);
      throw error;
    }
  },

  async fetchReferralCode(accountInfo: AccountInfo | null): Promise<ReferralCode | null> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo) return null;

    const user = await getOrCreateUser(accountInfo);
    if (!user) return null;

    const { data, error } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching referral code from Supabase:', error);
      return null;
    }

    if (!data) return null;

    return {
      code: data.code,
      userId: data.user_id,
      createdAt: data.created_at,
      totalReferrals: data.total_referrals || 0,
      totalEarnedEntries: data.total_earned_entries || 0,
    };
  },

  async fetchReferralCodeByCode(code: string): Promise<ReferralCode | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    const { data, error } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching referral code by code from Supabase:', error);
      return null;
    }

    if (!data) return null;

    return {
      code: data.code,
      userId: data.user_id,
      createdAt: data.created_at,
      totalReferrals: data.total_referrals || 0,
      totalEarnedEntries: data.total_earned_entries || 0,
    };
  },

  // Referral Redemptions
  async saveReferralRedemption(accountInfo: AccountInfo | null, redemption: ReferralRedemption): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;

    const { error } = await supabase.from('referral_redemptions').insert({
      id: redemption.id,
      referral_code: redemption.referralCode.toUpperCase(),
      referrer_email: redemption.referrerEmail.toLowerCase(),
      referee_email: redemption.refereeEmail.toLowerCase(),
      referee_name: redemption.refereeName,
      redeemed_at: redemption.redeemedAt,
      status: redemption.status,
      meals_logged: redemption.mealsLogged || 0,
      device_id: redemption.deviceId,
      completed_at: redemption.completedAt || null,
    });

    if (error) {
      console.error('Error saving referral redemption to Supabase:', error);
      throw error;
    }
  },

  async fetchReferralRedemptions(
    accountInfo: AccountInfo | null,
    type: 'referrer' | 'referee'
  ): Promise<ReferralRedemption[]> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.email) return [];

    const email = accountInfo.email.toLowerCase();
    const column = type === 'referrer' ? 'referrer_email' : 'referee_email';

    const { data, error } = await supabase
      .from('referral_redemptions')
      .select('*')
      .eq(column, email)
      .order('redeemed_at', { ascending: false });

    if (error) {
      console.error('Error fetching referral redemptions from Supabase:', error);
      return [];
    }

    return (
      data?.map((row) => ({
        id: row.id,
        referralCode: row.referral_code,
        referrerEmail: row.referrer_email,
        refereeEmail: row.referee_email,
        refereeName: row.referee_name || '',
        redeemedAt: row.redeemed_at,
        status: (row.status as 'pending' | 'completed' | 'failed') || 'pending',
        mealsLogged: row.meals_logged || 0,
        deviceId: row.device_id || '',
        completedAt: row.completed_at || undefined,
      })) || []
    );
  },

  // Referral Rewards
  async saveReferralReward(accountInfo: AccountInfo | null, reward: ReferralReward): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const { error } = await supabase.from('referral_rewards').insert({
      id: reward.id,
      user_id: user.id,
      related_redemption_id: reward.relatedRedemptionId,
      earned_at: reward.earnedAt,
      entries_awarded: reward.entriesAwarded,
      reason: reward.reason,
    });

    if (error) {
      console.error('Error saving referral reward to Supabase:', error);
      throw error;
    }
  },

  async fetchReferralRewards(accountInfo: AccountInfo | null, userId: string): Promise<ReferralReward[]> {
    if (!isSupabaseConfigured() || !supabase) return [];

    const { data, error } = await supabase
      .from('referral_rewards')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) {
      console.error('Error fetching referral rewards from Supabase:', error);
      return [];
    }

    return (
      data?.map((row) => ({
        id: row.id,
        userId: row.user_id,
        earnedAt: row.earned_at,
        entriesAwarded: row.entries_awarded || 0,
        reason: (row.reason as 'referrer_reward' | 'referee_reward') || 'referrer_reward',
        relatedRedemptionId: row.related_redemption_id || '',
      })) || []
    );
  },

  // Nutrition Library (Deterministic Engine)
  async fetchNutritionFromLibrary(foodName: string): Promise<NutritionLibraryItem | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    // Normalize name for lookup (lowercase, trimmed)
    const normalizedName = foodName.toLowerCase().trim();

    const { data, error } = await supabase
      .from('nutrition_library')
      .select('*')
      .eq('name', normalizedName)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching from nutrition_library:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      calories_per_100g: data.calories_per_100g,
      protein_per_100g: data.protein_per_100g,
      carbs_per_100g: data.carbs_per_100g,
      fat_per_100g: data.fat_per_100g,

      // Extended
      dietary_fiber_per_100g: data.dietary_fiber_per_100g ?? data.fiber_per_100g,
      sugar_per_100g: data.sugar_per_100g,
      added_sugars_per_100g: data.added_sugars_per_100g,
      sugar_alcohols_per_100g: data.sugar_alcohols_per_100g,
      net_carbs_per_100g: data.net_carbs_per_100g,

      saturated_fat_per_100g: data.saturated_fat_per_100g,
      trans_fat_per_100g: data.trans_fat_per_100g,
      polyunsaturated_fat_per_100g: data.polyunsaturated_fat_per_100g,
      monounsaturated_fat_per_100g: data.monounsaturated_fat_per_100g,

      sodium_mg_per_100g: data.sodium_mg_per_100g,
      potassium_mg_per_100g: data.potassium_mg_per_100g,
      cholesterol_mg_per_100g: data.cholesterol_mg_per_100g,
      calcium_mg_per_100g: data.calcium_mg_per_100g,
      iron_mg_per_100g: data.iron_mg_per_100g,

      vitamin_a_mcg_per_100g: data.vitamin_a_mcg_per_100g,
      vitamin_c_mg_per_100g: data.vitamin_c_mg_per_100g,
      vitamin_d_mcg_per_100g: data.vitamin_d_mcg_per_100g,
      vitamin_e_mg_per_100g: data.vitamin_e_mg_per_100g,
      vitamin_k_mcg_per_100g: data.vitamin_k_mcg_per_100g,
      vitamin_b12_mcg_per_100g: data.vitamin_b12_mcg_per_100g,

      standard_serving_weight_g: data.standard_serving_weight_g,
      standard_unit: data.standard_unit,
    };
  },

  async saveNutritionToLibrary(item: NutritionLibraryItem): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    // Normalize name
    const normalizedName = item.name.toLowerCase().trim();

    try {
      const { error } = await supabase.from('nutrition_library').upsert(
        {
          name: normalizedName,
          calories_per_100g: item.calories_per_100g,
          protein_per_100g: item.protein_per_100g,
          carbs_per_100g: item.carbs_per_100g,
          fat_per_100g: item.fat_per_100g,

          // Micros
          dietary_fiber_per_100g: item.dietary_fiber_per_100g,
          sugar_per_100g: item.sugar_per_100g,
          added_sugars_per_100g: item.added_sugars_per_100g,
          sugar_alcohols_per_100g: item.sugar_alcohols_per_100g,
          net_carbs_per_100g: item.net_carbs_per_100g,

          saturated_fat_per_100g: item.saturated_fat_per_100g,
          trans_fat_per_100g: item.trans_fat_per_100g,
          polyunsaturated_fat_per_100g: item.polyunsaturated_fat_per_100g,
          monounsaturated_fat_per_100g: item.monounsaturated_fat_per_100g,

          sodium_mg_per_100g: item.sodium_mg_per_100g,
          potassium_mg_per_100g: item.potassium_mg_per_100g,
          cholesterol_mg_per_100g: item.cholesterol_mg_per_100g,
          calcium_mg_per_100g: item.calcium_mg_per_100g,
          iron_mg_per_100g: item.iron_mg_per_100g,

          vitamin_a_mcg_per_100g: item.vitamin_a_mcg_per_100g,
          vitamin_c_mg_per_100g: item.vitamin_c_mg_per_100g,
          vitamin_d_mcg_per_100g: item.vitamin_d_mcg_per_100g,
          vitamin_e_mg_per_100g: item.vitamin_e_mg_per_100g,
          vitamin_k_mcg_per_100g: item.vitamin_k_mcg_per_100g,
          vitamin_b12_mcg_per_100g: item.vitamin_b12_mcg_per_100g,

          standard_serving_weight_g: item.standard_serving_weight_g,
          standard_unit: item.standard_unit,
        },
        { onConflict: 'name' }
      );

      if (error) {
        // Ignore "relation not found" error to prevent crash if table missing
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.warn('Supabase table "nutrition_library" missing. Auto-save skipped.');
          return;
        }
        console.error('Error saving to nutrition_library:', error);
      }
    } catch (e) {
      console.error('Exception saving to nutrition_library:', e);
    }
  },
};

