export interface CalorieData {
  food: number;
  exercise: number;
  remaining: number;
  target: number;
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