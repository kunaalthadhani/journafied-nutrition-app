import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseEntry } from '../components/ExerciseLogSection';
import { supabaseDataService } from './supabaseDataService';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { generateId, ensureUUID } from '../utils/uuid';
import { ParsedFood } from '../utils/foodNutrition';
import { calculateStreak } from '../utils/streakUtils';

export interface MealEntry {
  id: string;
  prompt: string;
  foods: ParsedFood[];
  timestamp: number;
  imageUri?: string;
  updatedAt?: string;
  date?: string; // Optional if we store it by date key
  userId?: string;
}

const STORAGE_KEYS = {
  GOALS: '@trackkal:goals',
  MEALS: '@trackkal:meals',
  EXERCISES: '@trackkal:exercises',
  WEIGHT_ENTRIES: '@trackkal:weightEntries',
  ENTRY_COUNT: '@trackkal:entryCount',
  USER_PLAN: '@trackkal:userPlan',
  DEVICE_INFO: '@trackkal:deviceInfo',
  ACCOUNT_INFO: '@trackkal:accountInfo',
  PREFERENCES: '@trackkal:preferences',
  PUSH_TOKENS: '@trackkal:pushTokens',
  PUSH_HISTORY: '@trackkal:pushHistory',
  REFERRAL_CODES: '@trackkal:referralCodes',
  REFERRAL_REDEMPTIONS: '@trackkal:referralRedemptions',
  REFERRAL_REWARDS: '@trackkal:referralRewards',
  SAVED_PROMPTS: '@trackkal:savedPrompts',
  ENTRY_TASKS: '@trackkal:entryTasks',
  SYNC_QUEUE: '@trackkal:syncQueue',
  STREAK_FREEZE: '@trackkal:streakFreeze',
  ADJUSTMENT_HISTORY: '@trackkal:adjustmentHistory',
  ANALYTICS_FEEDBACK: '@trackkal:analyticsFeedback',
  SUMMARIES: '@trackkal:summaries',
  // Helper to generate daily keys
  dailyLog: (date: string) => `@trackkal:log:${date}`,
  USER_METRICS_SNAPSHOT: '@trackkal:userMetricsSnapshot',
  INSIGHTS: '@trackkal:insights',
  COACH_DISMISS_DATE: '@trackkal:coachDismissDate',
};

// ... (rest of file)


export interface ExtendedGoalData {
  calories: number;
  proteinPercentage: number;
  carbsPercentage: number;
  fatPercentage: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  age?: number;
  gender?: 'male' | 'female' | 'prefer_not_to_say';
  heightCm?: number;
  heightFeet?: number;
  heightInches?: number;
  goal?: 'lose' | 'maintain' | 'gain';
  activityRate?: number;
  name?: string;
  trackingGoal?: string;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'very';
}

export interface WeightEntry {
  date: string; // ISO string
  weight: number; // in kg
  id?: string;
  updatedAt?: string;
}

export interface AccountInfo {
  name?: string;
  email?: string;
  phoneNumber?: string;
  supabaseUserId?: string;
  passwordHash?: string; // Should be hashed, not plain text
  hasUsedReferralCode?: boolean; // Track if user has used a referral code
  premiumUntil?: string; // ISO date string for premium trial expiry
}

// ... existing code ...

// Helper to check premium status
export const isUserPremium = (plan: string, premiumUntil?: string): boolean => {
  if (plan === 'premium') return true;
  if (!premiumUntil) return false;
  return new Date(premiumUntil) > new Date();
};

export interface GroceryItem {
  id: string;
  name: string;
  category?: string;
  isChecked: boolean;
  updatedAt?: string;
}

export interface AnalyticsEvent {
  eventName: string;
  properties?: Record<string, any>;
  timestamp: string;
}

export interface Preferences {
  weightUnit: 'kg' | 'lbs';
  notificationsEnabled: boolean;
  mealReminders: {
    breakfast: { enabled: boolean; hour: number; minute: number };
    lunch: { enabled: boolean; hour: number; minute: number };
    dinner: { enabled: boolean; hour: number; minute: number };
  };
  dynamicAdjustmentEnabled: boolean; // Smart Dynamic Adjustments feature
  dynamicAdjustmentThreshold: number; // 3, 4, or 5 (percentage)
  lastAdjustmentWeight?: number; // Weight at last adjustment (baseline)
  smartSuggestEnabled?: boolean; // New feature toggle
}

export interface AdjustmentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  previousCalories: number;
  newCalories: number;
  previousWeight: number; // Baseline weight
  currentWeight: number; // Trigger weight
  threshold: number; // The % threshold used
  status: 'applied' | 'dismissed' | 'pending';
  previousMacros?: {
    protein: number;
    carbs: number;
    fats: number;
  };
  macros?: {
    protein: number;
    carbs: number;
    fats: number;
  };
}

export interface PushBroadcastRecord {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  clickCount: number;
}

export interface ReferralCode {
  code: string; // unique alphanumeric code (8-10 characters)
  userId: string; // email or unique identifier of the code owner
  createdAt: string; // ISO timestamp
  totalReferrals: number; // count of successful referrals
  totalEarnedEntries: number; // total bonus entries earned from referrals
}

export interface ReferralRedemption {
  id: string; // unique redemption ID (generate with timestamp + random)
  referralCode: string; // the code that was used
  referrerEmail: string; // email of the person who owns the code
  refereeEmail: string; // email of the person who used the code
  refereeName: string; // name of the person who used the code
  redeemedAt: string; // ISO timestamp when code was entered
  status: 'pending' | 'completed' | 'failed'; // redemption status
  mealsLogged: number; // track progress toward 5 meals (0-5)
  deviceId: string; // device identifier for fraud detection
  completedAt?: string; // ISO timestamp when 5 meals were reached (if completed)
}

export interface ReferralReward {
  id: string; // unique reward ID
  userId: string; // email or unique identifier of user who earned reward
  earnedAt: string; // ISO timestamp
  entriesAwarded: number; // number of entries awarded (typically 10)
  reason: 'referrer_reward' | 'referee_reward'; // why the reward was given
  relatedRedemptionId: string; // links to the ReferralRedemption that triggered this
}

export interface SavedPrompt {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export type EntryTaskType = 'customPlan' | 'registration';

export interface EntryTasksStatus {
  customPlanCompleted: boolean;
  registrationCompleted: boolean;
}
export interface StreakFreezeData {
  freezesAvailable: number; // 0-2
  lastResetDate: string; // ISO date string of start of current month
  usedOnDates: string[]; // List of YYYY-MM-DD dates where freeze preserved a streak
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  entryCount: number;
  updatedAt: string;
}

export interface AnalyticsFeedback {
  id: string;
  timestamp: string;
  type: 'accuracy' | 'feature_request' | 'general';
  message?: string;
  rating?: number;
}

export interface DailyUserMetric {
  date: string; // YYYY-MM-DD
  mealsLogged: number;
  exerciseLogged: number;
  caloriesLogged: number;
  pushReceived: number;
  pushClicked: number;
  streakActive: boolean;
  createdAt?: string;
}

export interface UserMetricsSnapshot {
  generatedAt: string;
  userGoals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    goalType: string;
  };
  averages7Day: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    // Expanded Micros
    dietary_fiber: number;
    sugar: number;
    added_sugars: number;
    sugar_alcohols: number;
    net_carbs: number;
    saturated_fat: number;
    trans_fat: number;
    polyunsaturated_fat: number;
    monounsaturated_fat: number;
    sodium: number;
    potassium: number;
    cholesterol: number;
    calcium: number;
    iron: number;
    vitamin_a: number;
    vitamin_c: number;
    vitamin_d: number;
    vitamin_e: number;
    vitamin_k: number;
    vitamin_b12: number;
  };
  weightTrend: {
    current: number | null;
    startOfPeriod: number | null; // 7-14 days ago
    change: number | null;
    periodDays: number;
  };
  consistencyScore: number; // 0-100 based on adherence
  currentStreak: number;
  weakNutrients: string[]; // e.g. ['protein', 'fiber']
  commonFoods: {
    name: string;
    frequency: number;
    avgP: number;
    avgC: number;
    avgF: number;
    avgKcal: number;
  }[]; // top 10 recent
  recentDailySummaries: DailySummary[]; // last 7 days of summaries for granular rules
}

export interface Insight {
  id: string; // unique
  date: string; // YYYY-MM-DD generated
  type: 'pattern' | 'warning' | 'achievement' | 'suggestion';
  title: string;
  description: string; // Internal description, not AI text yet
  confidence: number; // 0-1
  relatedMetric?: string; // e.g. 'protein', 'calories'
  isDismissed?: boolean;
}

export interface NutritionLibraryItem {
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;

  dietary_fiber_per_100g?: number;
  sugar_per_100g?: number;
  added_sugars_per_100g?: number;
  sugar_alcohols_per_100g?: number;
  net_carbs_per_100g?: number;

  saturated_fat_per_100g?: number;
  trans_fat_per_100g?: number;
  polyunsaturated_fat_per_100g?: number;
  monounsaturated_fat_per_100g?: number;

  cholesterol_mg_per_100g?: number;
  sodium_mg_per_100g?: number;
  potassium_mg_per_100g?: number;
  calcium_mg_per_100g?: number;
  iron_mg_per_100g?: number;

  vitamin_a_mcg_per_100g?: number;
  vitamin_c_mg_per_100g?: number;
  vitamin_d_mcg_per_100g?: number;
  vitamin_e_mg_per_100g?: number;
  vitamin_k_mcg_per_100g?: number;
  vitamin_b12_mcg_per_100g?: number;

  standard_unit: string;
  standard_serving_weight_g: number;
  id?: string;
  // Previously used fields for backward compatibility mapping if needed (optional)
  fiber_per_100g?: number;
}

const getCachedAccountInfo = async (): Promise<AccountInfo | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT_INFO);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error reading cached account info:', error);
    return null;
  }
};

export type MealSyncPayload = {
  meal: MealEntry;
  dateKey: string;
};

export type WeightSyncPayload = {
  id: string;
  date: string;
  weight: number;
  updatedAt: string;
};

type SyncOperation =
  | { entity: 'meal'; action: 'upsert'; payload: MealSyncPayload }
  | { entity: 'meal'; action: 'delete'; payload: { id: string } }
  | { entity: 'weight'; action: 'upsert'; payload: WeightSyncPayload }
  | { entity: 'weight'; action: 'delete'; payload: { id: string } }
  | { entity: 'goals'; action: 'upsert'; payload: ExtendedGoalData }
  | { entity: 'exercise'; action: 'upsert'; payload: ExerciseEntry[] }
  | { entity: 'exercise'; action: 'delete'; payload: { ids: string[] } }
  | { entity: 'push_token'; action: 'upsert'; payload: { token: string; deviceInfo?: any } }
  | { entity: 'push_token'; action: 'revoke'; payload: { token: string } }
  | { entity: 'push_history'; action: 'upsert'; payload: PushBroadcastRecord }
  | { entity: 'push_history'; action: 'update_click'; payload: { id: string } }
  | { entity: 'saved_prompt'; action: 'upsert'; payload: SavedPrompt }
  | { entity: 'saved_prompt'; action: 'delete'; payload: { id: string } }
  | { entity: 'preferences'; action: 'upsert'; payload: Preferences }
  | { entity: 'settings'; action: 'upsert'; payload: { entryCount?: number; userPlan?: 'free' | 'premium'; deviceInfo?: any } }
  | { entity: 'entry_tasks'; action: 'upsert'; payload: EntryTasksStatus }
  | { entity: 'referral_code'; action: 'upsert'; payload: ReferralCode }
  | { entity: 'referral_redemption'; action: 'upsert'; payload: ReferralRedemption }
  | { entity: 'referral_redemption'; action: 'upsert'; payload: ReferralRedemption }
  | { entity: 'referral_reward'; action: 'upsert'; payload: ReferralReward }
  | { entity: 'streak_freeze'; action: 'upsert'; payload: StreakFreezeData }
  | { entity: 'grocery_item'; action: 'upsert'; payload: GroceryItem }
  | { entity: 'grocery_item'; action: 'delete'; payload: { id: string } }
  | { entity: 'analytics_event'; action: 'log'; payload: AnalyticsEvent };

