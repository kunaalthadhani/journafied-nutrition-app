// Food nutrition database and parsing utilities

export interface FoodItem {
  id: string;
  name: string;
  calories: number; // per 100g
  protein: number;  // per 100g
  carbs: number;    // per 100g  
  fat: number;      // per 100g
  serving_size_g: number; // default serving size in grams
  aliases: string[]; // alternative names
}

export interface ParsedFood {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  weight_g: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;

  // Detailed Macros & Micros
  // Carbs Logic
  dietary_fiber?: number;
  sugar?: number;
  added_sugars?: number;
  sugar_alcohols?: number;
  net_carbs?: number;

  // Fat Breakdown
  saturated_fat?: number;
  trans_fat?: number;
  polyunsaturated_fat?: number;
  monounsaturated_fat?: number;

  // Others
  cholesterol_mg?: number;
  sodium_mg?: number;
  calcium_mg?: number;
  iron_mg?: number;
  potassium_mg?: number;

  // Vitamins
  vitamin_a_mcg?: number; // micro-grams (RAE)
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number; // micro-grams
  vitamin_e_mg?: number;
  vitamin_k_mcg?: number;
  vitamin_b12_mcg?: number;
  // Legacy backups for compatibility if needed (mapped to new fields ideally)
  flavor?: string; // Optional flavor text
}

// Basic food database (you can expand this significantly)
export const FOOD_DATABASE: FoodItem[] = [
  {
    id: 'banana',
    name: 'Banana',
    calories: 89,
    protein: 1.1,
    carbs: 22.8,
    fat: 0.3,
    serving_size_g: 120, // 1 medium banana
    aliases: ['bananas', 'banana']
  },
  {
    id: 'apple',
    name: 'Apple',
    calories: 52,
    protein: 0.3,
    carbs: 13.8,
    fat: 0.2,
    serving_size_g: 180, // 1 medium apple
    aliases: ['apples', 'apple']
  },
  {
    id: 'chicken_breast',
    name: 'Chicken Breast',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    serving_size_g: 100,
    aliases: ['chicken', 'chicken breast', 'grilled chicken']
  },
  {
    id: 'rice',
    name: 'White Rice',
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    serving_size_g: 100, // cooked
    aliases: ['rice', 'white rice', 'steamed rice']
  },
  {
    id: 'egg',
    name: 'Egg',
    calories: 155,
    protein: 13,
    carbs: 1.1,
    fat: 11,
    serving_size_g: 50, // 1 large egg
    aliases: ['eggs', 'egg', 'boiled egg', 'scrambled egg']
  },
  // Add more foods as needed
];

// Quantity and unit parsing patterns
const QUANTITY_PATTERNS = [
  { pattern: /(\d+\.?\d*)\s*(large|big)/i, multiplier: 1.3 },
  { pattern: /(\d+\.?\d*)\s*(small|little)/i, multiplier: 0.7 },
  { pattern: /(\d+\.?\d*)\s*(medium|med)/i, multiplier: 1.0 },
  { pattern: /one|a\s+/i, quantity: 1 },
  { pattern: /two/i, quantity: 2 },
  { pattern: /three/i, quantity: 3 },
  { pattern: /half|0\.5/i, quantity: 0.5 },
  { pattern: /(\d+\.?\d*)/i, extract: true },
];

export function findFoodInDatabase(foodName: string): FoodItem | null {
  const normalizedName = foodName.toLowerCase().trim();

  return FOOD_DATABASE.find(food =>
    food.aliases.some(alias =>
      normalizedName.includes(alias.toLowerCase()) ||
      alias.toLowerCase().includes(normalizedName)
    )
  ) || null;
}

export function parseQuantityAndSize(input: string): { quantity: number; sizeMultiplier: number } {
  let quantity = 1;
  let sizeMultiplier = 1;

  // Check for size modifiers (large, small, medium)
  for (const pattern of QUANTITY_PATTERNS) {
    const match = input.match(pattern.pattern);
    if (match) {
      if (pattern.multiplier) {
        quantity = parseFloat(match[1]) || 1;
        sizeMultiplier = pattern.multiplier;
        break;
      } else if (pattern.quantity) {
        quantity = pattern.quantity;
        break;
      } else if (pattern.extract) {
        quantity = parseFloat(match[1]) || 1;
        break;
      }
    }
  }

  return { quantity, sizeMultiplier };
}

export function parseFoodInput(input: string): ParsedFood[] {
  const parsedFoods: ParsedFood[] = [];

  // Split by common delimiters (and, comma, etc.)
  const foodItems = input.split(/,|\sand\s|\n/i).map(item => item.trim());

  for (const item of foodItems) {
    if (!item) continue;

    // Extract quantity and size information
    const { quantity, sizeMultiplier } = parseQuantityAndSize(item);

    // Try to identify the food
    const food = findFoodInDatabase(item);

    if (food) {
      // Calculate actual weight based on serving size, quantity, and size modifier
      const weight_g = food.serving_size_g * quantity * sizeMultiplier;

      // Calculate nutrition values based on actual weight
      const calories = Math.round((food.calories / 100) * weight_g);
      const protein = Math.round(((food.protein / 100) * weight_g) * 10) / 10;
      const carbs = Math.round(((food.carbs / 100) * weight_g) * 10) / 10;
      const fat = Math.round(((food.fat / 100) * weight_g) * 10) / 10;

      parsedFoods.push({
        id: `${food.id}_${Date.now()}_${Math.random()}`,
        name: food.name,
        quantity,
        unit: quantity === 1 ? 'item' : 'items',
        weight_g: Math.round(weight_g),
        calories,
        protein,
        carbs,
        fat
      });
    }
  }

  return parsedFoods;
}

export function calculateTotalNutrition(foods: ParsedFood[]): {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
} {
  return foods.reduce(
    (total, food) => ({
      totalCalories: total.totalCalories + food.calories,
      totalProtein: Math.round((total.totalProtein + food.protein) * 10) / 10,
      totalCarbs: Math.round((total.totalCarbs + food.carbs) * 10) / 10,
      totalFat: Math.round((total.totalFat + food.fat) * 10) / 10,
    }),
    { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
  );
}