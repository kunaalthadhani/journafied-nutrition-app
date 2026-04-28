/**
 * Progressive Insight Unlock Engine
 *
 * Pure functions — no side effects, no storage calls.
 * Given user data stats, returns which insights are unlocked.
 */

export type InsightId =
  // Nutrition Analysis
  | 'goal-adherence'
  | 'macro-split'
  | 'calorie-trend'
  | 'meal-timing'
  | 'top-foods'
  | 'weekly-pattern'
  | 'nutrition-balance'
  | 'ai-weekly-insight'
  // Weight Tracker
  | 'bmi'
  | 'logging-consistency'
  | 'weight-fluctuation'
  | 'goal-progress'
  | 'weekly-rate'
  | 'estimated-goal-date'
  | 'weight-vs-calories'
  | 'monthly-comparison'
  | 'deficit-surplus-ai'
  | 'milestones-records';

export type InsightScreen = 'nutrition' | 'weight';

export interface InsightDefinition {
  id: InsightId;
  name: string;
  description: string; // one-liner for the announcement card
  screen: InsightScreen;
  icon: string; // Feather icon name
  requirementText: string; // shown on locked placeholder
  check: (stats: InsightStats) => boolean;
}

export interface InsightStats {
  loggedDays: number; // days with at least 1 food entry
  uniqueFoods: number;
  weightEntries: number;
  weightEntrySpanDays: number; // days between first and last weight entry
  hasTargetWeight: boolean;
  hasHeight: boolean;
  calorieAndWeightDays: number; // days with both calorie + weight data
  monthsWithWeightData: number; // distinct months that have weight entries
}

export interface InsightUnlockRecord {
  unlockedAt: string; // ISO date
  seenAt?: string; // ISO date — set when user dismisses the announcement
}

export type InsightUnlocks = Record<string, InsightUnlockRecord>;

// ── Definitions ──

