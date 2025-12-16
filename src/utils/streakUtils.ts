import { differenceInCalendarDays, parseISO, format, subDays } from 'date-fns';
import { Meal } from '../components/FoodLogSection';
import { DailySummary } from '../services/dataStorage';

/**
 * Calculates the current streak of consecutive days with logged meals.
 * 
 * @param summariesByDate - Record of summaries indexed by date key 'YYYY-MM-DD'
 * @returns number - The current streak count
 */
export const calculateStreak = (
    summariesByDate: Record<string, DailySummary>,
    frozenDates: string[] = []
): number => {
    // Filter for days with actual entries
    const datesWithMeals = Object.entries(summariesByDate)
        .filter(([_, summary]) => summary.entryCount > 0)
        .map(([dateKey]) => dateKey);

    // Combine real logs and frozen dates
    const activeDates = new Set([...datesWithMeals, ...frozenDates]);

    if (activeDates.size === 0) return 0;

    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    // Check if the streak is active
    if (!activeDates.has(today) && !activeDates.has(yesterday)) {
        return 0;
    }

    let streak = 0;
    let checkDate = today;

    // Start counting from yesterday if today is missed
    if (!activeDates.has(today)) {
        checkDate = yesterday;
    }

    while (true) {
        if (activeDates.has(checkDate)) {
            streak++;
            checkDate = format(subDays(parseISO(checkDate), 1), 'yyyy-MM-dd');
        } else {
            break;
        }
    }

    return streak;
};
