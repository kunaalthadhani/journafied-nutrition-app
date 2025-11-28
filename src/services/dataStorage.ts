import AsyncStorage from '@react-native-async-storage/async-storage';
import { Meal } from '../components/FoodLogSection';
import { ExerciseEntry } from '../components/ExerciseLogSection';
import { supabaseDataService } from './supabaseDataService';

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
  gender?: 'male' | 'female';
  heightCm?: number;
  heightFeet?: number;
  heightInches?: number;
  goal?: 'lose' | 'maintain' | 'gain';
  activityRate?: number;
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
  | { entity: 'weight'; action: 'delete'; payload: { id: string } };

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
  }
};

const processSyncQueue = async (accountInfo: AccountInfo | null): Promise<void> => {
  if (!accountInfo?.email) return;
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
      id: meal.id || `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  },

  // Load goals
  async loadGoals(): Promise<ExtendedGoalData | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.GOALS);
      return data ? JSON.parse(data) : null;
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
      if (!accountInfo?.email) return;

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
      if (!accountInfo?.email) {
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
    } catch (error) {
      console.error('Error saving exercises:', error);
    }
  },

  // Load exercises
  async loadExercises(): Promise<Record<string, ExerciseEntry[]>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
      return data ? JSON.parse(data) : {};
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
      if (!accountInfo?.email) return;

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
      if (!accountInfo?.email) {
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
    } catch (error) {
      console.error('Error saving entry count:', error);
    }
  },

  // Load entry count
  async loadEntryCount(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ENTRY_COUNT);
      return data ? parseInt(data, 10) || 0 : 0;
    } catch (error) {
      console.error('Error loading entry count:', error);
      return 0;
    }
  },

  // Save user plan
  async saveUserPlan(plan: 'free' | 'premium'): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PLAN, plan);
    } catch (error) {
      console.error('Error saving user plan:', error);
    }
  },

  // Load user plan
  async loadUserPlan(): Promise<'free' | 'premium'> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PLAN);
      return (data === 'premium' ? 'premium' : 'free');
    } catch (error) {
      console.error('Error loading user plan:', error);
      return 'free';
    }
  },

  // Save device info
  async saveDeviceInfo(info: any): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(info));
    } catch (error) {
      console.error('Error saving device info:', error);
    }
  },

  // Load device info
  async loadDeviceInfo(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_INFO);
      return data ? JSON.parse(data) : null;
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
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  },

  // Load preferences
  async loadPreferences(): Promise<Preferences | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading preferences:', error);
      return null;
    }
  },

  // Push notification tokens helpers
  async loadPushTokens(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKENS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error loading push tokens:', error);
      return [];
    }
  },

  async savePushTokens(tokens: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKENS, JSON.stringify(tokens));
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
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  },

  // Push broadcast history helpers
  async loadPushHistory(): Promise<PushBroadcastRecord[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_HISTORY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
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
    } catch (error) {
      console.error('Error incrementing push history clicks:', error);
    }
  },

  // Saved prompt helpers
  async loadSavedPrompts(): Promise<SavedPrompt[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PROMPTS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed)
        ? parsed.filter((item: SavedPrompt) => typeof item?.id === 'string' && typeof item?.text === 'string')
        : [];
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
    } catch (error) {
      console.error('Error adding saved prompt:', error);
    }
  },

  async removeSavedPrompt(id: string): Promise<void> {
    try {
      const existing = await this.loadSavedPrompts();
      const updated = existing.filter(prompt => prompt.id !== id);
      await this.saveSavedPrompts(updated);
    } catch (error) {
      console.error('Error removing saved prompt:', error);
    }
  },

  // Entry task reward helpers
  async loadEntryTasks(): Promise<EntryTasksStatus> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ENTRY_TASKS);
      if (!data) {
        return { customPlanCompleted: false, registrationCompleted: false };
      }
      const parsed = JSON.parse(data);
      return {
        customPlanCompleted: !!parsed.customPlanCompleted,
        registrationCompleted: !!parsed.registrationCompleted,
      };
    } catch (error) {
      console.error('Error loading entry tasks:', error);
      return { customPlanCompleted: false, registrationCompleted: false };
    }
  },

  async saveEntryTasks(status: EntryTasksStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ENTRY_TASKS, JSON.stringify(status));
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
      const data = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_CODES);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
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
      const codes = await this.loadReferralCodes();
      return codes.find(c => c.userId === userId) || null;
    } catch (error) {
      console.error('Error getting referral code:', error);
      return null;
    }
  },

  async getReferralCodeByCode(code: string): Promise<ReferralCode | null> {
    try {
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
      const data = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_REDEMPTIONS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
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
    } catch (error) {
      console.error('Error saving referral redemption:', error);
    }
  },

  async getReferralRedemptionsForUser(email: string, type: 'referrer' | 'referee'): Promise<ReferralRedemption[]> {
    try {
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
      const data = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_REWARDS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
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
    } catch (error) {
      console.error('Error saving referral reward:', error);
    }
  },

  async loadReferralRewardsForUser(userId: string): Promise<ReferralReward[]> {
    try {
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
      if (!accountInfo?.email) return;
      await processSyncQueue(accountInfo);

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
    } catch (error) {
      console.error('Error pushing cached data to Supabase:', error);
    }
  },
};



