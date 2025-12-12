import { differenceInCalendarDays, parseISO, format, subDays } from 'date-fns';
import { Meal } from '../components/FoodLogSection';

/**
 * Calculates the current streak of consecutive days with logged meals.
 * 
 * @param mealsByDate - Record of meals indexed by date key 'YYYY-MM-DD'
 * @returns number - The current streak count
 */
export const calculateStreak = (mealsByDate: Record<string, Meal[]>): number => {
    const datesWithMeals = Object.entries(mealsByDate)
        .filter(([_, meals]) => meals.length > 0)
        .map(([dateKey]) => dateKey)
        .sort((a, b) => b.localeCompare(a)); // Descending order (newest first)

    if (datesWithMeals.length === 0) return 0;

    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    let streak = 0;
    let currentDate = today;

    // Check if the streak is active (logged today or yesterday)
    // If the latest log is older than yesterday, the streak is broken (0).
    const lastLogDate = datesWithMeals[0];
    if (lastLogDate !== today && lastLogDate !== yesterday) {
        return 0;
    }

    // If we haven't logged today yet, we start counting from yesterday to see the "active" streak carried over
    // BUT, usually UI shows "current streak". 
    // - If I logged yesterday (streak 1) and not today: Streak is 1 X (pending today).
    // - If I logged today: Streak is 2.
    // The sorting ensures we just walk back.

    // Implementation: We verify continuity from "today" backwards.
    // If "today" is missing, we temporarily pretend it's there to check continuity from yesterday? 
    // No, simpler: Find the anchor. 

    let checkDate = datesWithMeals.includes(today) ? today : yesterday;

    // If even yesterday is not in the list (handled by the lastLogDate check above), we wouldn't be here.

    // Now iterate backwards
    while (true) {
        if (datesWithMeals.includes(checkDate)) {
            streak++;
            checkDate = format(subDays(parseISO(checkDate), 1), 'yyyy-MM-dd');
        } else {
            break;
        }
    }

    return streak;
};
