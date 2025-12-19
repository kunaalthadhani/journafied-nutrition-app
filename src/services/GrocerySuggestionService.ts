import { UserMetricsSnapshot, Insight } from './dataStorage';
import { ActionSuggestion } from './insightService';

export interface GroceryItem {
    name: string;
    category: "protein" | "fiber" | "carbs" | "fats" | "micronutrients";
    reason: string; // deterministic explanation key
    baseQuantity?: number; // Quantity for 1 week
    unit?: string;
    macros?: { p: number; c: number; f: number; kcal: number }; // Per TOTAL quantity, not per unit
}

export interface GrocerySuggestionResult {
    items: GroceryItem[];
    primaryFocus: string;
    summary: {
        weeklyTotal: { p: number; c: number; f: number; kcal: number };
        replacedJunkCalories: number;
        projectedWeightLossKg: number;
        maintenanceCalibration: number; // TDEE used
    };
}

// --- Mapping Tables ---

// 1. High-Quality Default Foods per Category
// These are used if we can't find a match in the user's common foods.
const DEFAULT_FOODS: Record<string, string[]> = {
    protein: ['Chicken Breast', 'Greek Yogurt', 'Tofu', 'Canned Tuna', 'Eggs', 'Lentils', 'Cottage Cheese'],
    fiber: ['Black Beans', 'Broccoli', 'Oats', 'Raspberries', 'Chia Seeds', 'Apples', 'Pear'],
    carbs: ['Sweet Potato', 'Brown Rice', 'Quinoa', 'Banana', 'Whole Grain Bread'],
    fats: ['Avocado', 'Almonds', 'Olive Oil', 'Walnuts', 'Peanut Butter'],
    micronutrients: ['Spinach', 'Kale', 'Bell Peppers', 'Carrots', 'Blueberries']
};

// 2. Insight Title -> Nutrient Gap Mapping
// Maps specific insight titles (from insightService) to a nutrient category to focus on.
const INSIGHT_TO_NUTRIENT: Record<string, GroceryItem['category']> = {
    'Protein Intake Low': 'protein',
    'Low Protein Warning': 'protein',
    'Protein Drop-off': 'protein',
    'Fiber Intake Low': 'fiber',
    'Low Fiber': 'fiber',
    'Weekend Overeating': 'fiber', // Satiety focus
    'Weekend Calorie Spikes': 'fiber', // Satiety focus
    'High Calorie Days': 'fiber', // Satiety focus for volume
    'Carb Overload': 'protein', // Balance
    'Fat Fatigue': 'carbs' // Energy balance - assuming high fat implies low carb potential or need for better energy source
};

// 3. User Weakness -> Nutrient Gap Mapping
// Maps strings found in UserMetricsSnapshot.weakNutrients
const WEAKNESS_TO_NUTRIENT: Record<string, GroceryItem['category']> = {
    'protein': 'protein',
    'fiber': 'fiber',
    'carbs': 'carbs',
    'fats': 'fats',
    'vitamins': 'micronutrients',
    'iron': 'micronutrients',
    'calcium': 'micronutrients'
};

// --- Helper Functions ---

/**
 * Checks if a user's common food matches a target category.
 * This is a simplistic check based on string inclusion or known items.
 * In a real app, this would query a food database.
 * For now, we perform basic heuristic checks.
 */
function getCategoryForFood(name: string): GroceryItem['category'] | null {
    const n = name.toLowerCase();
    // Protein
    if (n.includes('chicken') || n.includes('beef') || n.includes('egg') || n.includes('tofu') || n.includes('yogurt') || n.includes('tuna') || n.includes('fish') || n.includes('salmon') || n.includes('steak') || n.includes('pork') || n.includes('turkey') || n.includes('shrimp') || n.includes('protein') || n.includes('seitan') || n.includes('whey') || n.includes('meat') || n.includes('burger') || n.includes('cod') || n.includes('tilapia')) return 'protein';

    // Fiber (Fruits/Veg)
    if (n.includes('bean') || n.includes('lentil') || n.includes('oat') || n.includes('chia') || n.includes('flax') || n.includes('apple') || n.includes('berry') || n.includes('broccoli') || n.includes('vegetable') || n.includes('salad') || n.includes('spinach') || n.includes('kale') || n.includes('fruit') || n.includes('pear') || n.includes('orange') || n.includes('melon')) return 'fiber';

    // Carbs
    if (n.includes('rice') || n.includes('potato') || n.includes('bread') || n.includes('pasta') || n.includes('quinoa') || n.includes('cereal') || n.includes('banana') || n.includes('toast') || n.includes('oatmeal') || n.includes('bagel') || n.includes('tortilla') || n.includes('corn') || n.includes('wrap')) return 'carbs';

    // Fats
    if (n.includes('avocado') || n.includes('nut') || n.includes('oil') || n.includes('butter') || n.includes('cheese') || n.includes('seed') || n.includes('feta') || n.includes('mozzarella') || n.includes('coconut')) return 'fats';

    // Micro (Greens often double as fiber, but specific micro-dense ones)
    if (n.includes('spinach') || n.includes('kale') || n.includes('pepper') || n.includes('carrot') || n.includes('veg') || n.includes('mushroom') || n.includes('tomato') || n.includes('cucumber')) return 'micronutrients';

    return null;
}

