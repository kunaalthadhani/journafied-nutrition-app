import AsyncStorage from '@react-native-async-storage/async-storage';
import { Meal } from '../components/FoodLogSection';

const STORAGE_KEYS = {
  GOALS: '@trackkal:goals',
  MEALS: '@trackkal:meals',
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
};



