import { differenceInCalendarDays, parseISO, format, subDays } from 'date-fns';
import { Meal } from '../components/FoodLogSection';

/**
 * Calculates the current streak of consecutive days with logged meals.
 * 
 * @param mealsByDate - Record of meals indexed by date key 'YYYY-MM-DD'
 * @returns number - The current streak count
 */
export const calculateStreak = (
    mealsByDate: Record<string, Meal[]>,
    frozenDates: string[] = [] // New param: dates where freeze was applied
): number => {
    const datesWithMeals = Object.entries(mealsByDate)
        .filter(([_, meals]) => meals.length > 0)
        .map(([dateKey]) => dateKey);

    // Combine real logs and frozen dates
    const activeDates = new Set([...datesWithMeals, ...frozenDates]);

    if (activeDates.size === 0) return 0;

    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    // Check if the streak is active (logged or frozen today or yesterday)
    // We walk backwards from today.
    let streak = 0;
    let checkDate = today;

    // Special logic: If today is NOT logged/frozen, but yesterday IS, 
    // the streak is still "active" (valued at X), but strictly speaking
    // you haven't incremented it for today yet.
    // Standard streak logic: 
    // If today is present -> streak includes today.
    // If today is missing but yesterday is present -> streak includes yesterday (and is 1+).
    // If neither -> streak broken (0).

    if (!activeDates.has(today) && !activeDates.has(yesterday)) {
        return 0;
    }

    // Start counting
    // If today is missing, start checking from yesterday
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
