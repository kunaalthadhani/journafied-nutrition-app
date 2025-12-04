import AsyncStorage from '@react-native-async-storage/async-storage';
import { Meal } from '../components/FoodLogSection';
import { ExerciseEntry } from '../components/ExerciseLogSection';
import { supabaseDataService } from './supabaseDataService';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { generateId, ensureUUID } from '../utils/uuid';

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
};

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
}

export interface Preferences {
  weightUnit: 'kg' | 'lbs';
  notificationsEnabled: boolean;
  mealReminders: {
    breakfast: { enabled: boolean; hour: number; minute: number };
    lunch: { enabled: boolean; hour: number; minute: number };
    dinner: { enabled: boolean; hour: number; minute: number };
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
  meal: Meal;
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
  | { entity: 'referral_reward'; action: 'upsert'; payload: ReferralReward };

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

const ensureMealMetadata = (mealsByDate: Record<string, Meal[]>) => {
  const now = new Date().toISOString();
  Object.keys(mealsByDate).forEach((dateKey) => {
    mealsByDate[dateKey] = mealsByDate[dateKey].map((meal) => ({
      ...meal,
      id: ensureUUID(meal.id),
      updatedAt: meal.updatedAt || now,
    }));
  });
};

const flattenMeals = (mealsByDate: Record<string, Meal[]>) => {
  const map = new Map<string, { meal: Meal; dateKey: string }>();
  Object.entries(mealsByDate).forEach(([dateKey, meals]) => {
    meals.forEach((meal) => {
      map.set(meal.id, { meal, dateKey });
    });
  });
  return map;
};

const diffMeals = (
  previous: Record<string, Meal[]>,
  next: Record<string, Meal[]>
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
  remote: Record<string, Meal[]>,
  local: Record<string, Meal[]>
): Record<string, Meal[]> => {
  ensureMealMetadata(remote);
  ensureMealMetadata(local);
  const merged: Record<string, Meal[]> = JSON.parse(JSON.stringify(local));
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

  // Save all meals by date
  async saveMeals(mealsByDate: Record<string, Meal[]>): Promise<void> {
    try {
      const prevSerialized = await AsyncStorage.getItem(STORAGE_KEYS.MEALS);
      const previousMeals: Record<string, Meal[]> = prevSerialized ? JSON.parse(prevSerialized) : {};
      const nextMeals: Record<string, Meal[]> = JSON.parse(JSON.stringify(mealsByDate));

      ensureMealMetadata(previousMeals);
      ensureMealMetadata(nextMeals);

      await AsyncStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(nextMeals));
      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (!accountInfo?.supabaseUserId && !accountInfo?.email) return;

      const { upserts, deletions } = diffMeals(previousMeals, nextMeals);

      if (upserts.length > 0) {
        try {
          await supabaseDataService.upsertMeals(accountInfo, upserts);
        } catch (error) {
          console.error('Error syncing meals to Supabase:', error);
          await Promise.all(upserts.map((payload) =>
            enqueueSyncOperation({ entity: 'meal', action: 'upsert', payload })
          ));
        }
      }

      if (deletions.length > 0) {
        try {
          await supabaseDataService.deleteMeals(accountInfo, deletions);
        } catch (error) {
          console.error('Error deleting meals from Supabase:', error);
          await Promise.all(deletions.map((id) =>
            enqueueSyncOperation({ entity: 'meal', action: 'delete', payload: { id } })
          ));
        }
      }
    } catch (error) {
      console.error('Error saving meals:', error);
    }
  },

  // Load meals
  async loadMeals(): Promise<Record<string, Meal[]>> {
    try {
      const localData = await AsyncStorage.getItem(STORAGE_KEYS.MEALS);
      const localMeals: Record<string, Meal[]> = localData ? JSON.parse(localData) : {};

      const accountInfo = await getCachedAccountInfo();
      await processSyncQueue(accountInfo);
      if (!accountInfo?.supabaseUserId && !accountInfo?.email) {
        return localMeals;
      }

      const remoteMeals = await supabaseDataService.fetchMeals(accountInfo);
      if (remoteMeals && Object.keys(remoteMeals).length > 0) {
        const merged = mergeMealsCache(remoteMeals, localMeals);
        await AsyncStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(merged));
        return merged;
      }

      return localMeals;
    } catch (error) {
      console.error('Error loading meals:', error);
      return {};
    }
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

      return localPrefs;
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
};



