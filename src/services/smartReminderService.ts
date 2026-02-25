import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subDays } from 'date-fns';
import {
  dataStorage,
  MealEntry,
  ExtendedGoalData,
  SmartReminderPreferences,
  MealTimingPattern,
  ReminderPatternCache,
  ScheduledReminder,
  isUserPremium,
} from './dataStorage';
import { generateId } from '../utils/uuid';
import { analyticsService } from './analyticsService';

const STORAGE_KEYS = {
  CACHE: '@trackkal:smartReminderCache',
  LOG: '@trackkal:smartReminderLog',
  EFFECTIVENESS: '@trackkal:smartReminderEffectiveness',
};

const DEFAULT_PREFERENCES: SmartReminderPreferences = {
  enabled: true,
  smartRemindersEnabled: true,
  mealSlots: { breakfast: true, lunch: true, dinner: true },
  endOfDaySummary: true,
  quietHoursStart: 22,
  quietHoursEnd: 7,
};

const GENERIC_MESSAGES: Record<string, { title: string; body: string }> = {
  breakfast: { title: 'Good morning!', body: "Don't forget to log your breakfast!" },
  lunch: { title: 'Lunchtime!', body: 'Time to log your lunch!' },
  dinner: { title: 'Dinner time!', body: "Don't forget to log your dinner!" },
};

// ---- Helpers ----

function classifyMealSlot(hour: number): MealTimingPattern['mealSlot'] {
  if (hour >= 5 && hour <= 10) return 'breakfast';
  if (hour >= 11 && hour <= 14) return 'lunch';
  if (hour >= 15 && hour <= 20) return 'dinner';
  return 'snack';
}

function getLoggedSlotsToday(todayMeals: MealEntry[]): Set<string> {
  const slots = new Set<string>();
  for (const meal of todayMeals) {
    if (meal.timestamp) {
      const hour = new Date(meal.timestamp).getHours();
      slots.add(classifyMealSlot(hour));
    }
  }
  return slots;
}

function formatTimeAmPm(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

function isWithinQuietHours(hour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart <= quietEnd) {
    return hour >= quietStart || hour < quietEnd;
  }
  // Wraps midnight (e.g., 22:00 - 07:00)
  return hour >= quietStart || hour < quietEnd;
}

// ---- Pattern Analysis ----

async function computeMealTimingPatterns(lookbackDays = 14): Promise<ReminderPatternCache> {
  const today = new Date();
  const slots: Record<string, number[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  let totalProtein = 0;
  let totalCalories = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let daysWithData = 0;

  const summaries = await dataStorage.loadDailySummaries();

  for (let i = 1; i <= lookbackDays; i++) {
    const date = subDays(today, i);
    const dateKey = format(date, 'yyyy-MM-dd');

    let meals: MealEntry[];
    try {
      meals = await dataStorage.getDailyLog(dateKey);
    } catch {
      continue;
    }

    if (meals.length === 0) continue;
    daysWithData++;

    for (const meal of meals) {
      if (!meal.timestamp) continue;
      const mealDate = new Date(meal.timestamp);
      const minutesSinceMidnight = mealDate.getHours() * 60 + mealDate.getMinutes();
      const slot = classifyMealSlot(mealDate.getHours());
      slots[slot].push(minutesSinceMidnight);
    }

    const daySummary = summaries[dateKey];
    if (daySummary) {
      totalCalories += daySummary.totalCalories;
      totalProtein += daySummary.totalProtein;
      totalCarbs += daySummary.totalCarbs;
      totalFat += daySummary.totalFat;
    }
  }

  const mealTimings: MealTimingPattern[] = Object.entries(slots)
    .filter(([_, times]) => times.length >= 3)
    .map(([slot, times]) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((sum, t) => sum + (t - avg) ** 2, 0) / times.length;
      const stdDev = Math.sqrt(variance);

      return {
        mealSlot: slot as MealTimingPattern['mealSlot'],
        averageHour: Math.floor(avg / 60),
        averageMinute: Math.round(avg % 60),
        stdDevMinutes: Math.round(stdDev),
        sampleSize: times.length,
      };
    });

  const cache: ReminderPatternCache = {
    computedAt: new Date().toISOString(),
    mealTimings,
    averageDailyProtein: daysWithData > 0 ? Math.round(totalProtein / daysWithData) : 0,
    averageDailyCalories: daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0,
    averageDailyCarbs: daysWithData > 0 ? Math.round(totalCarbs / daysWithData) : 0,
    averageDailyFat: daysWithData > 0 ? Math.round(totalFat / daysWithData) : 0,
    typicalMealCount: daysWithData > 0
      ? Math.round(Object.values(slots).reduce((s, arr) => s + arr.length, 0) / daysWithData)
      : 0,
  };

  await AsyncStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(cache));
  return cache;
}