const readSyncQueue = async (): Promise<SyncOperation[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading sync queue:', error);
    return [];
  }
};

const writeSyncQueue = async (queue: SyncOperation[]): Promise<void> => {
  try {
    if (queue.length === 0) {
      await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    }
  } catch (error) {
    console.error('Error writing sync queue:', error);
  }
};

const enqueueSyncOperation = async (op: SyncOperation): Promise<void> => {
  const queue = await readSyncQueue();
  queue.push(op);
  await writeSyncQueue(queue);
};

const executeSyncOperation = async (op: SyncOperation, accountInfo: AccountInfo) => {
  switch (op.entity) {
    case 'meal':
      if (op.action === 'upsert') {
        await supabaseDataService.upsertMeals(accountInfo, [op.payload]);
      } else {
        await supabaseDataService.deleteMeals(accountInfo, [op.payload.id]);
      }
      break;
    case 'weight':
      if (op.action === 'upsert') {
        await supabaseDataService.upsertWeightEntries(accountInfo, [op.payload]);
      } else {
        await supabaseDataService.deleteWeightEntries(accountInfo, [op.payload.id]);
      }
      break;
    case 'goals':
      if (op.action === 'upsert') {
        await supabaseDataService.saveNutritionGoals(accountInfo, op.payload);
      }
      break;
    case 'exercise':
      if (op.action === 'upsert') {
        await supabaseDataService.upsertExercises(accountInfo, op.payload);
      } else {
        await supabaseDataService.deleteExercises(accountInfo, op.payload.ids);
      }
      break;
    case 'push_token':
      if (op.action === 'upsert') {
        await supabaseDataService.upsertPushToken(accountInfo, op.payload.token, op.payload.deviceInfo);
      } else {
        await supabaseDataService.revokePushToken(accountInfo, op.payload.token);
      }
      break;
    case 'push_history':
      if (op.action === 'upsert') {
        await supabaseDataService.savePushHistory(accountInfo, op.payload);
      } else {
        await supabaseDataService.updatePushHistoryClick(accountInfo, op.payload.id);
      }
      break;
    case 'saved_prompt':
      if (op.action === 'upsert') {
        await supabaseDataService.upsertSavedPrompt(accountInfo, op.payload);
      } else {
        await supabaseDataService.deleteSavedPrompt(accountInfo, op.payload.id);
      }
      break;
    case 'preferences':
      if (op.action === 'upsert') {
        await supabaseDataService.savePreferences(accountInfo, op.payload);
      }
      break;
    case 'settings':
      if (op.action === 'upsert') {
        await supabaseDataService.saveUserSettings(accountInfo, op.payload);
      }
      break;
    case 'entry_tasks':
      if (op.action === 'upsert') {
        await supabaseDataService.saveEntryTasks(accountInfo, op.payload);
      }
      break;
    case 'referral_code':
      if (op.action === 'upsert') {
        await supabaseDataService.saveReferralCode(accountInfo, op.payload);
      }
      break;
    case 'referral_redemption':
      if (op.action === 'upsert') {
        await supabaseDataService.saveReferralRedemption(accountInfo, op.payload);
      }
      break;
    case 'referral_reward':
      if (op.action === 'upsert') {
        await supabaseDataService.saveReferralReward(accountInfo, op.payload);
      }
      break;
    case 'streak_freeze':
      if (op.action === 'upsert') {
        await supabaseDataService.upsertStreakFreeze(accountInfo, op.payload);
      }
      break;
    case 'grocery_item':
      if (op.action === 'upsert') {
        await supabaseDataService.upsertGroceryItem(accountInfo, op.payload);
      } else {
        await supabaseDataService.deleteGroceryItem(accountInfo, op.payload.id);
      }
      break;
    case 'analytics_event':
      // Fire and forget for analytics to avoid blocking sync? 
      // Or await it. Usually fine to await.
      await supabaseDataService.logAnalyticsEvent(accountInfo, op.payload);
      break;
  }
};

const processSyncQueue = async (accountInfo: AccountInfo | null): Promise<void> => {
  if (!accountInfo?.supabaseUserId && !accountInfo?.email) return;
  const queue = await readSyncQueue();
  if (queue.length === 0) return;

  const remaining: SyncOperation[] = [];
  for (let i = 0; i < queue.length; i++) {
    const op = queue[i];
    try {
      await executeSyncOperation(op, accountInfo);
    } catch (error) {
      console.error('Deferred sync operation failed:', error);
      remaining.push(...queue.slice(i)); // include current + remaining ops
      break;
    }
  }

  await writeSyncQueue(remaining);
};

const ensureMealMetadata = (mealsByDate: Record<string, MealEntry[]>) => {
  const now = new Date().toISOString();
  Object.keys(mealsByDate).forEach((dateKey) => {
    mealsByDate[dateKey] = mealsByDate[dateKey].map((meal) => ({
      ...meal,
      id: ensureUUID(meal.id),
      updatedAt: meal.updatedAt || now,
    }));
  });
};

const flattenMeals = (mealsByDate: Record<string, MealEntry[]>) => {
  const map = new Map<string, { meal: MealEntry; dateKey: string }>();
  Object.entries(mealsByDate).forEach(([dateKey, meals]) => {
    meals.forEach((meal) => {
      map.set(meal.id, { meal, dateKey });
    });
  });
  return map;
};

const diffMeals = (
  previous: Record<string, MealEntry[]>,
  next: Record<string, MealEntry[]>
): { upserts: MealSyncPayload[]; deletions: string[] } => {
  const prevMap = flattenMeals(previous);
  const nextMap = flattenMeals(next);
  const upserts: MealSyncPayload[] = [];
  const deletions: string[] = [];
  const now = new Date().toISOString();

  nextMap.forEach(({ meal, dateKey }, id) => {
    const prev = prevMap.get(id);
    if (!prev) {
      upserts.push({ meal: { ...meal, updatedAt: meal.updatedAt || now }, dateKey });
      return;
    }

    const prevStr = JSON.stringify(prev.meal);
    const nextStr = JSON.stringify(meal);
    if (prevStr !== nextStr) {
      upserts.push({ meal: { ...meal, updatedAt: now }, dateKey });
    } else if (!meal.updatedAt && prev.meal.updatedAt) {
      meal.updatedAt = prev.meal.updatedAt;
    }
  });

  prevMap.forEach((_value, id) => {
    if (!nextMap.has(id)) {
      deletions.push(id);
    }
  });

  return { upserts, deletions };
};

const mergeMealsCache = (
  remote: Record<string, MealEntry[]>,
  local: Record<string, MealEntry[]>
): Record<string, MealEntry[]> => {
  ensureMealMetadata(remote);
  ensureMealMetadata(local);
  const merged: Record<string, MealEntry[]> = JSON.parse(JSON.stringify(local));
  const mergedFlat = flattenMeals(merged);
  const remoteFlat = flattenMeals(remote);

  remoteFlat.forEach(({ meal, dateKey }, id) => {
    const existing = mergedFlat.get(id);
    if (!existing) {
      merged[dateKey] = [...(merged[dateKey] || []), meal];
      mergedFlat.set(id, { meal, dateKey });
      return;
    }

    const existingUpdated = existing.meal.updatedAt || '';
    const remoteUpdated = meal.updatedAt || '';
    if (!existingUpdated || remoteUpdated > existingUpdated) {
      // Replace existing meal with remote version
      merged[existing.dateKey] = (merged[existing.dateKey] || []).map((m) =>
        m.id === meal.id ? meal : m
      );
      mergedFlat.set(id, { meal, dateKey: existing.dateKey });
    }
  });

  return merged;
};

const normalizeWeightEntry = (
  entry: { date: Date; weight: number; id?: string; updatedAt?: string } | WeightEntry
): WeightEntry => {
  const dateISO = entry.date instanceof Date ? entry.date.toISOString() : entry.date;
  const id = 'id' in entry && entry.id ? entry.id : dateISO;
  const updatedAt =
    'updatedAt' in entry && entry.updatedAt ? entry.updatedAt : new Date().toISOString();
  return {
    id,
    date: dateISO,
    weight: entry.weight,
    updatedAt,
  };
};

const diffWeightEntries = (
  previous: WeightEntry[],
  next: WeightEntry[]
): { upserts: WeightSyncPayload[]; deletions: string[] } => {
  const prevMap = new Map(previous.map((entry) => [entry.id ?? entry.date, entry]));
  const nextMap = new Map(next.map((entry) => [entry.id ?? entry.date, entry]));
  const upserts: WeightSyncPayload[] = [];
  const deletions: string[] = [];
  const now = new Date().toISOString();

  nextMap.forEach((entry, id) => {
    const prev = prevMap.get(id);
    if (!prev) {
      upserts.push({
        id,
        date: entry.date,
        weight: entry.weight,
        updatedAt: entry.updatedAt ?? now,
      });
      return;
    }

    if (prev.weight !== entry.weight) {
      upserts.push({
        id,
        date: entry.date,
        weight: entry.weight,
        updatedAt: now,
      });
    }
  });

  prevMap.forEach((_entry, id) => {
    if (!nextMap.has(id)) {
      deletions.push(id);
    }
  });

  return { upserts, deletions };
};

const mergeWeightEntries = (remote: WeightEntry[], local: WeightEntry[]): WeightEntry[] => {
  const mergedMap = new Map<string, WeightEntry>();
  local.forEach((entry) => {
    const normalized = normalizeWeightEntry(entry);
    mergedMap.set(normalized.id!, normalized);
  });

  remote.forEach((entry) => {
    const normalized = normalizeWeightEntry(entry);
    const existing = mergedMap.get(normalized.id!);
    if (!existing) {
      mergedMap.set(normalized.id!, normalized);
      return;
    }
    const existingUpdated = existing.updatedAt || '';
    const remoteUpdated = normalized.updatedAt || '';
    if (!existingUpdated || remoteUpdated > existingUpdated) {
      mergedMap.set(normalized.id!, normalized);
    }
  });

  return Array.from(mergedMap.values());
};

