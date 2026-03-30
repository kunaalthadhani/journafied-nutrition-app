/**
 * Calorie Bank Calculation Engine
 *
 * Pure functions — no side effects, no storage calls, fully deterministic.
 * Every number displayed in the app flows from these functions.
 */

import { CalorieBankConfig, DailySummary, ExtendedGoalData } from '../services/dataStorage';
import { format, addDays, differenceInDays, isBefore, isAfter, isSameDay, parseISO, startOfDay } from 'date-fns';

// ── Types ──

export interface CalorieBankDayData {
  date: string; // YYYY-MM-DD
  baseTarget: number;
  adjustedTarget: number;
  actual: number; // calories eaten
  banked: number; // capped amount saved
  spent: number; // capped amount over
  logged: boolean; // whether any entries exist
  isFuture: boolean;
  isToday: boolean;
  capHit: boolean; // whether banking cap was reached
  spendCapHit: boolean; // whether spending cap was reached
}

export interface CalorieBankCycle {
  cycleStartDate: string; // YYYY-MM-DD
  cycleEndDate: string; // YYYY-MM-DD
  baseDailyTarget: number;
  weeklyBudget: number;
  daysInCycle: number; // 7, or fewer for first partial cycle
  perDayData: CalorieBankDayData[];
  bankBalance: number; // running total of banked minus spent
  remainingBudget: number; // weeklyBudget minus all actual eaten so far
  remainingDays: number; // days from today to end (inclusive of today)
  weeklyActual: number; // total eaten so far this cycle
  adjustedTodayTarget: number;
  todayMacros: { protein: number; carbs: number; fat: number };
  goalType: 'lose' | 'gain' | 'maintain';
}

// ── Cycle Boundary Helpers ──

/**
 * Find the most recent occurrence of `cycleStartDay` on or before `referenceDate`.
 * cycleStartDay: 0=Sunday, 1=Monday, ..., 6=Saturday
 */
export function getCycleStartDate(cycleStartDay: number, referenceDate: Date): Date {
  const ref = startOfDay(referenceDate);
  const refDow = ref.getDay(); // 0=Sun..6=Sat
  let daysBack = refDow - cycleStartDay;
  if (daysBack < 0) daysBack += 7;
  return addDays(ref, -daysBack);
}

/**
 * Get the cycle end date (start + 6 days).
 */
export function getCycleEndDate(cycleStartDate: Date): Date {
  return addDays(cycleStartDate, 6);
}

// ── Core Calculation ──

/**
 * Calculate the full state of the current calorie bank cycle.
 *
 * This is the single source of truth. Called on every render that
 * needs banking data. It derives everything from:
 *   - config (user settings)
 *   - summariesByDate (actual intake data)
 *   - goals (base daily target + macros)
 *   - now (current date/time)
 */