// ---- Content Generation ----

function generateReminderContent(params: {
  mealSlot: string;
  pattern?: MealTimingPattern;
  isPremium: boolean;
}): { title: string; body: string } {
  if (!params.isPremium || !params.pattern) {
    return GENERIC_MESSAGES[params.mealSlot] || GENERIC_MESSAGES.lunch;
  }

  const timeStr = formatTimeAmPm(params.pattern.averageHour, params.pattern.averageMinute);
  const slotName = params.mealSlot.charAt(0).toUpperCase() + params.mealSlot.slice(1);

  if (params.pattern.stdDevMinutes < 30) {
    return {
      title: `${slotName} time?`,
      body: `You usually eat ${params.mealSlot} around ${timeStr}. Everything ok?`,
    };
  }

  return {
    title: `${slotName} time?`,
    body: `Around this time you often have ${params.mealSlot}. Don't forget to log it!`,
  };
}

function generateMacroPacingContent(params: {
  currentProtein: number;
  currentCalories: number;
  goals: ExtendedGoalData;
}): { title: string; body: string } | null {
  const { currentProtein, currentCalories, goals } = params;
  const proteinTarget = goals.proteinGrams || 0;
  const calorieTarget = goals.calories || 0;

  if (proteinTarget <= 0 && calorieTarget <= 0) return null;

  const proteinRemaining = proteinTarget - currentProtein;
  const proteinRatio = proteinTarget > 0 ? proteinRemaining / proteinTarget : 0;

  // Protein deficit: more than 60% remaining after 3 PM
  if (proteinRatio > 0.6 && proteinTarget > 0) {
    return {
      title: 'Protein check',
      body: `You're at ${Math.round(currentProtein)}g protein with dinner left. Maybe something protein-heavy tonight?`,
    };
  }

  // Over 80% of calories consumed with meals remaining
  const calorieRatio = calorieTarget > 0 ? currentCalories / calorieTarget : 0;
  if (calorieRatio > 0.8 && calorieTarget > 0) {
    const remaining = Math.round(calorieTarget - currentCalories);
    return {
      title: 'Calorie heads up',
      body: `You've used ${Math.round(calorieRatio * 100)}% of your daily calories. ${remaining} cal left for the rest of the day.`,
    };
  }

  return null;
}

function generateEndOfDaySummary(params: {
  currentCalories: number;
  goals: ExtendedGoalData;
  isPremium: boolean;
}): { title: string; body: string } {
  if (!params.isPremium || params.goals.calories <= 0) {
    return {
      title: 'End of day',
      body: 'Have you logged all your meals today?',
    };
  }

  const remaining = Math.round(params.goals.calories - params.currentCalories);
  if (remaining > 0) {
    return {
      title: 'Daily wrap-up',
      body: `You've logged ${Math.round(params.currentCalories).toLocaleString()} of ${params.goals.calories.toLocaleString()} cal today. ${remaining} cal remaining.`,
    };
  }

  return {
    title: 'Daily wrap-up',
    body: `You've hit your ${params.goals.calories.toLocaleString()} cal target for today. Nice work!`,
  };
}

// ---- Scheduling ----

async function cancelAllSmartReminders(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LOG);
    if (!raw) return;

    const reminders: ScheduledReminder[] = JSON.parse(raw);
    for (const reminder of reminders) {
      try {
        await Notifications.cancelScheduledNotificationAsync(reminder.id);
      } catch {
        // Notification may have already fired or been dismissed
      }
    }

    await AsyncStorage.removeItem(STORAGE_KEYS.LOG);
  } catch (err) {
    console.error('[smartReminder] Failed to cancel reminders:', err);
  }
}

async function scheduleLocalNotification(params: {
  id: string;
  title: string;
  body: string;
  triggerDate: Date;
  data: Record<string, unknown>;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: params.id,
    content: {
      title: params.title,
      body: params.body,
      sound: 'default',
      data: params.data,
    },
    trigger: params.triggerDate as any,
  });
}

// ---- Effectiveness Tracking ----

interface EffectivenessRecord {
  reminderId: string;
  firedAt: string;
  wasOpened: boolean;
  mealLoggedWithin30Min: boolean;
}

async function loadEffectivenessRecords(): Promise<EffectivenessRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.EFFECTIVENESS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveEffectivenessRecords(records: EffectivenessRecord[]): Promise<void> {
  // Keep last 100 records to avoid unbounded growth
  const trimmed = records.slice(-100);
  await AsyncStorage.setItem(STORAGE_KEYS.EFFECTIVENESS, JSON.stringify(trimmed));
}

