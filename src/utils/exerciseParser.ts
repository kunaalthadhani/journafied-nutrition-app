export type ExerciseIntensity = 'low' | 'moderate' | 'high';

export interface ParsedExercise {
  id: string;
  name: string;
  duration_minutes: number;
  intensity: ExerciseIntensity | string;
  calories: number;
  notes?: string;
}

interface ExerciseTemplate {
  id: string;
  name: string;
  keywords: string[];
  caloriesPerMinute: number;
  defaultIntensity: ExerciseIntensity;
}

const EXERCISE_DATABASE: ExerciseTemplate[] = [
  {
    id: 'running',
    name: 'Running',
    keywords: ['run', 'running', 'jog', 'jogging', 'sprint', 'treadmill'],
    caloriesPerMinute: 11,
    defaultIntensity: 'high',
  },
  {
    id: 'walking',
    name: 'Walking',
    keywords: ['walk', 'walking', 'hike', 'hiking', 'steps'],
    caloriesPerMinute: 5,
    defaultIntensity: 'low',
  },
  {
    id: 'cycling',
    name: 'Cycling',
    keywords: ['cycle', 'cycling', 'bike', 'biking', 'peloton', 'spin'],
    caloriesPerMinute: 9,
    defaultIntensity: 'moderate',
  },
  {
    id: 'swimming',
    name: 'Swimming',
    keywords: ['swim', 'swimming', 'laps', 'pool'],
    caloriesPerMinute: 10,
    defaultIntensity: 'high',
  },
  {
    id: 'strength',
    name: 'Strength Training',
    keywords: ['lift', 'lifting', 'weights', 'strength', 'gym', 'deadlift', 'squat', 'bench'],
    caloriesPerMinute: 8,
    defaultIntensity: 'moderate',
  },
  {
    id: 'yoga',
    name: 'Yoga / Pilates',
    keywords: ['yoga', 'pilates', 'stretching', 'mobility'],
    caloriesPerMinute: 4,
    defaultIntensity: 'low',
  },
  {
    id: 'hiit',
    name: 'HIIT / Circuits',
    keywords: ['hiit', 'interval', 'circuit', 'bootcamp'],
    caloriesPerMinute: 12,
    defaultIntensity: 'high',
  },
  {
    id: 'row',
    name: 'Rowing',
    keywords: ['row', 'rowing', 'erg'],
    caloriesPerMinute: 9,
    defaultIntensity: 'moderate',
  },
];

const DURATION_PATTERNS = [
  { regex: /(\d+(?:\.\d+)?)\s*(?:minutes|min|mins)\b/i, multiplier: 1 },
  { regex: /(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr)\b/i, multiplier: 60 },
];

const INTENSITY_HINTS: Record<ExerciseIntensity, string[]> = {
  low: ['light', 'easy', 'casual', 'walk', 'yoga'],
  moderate: ['moderate', 'steady', 'tempo'],
  high: ['hard', 'intense', 'sprint', 'hiit', 'interval', 'fast'],
};

const SINGLE_ENTRY_SPLIT_REGEX = /,|(?:\band\b)/i;

const DEFAULT_DURATION_MINUTES = 30;

const INTENSITY_MULTIPLIER: Record<ExerciseIntensity, number> = {
  low: 0.75,
  moderate: 1,
  high: 1.3,
};

function detectTemplate(fragment: string): ExerciseTemplate | null {
  const normalized = fragment.toLowerCase();
  return (
    EXERCISE_DATABASE.find((exercise) =>
      exercise.keywords.some((keyword) => normalized.includes(keyword))
    ) || null
  );
}

function detectDurationMinutes(fragment: string): number {
  for (const pattern of DURATION_PATTERNS) {
    const match = fragment.match(pattern.regex);
    if (match) {
      return Math.max(5, parseFloat(match[1]) * pattern.multiplier);
    }
  }
  return DEFAULT_DURATION_MINUTES;
}

function detectIntensity(fragment: string, fallback: ExerciseIntensity): ExerciseIntensity {
  const normalized = fragment.toLowerCase();
  if (INTENSITY_HINTS.high.some((hint) => normalized.includes(hint))) {
    return 'high';
  }
  if (INTENSITY_HINTS.low.some((hint) => normalized.includes(hint))) {
    return 'low';
  }
  if (INTENSITY_HINTS.moderate.some((hint) => normalized.includes(hint))) {
    return 'moderate';
  }
  return fallback;
}

export function parseExerciseInput(input: string): ParsedExercise[] {
  if (!input?.trim()) return [];

  const fragments = input
    .split(SINGLE_ENTRY_SPLIT_REGEX)
    .map((fragment) => fragment.trim())
    .filter(Boolean);

  const parsed: ParsedExercise[] = [];

  fragments.forEach((fragment) => {
    const template = detectTemplate(fragment);
    if (!template) return;

    const duration = detectDurationMinutes(fragment);
    const intensity = detectIntensity(fragment, template.defaultIntensity);
    const calories = Math.round(template.caloriesPerMinute * duration * INTENSITY_MULTIPLIER[intensity]);

    parsed.push({
      id: `${template.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: template.name,
      duration_minutes: Math.round(duration),
      intensity,
      calories,
      notes: fragment,
    });
  });

  return parsed;
}

export function calculateExerciseCalories(exercises: ParsedExercise[]): number {
  return exercises.reduce((total, exercise) => total + (exercise.calories || 0), 0);
}