export function calculateCurrentCycle(
  config: CalorieBankConfig,
  summariesByDate: Record<string, DailySummary>,
  goals: ExtendedGoalData,
  now: Date = new Date(),
): CalorieBankCycle {
  const today = startOfDay(now);
  const todayStr = format(today, 'yyyy-MM-dd');
  const goalType = goals.goal || 'lose';
  const baseDailyTarget = goals.calories || 2000;

  // Determine cycle boundaries
  const rawCycleStart = getCycleStartDate(config.cycleStartDay, today);
  const enabledDate = startOfDay(parseISO(config.enabledDate));

  // If banking was enabled after the cycle start, use enabledDate as effective start
  const effectiveCycleStart = isAfter(enabledDate, rawCycleStart) ? enabledDate : rawCycleStart;
  const cycleEnd = getCycleEndDate(rawCycleStart); // always 7-day aligned

  const cycleStartStr = format(effectiveCycleStart, 'yyyy-MM-dd');
  const cycleEndStr = format(cycleEnd, 'yyyy-MM-dd');
  const daysInCycle = differenceInDays(cycleEnd, effectiveCycleStart) + 1;

  const dailyCap = baseDailyTarget * (config.dailyCapPercent / 100);
  const spendingCap = baseDailyTarget * (config.spendingCapPercent / 100);

  // Gender-aware floor: 1,500 for men, 1,200 for women, whichever is higher vs 70% of base
  const genderFloor = goals.gender === 'female' ? 1200 : 1500;
  const targetFloor = Math.max(baseDailyTarget * 0.70, genderFloor);
  const targetCeiling = baseDailyTarget + spendingCap; // never above base + spending cap

  // ── Pass 1: Calculate banked/spent per day (up to today) ──

  const perDayData: CalorieBankDayData[] = [];
  let totalBanked = 0;
  let totalSpent = 0;
  let weeklyActual = 0;

  for (let i = 0; i < daysInCycle; i++) {
    const dayDate = addDays(effectiveCycleStart, i);
    const dayStr = format(dayDate, 'yyyy-MM-dd');
    const isToday = isSameDay(dayDate, today);
    const isFuture = isAfter(dayDate, today);
    const summary = summariesByDate[dayStr];
    const logged = !!summary && (summary.entryCount > 0 || summary.totalCalories > 0);

    let actual = 0;
    let banked = 0;
    let spent = 0;
    let capHit = false;
    let spendCapHit = false;

    if (isFuture || isToday) {
      // Future day or today (still in progress) — use actual logged so far, but no banking/spending
      actual = isToday ? (summary?.totalCalories || 0) : 0;
    } else if (!logged) {
      // Past day with no logs — assume they ate base target (no banking, no penalty)
      actual = baseDailyTarget;
    } else {
      // Past logged day
      actual = summary?.totalCalories || 0;
    }

    // Only calculate banking/spending for PAST completed days (not today, not future)
    if (!isFuture && !isToday) {
      const difference = baseDailyTarget - actual;

      if (goalType === 'lose' || goalType === 'maintain') {
        if (difference > 0) {
          // Ate less than target — bank the difference (capped)
          banked = Math.min(difference, dailyCap);
          capHit = difference > dailyCap;
        } else if (difference < 0) {
          // Ate more than target — spend from bank (capped)
          spent = Math.min(Math.abs(difference), spendingCap);
          spendCapHit = Math.abs(difference) > spendingCap;
        }
      } else {
        // Gain goal — logic flips
        if (difference > 0) {
          // Ate less than target — this is "spending" for gain (missed surplus)
          spent = Math.min(difference, spendingCap);
          spendCapHit = difference > spendingCap;
        } else if (difference < 0) {
          // Ate more than target — this is "banking" for gain (extra surplus)
          banked = Math.min(Math.abs(difference), dailyCap);
          capHit = Math.abs(difference) > dailyCap;
        }
      }

      totalBanked += banked;
      totalSpent += spent;
    }

    // Track weekly actual for all non-future days (including today)
    if (!isFuture) {
      weeklyActual += actual;
    }

    perDayData.push({
      date: dayStr,
      baseTarget: baseDailyTarget,
      adjustedTarget: baseDailyTarget, // will be recalculated in pass 2
      actual,
      banked,
      spent,
      logged,
      isFuture,
      isToday,
      capHit,
      spendCapHit,
    });
  }

  // ── Bank balance (for display) ──
  let bankBalance = totalBanked - totalSpent;
  if (bankBalance < 0) bankBalance = 0;

  // ── Weekly budget position ──
  // For UPWARD adjustments (ate less → future targets increase): use CAPPED bank balance
  // For DOWNWARD adjustments (ate more → future targets decrease): use REAL overspend
  const pastDays = perDayData.filter(d => !d.isFuture && !d.isToday);
  const pastDaysExpected = pastDays.length * baseDailyTarget;
  const pastDaysActual = pastDays.reduce((sum, d) => sum + d.actual, 0);
  const rawOverspend = pastDaysActual - pastDaysExpected; // positive = overate total

  // ── Pass 2: Calculate adjusted targets (redistribution) ──
  const remainingDays = perDayData.filter(d => d.isFuture || d.isToday).length;

  let adjustmentPerDay = 0;
  if (remainingDays > 0) {
    if (goalType === 'lose' || goalType === 'maintain') {
      if (rawOverspend > 0) {
        // Overate overall → reduce future days by the FULL overspend (not capped)
        adjustmentPerDay = -rawOverspend / remainingDays;
      } else {
        // Underate overall → increase future days by CAPPED bank balance only
        adjustmentPerDay = bankBalance / remainingDays;
      }
    } else {
      // Gain goal: logic flips
      if (rawOverspend < 0) {
        // Underate overall (bad for gain) → reduce future days
        adjustmentPerDay = rawOverspend / remainingDays; // rawOverspend is negative, so this reduces
      } else {
        // Overate overall (good for gain = banked surplus) → increase flexibility
        adjustmentPerDay = -bankBalance / remainingDays;
      }
    }
  }

  for (const day of perDayData) {
    if (day.isFuture || day.isToday) {
      let adjusted = baseDailyTarget + adjustmentPerDay;
      adjusted = Math.min(adjusted, targetCeiling);
      adjusted = Math.max(adjusted, targetFloor);
      day.adjustedTarget = Math.round(adjusted);
    } else {
      // Past days keep their base target for display
      day.adjustedTarget = baseDailyTarget;
    }
  }

  // ── Today's adjusted target and macros ──

  const todayData = perDayData.find(d => d.isToday);
  const adjustedTodayTarget = todayData?.adjustedTarget || baseDailyTarget;

  const macroRatio = adjustedTodayTarget / (baseDailyTarget || 1);
  const todayMacros = {
    protein: Math.round((goals.proteinGrams || 0) * macroRatio),
    carbs: Math.round((goals.carbsGrams || 0) * macroRatio),
    fat: Math.round((goals.fatGrams || 0) * macroRatio),
  };

  // ── Remaining budget ──

  const weeklyBudget = baseDailyTarget * daysInCycle;
  const remainingBudget = weeklyBudget - weeklyActual;

  return {
    cycleStartDate: cycleStartStr,
    cycleEndDate: cycleEndStr,
    baseDailyTarget,
    weeklyBudget,
    daysInCycle,
    perDayData,
    bankBalance,
    remainingBudget: Math.max(0, remainingBudget),
    remainingDays,
    weeklyActual,
    adjustedTodayTarget,
    todayMacros,
    goalType,
  };
}