export const INSIGHT_DEFINITIONS: InsightDefinition[] = [
  // Nutrition Analysis — ordered by unlock progression
  {
    id: 'goal-adherence',
    name: 'Goal Adherence',
    description: 'See how your daily intake compares to your targets',
    screen: 'nutrition',
    icon: 'target',
    requirementText: 'Log 2 days to unlock',
    check: (s) => s.loggedDays >= 2,
  },
  {
    id: 'macro-split',
    name: 'Macro Split',
    description: 'Your average protein, carbs, and fat breakdown',
    screen: 'nutrition',
    icon: 'pie-chart',
    requirementText: 'Log 2 days to unlock',
    check: (s) => s.loggedDays >= 2,
  },
  {
    id: 'calorie-trend',
    name: 'Calorie Trend',
    description: 'Track how your daily intake changes over time',
    screen: 'nutrition',
    icon: 'trending-up',
    requirementText: 'Log 3 days to unlock',
    check: (s) => s.loggedDays >= 3,
  },
  {
    id: 'meal-timing',
    name: 'Meal Timing',
    description: 'Discover when you eat most of your calories',
    screen: 'nutrition',
    icon: 'clock',
    requirementText: 'Log 3 days to unlock',
    check: (s) => s.loggedDays >= 3,
  },
  {
    id: 'top-foods',
    name: 'Top Foods',
    description: 'Your most frequently logged foods ranked',
    screen: 'nutrition',
    icon: 'award',
    requirementText: 'Log 4 days to unlock',
    check: (s) => s.loggedDays >= 4,
  },
  {
    id: 'weekly-pattern',
    name: 'Weekly Pattern',
    description: 'See which days of the week you eat more or less',
    screen: 'nutrition',
    icon: 'bar-chart-2',
    requirementText: 'Log 5 days to unlock',
    check: (s) => s.loggedDays >= 5,
  },
  {
    id: 'nutrition-balance',
    name: 'Nutrition Balance',
    description: 'A radar view of how balanced your diet is',
    screen: 'nutrition',
    icon: 'compass',
    requirementText: 'Log 5 days to unlock',
    check: (s) => s.loggedDays >= 5,
  },
  {
    id: 'ai-weekly-insight',
    name: 'AI Weekly Insight',
    description: 'Personalized AI review of your nutrition week',
    screen: 'nutrition',
    icon: 'cpu',
    requirementText: 'Log 7 days to unlock',
    check: (s) => s.loggedDays >= 7,
  },

  // Weight Tracker — ordered by unlock progression
  {
    id: 'logging-consistency',
    name: 'Logging Consistency',
    description: 'Track how consistently you log your weight',
    screen: 'weight',
    icon: 'check-circle',
    requirementText: 'Log 1 weight entry to unlock',
    check: (s) => s.weightEntries >= 1,
  },
  {
    id: 'bmi',
    name: 'Body Mass Index',
    description: 'Your BMI calculated from your height and weight',
    screen: 'weight',
    icon: 'activity',
    requirementText: 'Log 1 weight entry and set your height',
    check: (s) => s.weightEntries >= 1 && s.hasHeight,
  },
  {
    id: 'weight-fluctuation',
    name: 'Weight Fluctuation',
    description: 'See how much your weight varies day to day',
    screen: 'weight',
    icon: 'git-branch',
    requirementText: 'Log 3 weight entries to unlock',
    check: (s) => s.weightEntries >= 3,
  },
  {
    id: 'goal-progress',
    name: 'Goal Progress',
    description: 'Track how close you are to your target weight',
    screen: 'weight',
    icon: 'flag',
    requirementText: 'Log 3 weight entries and set a target weight',
    check: (s) => s.weightEntries >= 3 && s.hasTargetWeight,
  },
  {
    id: 'weekly-rate',
    name: 'Weekly Rate of Change',
    description: 'How fast you are losing or gaining per week',
    screen: 'weight',
    icon: 'zap',
    requirementText: 'Log 5 weight entries over 2+ weeks',
    check: (s) => s.weightEntries >= 5 && s.weightEntrySpanDays >= 14,
  },
  {
    id: 'weight-vs-calories',
    name: 'Weight vs Calories',
    description: 'See the relationship between what you eat and the scale',
    screen: 'weight',
    icon: 'layers',
    requirementText: 'Log 5 days with both weight and food data',
    check: (s) => s.calorieAndWeightDays >= 5,
  },
  {
    id: 'estimated-goal-date',
    name: 'Estimated Goal Date',
    description: 'When you will reach your target at your current pace',
    screen: 'weight',
    icon: 'calendar',
    requirementText: 'Log 7 weight entries over 3+ weeks',
    check: (s) => s.weightEntries >= 7 && s.weightEntrySpanDays >= 21,
  },
  {
    id: 'monthly-comparison',
    name: 'Monthly Comparison',
    description: 'Compare your progress this month vs last month',
    screen: 'weight',
    icon: 'columns',
    requirementText: 'Log weight in 2 different months',
    check: (s) => s.monthsWithWeightData >= 2,
  },
  {
    id: 'deficit-surplus-ai',
    name: 'Deficit & Surplus Impact',
    description: 'AI analysis of how your eating affects your weight',
    screen: 'weight',
    icon: 'cpu',
    requirementText: 'Log 7 days with both weight and food data',
    check: (s) => s.calorieAndWeightDays >= 7,
  },
  {
    id: 'milestones-records',
    name: 'Milestones & Records',
    description: 'Your weight records and achievements over time',
    screen: 'weight',
    icon: 'award',
    requirementText: 'Log 10 weight entries to unlock',
    check: (s) => s.weightEntries >= 10,
  },
];

// ── Pure check function ──

/**
 * Given current data stats, return the list of insight IDs that should be unlocked.
 */
export function getUnlockedInsightIds(stats: InsightStats): InsightId[] {
  return INSIGHT_DEFINITIONS
    .filter((def) => def.check(stats))
    .map((def) => def.id);
}

/**
 * Given current stats and previously stored unlocks, find NEW unlocks.
 * Returns definitions of insights that just became unlocked.
 */
export function getNewlyUnlockedInsights(
  stats: InsightStats,
  existingUnlocks: InsightUnlocks,
): InsightDefinition[] {
  const shouldBeUnlocked = getUnlockedInsightIds(stats);
  return shouldBeUnlocked
    .filter((id) => !existingUnlocks[id])
    .map((id) => INSIGHT_DEFINITIONS.find((d) => d.id === id)!)
    .filter(Boolean);
}

/**
 * Get the first unseen unlock (for the Home announcement card).
 * Returns null if all unlocks have been seen.
 */
export function getFirstUnseenUnlock(
  unlocks: InsightUnlocks,
): { id: InsightId; definition: InsightDefinition } | null {
  for (const def of INSIGHT_DEFINITIONS) {
    const record = unlocks[def.id];
    if (record && !record.seenAt) {
      return { id: def.id, definition: def };
    }
  }
  return null;
}

/**
 * Check if a specific insight is unlocked.
 */
export function isInsightUnlocked(id: InsightId, unlocks: InsightUnlocks): boolean {
  return !!unlocks[id];
}

/**
 * Get the definition for a specific insight.
 */
export function getInsightDefinition(id: InsightId): InsightDefinition | undefined {
  return INSIGHT_DEFINITIONS.find((d) => d.id === id);
}