// ---- Public API ----

export const smartReminderService = {
  /**
   * Main entry point. Call on every app open / foreground.
   * Cancels old reminders, analyzes patterns, schedules fresh notifications.
   */
  async scheduleAllReminders(): Promise<ScheduledReminder[]> {
    try {
      // Self-contained premium check (no closure dependency)
      const plan = await dataStorage.loadUserPlan();
      const accountInfo = await dataStorage.getAccountInfo();
      const isPremium = isUserPremium(plan, accountInfo?.premiumUntil);

      // Load preferences
      const prefs = await dataStorage.loadPreferences();
      const reminderPrefs = prefs?.smartReminderPreferences ?? DEFAULT_PREFERENCES;

      if (!reminderPrefs.enabled || !prefs?.notificationsEnabled) {
        await cancelAllSmartReminders();
        return [];
      }

      // Cancel previous batch
      await cancelAllSmartReminders();

      // Load / compute pattern cache
      let cache: ReminderPatternCache;
      try {
        cache = await computeMealTimingPatterns(14);
      } catch {
        cache = {
          computedAt: new Date().toISOString(),
          mealTimings: [],
          averageDailyProtein: 0,
          averageDailyCalories: 0,
          averageDailyCarbs: 0,
          averageDailyFat: 0,
          typicalMealCount: 0,
        };
      }

      // Load today's data
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      const todayMeals = await dataStorage.getDailyLog(todayKey);
      const loggedSlots = getLoggedSlotsToday(todayMeals);
      const goals = await dataStorage.loadGoals();

      // Calculate today's macro totals
      let currentCalories = 0;
      let currentProtein = 0;
      for (const meal of todayMeals) {
        for (const food of meal.foods) {
          currentCalories += food.calories || 0;
          currentProtein += food.protein || 0;
        }
      }

      const now = new Date();
      const scheduled: ScheduledReminder[] = [];
      const patternMap = new Map(cache.mealTimings.map(p => [p.mealSlot, p]));

      // --- Meal slot reminders ---
      const mealSlots = ['breakfast', 'lunch', 'dinner'] as const;

      for (const slot of mealSlots) {
        if (!reminderPrefs.mealSlots[slot]) continue;
        if (loggedSlots.has(slot)) continue;

        let scheduleHour: number;
        let scheduleMinute: number;
        let content: { title: string; body: string };
        let reminderIsPremium = false;

        const pattern = patternMap.get(slot);

        if (isPremium && reminderPrefs.smartRemindersEnabled && pattern && pattern.stdDevMinutes < 60) {
          // Premium: schedule 10 min before detected average
          let totalMinutes = pattern.averageHour * 60 + pattern.averageMinute - 10;
          if (totalMinutes < 0) totalMinutes = 0;
          scheduleHour = Math.floor(totalMinutes / 60);
          scheduleMinute = totalMinutes % 60;
          content = generateReminderContent({ mealSlot: slot, pattern, isPremium: true });
          reminderIsPremium = true;
        } else {
          // Free / fallback: use configured fixed time
          const mealReminderConfig = prefs?.mealReminders?.[slot];
          scheduleHour = mealReminderConfig?.hour ?? (slot === 'breakfast' ? 8 : slot === 'lunch' ? 12 : 18);
          scheduleMinute = mealReminderConfig?.minute ?? (slot === 'lunch' ? 30 : 0);
          content = generateReminderContent({ mealSlot: slot, isPremium: false });
        }

        // Skip if in quiet hours
        if (isWithinQuietHours(scheduleHour, reminderPrefs.quietHoursStart, reminderPrefs.quietHoursEnd)) continue;

        // Build trigger date
        const triggerDate = new Date();
        triggerDate.setHours(scheduleHour, scheduleMinute, 0, 0);
        if (triggerDate <= now) continue; // Skip if in the past

        const reminderId = `smart_${slot}_${generateId()}`;

        await scheduleLocalNotification({
          id: reminderId,
          title: content.title,
          body: content.body,
          triggerDate,
          data: { type: 'smart_reminder', reminderId, mealSlot: slot },
        });

        scheduled.push({
          id: reminderId,
          type: reminderIsPremium ? 'meal_timing' : 'generic_meal',
          mealSlot: slot,
          scheduledFor: triggerDate.toISOString(),
          title: content.title,
          body: content.body,
          isPremium: reminderIsPremium,
          createdAt: now.toISOString(),
        });
      }

      // --- Macro pacing nudge (premium, 3:30 PM) ---
      if (isPremium && reminderPrefs.smartRemindersEnabled && goals) {
        const macroTrigger = new Date();
        macroTrigger.setHours(15, 30, 0, 0);

        if (macroTrigger > now && !isWithinQuietHours(15, reminderPrefs.quietHoursStart, reminderPrefs.quietHoursEnd)) {
          const macroContent = generateMacroPacingContent({ currentProtein, currentCalories, goals });

          if (macroContent) {
            const macroId = `smart_macro_${generateId()}`;

            await scheduleLocalNotification({
              id: macroId,
              title: macroContent.title,
              body: macroContent.body,
              triggerDate: macroTrigger,
              data: { type: 'smart_reminder', reminderId: macroId, mealSlot: 'macro_pacing' },
            });

            scheduled.push({
              id: macroId,
              type: 'macro_pacing',
              scheduledFor: macroTrigger.toISOString(),
              title: macroContent.title,
              body: macroContent.body,
              isPremium: true,
              createdAt: now.toISOString(),
            });
          }
        }
      }

      // --- End of day summary (8:30 PM) ---
      if (reminderPrefs.endOfDaySummary && goals) {
        const eodTrigger = new Date();
        eodTrigger.setHours(20, 30, 0, 0);

        if (eodTrigger > now && !isWithinQuietHours(20, reminderPrefs.quietHoursStart, reminderPrefs.quietHoursEnd)) {
          const eodContent = generateEndOfDaySummary({ currentCalories, goals, isPremium });
          const eodId = `smart_eod_${generateId()}`;

          await scheduleLocalNotification({
            id: eodId,
            title: eodContent.title,
            body: eodContent.body,
            triggerDate: eodTrigger,
            data: { type: 'smart_reminder', reminderId: eodId, mealSlot: 'end_of_day' },
          });

          scheduled.push({
            id: eodId,
            type: 'end_of_day',
            scheduledFor: eodTrigger.toISOString(),
            title: eodContent.title,
            body: eodContent.body,
            isPremium,
            createdAt: now.toISOString(),
          });
        }
      }

      // Save scheduled log for effectiveness tracking
      await AsyncStorage.setItem(STORAGE_KEYS.LOG, JSON.stringify(scheduled));

      // Track analytics
      if (scheduled.length > 0) {
        analyticsService.trackSmartReminderScheduled(scheduled.length).catch(() => {});
      }

      if (__DEV__) {
        console.log(`[smartReminder] Scheduled ${scheduled.length} reminders (premium=${isPremium})`);
      }

      return scheduled;
    } catch (err) {
      console.error('[smartReminder] scheduleAllReminders failed:', err);
      return [];
    }
  },

  /**
   * Record that user tapped a smart reminder notification.
   */
  async recordReminderOpened(reminderId: string): Promise<void> {
    try {
      const records = await loadEffectivenessRecords();
      const existing = records.find(r => r.reminderId === reminderId);

      if (existing) {
        existing.wasOpened = true;
      } else {
        records.push({
          reminderId,
          firedAt: new Date().toISOString(),
          wasOpened: true,
          mealLoggedWithin30Min: false,
        });
      }

      await saveEffectivenessRecords(records);
      analyticsService.trackSmartReminderOpened().catch(() => {});
    } catch (err) {
      console.error('[smartReminder] recordReminderOpened failed:', err);
    }
  },

  /**
   * Check if a meal was logged within 30 min of any recent reminder.
   * Call this after every meal save.
   */
  async checkMealLoggedAfterReminder(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.LOG);
      if (!raw) return;

      const reminders: ScheduledReminder[] = JSON.parse(raw);
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      const records = await loadEffectivenessRecords();

      for (const reminder of reminders) {
        const scheduledTime = new Date(reminder.scheduledFor).getTime();

        // Reminder should have fired and meal logged within 30 min
        if (scheduledTime <= now && (now - scheduledTime) <= thirtyMinutes) {
          const existing = records.find(r => r.reminderId === reminder.id);
          if (existing) {
            existing.mealLoggedWithin30Min = true;
          } else {
            records.push({
              reminderId: reminder.id,
              firedAt: reminder.scheduledFor,
              wasOpened: false,
              mealLoggedWithin30Min: true,
            });
          }
        }
      }

      await saveEffectivenessRecords(records);

      // Track effectiveness for any newly marked records
      const effective = records.filter(r => r.mealLoggedWithin30Min);
      if (effective.length > 0) {
        analyticsService.trackSmartReminderEffective().catch(() => {});
      }
    } catch (err) {
      console.error('[smartReminder] checkMealLoggedAfterReminder failed:', err);
    }
  },
};
