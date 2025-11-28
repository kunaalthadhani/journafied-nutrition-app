import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { AccountInfo, MealSyncPayload, WeightEntry, WeightSyncPayload } from './dataStorage';
import { Meal } from '../components/FoodLogSection';
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

const sumNutrient = (foods: Meal['foods'], key: 'calories' | 'protein' | 'carbs' | 'fat') =>
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
  if (!accountInfo?.email) return null;

  const existing = await findExistingUser(accountInfo);

  if (existing) {
    const needsUpdate =
      (accountInfo.name && existing.display_name !== accountInfo.name) ||
      (accountInfo.phoneNumber && existing.phone_number !== accountInfo.phoneNumber) ||
      (accountInfo.supabaseUserId && existing.auth_user_id !== accountInfo.supabaseUserId);

    if (needsUpdate) {
      const { data: updated, error: updateError } = await supabase
        .from('app_users')
        .update({
          display_name: accountInfo.name ?? existing.display_name,
          phone_number: accountInfo.phoneNumber ?? existing.phone_number,
          auth_user_id: accountInfo.supabaseUserId ?? existing.auth_user_id,
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

  const { data, error } = await supabase
    .from('app_users')
    .insert({
      email: accountInfo.email.trim().toLowerCase(),
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

function mapFoodLogRowToMeals(records: SupabaseFoodLog[]): Record<string, Meal[]> {
  const grouped: Record<string, Meal[]> = {};

  records.forEach((record) => {
    const payload = (record.parsed_payload as Meal | null) ?? null;
    const meal: Meal = payload
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

function mealPayloadToRow(userId: string, payload: { meal: Meal; dateKey: string }): SupabaseFoodLog {
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
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.email || payloads.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const rows = payloads.map((payload) => mealPayloadToRow(user.id, payload));
    const { error } = await supabase.from('food_logs').upsert(rows, { onConflict: 'id' });
    if (error) {
      throw error;
    }
  },

  async deleteMeals(accountInfo: AccountInfo | null, mealIds: string[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.email || mealIds.length === 0) return;
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

  async fetchMeals(accountInfo: AccountInfo | null): Promise<Record<string, Meal[]>> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.email) return {};
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
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.email || payloads.length === 0) return;
    const user = await getOrCreateUser(accountInfo);
    if (!user) return;

    const rows = payloads.map((payload) => weightPayloadToRow(user.id, payload));
    const { error } = await supabase.from('weight_entries').upsert(rows, { onConflict: 'id' });
    if (error) {
      throw error;
    }
  },

  async deleteWeightEntries(accountInfo: AccountInfo | null, ids: string[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.email || ids.length === 0) return;
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
    if (!isSupabaseConfigured() || !supabase || !accountInfo?.email) return [];
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
};

