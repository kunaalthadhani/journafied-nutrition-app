import AsyncStorage from '@react-native-async-storage/async-storage';
import { Meal } from '../components/FoodLogSection';

const STORAGE_KEYS = {
  GOALS: '@journafied:goals',
  MEALS: '@journafied:meals',
  WEIGHT_ENTRIES: '@journafied:weightEntries',
  ENTRY_COUNT: '@journafied:entryCount',
  USER_PLAN: '@journafied:userPlan',
  DEVICE_INFO: '@journafied:deviceInfo',
  ACCOUNT_INFO: '@journafied:accountInfo',
  PREFERENCES: '@journafied:preferences',
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
}

export interface AccountInfo {
  name?: string;
  email?: string;
  passwordHash?: string; // Should be hashed, not plain text
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
      await AsyncStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(mealsByDate));
    } catch (error) {
      console.error('Error saving meals:', error);
    }
  },

  // Load meals
  async loadMeals(): Promise<Record<string, Meal[]>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.MEALS);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error loading meals:', error);
      return {};
    }
  },

  // Save weight entries
  async saveWeightEntries(entries: Array<{ date: Date; weight: number }>): Promise<void> {
    try {
      // Convert dates to ISO strings for storage
      const serialized = entries.map(e => ({
        date: e.date.toISOString(),
        weight: e.weight
      }));
      await AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(serialized));
    } catch (error) {
      console.error('Error saving weight entries:', error);
    }
  },

  // Load weight entries
  async loadWeightEntries(): Promise<Array<{ date: Date; weight: number }>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_ENTRIES);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.map((e: WeightEntry) => ({
        date: new Date(e.date),
        weight: e.weight
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
    } catch (error) {
      console.error('Error saving account info:', error);
    }
  },

  // Load account info
  async loadAccountInfo(): Promise<AccountInfo | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT_INFO);
      return data ? JSON.parse(data) : null;
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
};

