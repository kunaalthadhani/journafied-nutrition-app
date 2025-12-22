
// Utility functions for Advanced Analytics Calculations

import { Meal } from '../components/FoodLogSection';
import { eachDayOfInterval, format, getDay, isSameDay, startOfDay, subDays } from 'date-fns';

export interface TrendInsight {
    type: 'CALORIES' | 'PROTEIN' | 'WEIGHT';
    direction: 'UP' | 'DOWN' | 'STABLE';
    message: string;
    comparison: string; // e.g., "vs last week"
}

export interface MacroPattern {
    dayType: 'WEEKDAY' | 'WEEKEND';
    nutrient: 'Proteins' | 'Carbs' | 'Fats';
    level: 'HIGH' | 'LOW' | 'BALANCED';
    insight: string;
}

export interface ConsistencyData {
    date: string; // ISO
    status: 'LOGGED' | 'PARTIAL' | 'MISSED';
    score: number; // 0-1
}

// Helper to calculate trends (7 days vs previous 7 days)
export function calculateTrends(
    meals: Record<string, Meal[]>,
    goals: any
): TrendInsight[] {
    const insights: TrendInsight[] = [];
    const today = new Date();

    // Get last 7 days vs previous 7 days
    const currentWeek: number[] = [];
    const previousWeek: number[] = [];

    // Calories Trend
    for (let i = 0; i < 7; i++) {
        const d = subDays(today, i);
        const dateKey = format(d, 'yyyy-MM-dd');
        const dayMeals = meals[dateKey] || [];
        const cals = dayMeals.reduce((acc, m) => {
            const mealCals = m.foods.reduce((sum, f) => sum + f.calories, 0);
            return acc + mealCals;
        }, 0);
        if (dayMeals.length > 0) currentWeek.push(cals);
    }

    for (let i = 7; i < 14; i++) {
        const d = subDays(today, i);
        const dateKey = format(d, 'yyyy-MM-dd');
        const dayMeals = meals[dateKey] || [];
        const cals = dayMeals.reduce((acc, m) => {
            const mealCals = m.foods.reduce((sum, f) => sum + f.calories, 0);
            return acc + mealCals;
        }, 0);
        if (dayMeals.length > 0) previousWeek.push(cals);
    }

    const avgCurrent = currentWeek.length ? currentWeek.reduce((a, b) => a + b, 0) / currentWeek.length : 0;
    const avgPrev = previousWeek.length ? previousWeek.reduce((a, b) => a + b, 0) / previousWeek.length : 0;

    if (avgCurrent > 0 && avgPrev > 0) {
        const diff = avgCurrent - avgPrev;
        const percentChange = (diff / avgPrev) * 100;

        // Determine direction
        let direction: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
        if (percentChange > 5) direction = 'UP';
        if (percentChange < -5) direction = 'DOWN';

        // Construct message based on goal
        const target = goals.calories || 2000;
        let message = "Calorie intake is stabilizing.";

        if (direction === 'UP' && avgCurrent > target + 200) {
            message = "Calories trending slightly above target.";
        } else if (direction === 'DOWN' && avgCurrent < target - 200) {
            message = "Calorie intake is decreasing vs last week.";
        } else if (Math.abs(avgCurrent - target) < 150) {
            message = "You're consistently hitting your calorie target.";
            direction = 'STABLE';
        }

        insights.push({
            type: 'CALORIES',
            direction,
            message,
            comparison: 'vs last 7 days'
        });
    }

    return insights;
}

// Helper for Heatmap Data (Status per day for last 30 days)
export function calculateHeatmapData(meals: Record<string, Meal[]>): ConsistencyData[] {
    const result: ConsistencyData[] = [];
    const today = new Date();

    // Last 30 days
    const days = eachDayOfInterval({
        start: subDays(today, 29),
        end: today
    });

    days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayMeals = meals[dateKey] || [];
        const cals = dayMeals.reduce((acc, m) => {
            const mealCals = m.foods.reduce((sum, f) => sum + f.calories, 0);
            return acc + mealCals;
        }, 0);

        let status: 'LOGGED' | 'PARTIAL' | 'MISSED' = 'MISSED';
        let score = 0;

        if (dayMeals.length >= 3 && cals > 1200) {
            status = 'LOGGED';
            score = 1;
        } else if (dayMeals.length > 0) {
            status = 'PARTIAL';
            score = 0.5;
        }

        result.push({
            date: dateKey,
            status,
            score
        });
    });

    return result;
}

// Helper for Macro Patterns (Weekday vs Weekend)
export function calculateMacroPatterns(meals: Record<string, Meal[]>): MacroPattern[] {
    const patterns: MacroPattern[] = [];
    const weekdayProtein: number[] = [];
    const weekendProtein: number[] = [];

    // Analyze last 30 days
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const d = subDays(today, i);
        const dateKey = format(d, 'yyyy-MM-dd');
        const dayMeals = meals[dateKey] || [];
        if (dayMeals.length === 0) continue;

        const protein = dayMeals.reduce((acc, m) => {
            const mealProtein = m.foods.reduce((sum, f) => sum + (f.protein || 0), 0);
            return acc + mealProtein;
        }, 0);
        const dayOfWeek = getDay(d); // 0 = Sun, 6 = Sat

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            weekendProtein.push(protein);
        } else {
            weekdayProtein.push(protein);
        }
    }

    const avgWeekdayP = weekdayProtein.length ? weekdayProtein.reduce((a, b) => a + b, 0) / weekdayProtein.length : 0;
    const avgWeekendP = weekendProtein.length ? weekendProtein.reduce((a, b) => a + b, 0) / weekendProtein.length : 0;

    if (avgWeekdayP > 0 && avgWeekendP > 0) {
        if (avgWeekendP < avgWeekdayP * 0.85) {
            patterns.push({
                dayType: 'WEEKEND',
                nutrient: 'Proteins',
                level: 'LOW',
                insight: "Protein intake tends to drop on weekends."
            });
        }
        else if (avgWeekendP > avgWeekdayP * 1.15) {
            patterns.push({
                dayType: 'WEEKEND',
                nutrient: 'Proteins',
                level: 'HIGH',
                insight: "You eat more protein on weekends vs weekdays."
            });
        }
    }

    return patterns;
}
