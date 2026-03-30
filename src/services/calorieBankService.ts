/**
 * Calorie Bank Service
 *
 * Handles cycle reset detection, archival, and mid-cycle operations.
 * Called on app open, midnight crossing, and when banking is toggled.
 */

import { dataStorage, CalorieBankConfig, CalorieBankCompletedCycle, DailySummary, ExtendedGoalData } from './dataStorage';
import {
  getCycleStartDate,
  getCycleEndDate,
  calculateCurrentCycle,
  buildCompletedCycleRecord,
} from '../utils/calorieBankEngine';
import { format, addDays, isBefore, startOfDay, parseISO } from 'date-fns';

/**
 * Check if the current cycle has ended and needs to be archived + reset.
 *
 * Call this:
 *   - On app open
 *   - When app comes to foreground (AppState change)
 *   - At midnight crossing
 *
 * Returns the config (unchanged or freshly loaded) and whether a reset happened.
 */
export async function checkAndResetCycle(
  summariesByDate: Record<string, DailySummary>,
  goals: ExtendedGoalData,
  now: Date = new Date(),
): Promise<{ config: CalorieBankConfig | null; didReset: boolean }> {
  const config = await dataStorage.loadCalorieBankConfig();
  if (!config || !config.enabled) {
    return { config, didReset: false };
  }

  const today = startOfDay(now);
  const currentCycleStart = getCycleStartDate(config.cycleStartDay, today);
  const currentCycleStartStr = format(currentCycleStart, 'yyyy-MM-dd');

  // Check if there are any completed cycles that haven't been archived yet.
  // A cycle is "completed" if the current cycle start is AFTER the enabledDate's cycle start.
  // We only need to archive the most recent previous cycle (not arbitrary old ones).

  const enabledDate = startOfDay(parseISO(config.enabledDate));
  const enabledCycleStart = getCycleStartDate(config.cycleStartDay, enabledDate);

  // If the current cycle start is the same as or before the enabled cycle start,
  // there's nothing to archive (we're still in the first cycle).
  if (!isBefore(enabledCycleStart, currentCycleStart)) {
    return { config, didReset: false };
  }

  // Check if we already archived for the previous cycle.
  // The previous cycle started 7 days before the current cycle start.
  const previousCycleStart = addDays(currentCycleStart, -7);
  const previousCycleStartStr = format(previousCycleStart, 'yyyy-MM-dd');

  const completedCycles = await dataStorage.loadCompletedCycles();
  const alreadyArchived = completedCycles.some(
    (c) => c.startDate === previousCycleStartStr
  );

  if (alreadyArchived) {
    return { config, didReset: false };
  }

  // Archive the previous cycle.
  // Build the cycle data for the previous week using the engine.
  const previousCycleEnd = getCycleEndDate(previousCycleStart);
  const previousCycleEndStr = format(previousCycleEnd, 'yyyy-MM-dd');

  // Use the previous cycle's end date as "now" to get the full cycle calculation
  const previousCycle = calculateCurrentCycle(
    { ...config, enabledDate: config.enabledDate },
    summariesByDate,
    goals,
    previousCycleEnd,
  );

  const record = buildCompletedCycleRecord(previousCycle);

  await dataStorage.saveCompletedCycle(record as CalorieBankCompletedCycle);

  return { config, didReset: true };
}

/**
 * Enable calorie banking with default or provided settings.
 */
export async function enableCalorieBank(
  cycleStartDay: CalorieBankConfig['cycleStartDay'] = 1, // default Monday
  dailyCapPercent: CalorieBankConfig['dailyCapPercent'] = 20,
  spendingCapPercent: CalorieBankConfig['spendingCapPercent'] = 20,
): Promise<CalorieBankConfig> {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const config: CalorieBankConfig = {
    enabled: true,
    cycleStartDay,
    dailyCapPercent,
    spendingCapPercent,
    enabledDate: today,
    onboardingSeen: false,
  };
  await dataStorage.saveCalorieBankConfig(config);
  return config;
}

/**
 * Disable calorie banking. Preserves config but sets enabled=false.
 */
export async function disableCalorieBank(): Promise<void> {
  const config = await dataStorage.loadCalorieBankConfig();
  if (config) {
    await dataStorage.saveCalorieBankConfig({ ...config, enabled: false });
  }
}

/**
 * Update calorie bank settings (cap, cycle start day) without resetting the bank.
 * If cycleStartDay changes, that effectively resets the cycle boundaries.
 */
export async function updateCalorieBankSettings(
  updates: Partial<Pick<CalorieBankConfig, 'cycleStartDay' | 'dailyCapPercent' | 'spendingCapPercent'>>,
): Promise<CalorieBankConfig | null> {
  const config = await dataStorage.loadCalorieBankConfig();
  if (!config) return null;

  const updated: CalorieBankConfig = { ...config, ...updates };

  // If cycle start day changed, reset enabledDate to today (new cycle starts now)
  if (updates.cycleStartDay !== undefined && updates.cycleStartDay !== config.cycleStartDay) {
    updated.enabledDate = format(startOfDay(new Date()), 'yyyy-MM-dd');
  }

  await dataStorage.saveCalorieBankConfig(updated);
  return updated;
}

/**
 * Handle a manual plan change (user changed their calorie goals).
 * Resets the bank by updating enabledDate to today.
 * The engine will treat this as a new partial cycle.
 */
export async function handlePlanChange(): Promise<void> {
  const config = await dataStorage.loadCalorieBankConfig();
  if (!config || !config.enabled) return;

  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  await dataStorage.saveCalorieBankConfig({
    ...config,
    enabledDate: today,
  });
}

/**
 * Mark the onboarding as seen.
 */
export async function markOnboardingSeen(): Promise<void> {
  const config = await dataStorage.loadCalorieBankConfig();
  if (!config) return;
  await dataStorage.saveCalorieBankConfig({ ...config, onboardingSeen: true });
}