export const dataStorage = {
  // Save goals with all profile data
  async saveGoals(goals: ExtendedGoalData): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.saveNutritionGoals(accountInfo, goals);
        } catch (error) {
          console.error('Error syncing goals to Supabase:', error);
          // Add to sync queue for retry
          await enqueueSyncOperation({ entity: 'goals', action: 'upsert', payload: goals });
        }
      } else {
        // If not logged in, add to sync queue for when they log in
        await enqueueSyncOperation({ entity: 'goals', action: 'upsert', payload: goals });
      }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  },

  // Load goals
  async loadGoals(): Promise<ExtendedGoalData | null> {
    try {
      // Load from local storage first (for offline support)
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.GOALS);
      const localGoals: ExtendedGoalData | null = localData ? JSON.parse(localData) : null;

      // If user is logged in, fetch from Supabase and merge
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          const remoteGoals = await supabaseDataService.fetchNutritionGoals(accountInfo);
          if (remoteGoals) {
            // Merge: remote takes precedence, but keep local if remote is missing fields
            const merged: ExtendedGoalData = {
              ...localGoals,
              ...remoteGoals,
              // Preserve local values if remote doesn't have them
              calories: remoteGoals.calories || localGoals?.calories || 1500,
              proteinPercentage: remoteGoals.proteinPercentage || localGoals?.proteinPercentage || 30,
              carbsPercentage: remoteGoals.carbsPercentage || localGoals?.carbsPercentage || 45,
              fatPercentage: remoteGoals.fatPercentage || localGoals?.fatPercentage || 25,
              proteinGrams: remoteGoals.proteinGrams || localGoals?.proteinGrams || 0,
              carbsGrams: remoteGoals.carbsGrams || localGoals?.carbsGrams || 0,
              fatGrams: remoteGoals.fatGrams || localGoals?.fatGrams || 0,
            };
            // Save merged data back to local storage
            await AsyncStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(merged));
            return merged;
          }
        } catch (error) {
          console.error('Error fetching goals from Supabase:', error);
          // Return local data if remote fetch fails
        }
      }

      return localGoals;
    } catch (error) {
      console.error('Error loading goals:', error);
      return null;
    }
  },

  // --- DAILY LOG SHARDING HELPERS ---

  async getDailyLog(date: string): Promise<MealEntry[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.dailyLog(date));
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error(`Error loading daily log for ${date}:`, error);
      return [];
    }
  },

  async saveDailyLog(date: string, meals: MealEntry[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.dailyLog(date), JSON.stringify(meals));

      // Update summary automatically
      await this.updateSummaryForDate(date, meals);

      // Sync to Supabase logic will be handled by caller or queue for now to keep this atomic
      // But typically we should sync here.
    } catch (error) {
      console.error(`Error saving daily log for ${date}:`, error);
    }
  },

  async deleteDailyLog(date: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.dailyLog(date));
      await this.updateSummaryForDate(date, []);
    } catch (error) {
      console.error(`Error deleting daily log for ${date}:`, error);
    }
  },

  async migrateLegacyMealsToShards(): Promise<void> {
    try {
      const legacyJson = await AsyncStorage.getItem(STORAGE_KEYS.MEALS);
      if (!legacyJson) return; // Already migrated or empty

      console.log('Migrating legacy meals to shards...');
      const legacyMeals: Record<string, MealEntry[]> = JSON.parse(legacyJson);

      const keys = Object.keys(legacyMeals);
      const pairs: [string, string][] = keys.map(date => [
        STORAGE_KEYS.dailyLog(date),
        JSON.stringify(legacyMeals[date])
      ]);

      if (pairs.length > 0) {
        try {
          await AsyncStorage.multiSet(pairs);
        } catch (e) {
          for (const [k, v] of pairs) {
            await AsyncStorage.setItem(k, v);
          }
        }
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.MEALS);
      console.log('Migration to shards complete.');

      // Also ensure summaries exist
      await this.migrateMealsToSummaries();

    } catch (error) {
      console.error('Error migrating to shards:', error);
    }
  },

  // Save all meals (Legacy wrapper/Batched)
  // Maintains interface compatibility but uses shards internally
  async saveMeals(mealsByDate: Record<string, MealEntry[]>): Promise<void> {
    try {
      for (const [date, meals] of Object.entries(mealsByDate)) {
        await this.saveDailyLog(date, meals);
      }
    } catch (error) {
      console.error('Error saving meals (sharded):', error);
    }
  },

  // Load ALL meals (Expensive - avoids returning partial data if usage expects all)
  // WARNING: This reconstructs the full blob. Use getDailyLog whenever possible.
  async loadMeals(): Promise<Record<string, MealEntry[]>> {
    // First check if we need to migrate
    const legacy = await AsyncStorage.getItem(STORAGE_KEYS.MEALS);
    if (legacy) {
      await this.migrateLegacyMealsToShards();
    }

    // Load all keys matching pattern
    const allKeys = await AsyncStorage.getAllKeys();
    const shardKeys = allKeys.filter(k => k.startsWith('@trackkal:log:'));

    if (shardKeys.length === 0) return {};

    const pairs = await AsyncStorage.multiGet(shardKeys);
    const constructed: Record<string, MealEntry[]> = {};

    pairs.forEach(([key, value]) => {
      if (value) {
        const date = key.replace('@trackkal:log:', '');
        constructed[date] = JSON.parse(value);
      }
    });
    return constructed;
  },

  // Save exercises by date
  async saveExercises(exercisesByDate: Record<string, ExerciseEntry[]>): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercisesByDate));

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          const allExercises = Object.values(exercisesByDate).flat();
          await supabaseDataService.upsertExercises(accountInfo, allExercises);
        } catch (error) {
          console.error('Error syncing exercises to Supabase:', error);
          const allExercises = Object.values(exercisesByDate).flat();
          await enqueueSyncOperation({ entity: 'exercise', action: 'upsert', payload: allExercises });
        }
      } else {
        const allExercises = Object.values(exercisesByDate).flat();
        await enqueueSyncOperation({ entity: 'exercise', action: 'upsert', payload: allExercises });
      }
    } catch (error) {
      console.error('Error saving exercises:', error);
    }
  },

  // Load exercises
  async loadExercises(): Promise<Record<string, ExerciseEntry[]>> {
    try {
      // Load from local storage first (for offline support)
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
      const localExercises: Record<string, ExerciseEntry[]> = localData ? JSON.parse(localData) : {};

      // If user is logged in, fetch from Supabase and merge
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (accountInfo?.supabaseUserId) {
        try {
          const remoteExercises = await supabaseDataService.fetchExercises(accountInfo);
          if (remoteExercises && Object.keys(remoteExercises).length > 0) {
            // Merge: remote takes precedence for dates that exist in both
            const merged: Record<string, ExerciseEntry[]> = { ...localExercises };
            Object.keys(remoteExercises).forEach((dateKey) => {
              merged[dateKey] = remoteExercises[dateKey];
            });
            await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(merged));
            return merged;
          }
        } catch (error) {
          console.error('Error fetching exercises from Supabase:', error);
        }
      }

      return localExercises;
    } catch (error) {
      console.error('Error loading exercises:', error);
      return {};
    }
  },

  // Save weight entries
  async saveWeightEntries(entries: Array<{ date: Date; weight: number }>): Promise<void> {
    try {
      const normalized = entries.map(normalizeWeightEntry);
      const prevSerialized = await AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_ENTRIES);
      const previous: WeightEntry[] = prevSerialized ? JSON.parse(prevSerialized) : [];
      await AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(normalized));
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (!accountInfo?.supabaseUserId && !accountInfo?.email) return;

      const { upserts, deletions } = diffWeightEntries(previous, normalized);

      if (upserts.length > 0) {
        try {
          await supabaseDataService.upsertWeightEntries(accountInfo, upserts);
        } catch (error) {
          console.error('Error syncing weight entries to Supabase:', error);
          await Promise.all(
            upserts.map((payload) =>
              enqueueSyncOperation({ entity: 'weight', action: 'upsert', payload })
            )
          );
        }
      }

      if (deletions.length > 0) {
        try {
          await supabaseDataService.deleteWeightEntries(accountInfo, deletions);
        } catch (error) {
          console.error('Error deleting weight entries from Supabase:', error);
          await Promise.all(
            deletions.map((id) =>
              enqueueSyncOperation({ entity: 'weight', action: 'delete', payload: { id } })
            )
          );
        }
      }
      if (normalized.length <= 1) {
        // User presumably reset their data. Reset smart adjustment baseline.
        const prefs = await this.loadPreferences();
        if (prefs && prefs.lastAdjustmentWeight) {
          await this.savePreferences({ ...prefs, lastAdjustmentWeight: undefined });
          console.log('Reset smart adjustment baseline due to weight history clear.');
        }
      }
    } catch (error) {
      console.error('Error saving weight entries:', error);
    }
  },

  // Load weight entries
  async loadWeightEntries(): Promise<Array<{ date: Date; weight: number }>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_ENTRIES);
      const localEntries: WeightEntry[] = data ? JSON.parse(data) : [];

      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (!accountInfo?.supabaseUserId && !accountInfo?.email) {
        return localEntries.map((entry) => ({
          id: entry.id,
          date: new Date(entry.date),
          weight: entry.weight,
          updatedAt: entry.updatedAt,
        }));
      }

      const remoteEntries = await supabaseDataService.fetchWeightEntries(accountInfo);
      if (remoteEntries.length > 0) {
        const merged = mergeWeightEntries(remoteEntries, localEntries);
        await AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(merged));
        return merged.map((entry) => ({
          id: entry.id,
          date: new Date(entry.date),
          weight: entry.weight,
          updatedAt: entry.updatedAt,
        }));
      }

      return localEntries.map((entry) => ({
        id: entry.id,
        date: new Date(entry.date),
        weight: entry.weight,
        updatedAt: entry.updatedAt,
      }));
    } catch (error) {
      console.error('Error loading weight entries:', error);
      return [];
    }
  },

  // Save entry count
  async saveEntryCount(count: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ENTRY_COUNT, String(count));

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.saveUserSettings(accountInfo, { entryCount: count });
        } catch (error) {
          console.error('Error syncing entry count to Supabase:', error);
          await enqueueSyncOperation({ entity: 'settings', action: 'upsert', payload: { entryCount: count } });
        }
      } else {
        await enqueueSyncOperation({ entity: 'settings', action: 'upsert', payload: { entryCount: count } });
      }
    } catch (error) {
      console.error('Error saving entry count:', error);
    }
  },

  // Load entry count
  async loadEntryCount(): Promise<number> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.ENTRY_COUNT);
      const localCount = localData ? parseInt(localData, 10) || 0 : 0;

      // If user is logged in, fetch from Supabase
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (accountInfo?.supabaseUserId) {
        try {
          const remoteSettings = await supabaseDataService.fetchUserSettings(accountInfo);
          if (remoteSettings && remoteSettings.entryCount !== undefined) {
            await AsyncStorage.setItem(STORAGE_KEYS.ENTRY_COUNT, String(remoteSettings.entryCount));
            return remoteSettings.entryCount;
          }
        } catch (error) {
          console.error('Error fetching entry count from Supabase:', error);
        }
      }

      return localCount;
    } catch (error) {
      console.error('Error loading entry count:', error);
      return 0;
    }
  },

  async saveStreakFreeze(data: StreakFreezeData): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STREAK_FREEZE, JSON.stringify(data));

      await enqueueSyncOperation({
        entity: 'streak_freeze',
        action: 'upsert',
        payload: data
      });
    } catch (error) {
      console.error('Error saving streak freeze data:', error);
    }
  },

  async logAnalyticsEvent(eventName: string, properties?: any): Promise<void> {
    try {
      const payload: AnalyticsEvent = {
        eventName,
        properties,
        timestamp: new Date().toISOString()
      };

      await enqueueSyncOperation({
        entity: 'analytics_event',
        action: 'log',
        payload
      });
    } catch (e) {
      console.warn('Error queuing analytics', e);
    }
  },

  // Load streak freeze data
  async loadStreakFreeze(): Promise<StreakFreezeData | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.STREAK_FREEZE);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
      console.error('Failed to load streak freeze data', e);
      return null;
    }
  },

  async saveAnalyticsFeedback(feedback: AnalyticsFeedback): Promise<void> {
    try {
      const existing = await this.getAnalyticsFeedback();
      const newFeedback = [...existing, feedback];
      await AsyncStorage.setItem(STORAGE_KEYS.ANALYTICS_FEEDBACK, JSON.stringify(newFeedback));
    } catch (e) {
      console.error('Failed to save analytics feedback', e);
    }
  },

  async getAnalyticsFeedback(): Promise<AnalyticsFeedback[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.ANALYTICS_FEEDBACK);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to load analytics feedback', e);
      return [];
    }
  },

  // Save user plan
  async saveUserPlan(plan: 'free' | 'premium'): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PLAN, plan);

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.saveUserSettings(accountInfo, { userPlan: plan });
        } catch (error) {
          console.error('Error syncing user plan to Supabase:', error);
          await enqueueSyncOperation({ entity: 'settings', action: 'upsert', payload: { userPlan: plan } });
        }
      } else {
        await enqueueSyncOperation({ entity: 'settings', action: 'upsert', payload: { userPlan: plan } });
      }
    } catch (error) {
      console.error('Error saving user plan:', error);
    }
  },

  // Load user plan
  async loadUserPlan(): Promise<'free' | 'premium'> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.USER_PLAN);
      const localPlan = (localData === 'premium' ? 'premium' : 'free') as 'free' | 'premium';

      // If user is logged in, fetch from Supabase
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (accountInfo?.supabaseUserId) {
        try {
          const remoteSettings = await supabaseDataService.fetchUserSettings(accountInfo);
          if (remoteSettings && remoteSettings.userPlan) {
            await AsyncStorage.setItem(STORAGE_KEYS.USER_PLAN, remoteSettings.userPlan);
            return remoteSettings.userPlan;
          }
        } catch (error) {
          console.error('Error fetching user plan from Supabase:', error);
        }
      }

      return localPlan;
    } catch (error) {
      console.error('Error loading user plan:', error);
      return 'free';
    }
  },

  // Save device info
  async saveDeviceInfo(info: any): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(info));

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.saveUserSettings(accountInfo, { deviceInfo: info });
        } catch (error) {
          console.error('Error syncing device info to Supabase:', error);
          await enqueueSyncOperation({ entity: 'settings', action: 'upsert', payload: { deviceInfo: info } });
        }
      } else {
        await enqueueSyncOperation({ entity: 'settings', action: 'upsert', payload: { deviceInfo: info } });
      }
    } catch (error) {
      console.error('Error saving device info:', error);
    }
  },

  // Load device info
  async loadDeviceInfo(): Promise<any | null> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_INFO);
      const localInfo = localData ? JSON.parse(localData) : null;

      // If user is logged in, fetch from Supabase
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (accountInfo?.supabaseUserId) {
        try {
          const remoteSettings = await supabaseDataService.fetchUserSettings(accountInfo);
          if (remoteSettings && remoteSettings.deviceInfo) {
            await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(remoteSettings.deviceInfo));
            return remoteSettings.deviceInfo;
          }
        } catch (error) {
          console.error('Error fetching device info from Supabase:', error);
        }
      }

      return localInfo;
    } catch (error) {
      console.error('Error loading device info:', error);
      return null;
    }
  },

  // Save account info
  async saveAccountInfo(info: AccountInfo): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNT_INFO, JSON.stringify(info));
      if (info?.email) {
        const remoteProfile = await supabaseDataService.saveAccountToSupabase(info);
        if (remoteProfile?.id) {
          const merged: AccountInfo = {
            ...info,
            supabaseUserId: info.supabaseUserId ?? remoteProfile.authUserId ?? remoteProfile.id,
            email: remoteProfile.email ?? info.email,
            name: info.name ?? remoteProfile.displayName ?? undefined,
            phoneNumber: info.phoneNumber ?? remoteProfile.phoneNumber ?? undefined,
          };
          await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNT_INFO, JSON.stringify(merged));
        }
      }
    } catch (error) {
      console.error('Error saving account info:', error);
    }
  },

  // Load account info
  async loadAccountInfo(): Promise<AccountInfo | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT_INFO);
      const cached = data ? JSON.parse(data) : null;

      if (cached?.email) {
        const remote = await supabaseDataService.fetchAccountByEmail(cached.email);
        if (remote) {
          const merged: AccountInfo = {
            ...cached,
            email: remote.email ?? cached.email,
            name: remote.displayName ?? cached.name,
            phoneNumber: remote.phoneNumber ?? cached.phoneNumber,
            supabaseUserId: remote.id,
          };
          await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNT_INFO, JSON.stringify(merged));
          return merged;
        }
      }

      return cached;
    } catch (error) {
      console.error('Error loading account info:', error);
      return null;
    }
  },

  // Save preferences
  async savePreferences(prefs: Preferences): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.savePreferences(accountInfo, prefs);
        } catch (error) {
          console.error('Error syncing preferences to Supabase:', error);
          await enqueueSyncOperation({ entity: 'preferences', action: 'upsert', payload: prefs });
        }
      } else {
        await enqueueSyncOperation({ entity: 'preferences', action: 'upsert', payload: prefs });
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  },

  // Load preferences
  async loadPreferences(): Promise<Preferences | null> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
      const localPrefs: Preferences | null = localData ? JSON.parse(localData) : null;

      // If user is logged in, fetch from Supabase
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (accountInfo?.supabaseUserId) {
        try {
          const remotePrefs = await supabaseDataService.fetchPreferences(accountInfo);
          if (remotePrefs) {
            await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(remotePrefs));
            return remotePrefs;
          }
        } catch (error) {
          console.error('Error fetching preferences from Supabase:', error);
        }
      }

      const defaults: Preferences = {
        weightUnit: 'kg',
        notificationsEnabled: true,
        mealReminders: {
          breakfast: { enabled: false, hour: 8, minute: 0 },
          lunch: { enabled: false, hour: 13, minute: 0 },
          dinner: { enabled: false, hour: 19, minute: 0 },
        },
        dynamicAdjustmentEnabled: true, // Enable by default for visibility
        dynamicAdjustmentThreshold: 2, // Lower threshold to 2% for easier testing
      };

      return localPrefs ? { ...defaults, ...localPrefs } : defaults;
    } catch (error) {
      console.error('Error loading preferences:', error);
      return null;
    }
  },

  // Push notification tokens helpers
  async loadPushTokens(): Promise<string[]> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKENS);
      const localTokens: string[] = localData ? (Array.isArray(JSON.parse(localData)) ? JSON.parse(localData) : []) : [];

      // If user is logged in, fetch from Supabase
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (accountInfo?.supabaseUserId) {
        try {
          const remoteTokens = await supabaseDataService.fetchPushTokens(accountInfo);
          if (remoteTokens && remoteTokens.length > 0) {
            // Merge: combine local and remote, remove duplicates
            const merged = Array.from(new Set([...localTokens, ...remoteTokens]));
            await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKENS, JSON.stringify(merged));
            return merged;
          }
        } catch (error) {
          console.error('Error fetching push tokens from Supabase:', error);
        }
      }

      return localTokens;
    } catch (error) {
      console.error('Error loading push tokens:', error);
      return [];
    }
  },

  async savePushTokens(tokens: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKENS, JSON.stringify(tokens));

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          // Upsert all active tokens
          await Promise.all(
            tokens.map((token) => supabaseDataService.upsertPushToken(accountInfo, token))
          );
        } catch (error) {
          console.error('Error syncing push tokens to Supabase:', error);
          // Queue individual token operations
          await Promise.all(
            tokens.map((token) =>
              enqueueSyncOperation({ entity: 'push_token', action: 'upsert', payload: { token } })
            )
          );
        }
      } else {
        await Promise.all(
          tokens.map((token) =>
            enqueueSyncOperation({ entity: 'push_token', action: 'upsert', payload: { token } })
          )
        );
      }
    } catch (error) {
      console.error('Error saving push tokens:', error);
    }
  },

  async addPushToken(token: string): Promise<void> {
    try {
      const existing = await this.loadPushTokens();
      if (!existing.includes(token)) {
        const updated = [...existing, token];
        await this.savePushTokens(updated);

        // Also sync individual token
        const accountInfo = await getCachedAccountInfo();
        if (accountInfo?.supabaseUserId) {
          try {
            await supabaseDataService.upsertPushToken(accountInfo, token);
          } catch (error) {
            console.error('Error syncing push token to Supabase:', error);
            await enqueueSyncOperation({ entity: 'push_token', action: 'upsert', payload: { token } });
          }
        } else {
          await enqueueSyncOperation({ entity: 'push_token', action: 'upsert', payload: { token } });
        }
      }
    } catch (error) {
      console.error('Error adding push token:', error);
    }
  },

  async removePushToken(token: string): Promise<void> {
    try {
      const existing = await this.loadPushTokens();
      const updated = existing.filter(t => t !== token);
      await this.savePushTokens(updated);

      // Revoke token in Supabase
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.revokePushToken(accountInfo, token);
        } catch (error) {
          console.error('Error revoking push token in Supabase:', error);
          await enqueueSyncOperation({ entity: 'push_token', action: 'revoke', payload: { token } });
        }
      } else {
        await enqueueSyncOperation({ entity: 'push_token', action: 'revoke', payload: { token } });
      }
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  },

  // Push broadcast history helpers
  async loadPushHistory(): Promise<PushBroadcastRecord[]> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_HISTORY);
      const localHistory: PushBroadcastRecord[] = localData
        ? (Array.isArray(JSON.parse(localData)) ? JSON.parse(localData) : [])
        : [];

      // If user is logged in, fetch from Supabase
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (accountInfo?.supabaseUserId) {
        try {
          const remoteHistory = await supabaseDataService.fetchPushHistory(accountInfo);
          if (remoteHistory && remoteHistory.length > 0) {
            // Merge: combine local and remote, remote takes precedence for same IDs
            const mergedMap = new Map<string, PushBroadcastRecord>();
            localHistory.forEach((record) => mergedMap.set(record.id, record));
            remoteHistory.forEach((record) => mergedMap.set(record.id, record));
            const merged = Array.from(mergedMap.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            await AsyncStorage.setItem(STORAGE_KEYS.PUSH_HISTORY, JSON.stringify(merged));
            return merged;
          }
        } catch (error) {
          console.error('Error fetching push history from Supabase:', error);
        }
      }

      return localHistory;
    } catch (error) {
      console.error('Error loading push history:', error);
      return [];
    }
  },

  async savePushHistory(history: PushBroadcastRecord[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_HISTORY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving push history:', error);
    }
  },

  async addPushHistoryRecord(record: PushBroadcastRecord): Promise<void> {
    try {
      const existing = await this.loadPushHistory();
      const updated = [record, ...existing];
      await this.savePushHistory(updated);

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.savePushHistory(accountInfo, record);
        } catch (error) {
          console.error('Error syncing push history to Supabase:', error);
          await enqueueSyncOperation({ entity: 'push_history', action: 'upsert', payload: record });
        }
      } else {
        await enqueueSyncOperation({ entity: 'push_history', action: 'upsert', payload: record });
      }
    } catch (error) {
      console.error('Error adding push history record:', error);
    }
  },

  async incrementPushHistoryClicks(id: string): Promise<void> {
    try {
      const existing = await this.loadPushHistory();
      const updated = existing.map(record =>
        record.id === id
          ? { ...record, clickCount: record.clickCount + 1 }
          : record
      );
      await this.savePushHistory(updated);

      // Sync click update to Supabase
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.updatePushHistoryClick(accountInfo, id);
        } catch (error) {
          console.error('Error syncing push history click to Supabase:', error);
          await enqueueSyncOperation({ entity: 'push_history', action: 'update_click', payload: { id } });
        }
      } else {
        await enqueueSyncOperation({ entity: 'push_history', action: 'update_click', payload: { id } });
      }
    } catch (error) {
      console.error('Error incrementing push history clicks:', error);
    }
  },

  // Saved prompt helpers
  async loadSavedPrompts(): Promise<SavedPrompt[]> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PROMPTS);
      const localPrompts: SavedPrompt[] = localData
        ? (Array.isArray(JSON.parse(localData))
          ? JSON.parse(localData).filter(
            (item: SavedPrompt) => typeof item?.id === 'string' && typeof item?.text === 'string'
          )
          : [])
        : [];

      // If user is logged in, fetch from Supabase
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (accountInfo?.supabaseUserId) {
        try {
          const remotePrompts = await supabaseDataService.fetchSavedPrompts(accountInfo);
          if (remotePrompts && remotePrompts.length > 0) {
            // Merge: remote takes precedence for same IDs
            const mergedMap = new Map<string, SavedPrompt>();
            localPrompts.forEach((prompt) => mergedMap.set(prompt.id, prompt));
            remotePrompts.forEach((prompt) => mergedMap.set(prompt.id, prompt));
            const merged = Array.from(mergedMap.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PROMPTS, JSON.stringify(merged));
            return merged;
          }
        } catch (error) {
          console.error('Error fetching saved prompts from Supabase:', error);
        }
      }

      return localPrompts;
    } catch (error) {
      console.error('Error loading saved prompts:', error);
      return [];
    }
  },

  async saveSavedPrompts(prompts: SavedPrompt[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PROMPTS, JSON.stringify(prompts));
    } catch (error) {
      console.error('Error saving prompts:', error);
    }
  },

  async addSavedPrompt(prompt: SavedPrompt): Promise<void> {
    try {
      const existing = await this.loadSavedPrompts();
      const updated = [prompt, ...existing];
      await this.saveSavedPrompts(updated);

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.upsertSavedPrompt(accountInfo, prompt);
        } catch (error) {
          console.error('Error syncing saved prompt to Supabase:', error);
          await enqueueSyncOperation({ entity: 'saved_prompt', action: 'upsert', payload: prompt });
        }
      } else {
        await enqueueSyncOperation({ entity: 'saved_prompt', action: 'upsert', payload: prompt });
      }
    } catch (error) {
      console.error('Error adding saved prompt:', error);
    }
  },

  async removeSavedPrompt(id: string): Promise<void> {
    try {
      const existing = await this.loadSavedPrompts();
      const updated = existing.filter(prompt => prompt.id !== id);
      await this.saveSavedPrompts(updated);

      // Delete from Supabase
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.deleteSavedPrompt(accountInfo, id);
        } catch (error) {
          console.error('Error deleting saved prompt from Supabase:', error);
          await enqueueSyncOperation({ entity: 'saved_prompt', action: 'delete', payload: { id } });
        }
      } else {
        await enqueueSyncOperation({ entity: 'saved_prompt', action: 'delete', payload: { id } });
      }
    } catch (error) {
      console.error('Error removing saved prompt:', error);
    }
  },

  // Entry task reward helpers
  async loadEntryTasks(): Promise<EntryTasksStatus> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.ENTRY_TASKS);
      const localTasks: EntryTasksStatus = localData
        ? JSON.parse(localData)
        : { customPlanCompleted: false, registrationCompleted: false };

      // If user is logged in, fetch from Supabase
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (accountInfo?.supabaseUserId) {
        try {
          const remoteTasks = await supabaseDataService.fetchEntryTasks(accountInfo);
          if (remoteTasks) {
            await AsyncStorage.setItem(STORAGE_KEYS.ENTRY_TASKS, JSON.stringify(remoteTasks));
            return remoteTasks;
          }
        } catch (error) {
          console.error('Error fetching entry tasks from Supabase:', error);
        }
      }

      return localTasks;
    } catch (error) {
      console.error('Error loading entry tasks:', error);
      return { customPlanCompleted: false, registrationCompleted: false };
    }
  },

  async saveEntryTasks(status: EntryTasksStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ENTRY_TASKS, JSON.stringify(status));

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.saveEntryTasks(accountInfo, status);
        } catch (error) {
          console.error('Error syncing entry tasks to Supabase:', error);
          await enqueueSyncOperation({ entity: 'entry_tasks', action: 'upsert', payload: status });
        }
      } else {
        await enqueueSyncOperation({ entity: 'entry_tasks', action: 'upsert', payload: status });
      }
    } catch (error) {
      console.error('Error saving entry tasks:', error);
    }
  },

  async completeEntryTask(task: EntryTaskType): Promise<{ status: EntryTasksStatus; awarded: boolean }> {
    try {
      const current = await this.loadEntryTasks();
      const taskKey =
        task === 'customPlan' ? 'customPlanCompleted' : 'registrationCompleted';
      if (current[taskKey]) {
        return { status: current, awarded: false };
      }
      const updated: EntryTasksStatus = { ...current, [taskKey]: true };
      await this.saveEntryTasks(updated);
      return { status: updated, awarded: true };
    } catch (error) {
      console.error('Error completing entry task:', error);
      return {
        status: { customPlanCompleted: false, registrationCompleted: false },
        awarded: false,
      };
    }
  },

  getEntryTaskBonus(status?: EntryTasksStatus): number {
    const resolved = status || { customPlanCompleted: false, registrationCompleted: false };
    const bonusPerTask = 5;
    return (resolved.customPlanCompleted ? bonusPerTask : 0) +
      (resolved.registrationCompleted ? bonusPerTask : 0);
  },

  // Referral code storage methods
  async loadReferralCodes(): Promise<ReferralCode[]> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_CODES);
      const localCodes: ReferralCode[] = localData ? (Array.isArray(JSON.parse(localData)) ? JSON.parse(localData) : []) : [];

      // Note: Referral codes are global, not per-user, so we don't fetch all from Supabase here
      // Individual lookups use getReferralCode/getReferralCodeByCode which check Supabase
      return localCodes;
    } catch (error) {
      console.error('Error loading referral codes:', error);
      return [];
    }
  },

  async saveReferralCodes(codes: ReferralCode[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REFERRAL_CODES, JSON.stringify(codes));
    } catch (error) {
      console.error('Error saving referral codes:', error);
    }
  },

  async getReferralCode(userId: string): Promise<ReferralCode | null> {
    try {
      // Try Supabase first if we have account info
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          const remoteCode = await supabaseDataService.fetchReferralCode(accountInfo);
          if (remoteCode) return remoteCode;
        } catch (error) {
          console.error('Error fetching referral code from Supabase:', error);
        }
      }

      // Fallback to local
      const codes = await this.loadReferralCodes();
      return codes.find(c => c.userId === userId) || null;
    } catch (error) {
      console.error('Error getting referral code:', error);
      return null;
    }
  },

  async getReferralCodeByCode(code: string): Promise<ReferralCode | null> {
    try {
      // Try Supabase first
      if (isSupabaseConfigured() && supabase) {
        try {
          const remoteCode = await supabaseDataService.fetchReferralCodeByCode(code);
          if (remoteCode) return remoteCode;
        } catch (error) {
          console.error('Error fetching referral code by code from Supabase:', error);
        }
      }

      // Fallback to local
      const codes = await this.loadReferralCodes();
      return codes.find(c => c.code === code.toUpperCase()) || null;
    } catch (error) {
      console.error('Error getting referral code by code:', error);
      return null;
    }
  },

  async saveReferralCode(referralCode: ReferralCode): Promise<void> {
    try {
      const codes = await this.loadReferralCodes();
      const existingIndex = codes.findIndex(c => c.userId === referralCode.userId);
      if (existingIndex >= 0) {
        codes[existingIndex] = referralCode;
      } else {
        codes.push(referralCode);
      }
      await this.saveReferralCodes(codes);

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.saveReferralCode(accountInfo, referralCode);
        } catch (error) {
          console.error('Error syncing referral code to Supabase:', error);
          await enqueueSyncOperation({ entity: 'referral_code', action: 'upsert', payload: referralCode });
        }
      } else {
        await enqueueSyncOperation({ entity: 'referral_code', action: 'upsert', payload: referralCode });
      }
    } catch (error) {
      console.error('Error saving referral code:', error);
    }
  },

  async updateReferralCode(userId: string, updates: Partial<ReferralCode>): Promise<void> {
    try {
      const codes = await this.loadReferralCodes();
      const index = codes.findIndex(c => c.userId === userId);
      if (index >= 0) {
        codes[index] = { ...codes[index], ...updates };
        await this.saveReferralCodes(codes);
      }
    } catch (error) {
      console.error('Error updating referral code:', error);
    }
  },

  // Referral redemption storage methods
  async loadReferralRedemptions(): Promise<ReferralRedemption[]> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_REDEMPTIONS);
      const localRedemptions: ReferralRedemption[] = localData
        ? (Array.isArray(JSON.parse(localData)) ? JSON.parse(localData) : [])
        : [];

      // Note: Redemptions are fetched per-user via getReferralRedemptionsForUser which checks Supabase
      return localRedemptions;
    } catch (error) {
      console.error('Error loading referral redemptions:', error);
      return [];
    }
  },

  async saveReferralRedemptions(redemptions: ReferralRedemption[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REFERRAL_REDEMPTIONS, JSON.stringify(redemptions));
    } catch (error) {
      console.error('Error saving referral redemptions:', error);
    }
  },

  async saveReferralRedemption(redemption: ReferralRedemption): Promise<void> {
    try {
      const redemptions = await this.loadReferralRedemptions();
      redemptions.push(redemption);
      await this.saveReferralRedemptions(redemptions);

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.saveReferralRedemption(accountInfo, redemption);
        } catch (error) {
          console.error('Error syncing referral redemption to Supabase:', error);
          await enqueueSyncOperation({ entity: 'referral_redemption', action: 'upsert', payload: redemption });
        }
      } else {
        await enqueueSyncOperation({ entity: 'referral_redemption', action: 'upsert', payload: redemption });
      }
    } catch (error) {
      console.error('Error saving referral redemption:', error);
    }
  },

  async getReferralRedemptionsForUser(email: string, type: 'referrer' | 'referee'): Promise<ReferralRedemption[]> {
    try {
      // Try Supabase first if we have account info
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.email && accountInfo.email.toLowerCase() === email.toLowerCase()) {
        try {
          const remoteRedemptions = await supabaseDataService.fetchReferralRedemptions(accountInfo, type);
          if (remoteRedemptions && remoteRedemptions.length > 0) {
            // Merge with local
            const localRedemptions = await this.loadReferralRedemptions();
            const mergedMap = new Map<string, ReferralRedemption>();
            localRedemptions.forEach((r) => mergedMap.set(r.id, r));
            remoteRedemptions.forEach((r) => mergedMap.set(r.id, r));
            return Array.from(mergedMap.values());
          }
        } catch (error) {
          console.error('Error fetching referral redemptions from Supabase:', error);
        }
      }

      // Fallback to local
      const redemptions = await this.loadReferralRedemptions();
      if (type === 'referrer') {
        return redemptions.filter(r => r.referrerEmail.toLowerCase() === email.toLowerCase());
      } else {
        return redemptions.filter(r => r.refereeEmail.toLowerCase() === email.toLowerCase());
      }
    } catch (error) {
      console.error('Error getting referral redemptions for user:', error);
      return [];
    }
  },

  async updateReferralRedemption(id: string, updates: Partial<ReferralRedemption>): Promise<void> {
    try {
      const redemptions = await this.loadReferralRedemptions();
      const index = redemptions.findIndex(r => r.id === id);
      if (index >= 0) {
        redemptions[index] = { ...redemptions[index], ...updates };
        await this.saveReferralRedemptions(redemptions);
      }
    } catch (error) {
      console.error('Error updating referral redemption:', error);
    }
  },

  // Referral reward storage methods
  async loadReferralRewards(): Promise<ReferralReward[]> {
    try {
      // Load from local storage first
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_REWARDS);
      const localRewards: ReferralReward[] = localData
        ? (Array.isArray(JSON.parse(localData)) ? JSON.parse(localData) : [])
        : [];

      // Note: Rewards are fetched per-user via loadReferralRewardsForUser which checks Supabase
      return localRewards;
    } catch (error) {
      console.error('Error loading referral rewards:', error);
      return [];
    }
  },

  async saveReferralRewards(rewards: ReferralReward[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REFERRAL_REWARDS, JSON.stringify(rewards));
    } catch (error) {
      console.error('Error saving referral rewards:', error);
    }
  },

  async saveReferralReward(reward: ReferralReward): Promise<void> {
    try {
      const rewards = await this.loadReferralRewards();
      rewards.push(reward);
      await this.saveReferralRewards(rewards);

      // Sync to Supabase if user is logged in
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          await supabaseDataService.saveReferralReward(accountInfo, reward);
        } catch (error) {
          console.error('Error syncing referral reward to Supabase:', error);
          await enqueueSyncOperation({ entity: 'referral_reward', action: 'upsert', payload: reward });
        }
      } else {
        await enqueueSyncOperation({ entity: 'referral_reward', action: 'upsert', payload: reward });
      }
    } catch (error) {
      console.error('Error saving referral reward:', error);
    }
  },

  async loadReferralRewardsForUser(userId: string): Promise<ReferralReward[]> {
    try {
      // Try Supabase first if we have account info
      const accountInfo = await getCachedAccountInfo();
      if (accountInfo?.supabaseUserId) {
        try {
          const remoteRewards = await supabaseDataService.fetchReferralRewards(accountInfo, userId);
          if (remoteRewards && remoteRewards.length > 0) {
            // Merge with local
            const localRewards = await this.loadReferralRewards();
            const mergedMap = new Map<string, ReferralReward>();
            localRewards.forEach((r) => mergedMap.set(r.id, r));
            remoteRewards.forEach((r) => mergedMap.set(r.id, r));
            return Array.from(mergedMap.values());
          }
        } catch (error) {
          console.error('Error fetching referral rewards from Supabase:', error);
        }
      }

      // Fallback to local
      const rewards = await this.loadReferralRewards();
      return rewards.filter(r => r.userId.toLowerCase() === userId.toLowerCase());
    } catch (error) {
      console.error('Error loading referral rewards for user:', error);
      return [];
    }
  },

  async checkIfUserHasUsedReferralCode(userId: string): Promise<boolean> {
    try {
      const redemptions = await this.loadReferralRedemptions();
      return redemptions.some(r => r.refereeEmail.toLowerCase() === userId.toLowerCase());
    } catch (error) {
      console.error('Error checking if user has used referral code:', error);
      return false;
    }
  },

  async getTotalEarnedEntriesFromReferrals(userId: string): Promise<number> {
    try {
      const rewards = await this.loadReferralRewards();
      const userRewards = rewards.filter(r => r.userId.toLowerCase() === userId.toLowerCase());
      return userRewards.reduce((sum, reward) => sum + reward.entriesAwarded, 0);
    } catch (error) {
      console.error('Error getting total earned entries from referrals:', error);
      return 0;
    }
  },

  // Daily Summary (Lightweight) Methods
  async loadDailySummaries(): Promise<Record<string, DailySummary>> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.SUMMARIES);
      return json ? JSON.parse(json) : {};
    } catch (error) {
      console.error('Error loading summaries:', error);
      return {};
    }
  },

  async saveDailySummaries(summaries: Record<string, DailySummary>): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SUMMARIES, JSON.stringify(summaries));
    } catch (error) {
      console.error('Error saving summaries:', error);
    }
  },

  recalculateDailySummary(date: string, mealsOrFoods: MealEntry[] | any[]): DailySummary {
    // This helper can take full daily meals and produce the summary
    // Needs to handle both MealEntry (which has ParsedFood[]) 
    // or flat ParsedFood list if we change structure later.

    // Flatten to just foods
    const foods = (mealsOrFoods as MealEntry[]).flatMap(m => m.foods);

    const totals = foods.reduce((acc, food) => {
      return {
        calories: acc.calories + (food.calories || 0),
        protein: acc.protein + (food.protein || 0),
        carbs: acc.carbs + (food.carbs || 0),
        fat: acc.fat + (food.fat || 0),
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      date,
      totalCalories: totals.calories,
      totalProtein: Number(totals.protein.toFixed(1)),
      totalCarbs: Number(totals.carbs.toFixed(1)),
      totalFat: Number(totals.fat.toFixed(1)),
      entryCount: mealsOrFoods.length,
      updatedAt: new Date().toISOString()
    };
  },

  async updateSummaryForDate(dateKey: string, mealsForDay: MealEntry[]): Promise<void> {
    try {
      const summaries = await this.loadDailySummaries();
      const newSummary = this.recalculateDailySummary(dateKey, mealsForDay);
      summaries[dateKey] = newSummary;
      await this.saveDailySummaries(summaries);

      // Sync summary to Supabase (Step 2 - Todo)
      // await supabaseDataService.upsertDailySummary(...)
    } catch (e) {
      console.error("Error updating summary for date", e);
    }
  },

  async migrateMealsToSummaries(): Promise<void> {
    try {
      const existingSummaries = await this.loadDailySummaries();
      if (Object.keys(existingSummaries).length > 0) return;

      console.log('No daily summaries found, performing initial migration...');
      const allMeals = await this.loadMeals();
      const newSummaries: Record<string, DailySummary> = {};

      Object.keys(allMeals).forEach(dateKey => {
        newSummaries[dateKey] = this.recalculateDailySummary(dateKey, allMeals[dateKey]);
      });

      if (Object.keys(newSummaries).length > 0) {
        await this.saveDailySummaries(newSummaries);
        console.log('Initial daily summaries migration complete.');
      }
    } catch (error) {
      console.error('Migration failed', error);
    }
  },

  async pushCachedDataToSupabase(): Promise<void> {
    try {
      const accountInfo = await getCachedAccountInfo();
      if (!accountInfo?.supabaseUserId && !accountInfo?.email) return;
      await processSyncQueue(accountInfo);

      // Sync meals
      const mealsData = await AsyncStorage.getItem(STORAGE_KEYS.MEALS);
      const meals = mealsData ? JSON.parse(mealsData) : {};
      ensureMealMetadata(meals);
      const mealPayloads = Array.from(flattenMeals(meals).values());
      if (mealPayloads.length) {
        try {
          await supabaseDataService.upsertMeals(accountInfo, mealPayloads);
        } catch (error) {
          console.error('Bulk meal sync failed, queueing operations:', error);
          await Promise.all(
            mealPayloads.map((payload) =>
              enqueueSyncOperation({ entity: 'meal', action: 'upsert', payload })
            )
          );
        }
      }

      // Sync weight entries
      const weightData = await AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_ENTRIES);
      const parsedWeights: WeightEntry[] = weightData ? JSON.parse(weightData) : [];
      const normalizedWeights = parsedWeights.map((entry) => ({
        id: entry.id || entry.date,
        date: entry.date,
        weight: entry.weight,
        updatedAt: entry.updatedAt || new Date().toISOString(),
      }));

      if (normalizedWeights.length) {
        try {
          await supabaseDataService.upsertWeightEntries(
            accountInfo,
            normalizedWeights.map((entry) => ({
              id: entry.id!,
              date: entry.date,
              weight: entry.weight,
              updatedAt: entry.updatedAt!,
            }))
          );
        } catch (error) {
          console.error('Bulk weight sync failed, queueing operations:', error);
          await Promise.all(
            normalizedWeights.map((entry) =>
              enqueueSyncOperation({
                entity: 'weight',
                action: 'upsert',
                payload: {
                  id: entry.id!,
                  date: entry.date,
                  weight: entry.weight,
                  updatedAt: entry.updatedAt!,
                },
              })
            )
          );
        }
      }

      // Sync exercises
      const exercisesData = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
      const exercises = exercisesData ? JSON.parse(exercisesData) : {};
      const allExercises = Object.values(exercises).flat() as ExerciseEntry[];
      if (allExercises.length > 0) {
        try {
          await supabaseDataService.upsertExercises(accountInfo, allExercises);
        } catch (error) {
          console.error('Bulk exercise sync failed, queueing operations:', error);
          await enqueueSyncOperation({ entity: 'exercise', action: 'upsert', payload: allExercises });
        }
      }

      // Sync goals
      const goalsData = await AsyncStorage.getItem(STORAGE_KEYS.GOALS);
      if (goalsData) {
        try {
          const goals = JSON.parse(goalsData) as ExtendedGoalData;
          await supabaseDataService.saveNutritionGoals(accountInfo, goals);
        } catch (error) {
          console.error('Bulk goals sync failed, queueing operation:', error);
          const goals = JSON.parse(goalsData) as ExtendedGoalData;
          await enqueueSyncOperation({ entity: 'goals', action: 'upsert', payload: goals });
        }
      }

      // Sync push tokens
      const pushTokensData = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKENS);
      if (pushTokensData) {
        try {
          const tokens = JSON.parse(pushTokensData) as string[];
          await Promise.all(tokens.map((token) => supabaseDataService.upsertPushToken(accountInfo, token)));
        } catch (error) {
          console.error('Bulk push token sync failed, queueing operations:', error);
          const tokens = JSON.parse(pushTokensData) as string[];
          await Promise.all(
            tokens.map((token) =>
              enqueueSyncOperation({ entity: 'push_token', action: 'upsert', payload: { token } })
            )
          );
        }
      }

      // Sync push history
      const pushHistoryData = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_HISTORY);
      if (pushHistoryData) {
        try {
          const history = JSON.parse(pushHistoryData) as PushBroadcastRecord[];
          await Promise.all(history.map((record) => supabaseDataService.savePushHistory(accountInfo, record)));
        } catch (error) {
          console.error('Bulk push history sync failed, queueing operations:', error);
          const history = JSON.parse(pushHistoryData) as PushBroadcastRecord[];
          await Promise.all(
            history.map((record) =>
              enqueueSyncOperation({ entity: 'push_history', action: 'upsert', payload: record })
            )
          );
        }
      }

      // Sync saved prompts
      const savedPromptsData = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PROMPTS);
      if (savedPromptsData) {
        try {
          const prompts = JSON.parse(savedPromptsData) as SavedPrompt[];
          await Promise.all(prompts.map((prompt) => supabaseDataService.upsertSavedPrompt(accountInfo, prompt)));
        } catch (error) {
          console.error('Bulk saved prompts sync failed, queueing operations:', error);
          const prompts = JSON.parse(savedPromptsData) as SavedPrompt[];
          await Promise.all(
            prompts.map((prompt) =>
              enqueueSyncOperation({ entity: 'saved_prompt', action: 'upsert', payload: prompt })
            )
          );
        }
      }

      // Sync preferences
      const preferencesData = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (preferencesData) {
        try {
          const prefs = JSON.parse(preferencesData) as Preferences;
          await supabaseDataService.savePreferences(accountInfo, prefs);
        } catch (error) {
          console.error('Bulk preferences sync failed, queueing operation:', error);
          const prefs = JSON.parse(preferencesData) as Preferences;
          await enqueueSyncOperation({ entity: 'preferences', action: 'upsert', payload: prefs });
        }
      }

      // Sync user settings (entry count, user plan, device info)
      const entryCountData = await AsyncStorage.getItem(STORAGE_KEYS.ENTRY_COUNT);
      const userPlanData = await AsyncStorage.getItem(STORAGE_KEYS.USER_PLAN);
      const deviceInfoData = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_INFO);
      const settings: any = {};
      if (entryCountData) settings.entryCount = parseInt(entryCountData, 10) || 0;
      if (userPlanData) settings.userPlan = userPlanData === 'premium' ? 'premium' : 'free';
      if (deviceInfoData) settings.deviceInfo = JSON.parse(deviceInfoData);
      if (Object.keys(settings).length > 0) {
        try {
          await supabaseDataService.saveUserSettings(accountInfo, settings);
        } catch (error) {
          console.error('Bulk user settings sync failed, queueing operation:', error);
          await enqueueSyncOperation({ entity: 'settings', action: 'upsert', payload: settings });
        }
      }

      // Sync entry tasks
      const entryTasksData = await AsyncStorage.getItem(STORAGE_KEYS.ENTRY_TASKS);
      if (entryTasksData) {
        try {
          const tasks = JSON.parse(entryTasksData) as EntryTasksStatus;
          await supabaseDataService.saveEntryTasks(accountInfo, tasks);
        } catch (error) {
          console.error('Bulk entry tasks sync failed, queueing operation:', error);
          const tasks = JSON.parse(entryTasksData) as EntryTasksStatus;
          await enqueueSyncOperation({ entity: 'entry_tasks', action: 'upsert', payload: tasks });
        }
      }

      // Sync referral codes
      const referralCodesData = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_CODES);
      if (referralCodesData) {
        try {
          const codes = JSON.parse(referralCodesData) as ReferralCode[];
          await Promise.all(codes.map((code) => supabaseDataService.saveReferralCode(accountInfo, code)));
        } catch (error) {
          console.error('Bulk referral codes sync failed, queueing operations:', error);
          const codes = JSON.parse(referralCodesData) as ReferralCode[];
          await Promise.all(
            codes.map((code) =>
              enqueueSyncOperation({ entity: 'referral_code', action: 'upsert', payload: code })
            )
          );
        }
      }

      // Sync referral redemptions
      const referralRedemptionsData = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_REDEMPTIONS);
      if (referralRedemptionsData) {
        try {
          const redemptions = JSON.parse(referralRedemptionsData) as ReferralRedemption[];
          await Promise.all(
            redemptions.map((redemption) => supabaseDataService.saveReferralRedemption(accountInfo, redemption))
          );
        } catch (error) {
          console.error('Bulk referral redemptions sync failed, queueing operations:', error);
          const redemptions = JSON.parse(referralRedemptionsData) as ReferralRedemption[];
          await Promise.all(
            redemptions.map((redemption) =>
              enqueueSyncOperation({ entity: 'referral_redemption', action: 'upsert', payload: redemption })
            )
          );
        }
      }

      // Sync referral rewards
      const referralRewardsData = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_REWARDS);
      if (referralRewardsData) {
        try {
          const rewards = JSON.parse(referralRewardsData) as ReferralReward[];
          await Promise.all(rewards.map((reward) => supabaseDataService.saveReferralReward(accountInfo, reward)));
        } catch (error) {
          console.error('Bulk referral rewards sync failed, queueing operations:', error);
          const rewards = JSON.parse(referralRewardsData) as ReferralReward[];
          await Promise.all(
            rewards.map((reward) =>
              enqueueSyncOperation({ entity: 'referral_reward', action: 'upsert', payload: reward })
            )
          );
        }
      }
    } catch (error) {
      console.error('Error pushing cached data to Supabase:', error);
    }
  },



  saveAdjustmentHistory: async (history: AdjustmentRecord[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ADJUSTMENT_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save adjustment history', e);
    }
  },

  loadAdjustmentHistory: async (): Promise<AdjustmentRecord[]> => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.ADJUSTMENT_HISTORY);
      if (json) {
        return JSON.parse(json);
      }
    } catch (e) {
      console.error('Failed to load adjustment history', e);
    }
    return [];
  },

  checkAndGenerateAdjustment: async (): Promise<AdjustmentRecord | null> => {
    try {
      const prefs = await dataStorage.loadPreferences();
      if (!prefs || !prefs.dynamicAdjustmentEnabled) return null;

      const goals = await dataStorage.loadGoals();
      if (!goals) return null;

      const weightEntries = await dataStorage.loadWeightEntries();
      if (!weightEntries || weightEntries.length === 0) return null;

      // Sort by date desc
      // Sort by date desc - ensure reliable parsing
      const sortedWeights = [...weightEntries].sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
        const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
        return dateB - dateA;
      });

      const currentEntry = sortedWeights[0];
      const currentWeight = currentEntry.weight;

      // Determine baseline
      let baselineWeight = prefs.lastAdjustmentWeight;

      // If we don't have a baseline, we need at least 2 entries to compare start vs current
      if (!baselineWeight) {
        if (sortedWeights.length < 2) return null;
        // Use the OLDEST weight as baseline
        const oldestEntry = sortedWeights[sortedWeights.length - 1];
        baselineWeight = oldestEntry.weight;
      }

      // Small sanity check: if current IS the baseline (e.g. only 1 entry and it was set as baseline), skip
      if (baselineWeight === currentWeight) return null;

      console.log('Checking smart adjustment... Enabled:', prefs.dynamicAdjustmentEnabled, 'Baseline:', baselineWeight, 'Current:', currentWeight);

      // Calculate change
      const percentChange = (currentWeight - baselineWeight) / baselineWeight;
      const thresholdDecimal = prefs.dynamicAdjustmentThreshold / 100;

      console.log('Change %:', percentChange, 'Threshold:', thresholdDecimal);

      if (Math.abs(percentChange) >= thresholdDecimal) {
        // Prevent duplicate pending for same day/weight?
        // For now, let it generate.

        // Logic change: Adjust based on user's selected pace
        // Mild (0.25) -> 100 kcal
        // Normal (0.5) -> 200 kcal
        // Fast (1.0) -> 300 kcal
        // Default to Normal (200) if unknown

        let adjustmentAmount = 200;
        if (goals.activityRate) {
          if (goals.activityRate <= 0.25) adjustmentAmount = 100;
          else if (goals.activityRate <= 0.5) adjustmentAmount = 200;
          else adjustmentAmount = 300;
        }

        let newCalories = goals.calories;
        if (goals.goal === 'gain') {
          newCalories += adjustmentAmount;
        } else {
          // Lose or Maintain (usually lose)
          newCalories -= adjustmentAmount;
        }

        if (newCalories < 1200) newCalories = 1200; // Safety floor

        // Helper for macros
        const pRate = goals.proteinPercentage / 100;
        const cRate = goals.carbsPercentage / 100;
        const fRate = goals.fatPercentage / 100;

        return {
          id: generateId(),
          date: new Date().toISOString().split('T')[0],
          previousCalories: goals.calories,
          newCalories,
          previousWeight: baselineWeight,
          currentWeight,
          threshold: prefs.dynamicAdjustmentThreshold,
          status: 'pending',
          previousMacros: {
            protein: goals.proteinGrams,
            carbs: goals.carbsGrams,
            fats: goals.fatGrams,
          },
          macros: {
            protein: Math.round((newCalories * pRate) / 4),
            carbs: Math.round((newCalories * cRate) / 4),
            fats: Math.round((newCalories * fRate) / 9),
          }
        };
      }
    } catch (e) {
      console.error('Error generating adjustment', e);
    }
    return null;
  },

  applyAdjustment: async (record: AdjustmentRecord): Promise<void> => {
    try {
      const goals = await dataStorage.loadGoals();
      if (!goals) return;

      // 1. Update Goals
      const newGoals: ExtendedGoalData = {
        ...goals,
        calories: record.newCalories,
        proteinGrams: record.macros?.protein || goals.proteinGrams,
        carbsGrams: record.macros?.carbs || goals.carbsGrams,
        fatGrams: record.macros?.fats || goals.fatGrams,
      };
      await dataStorage.saveGoals(newGoals);

      // 2. Update Preferences (baseline)
      const prefs = await dataStorage.loadPreferences();
      if (prefs) {
        await dataStorage.savePreferences({
          ...prefs,
          lastAdjustmentWeight: record.currentWeight
        });
      }

      // 3. Save to History
      const history = await dataStorage.loadAdjustmentHistory();
      const newHistory = [
        { ...record, status: 'applied' as const },
        ...history
      ];
      await dataStorage.saveAdjustmentHistory(newHistory);

    } catch (e) {
      console.error('Failed to apply adjustment', e);
    }
  },

  dismissAdjustment: async (record: AdjustmentRecord): Promise<void> => {
    try {
      const history = await dataStorage.loadAdjustmentHistory();
      const newHistory = [
        { ...record, status: 'dismissed' as const },
        ...history
      ];
      await dataStorage.saveAdjustmentHistory(newHistory);
      // Update baseline to prevent immediate re-prompt
      const prefs = await dataStorage.loadPreferences();
      if (prefs) {
        await dataStorage.savePreferences({
          ...prefs,
          lastAdjustmentWeight: record.currentWeight
        });
      }
    } catch (e) {
      console.error('Failed to dismiss adjustment', e);
    }
  },
  getAccountInfo: async (): Promise<AccountInfo | null> => {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT_INFO);
    return json ? JSON.parse(json) : null;
  },

  getStreak: async (): Promise<number> => {
    try {
      const summaries = await dataStorage.loadDailySummaries();
      const freezeData = await dataStorage.loadStreakFreeze();
      return calculateStreak(summaries, freezeData?.usedOnDates || []);
    } catch (e) {
      console.error('Error calculating streak:', e);
      return 0;
    }
  },

  saveMeal: async (date: string, meal: MealEntry): Promise<void> => {
    const meals = await dataStorage.loadMeals();
    const dayMeals = meals[date] || [];
    meals[date] = [...dayMeals, meal];
    await dataStorage.saveMeals(meals);
  },

  // --- USER METRICS SNAPSHOT ---

  async getUserMetricsSnapshot(): Promise<UserMetricsSnapshot | null> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.USER_METRICS_SNAPSHOT);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      console.error('Error loading snapshot', e);
      return null;
    }
  },

  async saveUserMetricsSnapshot(snapshot: UserMetricsSnapshot): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_METRICS_SNAPSHOT, JSON.stringify(snapshot));
      // Optional: Sync to Supabase here or in background
    } catch (e) {
      console.error('Error saving snapshot', e);
    }
  },

  async generateUserMetricsSnapshot(): Promise<UserMetricsSnapshot | null> {
    try {
      // 1. Load data
      const goals = await this.loadGoals();
      if (!goals) return null; // Can't generate without goals

      const summaries = await this.loadDailySummaries();

      // Load raw entries directly
      const weightJson = await AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_ENTRIES);
      const weightEntries: WeightEntry[] = weightJson ? JSON.parse(weightJson) : [];

      const today = new Date();



      // 2. Averages (Last 7 days)
      let totalCals = 0, totalP = 0, totalC = 0, totalF = 0;

      // Track micros separately
      const microSums = {
        dietary_fiber: 0, sugar: 0, added_sugars: 0, sugar_alcohols: 0, net_carbs: 0,
        saturated_fat: 0, trans_fat: 0, polyunsaturated_fat: 0, monounsaturated_fat: 0,
        sodium: 0, potassium: 0, cholesterol: 0, calcium: 0, iron: 0,
        vitamin_a: 0, vitamin_c: 0, vitamin_d: 0, vitamin_e: 0, vitamin_k: 0, vitamin_b12: 0
      };

      let dayCount = 0;
      let verifiedKeys: string[] = []; // for common foods scan

      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const k = d.toISOString().split('T')[0];
        const s = summaries[k];
        if (s && s.entryCount > 0) {
          totalCals += s.totalCalories;
          totalP += s.totalProtein;
          totalC += s.totalCarbs;
          totalF += s.totalFat;
          dayCount++;
          verifiedKeys.push(k);
        }
      }

      // 3. Weight Trend (last 14 days)
      // Sort desc
      const sortedWeights = [...weightEntries].sort((a, b) => b.date.localeCompare(a.date));
      // ... (Keeping this part identical relies on me copying it perfectly or using a smaller chunk)
      // I'll copy the logic I saw in previous `view_file`.
      const currentW = sortedWeights.length > 0 ? sortedWeights[0].weight : null;
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(today.getDate() - 14);
      const pastWEntry = sortedWeights.find(w => w.date <= twoWeeksAgo.toISOString().split('T')[0]);
      const startW = pastWEntry ? pastWEntry.weight : (sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1].weight : null);

      // 4. Consistency Score
      let consistentDays = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const k = d.toISOString().split('T')[0];
        const s = summaries[k];
        if (s && s.entryCount > 0) {
          const diff = Math.abs(s.totalCalories - goals.calories);
          if (diff / goals.calories <= 0.15) consistentDays++;
        }
      }
      const consistencyScore = Math.round((consistentDays / 7) * 100);

      // 6. Common Foods & Micro Accumulation
      const foodStats: Record<string, { count: number, p: number, c: number, f: number, kcal: number, weight: number }> = {};

      for (const k of verifiedKeys) {
        try {
          const dailyMeals = await this.getDailyLog(k);
          dailyMeals.forEach(m => {
            m.foods.forEach(f => {
              // Stats for Common Foods
              const name = ((f as any).food_name || (f as any).foodName || (f as any).name || '').toLowerCase().trim();
              if (name) {
                if (!foodStats[name]) {
                  foodStats[name] = { count: 0, p: 0, c: 0, f: 0, kcal: 0, weight: 0 };
                }
                const s = foodStats[name];
                s.count++;
                s.p += (f.protein || 0);
                s.c += (f.carbs || 0);
                s.f += (f.fat || 0);
                s.kcal += (f.calories || 0);
                s.weight += (f.weight_g || 100);
              }

              // Accumulate Daily Micros
              // Safe access with fallback 0
              if (f.dietary_fiber) microSums.dietary_fiber += f.dietary_fiber;
              else if ((f as any).fiber) microSums.dietary_fiber += (f as any).fiber; // legacy fallback

              if (f.sugar) microSums.sugar += f.sugar;
              if (f.added_sugars) microSums.added_sugars += f.added_sugars;
              if (f.sugar_alcohols) microSums.sugar_alcohols += f.sugar_alcohols;
              if (f.net_carbs) microSums.net_carbs += f.net_carbs;

              if (f.saturated_fat) microSums.saturated_fat += f.saturated_fat;
              if (f.trans_fat) microSums.trans_fat += f.trans_fat;
              if (f.polyunsaturated_fat) microSums.polyunsaturated_fat += f.polyunsaturated_fat;
              if (f.monounsaturated_fat) microSums.monounsaturated_fat += f.monounsaturated_fat;

              if (f.sodium_mg) microSums.sodium += f.sodium_mg;
              if (f.potassium_mg) microSums.potassium += f.potassium_mg;
              if (f.cholesterol_mg) microSums.cholesterol += f.cholesterol_mg;
              if (f.calcium_mg) microSums.calcium += f.calcium_mg;
              if (f.iron_mg) microSums.iron += f.iron_mg;

              if (f.vitamin_a_mcg) microSums.vitamin_a += f.vitamin_a_mcg;
              if (f.vitamin_c_mg) microSums.vitamin_c += f.vitamin_c_mg;
              if (f.vitamin_d_mcg) microSums.vitamin_d += f.vitamin_d_mcg;
              if (f.vitamin_e_mg) microSums.vitamin_e += f.vitamin_e_mg;
              if (f.vitamin_k_mcg) microSums.vitamin_k += f.vitamin_k_mcg;
              if (f.vitamin_b12_mcg) microSums.vitamin_b12 += f.vitamin_b12_mcg;
            });
          });
        } catch (e) { /* ignore read error */ }
      }

      const avgs = {
        calories: dayCount ? Math.round(totalCals / dayCount) : 0,
        protein: dayCount ? Math.round(totalP / dayCount) : 0,
        carbs: dayCount ? Math.round(totalC / dayCount) : 0,
        fat: dayCount ? Math.round(totalF / dayCount) : 0,

        dietary_fiber: dayCount ? Math.round(microSums.dietary_fiber / dayCount) : 0,
        sugar: dayCount ? Math.round(microSums.sugar / dayCount) : 0,
        added_sugars: dayCount ? Math.round(microSums.added_sugars / dayCount) : 0,
        sugar_alcohols: dayCount ? Math.round(microSums.sugar_alcohols / dayCount) : 0,
        net_carbs: dayCount ? Math.round(microSums.net_carbs / dayCount) : 0,

        saturated_fat: dayCount ? Math.round(microSums.saturated_fat / dayCount) : 0,
        trans_fat: dayCount ? Math.round(microSums.trans_fat / dayCount) : 0,
        polyunsaturated_fat: dayCount ? Math.round(microSums.polyunsaturated_fat / dayCount) : 0,
        monounsaturated_fat: dayCount ? Math.round(microSums.monounsaturated_fat / dayCount) : 0,

        sodium: dayCount ? Math.round(microSums.sodium / dayCount) : 0,
        potassium: dayCount ? Math.round(microSums.potassium / dayCount) : 0,
        cholesterol: dayCount ? Math.round(microSums.cholesterol / dayCount) : 0,
        calcium: dayCount ? Math.round(microSums.calcium / dayCount) : 0,
        iron: dayCount ? Math.round(microSums.iron / dayCount) : 0,

        vitamin_a: dayCount ? Math.round(microSums.vitamin_a / dayCount) : 0,
        vitamin_c: dayCount ? Math.round(microSums.vitamin_c / dayCount) : 0,
        vitamin_d: dayCount ? Math.round(microSums.vitamin_d / dayCount) : 0,
        vitamin_e: dayCount ? Math.round(microSums.vitamin_e / dayCount) : 0,
        vitamin_k: dayCount ? Math.round(microSums.vitamin_k / dayCount) : 0,
        vitamin_b12: dayCount ? Math.round(microSums.vitamin_b12 / dayCount) : 0,
      };

      // 5. Weak Nutrients (Calculated after avgs)
      const weak: string[] = [];
      if (avgs.protein < goals.proteinGrams * 0.8) weak.push('protein');
      if (avgs.calories > goals.calories * 1.2) weak.push('calories_high');
      if (avgs.calories < goals.calories * 0.8) weak.push('calories_low');
      // Add micronutrient checks if we want? (optional, but good for coach)
      if (avgs.dietary_fiber < 25) weak.push('fiber'); // General guideline
      if (avgs.sugar > 50) weak.push('sugar_high');

      const commonFoods = Object.entries(foodStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([name, stats]) => {
          // Normalize to per 100g
          const totalW = stats.weight || (stats.count * 100);
          const factor = 100 / totalW;

          return {
            name,
            frequency: stats.count,
            avgP: Math.round((stats.p * factor) * 10) / 10,
            avgC: Math.round((stats.c * factor) * 10) / 10,
            avgF: Math.round((stats.f * factor) * 10) / 10,
            avgKcal: Math.round((stats.kcal * factor) * 10) / 10
          };
        });

      const streak = await this.getStreak();

      const snapshot: UserMetricsSnapshot = {
        generatedAt: new Date().toISOString(),
        userGoals: {
          calories: goals.calories,
          protein: goals.proteinGrams,
          carbs: goals.carbsGrams,
          fat: goals.fatGrams,
          goalType: goals.goal || 'maintain',
        },
        averages7Day: avgs,
        weightTrend: {
          current: currentW,
          startOfPeriod: startW,
          change: (currentW && startW) ? Number((currentW - startW).toFixed(2)) : null,
          periodDays: 14 // approx
        },
        consistencyScore,
        currentStreak: streak,
        weakNutrients: weak,
        commonFoods,
        recentDailySummaries: Object.values(summaries).filter(s => verifiedKeys.includes(s.date))
      };

      await this.saveUserMetricsSnapshot(snapshot);
      return snapshot;

    } catch (error) {
      console.error('Error generating metrics snapshot:', error);
      return null;
    }
  },


  // --- INSIGHT ENGINE STORAGE ---

  async saveInsights(insights: Insight[]): Promise<void> {
    try {
      const currentFn = await this.loadInsights();
      const current = currentFn || [];
      const newMap = new Map();
      current.forEach(i => newMap.set(i.id, i));
      insights.forEach(i => newMap.set(i.id, i));

      const combined = Array.from(newMap.values()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
      await AsyncStorage.setItem(STORAGE_KEYS.INSIGHTS, JSON.stringify(combined));
    } catch (e) {
      console.error('Error saving insights', e);
    }
  },

  async loadInsights(): Promise<Insight[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.INSIGHTS);
      return json ? JSON.parse(json) : [];
    } catch (e) {
      console.error('Error loading insights', e);
      return [];
    }
  },

  async dismissInsight(id: string): Promise<void> {
    try {
      const insights = await this.loadInsights();
      const updated = insights.map(i =>
        i.id === id ? { ...i, isDismissed: true } : i
      );
      await AsyncStorage.setItem(STORAGE_KEYS.INSIGHTS, JSON.stringify(updated));
    } catch (e) {
      console.error('Error dismissing insight', e);
    }
  },

  async setCoachDismissedToday(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      await AsyncStorage.setItem(STORAGE_KEYS.COACH_DISMISS_DATE, today);
    } catch (e) { console.error(e); }
  },

  async isCoachDismissedToday(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.COACH_DISMISS_DATE);
      const today = new Date().toISOString().split('T')[0];
      return stored === today;
    } catch (e) { return false; }
  },

  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.error('Error clearing all local data:', e);
    }
  },

  async debug_injectPlateauData(): Promise<void> {
    console.log('Injecting debug plateau data...');
    const today = new Date();

    // 1. Set Goal (Deficit but eating maintenance)
    // Let's say Maintenance is 2500, Target is 2000.
    const goals: ExtendedGoalData = {
      calories: 2000,
      proteinPercentage: 30,
      carbsPercentage: 40,
      fatPercentage: 30,
      proteinGrams: 150,
      carbsGrams: 200,
      fatGrams: 67,
      currentWeightKg: 80,
      targetWeightKg: 75,
      goal: 'lose',
      gender: 'male'
    };
    await this.saveGoals(goals);

    // 3. Generate 14 Days of Data
    const weightEntries: WeightEntry[] = [];

    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // WEIGHT: Stable (Plateau)
      // 80.0 -> 80.1 variance
      weightEntries.push({
        id: generateId(),
        date: dateStr,
        weight: 80 + (i % 2 === 0 ? 0 : 0.1), // 80.0, 80.1, 80.0...
        updatedAt: new Date().toISOString()
      });

      // MEALS: Consistent, "Healthy" Staples
      // ~2000 kcal (Hitting the target perfectly)
      const meals: MealEntry[] = [
        {
          id: generateId(),
          prompt: "Breakfast",
          timestamp: d.setHours(8, 0, 0, 0),
          foods: [
            { id: generateId(), quantity: 3, unit: 'whole', name: "Scrambled Eggs (3 eggs)", calories: 240, protein: 18, carbs: 2, fat: 15, weight_g: 150 },
            { id: generateId(), quantity: 2, unit: 'slice', name: "Whole Wheat Toast", calories: 100, protein: 4, carbs: 15, fat: 2, weight_g: 40 }
          ]
        },
        {
          id: generateId(),
          prompt: "Lunch",
          timestamp: d.setHours(13, 0, 0, 0),
          foods: [
            { id: generateId(), quantity: 200, unit: 'g', name: "Grilled Chicken Breast", calories: 300, protein: 60, carbs: 0, fat: 6, weight_g: 200 },
            { id: generateId(), quantity: 200, unit: 'g', name: "Brown Rice", calories: 250, protein: 5, carbs: 50, fat: 2, weight_g: 200 },
            { id: generateId(), quantity: 150, unit: 'g', name: "Broccoli", calories: 50, protein: 4, carbs: 10, fat: 0, weight_g: 150 }
          ]
        },
        {
          id: generateId(),
          prompt: "Dinner",
          timestamp: d.setHours(19, 0, 0, 0),
          foods: [
            { id: generateId(), quantity: 200, unit: 'g', name: "Grilled Salmon", calories: 400, protein: 40, carbs: 0, fat: 20, weight_g: 200 },
            { id: generateId(), quantity: 200, unit: 'g', name: "Quinoa Salad", calories: 300, protein: 10, carbs: 40, fat: 10, weight_g: 200 }
          ]
        }
      ];

      // Save Daily Log
      await this.saveDailyLog(dateStr, meals);
    }

    // Save Weights
    await AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(weightEntries));

    // 4. Force Snapshot Update
    await this.generateUserMetricsSnapshot();
    console.log('Debug data injected.');
  },
};


