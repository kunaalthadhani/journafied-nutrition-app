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
  ReferralRedemption,
  ReferralReward,
  MealEntry,
  ReferralCode,
  StreakFreezeData,
  AnalyticsEvent,
  Insight,
  DetectedPattern,
  WeeklyActionPlan,
  CalorieBankConfig,
  CalorieBankCompletedCycle,
  DailySummary,
  FamilyProfile,
  HabitSignal,
  LiftsDay,
  LiftsSupplement,
} from './dataStorage';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseEntry } from '../components/ExerciseLogSection';
import { AppUser, SupabaseFoodLog } from '../types';
import { generateId } from '../utils/uuid';

// one anonymous install id per device, the family analytics key
const INSTALL_ID_KEY = '@trackkal:installId';
let cachedInstallId: string | null = null;
async function getInstallId(): Promise<string> {
  if (cachedInstallId) return cachedInstallId;
  let id: string | null = null;
  try {
    id = await AsyncStorage.getItem(INSTALL_ID_KEY);
  } catch { /* mint fresh below */ }
  if (!id) {
    id = generateId();
    try { await AsyncStorage.setItem(INSTALL_ID_KEY, id); } catch { /* keep in memory */ }
  }
  cachedInstallId = id;
  return id;
}

const sumNutrient = (foods: MealEntry['foods'], key: 'calories' | 'protein' | 'carbs' | 'fat') =>
  foods.reduce((total, food) => total + (food[key] || 0), 0);

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 10);
};

// The family identity: the auth uid is the only key. app_users is gone,
// every table on the family project references auth.users directly, and
// the profiles row (created by a server trigger on signup) carries the
// shared name. Reading the session every time keeps RLS happy and survives
// cache wipes, same as before, minus the email joins.
// A cloud write with no live session is not a failure, it is "not yet". The
// cached supabaseUserId survives sign out and a killed session, so the app can
// believe it is signed in when it is not. Ops that hit this must be requeued
// untouched: burning retries here empties the queue before she signs back in,
// which is how the goals sync was lost once already
export const AUTH_NOT_READY = 'AUTH_NOT_READY';
export const isAuthNotReady = (e: unknown): boolean =>
  e instanceof Error && e.message === AUTH_NOT_READY;

async function getOrCreateUser(accountInfo?: AccountInfo | null): Promise<AppUser | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const authUser = sessionData?.session?.user;
  if (!authUser?.id) return null;

  let displayName: string | undefined;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', authUser.id)
      .maybeSingle();
    displayName = (data?.name as string | null) ?? undefined;
  } catch { /* the name is enrichment, never a gate */ }

  // a fresher local name lands on the shared profile, so the next family
  // app greets her by name
  if (accountInfo?.name && accountInfo.name !== displayName) {
    try {
      await supabase
        .from('profiles')
        .update({ name: accountInfo.name, updated_at: new Date().toISOString() })
        .eq('id', authUser.id);
      displayName = accountInfo.name;
    } catch { /* best effort */ }
  }

  return {
    id: authUser.id,
    authUserId: authUser.id,
    email: authUser.email ?? accountInfo?.email ?? undefined,
    displayName,
    phoneNumber: undefined,
    createdAt: authUser.created_at ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function getUserByEmail(email: string): Promise<AppUser | null> {
  // email is a login credential now, never a join key. The only account
  // this client can see is the signed in one; anyone else is null
  const user = await getOrCreateUser(null);
  if (!user?.email || !email) return null;
  return user.email.toLowerCase() === email.trim().toLowerCase() ? user : null;
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
    // Intentionally omit deleted_at. Sending deleted_at:null here made an upsert
    // (e.g. a date-switch re-upsert of the whole day) RESURRECT a meal that was
    // soft-deleted on another device. Omitting it leaves deleted_at untouched on
    // a conflicting row, and a brand-new row still defaults to null.
  };
}