// --- 4. Quantity Estimation Heuristics ---
// Added average macros (per unit specified) for defaults
const QUANTITY_DEFAULTS: Record<GroceryItem['category'], { q: number, u: string, kcal: number, p: number, c: number, f: number }> = {
    'protein': { q: 1, u: 'kg', kcal: 1650, p: 310, c: 0, f: 36 }, // 1kg chicken breast
    'fiber': { q: 500, u: 'g', kcal: 170, p: 14, c: 33, f: 2 }, // 500g broccoli
    'carbs': { q: 500, u: 'g', kcal: 650, p: 13, c: 140, f: 2 }, // 500g cooked rice approx
    'fats': { q: 1, u: 'pack', kcal: 1200, p: 40, c: 40, f: 106 }, // 200g nuts
    'micronutrients': { q: 300, u: 'g', kcal: 70, p: 9, c: 11, f: 1 } // 300g spinach
};

// Specific overrides for common items
const ITEM_QUANTITY_OVERRIDES: Record<string, { q: number, u: string, kcal: number, p: number, c: number, f: number }> = {
    'eggs': { q: 12, u: 'count', kcal: 840, p: 72, c: 0, f: 60 },
    'avocado': { q: 3, u: 'count', kcal: 720, p: 9, c: 39, f: 66 },
    'banana': { q: 1, u: 'bunch', kcal: 600, p: 6, c: 140, f: 2 },
    'apple': { q: 6, u: 'count', kcal: 570, p: 3, c: 150, f: 1 },
    'olive oil': { q: 1, u: 'bottle', kcal: 2000, p: 0, c: 0, f: 220 }, // Partial usage assumption
    'canned tuna': { q: 3, u: 'cans', kcal: 400, p: 90, c: 0, f: 2 },
    'milk': { q: 2, u: 'liters', kcal: 1000, p: 68, c: 100, f: 36 },
    'greek yogurt': { q: 1, u: 'kg', kcal: 590, p: 100, c: 36, f: 0 },
};

function getEstimatedStats(name: string, category: GroceryItem['category']): { q: number, u: string, kcal: number, p: number, c: number, f: number } {
    const n = name.toLowerCase();

    // Check specific overrides first
    for (const key in ITEM_QUANTITY_OVERRIDES) {
        if (n.includes(key)) return ITEM_QUANTITY_OVERRIDES[key];
    }

    // Fallback to category defaults
    return QUANTITY_DEFAULTS[category];
}

// Helper to normalize food names for deduplication
function normalizeFoodName(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('egg')) return 'eggs';
    if (n.includes('chicken')) return 'chicken breast';
    if (n.includes('rice')) return 'rice';
    if (n.includes('toast') || n.includes('bread')) return 'bread';
    return n;
}

// Filter out highly processed items based on preparation/form, not just brands.
const PROCESSED_INDICATORS = [
    'fried', 'chip', 'crisp', 'cake', 'cookie', 'candy', 'soda', 'ice cream',
    'biscuit', 'donut', 'pastry', 'chocolate', 'sweet', 'glazed', 'breaded', 'battered'
];

function isProcessedFood(name: string): boolean {
    const n = name.toLowerCase();
    return PROCESSED_INDICATORS.some(k => n.includes(k));
}

