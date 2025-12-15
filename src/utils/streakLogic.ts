import { format, subDays } from 'date-fns';
import { MealEntry, StreakFreezeData, ExtendedGoalData, dataStorage } from '../services/dataStorage';

/**
 * Checks for missed days in the recent past that would break a streak,
 * and automatically applies a streak freeze if available.
 */
export const checkMissedDaysAndFreeze = async (
    meals: Record<string, MealEntry[]>,
    freezeData: StreakFreezeData | null,
    goals: ExtendedGoalData | null
): Promise<StreakFreezeData | null> => {
    if (!freezeData) return null;

    // If no freezes left, we can't do anything
    if (freezeData.freezesAvailable <= 0) return freezeData;

    const yesterday = subDays(new Date(), 1);
    const yesterdayKey = format(yesterday, 'yyyy-MM-dd');

    let updatedFreeze = { ...freezeData };
    let changed = false;

    // Check Yesterday:
    // If user has NO meals logged for yesterday
    // AND yesterday is NOT already in the "usedOnDates" list
    // => Consume 1 freeze token
    const hasMealsYesterday = meals[yesterdayKey] && meals[yesterdayKey].length > 0;
    const isYesterdayFrozen = updatedFreeze.usedOnDates.includes(yesterdayKey);

    if (!hasMealsYesterday && !isYesterdayFrozen) {
        if (updatedFreeze.freezesAvailable > 0) {
            console.log(`[StreakLogic] Auto-freezing missed day: ${yesterdayKey}`);
            updatedFreeze.freezesAvailable -= 1;
            updatedFreeze.usedOnDates = [...updatedFreeze.usedOnDates, yesterdayKey];
            changed = true;
        }
    }

    // We could potentially check further back (e.g. day before yesterday) if we wanted recursive protection,
    // but standard logic usually just protects the immediate break or requires manual intervention.
    // We'll stick to "Yesterday Protection" for now.

    if (changed) {
        await dataStorage.saveStreakFreeze(updatedFreeze);
    }

    return updatedFreeze;
};