// weights live in the shared family weight_log now: one row per user per
// day per app. Kcal writes its own rows and reads the whole family, so a
// weigh in from TrackLifts shows up here. One account, one body. Her own
// kcal row wins a day; a sibling row fills a day she skipped
function mapWeightRows(records: { date: string; weight_kg: number; source_app: string; created_at?: string }[]): WeightEntry[] {
  const byDate = new Map<string, { entry: WeightEntry; own: boolean }>();
  for (const r of records) {
    const date = String(r.date);
    const own = r.source_app === 'kcal';
    const existing = byDate.get(date);
    if (existing && (existing.own || !own)) continue;
    byDate.set(date, {
      own,
      entry: {
        id: date,
        date,
        weight: Number(r.weight_kg) || 0,
        updatedAt: r.created_at || new Date().toISOString(),
      },
    });
  }
  return [...byDate.values()].map((x) => x.entry).sort((a, b) => (a.date < b.date ? -1 : 1));
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
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    const rows = payloads.map((payload) => mealPayloadToRow(user.id, payload));
    const { error } = await supabase.from('kcal_food_logs').upsert(rows, { onConflict: 'id' });
    if (error) {
      throw error;
    }
  },

  async deleteMeals(accountInfo: AccountInfo | null, mealIds: string[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || mealIds.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    const { error } = await supabase
      .from('kcal_food_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', user.id)
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
      .from('kcal_food_logs')
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
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    // one row per day: dedupe the batch by date, last write wins, because a
    // single upsert statement cannot touch the same key twice
    const byDate = new Map<string, WeightSyncPayload>();
    for (const p of payloads) byDate.set(p.date.slice(0, 10), p);
    const rows = [...byDate.entries()].map(([date, p]) => ({
      user_id: user.id,
      date,
      weight_kg: p.weight,
      source_app: 'kcal',
    }));
    const { error } = await supabase
      .from('weight_log')
      .upsert(rows, { onConflict: 'user_id,date,source_app' });
    if (error) {
      throw error;
    }
  },

  async deleteWeightEntries(accountInfo: AccountInfo | null, ids: string[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || ids.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    // local ids are date based, so a delete targets days. Only kcal's own
    // rows die: a sibling app's weigh in is never deleted from here
    const dates = ids
      .map((id) => (/^\d{4}-\d{2}-\d{2}/.test(id) ? id.slice(0, 10) : null))
      .filter((d): d is string => d !== null);
    if (dates.length === 0) return;
    const { error } = await supabase
      .from('weight_log')
      .delete()
      .eq('user_id', user.id)
      .eq('source_app', 'kcal')
      .in('date', dates);
    if (error) {
      throw error;
    }
  },

  async fetchWeightEntries(accountInfo: AccountInfo | null) {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return [];
    const user = await getOrCreateUser(accountInfo);
    if (!user) return [];

    const { data, error } = await supabase
      .from('weight_log')
      .select('date, weight_kg, source_app, created_at')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching weight entries from Supabase:', error);
      return [];
    }

    return data ? mapWeightRows(data) : [];
  },

  async saveNutritionGoals(accountInfo: AccountInfo | null, goals: ExtendedGoalData): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;
    // Accept email-only accounts like upsertMeals does. During sign-up there is a
    // window where the cache has the email but not the uid yet; goals are written
    // exactly once at onboarding, so rejecting that window loses the only write.
    if (!accountInfo?.supabaseUserId && !accountInfo?.email) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw instead of silently resolving. A silent no-op here reads as success to
    // the sync queue, which dequeues the op forever. Throwing lets callers enqueue
    // and the queue retry.
    if (!user) throw new Error('saveNutritionGoals: could not resolve app user');

    // First, deactivate all existing active goals for this user
    const { error: deactivateError } = await supabase
      .from('kcal_goals')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (deactivateError) {
      console.error('Error deactivating previous nutrition goals:', deactivateError);
      // Continue anyway - we'll still create the new goal
    }

    // Insert the new active goal with all profile data
    const { error: insertError } = await supabase
      .from('kcal_goals')
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

    // ring 1: the body facts the goal was built from land on the shared
    // profile, so TrackLifts and Femm start already knowing her. The goal
    // row above keeps its own snapshot for history, profiles holds the
    // live truth. prefer_not_to_say stays private, the family column is null
    try {
      const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (goals.gender === 'male' || goals.gender === 'female') p.gender = goals.gender;
      if (goals.age) p.age = goals.age;
      // kcal is the only app that collects a real date, so it owns the backfill
      // of the canonical birth fact. Age stays written for readers that predate
      // dob, but dob is what the family should be deriving from
      if (goals.dob) p.dob = goals.dob;
      if (goals.heightCm) p.height_cm = goals.heightCm;
      if (goals.currentWeightKg) p.weight_kg = goals.currentWeightKg;
      if (goals.targetWeightKg) p.goal_weight_kg = goals.targetWeightKg;
      // body_goal, never the old shared `goal` column: lifts wrote its training
      // word into that one, and a training word read as a body goal would set
      // the wrong calorie target
      if (goals.goal === 'lose' || goals.goal === 'maintain' || goals.goal === 'gain') {
        p.body_goal = goals.goal;
      }
      await supabase.from('profiles').update(p).eq('id', user.id);
    } catch { /* profile push is enrichment, the goal is already saved */ }
  },

  async fetchNutritionGoals(accountInfo: AccountInfo | null): Promise<ExtendedGoalData | null> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return null;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return null;

    const { data, error } = await supabase
      .from('kcal_goals')
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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || exercises.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

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
        // Omit deleted_at so re-upserting the full list never resurrects an
        // exercise soft-deleted on another device (same fix as mealPayloadToRow).
      };
    });

    const { error } = await supabase.from('kcal_exercise_logs').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.error('Error upserting exercises to Supabase:', error);
      throw error;
    }
  },

  async deleteExercises(accountInfo: AccountInfo | null, ids: string[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || ids.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    const { error } = await supabase
      .from('kcal_exercise_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', ids);

    if (error) {
      console.error('Error deleting exercises from Supabase:', error);
      throw error;
    }
  },

  async fetchExercises(accountInfo: AccountInfo | null): Promise<Record<string, ExerciseEntry[]>> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return {};
    const user = await getOrCreateUser(accountInfo);
    if (!user) return {};

    const { data, error } = await supabase
      .from('kcal_exercise_logs')
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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || !token) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: user.id,
          app: 'kcal',
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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || !token) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return [];
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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    const { error } = await supabase.from('kcal_push_history').insert({
      id: record.id,
      user_id: user.id,
      title: record.title,
      message: record.message,
      client_ts: record.timestamp,
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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    // Note: Supabase doesn't support raw SQL in update, so we fetch, increment, and update
    const { data: existing } = await supabase
      .from('kcal_push_history')
      .select('click_count')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('kcal_push_history')
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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return [];
    const user = await getOrCreateUser(accountInfo);
    if (!user) return [];

    const { data, error } = await supabase
      .from('kcal_push_history')
      .select('*')
      .eq('user_id', user.id)
      .order('client_ts', { ascending: false });

    if (error) {
      console.error('Error fetching push history from Supabase:', error);
      return [];
    }

    return (
      data?.map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        timestamp: row.client_ts || row.sent_at,
        targetCount: row.target_count || 0,
        successCount: row.success_count || 0,
        failureCount: row.failure_count || 0,
        clickCount: row.click_count || 0,
      })) || []
    );
  },

  // Saved Prompts
  async upsertSavedPrompt(accountInfo: AccountInfo | null, prompt: SavedPrompt): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    const { error } = await supabase
      .from('kcal_saved_prompts')
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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    const { error } = await supabase.from('kcal_saved_prompts').delete().eq('id', id).eq('user_id', user.id);

    if (error) {
      console.error('Error deleting saved prompt from Supabase:', error);
      throw error;
    }
  },

  async fetchSavedPrompts(accountInfo: AccountInfo | null): Promise<SavedPrompt[]> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return [];
    const user = await getOrCreateUser(accountInfo);
    if (!user) return [];

    const { data, error } = await supabase
      .from('kcal_saved_prompts')
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
    if (!isSupabaseConfigured() || !supabase) return;
    if (!accountInfo?.supabaseUserId && !accountInfo?.email) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) throw new Error('savePreferences: could not resolve app user');

    const { error } = await supabase
      .from('kcal_prefs')
      .upsert(
        {
          user_id: user.id,
          notifications_enabled: prefs.notificationsEnabled,
          meal_reminders: prefs.mealReminders,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving preferences to Supabase:', error);
      throw error;
    }

    // the weight unit is a ring 1 fact on the shared profile, every Track
    // app reads and writes the same one. Family speaks kg/lb, kcal lbs
    try {
      await supabase
        .from('profiles')
        .update({
          weight_unit: prefs.weightUnit === 'lbs' ? 'lb' : 'kg',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    } catch { /* the unit is enrichment, prefs already saved */ }
  },

  async fetchPreferences(accountInfo: AccountInfo | null): Promise<Preferences | null> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return null;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return null;

    const { data, error } = await supabase
      .from('kcal_prefs')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching preferences from Supabase:', error);
      return null;
    }

    if (!data) return null;

    // the unit lives on the shared profile, ring 1
    let unit: 'kg' | 'lbs' = 'kg';
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('weight_unit')
        .eq('id', user.id)
        .maybeSingle();
      if (prof?.weight_unit === 'lb') unit = 'lbs';
    } catch { /* default kg */ }

    return {
      weightUnit: unit,
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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    const updateData: any = {};
    if (settings.entryCount !== undefined) updateData.entry_count = settings.entryCount;
    // userPlan is deliberately dropped: entitlements is the family's only
    // premium truth, written by the server, never by a phone
    if (settings.deviceInfo !== undefined) updateData.device_info = settings.deviceInfo;

    const { error } = await supabase
      .from('kcal_settings')
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

  // entryCount is undefined when this user has no settings row yet, so callers
  // keep their local value instead of being reset to zero. userPlan is always
  // answered: it comes from entitlements, which exists independently.
  async fetchUserSettings(accountInfo: AccountInfo | null): Promise<{
    entryCount?: number;
    userPlan: 'free' | 'premium';
    deviceInfo: any;
  } | null> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return null;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return null;

    const { data, error } = await supabase
      .from('kcal_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user settings from Supabase:', error);
      return null;
    }

    // premium comes from the family entitlements table, the only truth.
    // Read before the settings row is considered: someone who bought Track
    // Plus in TrackLifts and then installed this app has an entitlements row
    // and no kcal_settings row yet. Returning early on the missing settings
    // row used to hand that person a free plan.
    let userPlan: 'free' | 'premium' = 'free';
    try {
      const { data: ent } = await supabase
        .from('entitlements')
        .select('kcal_premium, track_plus')
        .eq('user_id', user.id)
        .maybeSingle();
      if (ent?.kcal_premium || ent?.track_plus) userPlan = 'premium';
    } catch { /* free until proven premium */ }

    return {
      entryCount: data ? (data.entry_count || 0) : undefined,
      userPlan,
      deviceInfo: data?.device_info || null,
    };
  },

  // Referral Codes
  async saveReferralCode(accountInfo: AccountInfo | null, code: ReferralCode): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    const { error } = await supabase
      .from('kcal_referral_codes')
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
      .from('kcal_referral_codes')
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
      .from('kcal_referral_codes')
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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;

    const { error } = await supabase.from('kcal_referral_redemptions').insert({
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
      .from('kcal_referral_redemptions')
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
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    const { error } = await supabase.from('kcal_referral_rewards').insert({
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
      .from('kcal_referral_rewards')
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

  // Streak Freeze
  async upsertStreakFreeze(accountInfo: AccountInfo | null, freeze: StreakFreezeData): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    try {
      const { error } = await supabase.from('kcal_streak_freezes').upsert(
        {
          user_id: user.id,
          freezes_available: freeze.freezesAvailable,
          last_reset_date: freeze.lastResetDate,
          used_on_dates: freeze.usedOnDates,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      );
      if (error) console.error('Error saving streak freeze:', error);
    } catch (e) { console.error('Exception saving streak freeze:', e); }
  },

  // Analytics: the family table is write only by design, install_id keyed,
  // app tagged. A leaked client key can add a row and never read one back
  async logAnalyticsEvent(accountInfo: AccountInfo | null, event: AnalyticsEvent): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    try {
      const { error } = await supabase.from('analytics_events').insert({
        install_id: await getInstallId(),
        user_id: user.id,
        app: 'kcal',
        name: event.eventName.slice(0, 64),
        props: event.properties || {},
        client_ts: event.timestamp,
      });
      if (error) console.warn('Failed to log analytics event:', error);
    } catch (e) { }
  },

  // Insights
  async upsertInsights(accountInfo: AccountInfo | null, insights: Insight[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || insights.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);
    const rows = insights.map((i) => ({
      id: i.id,
      user_id: user.id,
      payload: i as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('kcal_insights').upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw error;
  },

  async fetchInsights(accountInfo: AccountInfo | null): Promise<Insight[]> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return [];
    const user = await getOrCreateUser(accountInfo);
    if (!user) return [];
    const { data, error } = await supabase
      .from('kcal_insights')
      .select('payload')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) { console.error('fetchInsights error:', error); return []; }
    return (data || []).map((row) => row.payload as Insight);
  },

  // Detected Patterns (single jsonb per user — array of patterns)
  async upsertDetectedPatterns(accountInfo: AccountInfo | null, patterns: DetectedPattern[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);
    const { error } = await supabase.from('kcal_detected_patterns').upsert(
      {
        user_id: user.id,
        payload: { patterns } as unknown as Record<string, unknown>,
        detected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
  },

  async fetchDetectedPatterns(accountInfo: AccountInfo | null): Promise<DetectedPattern[]> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return [];
    const user = await getOrCreateUser(accountInfo);
    if (!user) return [];
    const { data, error } = await supabase
      .from('kcal_detected_patterns')
      .select('payload')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') { console.error('fetchDetectedPatterns error:', error); return []; }
    const payload = (data?.payload as { patterns?: DetectedPattern[] } | null) ?? null;
    return payload?.patterns ?? [];
  },

  // Weekly Action Plan (single per user)
  async upsertWeeklyActionPlan(accountInfo: AccountInfo | null, plan: WeeklyActionPlan): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);
    const { error } = await supabase.from('kcal_weekly_action_plans').upsert(
      {
        user_id: user.id,
        payload: plan as unknown as Record<string, unknown>,
        generated_at: plan.weekStartDate || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
  },

  async fetchWeeklyActionPlan(accountInfo: AccountInfo | null): Promise<WeeklyActionPlan | null> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return null;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return null;
    const { data, error } = await supabase
      .from('kcal_weekly_action_plans')
      .select('payload')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') { console.error('fetchWeeklyActionPlan error:', error); return null; }
    return (data?.payload as WeeklyActionPlan | null) ?? null;
  },

  // Insight Unlocks
  async upsertInsightUnlocks(
    accountInfo: AccountInfo | null,
    unlocks: Record<string, { unlockedAt: string; seenAt?: string }>,
  ): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);
    const rows = Object.entries(unlocks).map(([insightId, value]) => ({
      user_id: user.id,
      insight_id: insightId,
      unlocked_at: value.unlockedAt,
      seen_at: value.seenAt || null,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return;
    const { error } = await supabase
      .from('kcal_insight_unlocks')
      .upsert(rows, { onConflict: 'user_id,insight_id' });
    if (error) throw error;
  },

  async fetchInsightUnlocks(
    accountInfo: AccountInfo | null,
  ): Promise<Record<string, { unlockedAt: string; seenAt?: string }>> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return {};
    const user = await getOrCreateUser(accountInfo);
    if (!user) return {};
    const { data, error } = await supabase
      .from('kcal_insight_unlocks')
      .select('insight_id, unlocked_at, seen_at')
      .eq('user_id', user.id);
    if (error) { console.error('fetchInsightUnlocks error:', error); return {}; }
    const out: Record<string, { unlockedAt: string; seenAt?: string }> = {};
    (data || []).forEach((row) => {
      out[row.insight_id] = {
        unlockedAt: row.unlocked_at,
        seenAt: row.seen_at || undefined,
      };
    });
    return out;
  },

  // Onboarding reads before it asks. FAMILY.md law six: a signed in user is
  // never asked a question whose answer already sits on profiles. Age is
  // derived from dob and never read from the age column when a dob exists,
  // because a stored age is wrong within a year and nobody owns incrementing it
  async fetchFamilyProfile(accountInfo: AccountInfo | null): Promise<FamilyProfile | null> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('name, gender, dob, age, height_cm, weight_kg, goal_weight_kg, weight_unit, body_goal, training_goal, days_per_week, session_length_min')
      .eq('id', accountInfo.supabaseUserId)
      .maybeSingle();
    if (error) { if (__DEV__) console.warn('fetchFamilyProfile error:', error.message); return null; }
    if (!data) return null;

    const ageFromDob = (() => {
      if (!data.dob) return null;
      const d = new Date(data.dob as string);
      if (Number.isNaN(d.getTime())) return null;
      const now = new Date();
      let a = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
      return a >= 0 && a < 130 ? a : null;
    })();

    return {
      name: (data.name as string) || null,
      gender: (data.gender as 'male' | 'female' | null) ?? null,
      dob: (data.dob as string) || null,
      age: ageFromDob ?? (typeof data.age === 'number' ? data.age : null),
      ageIsDerived: ageFromDob !== null,
      heightCm: typeof data.height_cm === 'number' ? data.height_cm : null,
      weightKg: typeof data.weight_kg === 'number' ? data.weight_kg : null,
      goalWeightKg: typeof data.goal_weight_kg === 'number' ? data.goal_weight_kg : null,
      weightUnit: (data.weight_unit as 'kg' | 'lb' | null) ?? null,
      bodyGoal: (data.body_goal as 'lose' | 'maintain' | 'gain' | null) ?? null,
      trainingGoal: (data.training_goal as string) || null,
      daysPerWeek: typeof data.days_per_week === 'number' ? data.days_per_week : null,
      sessionLengthMin: typeof data.session_length_min === 'number' ? data.session_length_min : null,
    };
  },

  // ---- The family wall ----
  // Two calls cross to a sibling app. Both are named in FAMILY.md before they
  // were written. Kcal owns kcal_habit_signals and only reads lifts' ledger

  async upsertHabitSignals(
    accountInfo: AccountInfo | null,
    signals: HabitSignal[],
  ): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) throw new Error(AUTH_NOT_READY);
    // Six is a schema constraint on the other side, not a suggestion
    const capped = signals.slice(0, 6);
    const { error } = await supabase
      .from('kcal_habit_signals')
      .upsert({ user_id: user.id, signals: capped, computed_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
  },

  async fetchLiftsDays(
    accountInfo: AccountInfo | null,
    sinceDate: string,
  ): Promise<LiftsDay[]> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return [];
    const { data, error } = await supabase
      .from('lifts_daily_summaries')
      .select('summary_date, session_count, total_sets, total_volume_kg, duration_min, calories_burned, highlight, first_started_at, last_finished_at, updated_at')
      .eq('user_id', accountInfo.supabaseUserId)
      .gte('summary_date', sinceDate)
      .order('summary_date', { ascending: false });
    // A sibling that has not shipped its writer yet is not an error worth noise
    if (error) { if (__DEV__) console.warn('fetchLiftsDays error:', error.message); return []; }
    return (data || []).map((row) => ({
      date: row.summary_date as string,
      sessions: row.session_count ?? 0,
      sets: row.total_sets ?? null,
      volumeKg: row.total_volume_kg ?? null,
      minutes: row.duration_min ?? null,
      // An estimate. Context, never currency: this number never enters the
      // eating budget. FAMILY.md carries the rule
      caloriesBurnedEstimate: row.calories_burned ?? null,
      highlight: typeof row.highlight === 'string' ? row.highlight.slice(0, 200) : null,
      // Clocks are often null: a backfilled session never had them. A day with
      // totals and no clocks was trained at an unknown hour, never assume one
      startedAt: row.first_started_at ?? null,
      finishedAt: row.last_finished_at ?? null,
      updatedAt: row.updated_at as string,
    }));
  },

  async fetchLiftsSupplements(
    accountInfo: AccountInfo | null,
    sinceDate: string,
  ): Promise<LiftsSupplement[]> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.supabaseUserId) return [];
    const { data, error } = await supabase
      .from('supplement_log')
      .select('taken_on, name, dose_label, kcal, protein_g')
      .eq('user_id', accountInfo.supabaseUserId)
      .gte('taken_on', sinceDate)
      .order('taken_on', { ascending: false });
    if (error) { if (__DEV__) console.warn('fetchLiftsSupplements error:', error.message); return []; }
    return (data || []).map((row) => ({
      date: row.taken_on as string,
      name: (row.name as string) || '',
      doseLabel: (row.dose_label as string) || null,
      kcal: typeof row.kcal === 'number' ? row.kcal : null,
      proteinG: typeof row.protein_g === 'number' ? row.protein_g : null,
    }));
  },

  // Daily Summaries
  async upsertDailySummaries(
    accountInfo: AccountInfo | null,
    summaries: Record<string, DailySummary>,
  ): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);
    // the typed columns are the cross app contract: TrackLifts reads
    // calories and protein_g so its coach can speak to the other half.
    // They must never drift from the payload, written together always
    const rows = Object.entries(summaries).map(([dateKey, summary]) => ({
      user_id: user.id,
      summary_date: dateKey,
      payload: summary as unknown as Record<string, unknown>,
      calories: summary.totalCalories ?? null,
      protein_g: summary.totalProtein ?? null,
      carbs_g: summary.totalCarbs ?? null,
      fat_g: summary.totalFat ?? null,
      calorie_goal: summary.goalCalories ?? null,
      protein_goal_g: summary.goalProtein ?? null,
      updated_at: summary.updatedAt || new Date().toISOString(),
    }));
    if (rows.length === 0) return;
    const { error } = await supabase
      .from('kcal_daily_summaries')
      .upsert(rows, { onConflict: 'user_id,summary_date' });
    if (error) throw error;
  },

  async fetchDailySummaries(
    accountInfo: AccountInfo | null,
  ): Promise<Record<string, DailySummary>> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return {};
    const user = await getOrCreateUser(accountInfo);
    if (!user) return {};
    const { data, error } = await supabase
      .from('kcal_daily_summaries')
      .select('summary_date, payload')
      .eq('user_id', user.id);
    if (error) { console.error('fetchDailySummaries error:', error); return {}; }
    const out: Record<string, DailySummary> = {};
    (data || []).forEach((row) => {
      out[row.summary_date] = row.payload as DailySummary;
    });
    return out;
  },

  // Calorie Bank Config (stored as jsonb column on user_settings)
  async upsertCalorieBankConfig(
    accountInfo: AccountInfo | null,
    config: CalorieBankConfig,
  ): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);
    const { error } = await supabase
      .from('kcal_settings')
      .upsert(
        { user_id: user.id, calorie_bank_config: config as unknown as Record<string, unknown> },
        { onConflict: 'user_id' },
      );
    if (error) throw error;
  },

  async fetchCalorieBankConfig(
    accountInfo: AccountInfo | null,
  ): Promise<CalorieBankConfig | null> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return null;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return null;
    const { data, error } = await supabase
      .from('kcal_settings')
      .select('calorie_bank_config')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') { console.error('fetchCalorieBankConfig error:', error); return null; }
    return (data?.calorie_bank_config as CalorieBankConfig | null) ?? null;
  },

  // Calorie Bank Completed Cycles
  async upsertCompletedCycles(
    accountInfo: AccountInfo | null,
    cycles: CalorieBankCompletedCycle[],
  ): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email) || cycles.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);
    const rows = cycles.map((cycle) => ({
      id: (cycle as any).id || `${cycle.startDate}_${cycle.endDate}`,
      user_id: user.id,
      payload: cycle as unknown as Record<string, unknown>,
      completed_at: cycle.endDate || new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('kcal_calorie_bank_cycles')
      .upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw error;
  },

  async fetchCompletedCycles(
    accountInfo: AccountInfo | null,
  ): Promise<CalorieBankCompletedCycle[]> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return [];
    const user = await getOrCreateUser(accountInfo);
    if (!user) return [];
    const { data, error } = await supabase
      .from('kcal_calorie_bank_cycles')
      .select('payload')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: true });
    if (error) { console.error('fetchCompletedCycles error:', error); return []; }
    return (data || []).map((row) => row.payload as CalorieBankCompletedCycle);
  },

  async deleteAllUserData(accountInfo: AccountInfo | null): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || (!accountInfo?.supabaseUserId && !accountInfo?.email)) return;
    const user = await getOrCreateUser(accountInfo);
    // Throw, never silently no-op: the sync queue reads a resolved promise as
    // success and dequeues the op forever. See the goals-sync postmortem.
    if (!user) throw new Error(AUTH_NOT_READY);

    try {
      // Every kcal owned table, then kcal's rows in the shared journals.
      // The auth record itself dies in the edge function afterwards, and
      // its cascade sweeps anything left. Note the family reality: deleting
      // the account deletes the Track account, every family app's data goes
      // with it, one account, one deletion.
      const tables = [
        'kcal_food_logs',
        'kcal_exercise_logs',
        'kcal_goals',
        'kcal_prefs',
        'kcal_settings',
        'kcal_saved_prompts',
        'kcal_insights',
        'kcal_detected_patterns',
        'kcal_weekly_action_plans',
        'kcal_insight_unlocks',
        'kcal_daily_summaries',
        'kcal_calorie_bank_cycles',
        'kcal_streak_freezes',
        'kcal_referral_codes',
        'kcal_referral_rewards',
        'kcal_push_history',
      ];

      await Promise.all([
        ...tables.map(table => supabase!.from(table).delete().eq('user_id', user.id)),
        supabase.from('weight_log').delete().eq('user_id', user.id).eq('source_app', 'kcal'),
        supabase.from('water_log').delete().eq('user_id', user.id),
        supabase.from('push_tokens').delete().eq('user_id', user.id).eq('app', 'kcal'),
      ]);
    } catch (error) {
      console.error('Error deleting user data from Supabase:', error);
      throw error;
    }
  },
};

