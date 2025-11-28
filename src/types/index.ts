export interface CalorieData {
  food: number;
  exercise: number;
  remaining: number;
  target: number;
}

export interface AppUser {
  id: string;
  authUserId?: string;
  email?: string;
  displayName?: string;
  phoneNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupabaseFoodLog {
  id?: string;
  user_id: string;
  prompt: string;
  parsed_payload: Record<string, unknown> | null;
  logged_date: string;
  total_calories?: number | null;
  total_protein?: number | null;
  total_carbs?: number | null;
  total_fat?: number | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface SupabaseWeightEntry {
  id?: string;
  user_id: string;
  logged_date: string;
  weight_kg?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface MacroData {
  carbs: {
    current: number;
    target: number;
    unit: string;
  };
  protein: {
    current: number;
    target: number;
    unit: string;
  };
  fat: {
    current: number;
    target: number;
    unit: string;
  };
}

export interface DayData {
  date: Date;
  dayName: string;
  dayNumber: number;
  isActive: boolean;
}

export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  timestamp: Date;
}

export interface ExerciseEntry {
  id: string;
  name: string;
  caloriesBurned: number;
  duration: number; // in minutes
  timestamp: Date;
}