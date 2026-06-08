/**
 * Calorie Bank Service
 *
 * Handles cycle reset detection, archival, and mid-cycle operations.
 * Called on app open, midnight crossing, and when banking is toggled.
 */

import { dataStorage, CalorieBankConfig, CalorieBankCompletedCycle, DailySummary, ExtendedGoalData } from './dataStorage';
import {
  getCycleStartDate,
  calculateCompletedCycle,
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

  const enabledDate = startOfDay(parseISO(config.enabledDate));
  const enabledCycleStart = getCycleStartDate(config.cycleStartDay, enabledDate);

  // Still inside the first cycle — nothing has completed yet.
  if (!isBefore(enabledCycleStart, currentCycleStart)) {
    return { config, didReset: false };
  }

  const completedCycles = await dataStorage.loadCompletedCycles();
  const archived = new Set(completedCycles.map((c) => c.startDate));

  // Archive every cycle that completed since the bank was enabled, not just the
  // most recent one — this catches cycles the app was closed through. Each cycle
  // is settled across all its days; the live engine never settles today, which
  // would otherwise drop the final day of every archived cycle.
  let didReset = false;
  for (
    let cursor = enabledCycleStart;
    isBefore(cursor, currentCycleStart);
    cursor = addDays(cursor, 7)
  ) {
    const cycle = calculateCompletedCycle(config, summariesByDate, goals, cursor);
    if (archived.has(cycle.cycleStartDate)) continue;
    await dataStorage.saveCompletedCycle(
      buildCompletedCycleRecord(cycle) as CalorieBankCompletedCycle,
    );
    archived.add(cycle.cycleStartDate);
    didReset = true;
  }

  return { config, didReset };
}

/**
 * Enable calorie banking. Re-enabling preserves the user's saved cycle start day
 * and caps; only a brand-new config falls back to the defaults. Either way the
 * cycle starts fresh from today, since the bank was off until now.
 */
export async function enableCalorieBank(
  cycleStartDay: CalorieBankConfig['cycleStartDay'] = 1, // default Monday
  dailyCapPercent: CalorieBankConfig['dailyCapPercent'] = 20,
  spendingCapPercent: CalorieBankConfig['spendingCapPercent'] = 20,
): Promise<CalorieBankConfig> {
  const existing = await dataStorage.loadCalorieBankConfig();
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const config: CalorieBankConfig = existing
    ? { ...existing, enabled: true, enabledDate: today }
    : { enabled: true, cycleStartDay, dailyCapPercent, spendingCapPercent, enabledDate: today };
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