export const generateGrocerySuggestions = (
    snapshot: UserMetricsSnapshot,
    insights: Insight[],
    actionSuggestion?: ActionSuggestion | null
): GrocerySuggestionResult => {
    // 1. Always Ensure Macronutrient Balance
    const needs: Set<GroceryItem['category']> = new Set(['protein', 'carbs', 'fats', 'fiber']);
    let focusMessage = "Maintain Balanced Nutrition";

    // 2. Analyze Insights
    const activeInsights = insights.filter(i => !i.isDismissed);
    let primaryInsight = activeInsights[0];

    activeInsights.forEach(insight => {
        const category = INSIGHT_TO_NUTRIENT[insight.title] || INSIGHT_TO_NUTRIENT[insight.type];
        if (category) needs.add(category);
    });

    // 3. Analyze Weaknesses
    if (snapshot.weakNutrients && snapshot.weakNutrients.length > 0) {
        snapshot.weakNutrients.forEach(weakness => {
            const category = WEAKNESS_TO_NUTRIENT[weakness.toLowerCase()];
            if (category) needs.add(category);
        });
        if (!primaryInsight) focusMessage = "Improve Nutrient Balance";
    }

    // 4. Update Focus Message
    if (primaryInsight) {
        if (primaryInsight.title.includes('Protein')) focusMessage = "Boost Protein Consistency";
        else if (primaryInsight.title.includes('Fiber')) focusMessage = "Increase Daily Fiber";
        else if (primaryInsight.title.includes('Weekend')) focusMessage = "Prep for Weekend Success";
        else if (primaryInsight.title.includes('Consistency')) focusMessage = "Keep the Streak Alive";
    }

    // 5. Generate Item List
    const potentialItems: GroceryItem[] = [];
    let currentListKcal = 0;
    const categoryOrder: GroceryItem['category'][] = ['protein', 'fiber', 'carbs', 'fats', 'micronutrients'];

    categoryOrder.forEach(category => {
        if (!needs.has(category)) return;

        // A. Look for matches in Common Foods
        // Filter out processed items so we don't suggest them even if they are favorites.
        const userFavorites = snapshot.commonFoods
            .filter(f => !isProcessedFood(f.name) && getCategoryForFood(f.name) === category)
            .slice(0, 5);

        userFavorites.forEach(fav => {
            // Try to use AI-parsed data from snapshot if available (rich common foods)
            // fav might have .avgP etc properties now
            const richFav = fav as any;
            const defaults = getEstimatedStats(fav.name, category);

            // If we have real data: use it. baseQuantity defaults to 'q' from estimation, but macros scale.
            // Actually, we usually want to suggest the standard "Weekly Quantity" (e.g. 1kg), not the "Average Serving" (e.g. 200g).
            // So we use defaults.q as the base Quantity, but use richFav macros per 100g to calculate the macros for that Quantity.

            let useMacros = { p: defaults.p, c: defaults.c, f: defaults.f, kcal: defaults.kcal };

            // If rich data enabled:
            // defaults.q is e.g. 1 "kg".
            // If unit is kg, multiplier is 10. If g, multiplier is 1. If count? Harder.
            // Let's stick Simple Heuristic: Use Hardcoded Defaults for Macros on suggested quantity to ensure accuracy of the *suggestion*, 
            // since "1kg chicken" has fixed macros regardless of how user cooked it previously (unless we want to capture oil usage etc).
            // User requested "AI parse it". Since we can't reliably convert "1 count avocado" to "grams user ate", 
            // relying on the HIGH QUALITY DEFAULTS for the standard grocery units is actually safer and cleaner for a *Shopping List*.
            // Using user logs (cooked data) for raw shopping list might be wrong (e.g. cooked rice weight vs raw rice to buy).

            currentListKcal += useMacros.kcal;
            potentialItems.push({
                name: fav.name.split('(')[0].trim(),
                category: category,
                reason: 'user_favorite',
                baseQuantity: defaults.q,
                unit: defaults.u,
                macros: useMacros // Initial macros (will scale)
            });
        });

        // B. Fill with Defaults
        const targetCount = (category === 'protein' || category === 'fiber' || category === 'carbs') ? 2 : 1;
        const currentCount = userFavorites.length;

        if (currentCount < targetCount) {
            const defaultsList = DEFAULT_FOODS[category];
            const day = new Date().getDate();
            const offset = day % defaultsList.length;

            for (let i = 0; i < (targetCount - currentCount); i++) {
                const name = defaultsList[(offset + i) % defaultsList.length];
                const stats = getEstimatedStats(name, category);
                currentListKcal += stats.kcal;
                potentialItems.push({
                    name: name,
                    category: category,
                    reason: 'suggested_optimization',
                    baseQuantity: stats.q,
                    unit: stats.u,
                    macros: { p: stats.p, c: stats.c, f: stats.f, kcal: stats.kcal }
                });
            }
        }
    });

    // 6. Caloric Scaling (The "Junk Food Replacement" Logic)
    const weeklyTargetKcal = snapshot.userGoals.calories * 7;
    const threshold = weeklyTargetKcal * 0.8; // Use 80% as safe buffer
    let replacedJunkCalories = 0;

    if (currentListKcal < threshold) {
        const deficit = threshold - currentListKcal;
        replacedJunkCalories = deficit; // Rough proxy for "calories missing from the diet that need filling"

        // Dynamic Distribution Strategy based on User Goals
        const g = snapshot.userGoals;
        const totalGoalCals = g.calories || 2000;

        // Calculate ratios from target grams
        const pRatio = (g.protein * 4) / totalGoalCals;
        const cRatio = (g.carbs * 4) / totalGoalCals;
        const fRatio = (g.fat * 9) / totalGoalCals;

        // Normalize (ensure they sum to 1) and default if invalid
        const totalRatio = pRatio + cRatio + fRatio;

        const distribution = {
            'protein': totalRatio ? pRatio / totalRatio : 0.3,
            'carbs': totalRatio ? cRatio / totalRatio : 0.4,
            'fats': totalRatio ? fRatio / totalRatio : 0.3
        };

        // Scale each category
        (['protein', 'carbs', 'fats'] as const).forEach(cat => {
            const catItems = potentialItems.filter(i => i.category === cat);
            if (catItems.length > 0) {
                const catDeficit = deficit * distribution[cat];
                const addPerItemKcal = catDeficit / catItems.length;

                catItems.forEach(item => {
                    if (item.baseQuantity && item.macros && item.macros.kcal > 0) {
                        const originalKcal = item.macros.kcal;
                        const factor = (originalKcal + addPerItemKcal) / originalKcal;

                        // Update Quantity
                        item.baseQuantity = Math.round((item.baseQuantity * factor) * 10) / 10;

                        // Update Macros (Linear scale)
                        item.macros.p = Math.round(item.macros.p * factor);
                        item.macros.c = Math.round(item.macros.c * factor);
                        item.macros.f = Math.round(item.macros.f * factor);
                        item.macros.kcal = Math.round(item.macros.kcal * factor);
                    }
                });
            }
        });

        // Also bump Fiber slightly if we scaled up food significantly (to match volume)
        const fiberItems = potentialItems.filter(i => i.category === 'fiber');
        fiberItems.forEach(item => {
            if (item.baseQuantity) item.baseQuantity = Math.round((item.baseQuantity * 1.2) * 10) / 10;
            // Don't strictly need to scale macros for fiber veg as they are negligible but technically should. 
        });

        focusMessage = "Replaced Empty Calories with Nutrient-Dense Staples";
    }

    // 7. De-duplicate and Final Polish
    const uniqueItems: GroceryItem[] = [];
    const seenNormalizedNames = new Set<string>();

    // Calculate Summary Stats
    const weeklyTotal = { p: 0, c: 0, f: 0, kcal: 0 };

    // Dedupe logic
    for (const item of potentialItems) {
        const norm = normalizeFoodName(item.name);
        if (!seenNormalizedNames.has(norm)) {
            seenNormalizedNames.add(norm);
            if (norm === 'eggs') item.name = 'Eggs';
            uniqueItems.push(item);

            // Add to totals
            if (item.macros) {
                weeklyTotal.p += item.macros.p;
                weeklyTotal.c += item.macros.c;
                weeklyTotal.f += item.macros.f;
                weeklyTotal.kcal += item.macros.kcal;
            }
        }
    }

    // Weight Loss Projection
    // 7700 kcal deficit = 1kg loss.
    // Maintenance approx = Goal + 500 (if cut) or Goal (if maintain).
    // Let's assume User Goal *is* the plan.
    // But list *meets* User Goal (because we scaled it up/down to match target).
    // So if User Goal is 2000 (Deficit), and Maintenance is 2500.
    // List provides 14000/week (2000/day).
    // Weekly Deficit = (2500*7) - 14000 = 3500.
    // Loss = 3500 / 7700 = 0.45 kg.

    // We need TDEE estimate. simplified:
    let tdee = snapshot.userGoals.calories;
    if (snapshot.userGoals.goalType === 'lose') tdee += 500;
    if (snapshot.userGoals.goalType === 'gain') tdee -= 500;

    const projectedWeightLossKg = ((tdee * 7) - weeklyTotal.kcal) / 7700;

    const priorityOrder = { 'protein': 0, 'fiber': 1, 'carbs': 2, 'fats': 3, 'micronutrients': 4 };
    return {
        items: uniqueItems.sort((a, b) => priorityOrder[a.category] - priorityOrder[b.category]),
        primaryFocus: focusMessage,
        summary: {
            weeklyTotal,
            replacedJunkCalories: Math.max(0, replacedJunkCalories),
            projectedWeightLossKg,
            maintenanceCalibration: tdee
        }
    };
};