// ── Helpers for display ──

/**
 * Get the day name abbreviation for a cycle start day number.
 */
export function getDayName(day: number): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day] || 'Mon';
}

/**
 * Get the full day name for a cycle start day number.
 */
export function getFullDayName(day: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] || 'Monday';
}

/**
 * Calculate bank utilization from a completed cycle's per-day data.
 * Utilization = (total spent / total banked) × 100
 * If nothing was banked, utilization is 0.
 */
export function calculateBankUtilization(perDayData: CalorieBankDayData[]): number {
  const totalBanked = perDayData.reduce((sum, d) => sum + d.banked, 0);
  const totalSpent = perDayData.reduce((sum, d) => sum + d.spent, 0);
  if (totalBanked === 0) return 0;
  return Math.min(100, Math.round((totalSpent / totalBanked) * 100));
}

/**
 * Build a completed cycle record from the current cycle data (for archiving at reset).
 */
export function buildCompletedCycleRecord(
  cycle: CalorieBankCycle,
): {
  startDate: string;
  endDate: string;
  weeklyBudget: number;
  weeklyActual: number;
  bankUtilization: number;
  expiredCalories: number;
  daysLogged: number;
  daysInCycle: number;
  peakBankBalance: number;
  capHitDays: number;
  spendCapHitDays: number;
  goalType: 'lose' | 'gain' | 'maintain';
} {
  const utilization = calculateBankUtilization(cycle.perDayData);
  const totalBanked = cycle.perDayData.reduce((sum, d) => sum + d.banked, 0);
  const totalSpent = cycle.perDayData.reduce((sum, d) => sum + d.spent, 0);
  const expired = Math.max(0, totalBanked - totalSpent);

  // Calculate peak bank balance across the cycle
  let runningBalance = 0;
  let peak = 0;
  for (const day of cycle.perDayData) {
    runningBalance += day.banked - day.spent;
    if (runningBalance < 0) runningBalance = 0;
    if (runningBalance > peak) peak = runningBalance;
  }

  return {
    startDate: cycle.cycleStartDate,
    endDate: cycle.cycleEndDate,
    weeklyBudget: cycle.weeklyBudget,
    weeklyActual: cycle.weeklyActual,
    bankUtilization: utilization,
    expiredCalories: expired,
    daysLogged: cycle.perDayData.filter(d => d.logged && !d.isFuture).length,
    daysInCycle: cycle.daysInCycle,
    peakBankBalance: Math.round(peak),
    capHitDays: cycle.perDayData.filter(d => d.capHit).length,
    spendCapHitDays: cycle.perDayData.filter(d => d.spendCapHit).length,
    goalType: cycle.goalType,
  };
}
