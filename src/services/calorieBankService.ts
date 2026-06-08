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

  // A cycle just rolled over, so promote any pending cap change to active. The
  // completed cycles above were archived with the cap that was in force for them
  // (the old active cap), which is correct.
  if (didReset && (config.pendingDailyCapPercent !== undefined || config.pendingSpendingCapPercent !== undefined)) {
    const promoted: CalorieBankConfig = {
      ...config,
      dailyCapPercent: config.pendingDailyCapPercent ?? config.dailyCapPercent,
      spendingCapPercent: config.pendingSpendingCapPercent ?? config.spendingCapPercent,
    };
    delete promoted.pendingDailyCapPercent;
    delete promoted.pendingSpendingCapPercent;
    await dataStorage.saveCalorieBankConfig(promoted);
    return { config: promoted, didReset };
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
 * Update calorie bank settings. Cap changes are staged as pending and apply from
 * the next cycle (never rewriting the current week). A cycle start day change
 * restructures the cycle immediately; the caller should archive the in-progress
 * week first via archiveInProgressCycle.
 */
export async function updateCalorieBankSettings(
  updates: Partial<Pick<CalorieBankConfig, 'cycleStartDay' | 'dailyCapPercent' | 'spendingCapPercent'>>,
): Promise<CalorieBankConfig | null> {
  const config = await dataStorage.loadCalorieBankConfig();
  if (!config) return null;

  const updated: CalorieBankConfig = { ...config };

  // Cap changes never rewrite a day that already settled. If the current cycle has
  // no completed days yet (just enabled, or today is the start day), apply now;
  // otherwise stage as pending so it takes effect at the next rollover.
  const today = startOfDay(new Date());
  const cycleStart = getCycleStartDate(config.cycleStartDay, today);
  const enabledDate = startOfDay(parseISO(config.enabledDate));
  const effectiveStart = isBefore(cycleStart, enabledDate) ? enabledDate : cycleStart;
  const hasCompletedDays = isBefore(effectiveStart, today);

  if (updates.dailyCapPercent !== undefined) {
    if (hasCompletedDays) {
      updated.pendingDailyCapPercent = updates.dailyCapPercent;
    } else {
      updated.dailyCapPercent = updates.dailyCapPercent;
      delete updated.pendingDailyCapPercent;
    }
  }
  if (updates.spendingCapPercent !== undefined) {
    if (hasCompletedDays) {
      updated.pendingSpendingCapPercent = updates.spendingCapPercent;
    } else {
      updated.spendingCapPercent = updates.spendingCapPercent;
      delete updated.pendingSpendingCapPercent;
    }
  }

  // A cycle start day change restructures the cycle now, starting fresh from
  // today. Since there are no past days in the new cycle to rewrite, any pending
  // cap can take effect immediately rather than waiting for a rollover.
  if (updates.cycleStartDay !== undefined && updates.cycleStartDay !== config.cycleStartDay) {
    updated.cycleStartDay = updates.cycleStartDay;
    updated.enabledDate = format(startOfDay(new Date()), 'yyyy-MM-dd');
    if (updated.pendingDailyCapPercent !== undefined) {
      updated.dailyCapPercent = updated.pendingDailyCapPercent;
      delete updated.pendingDailyCapPercent;
    }
    if (updated.pendingSpendingCapPercent !== undefined) {
      updated.spendingCapPercent = updated.pendingSpendingCapPercent;
      delete updated.pendingSpendingCapPercent;
    }
  }

  await dataStorage.saveCalorieBankConfig(updated);
  return updated;
}

/**
 * Archive the in-progress cycle's completed days (through yesterday) before the
 * cycle is restructured by a start day change, so that week's banking is not
 * lost. Today is live and is not settled.
 */
export async function archiveInProgressCycle(
  summariesByDate: Record<string, DailySummary>,
  goals: ExtendedGoalData,
  now: Date = new Date(),
): Promise<void> {
  const config = await dataStorage.loadCalorieBankConfig();
  if (!config || !config.enabled) return;

  const today = startOfDay(now);
  const currentCycleStart = getCycleStartDate(config.cycleStartDay, today);
  const cycle = calculateCompletedCycle(config, summariesByDate, goals, currentCycleStart, addDays(today, -1));
  if (cycle.daysInCycle <= 0) return; // no completed days yet this cycle

  const completed = await dataStorage.loadCompletedCycles();
  if (completed.some((c) => c.startDate === cycle.cycleStartDate)) return;
  await dataStorage.saveCompletedCycle(buildCompletedCycleRecord(cycle) as CalorieBankCompletedCycle);
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
