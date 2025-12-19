import { Insight, UserMetricsSnapshot } from './dataStorage';
import { generateId } from '../utils/uuid';
import { isWeekend } from 'date-fns';

export const generateInsights = (snapshot: UserMetricsSnapshot, existingInsights: Insight[] = []): Insight[] => {
    if (!snapshot.recentDailySummaries || snapshot.recentDailySummaries.length === 0) {
        return [];
    }

    const { userGoals, averages7Day, weakNutrients, weightTrend, consistencyScore } = snapshot;
    const insights: Insight[] = [];
    const today = new Date().toISOString().split('T')[0];

    // RULE 1: Protein < Target for 5 of last 7 days (Warning)
    const lowProteinDays = snapshot.recentDailySummaries.filter(
        (s) => s.totalProtein < userGoals.protein * 0.85
    ).length;

    if (lowProteinDays >= 5) {
        insights.push({
            id: generateId(),
            date: today,
            type: 'warning',
            title: 'Protein Intake Low',
            description: `You've been under your protein target for ${lowProteinDays} of the last 7 days. Consistency matters for muscle maintenance.`,
            confidence: 0.9,
            relatedMetric: 'protein',
            isDismissed: false,
        });
    }

    // RULE 2: Calories > Goal on Weekends (Pattern)
    const weekendDays = snapshot.recentDailySummaries.filter((s) => {
        const d = new Date(s.date);
        return isWeekend(d) && s.totalCalories > userGoals.calories * 1.15;
    });

    if (weekendDays.length >= 2) {
        insights.push({
            id: generateId(),
            date: today,
            type: 'pattern',
            title: 'Weekend Calorie Spikes',
            description: 'Your calorie intake tends to exceed your goal significantly on weekends.',
            confidence: 0.85,
            relatedMetric: 'calories',
            isDismissed: false,
        });
    }

    // RULE 3: Fiber Consistently Low (Warning) - Based on Weak Nutrients detection + detailed scan
    // Note: generateUserMetricsSnapshot did not strictly implement Fiber check yet as we couldn't edit parsing logic easily.
    // But if 'fiber' is in weakNutrients (future proofing), we detect it.
    if (weakNutrients.includes('fiber')) {
        insights.push({
            id: generateId(),
            date: today,
            type: 'warning',
            title: 'Low Fiber Intake',
            description: 'Your recent food logs indicate consistently low fiber. Consider adding more vegetables or whole grains.',
            confidence: 0.8,
            relatedMetric: 'fiber',
            isDismissed: false,
        });
    }

    // RULE 4: Weight Plateau Despite Consistency (Pattern)
    if (
        consistencyScore > 80 && // High consistency
        weightTrend.periodDays >= 7 &&
        weightTrend.change !== null &&
        Math.abs(weightTrend.change) < 0.3 && // < 0.3kg change over period (plateau)
        userGoals.goalType === 'lose' // Only relevant if trying to lose
    ) {
        insights.push({
            id: generateId(),
            date: today,
            type: 'pattern',
            title: 'Weight Plateau',
            description: "You're hitting your calorie goals consistently, but your weight has stayed stable. It might be time to adjust your calorie target or activity level.",
            confidence: 0.85,
            relatedMetric: 'weight',
            isDismissed: false,
        });
    }

    // RULE 5: High Consistency Achievement
    if (consistencyScore > 90) {
        insights.push({
            id: generateId(),
            date: today,
            type: 'achievement',
            title: 'Rock Solid Consistency',
            description: 'You hit your calorie targets over 90% of the time this week. Great discipline!',
            confidence: 0.95,
            relatedMetric: 'calories',
            isDismissed: false,
        });
    }

    // --- DEDUPLICATION ---
    // Filter out if similar insight exists in past 7 days
    // We treat 'pastInsights' as all historical insights passed in
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // Get titles of insights generated/shown in last 7 days
    const recentTitles = new Set(
        existingInsights
            .filter(i => i.date >= sevenDaysAgoStr) // String comparison works for ISO YYYY-MM-DD
            .map(i => i.title)
    );

    let candidates = insights.filter(i => !recentTitles.has(i.title));

    // --- PRIORITIZATION ---
    // Warning > Pattern > Suggestion > Achievement
    const priorityMap: Record<string, number> = {
        'warning': 5,
        'pattern': 3,
        'suggestion': 2,
        'achievement': 1
    };

    candidates.sort((a, b) => {
        const pA = priorityMap[a.type] || 0;
        const pB = priorityMap[b.type] || 0;
        return pB - pA; // Descending
    });

    // Return limited list (max 2 per run to avoid spam)
    return candidates.slice(0, 2);
};

export interface ActionSuggestion {
    id: string;
    insightType: string; // matches Insight.title or generalized type
    shortLabel: string;
    description: string;
}

export const getActionForInsight = (insight: Insight): ActionSuggestion | null => {
    // Deterministic mapping based on Insight Title or Type

    // 1. Protein Low
    if (insight.title === 'Protein Intake Low') {
        return {
            id: 'action-protein-lunch',
            insightType: 'Protein Intake Low',
            shortLabel: 'Add Protein to Lunch',
            description: 'Try adding one extra serving of lean protein (chicken, tofu, greek yogurt) to your lunch today.'
        };
    }

    // 2. Weekend Spikes
    if (insight.title === 'Weekend Calorie Spikes') {
        return {
            id: 'action-weekend-plan',
            insightType: 'Weekend Calorie Spikes',
            shortLabel: 'Plan One Treat',
            description: 'Pick one meal to indulge in this weekend, but stick to your routine for the others to balance it out.'
        };
    }

    // 3. Low Fiber
    if (insight.title === 'Low Fiber Intake') {
        return {
            id: 'action-add-veg',
            insightType: 'Low Fiber Intake',
            shortLabel: 'Eat a Green Veggie',
            description: 'Add a side of broccoli, spinach, or green beans to your next dinner.'
        };
    }

    // 4. Weight Plateau
    if (insight.title === 'Weight Plateau') {
        return {
            id: 'action-walk',
            insightType: 'Weight Plateau',
            shortLabel: '15min Walk',
            description: 'Increase your daily activity slightly by adding a brisk 15-minute walk today.'
        };
    }

    // 5. Achievement (Consistency)
    if (insight.title === 'Rock Solid Consistency') {
        return {
            id: 'action-rest',
            insightType: 'Rock Solid Consistency',
            shortLabel: 'Enjoy a Rest Day',
            description: 'You’ve been disciplined. Take a moment to appreciate your effort, maybe stretch or meditate.'
        };
    }

    return null;
};
