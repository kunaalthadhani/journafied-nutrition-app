// OpenAI API service for food analysis
import { ParsedFood } from '../utils/foodNutrition';
import { invokeAI } from './aiProxyService';
import * as FileSystem from 'expo-file-system/legacy';
import { generateId } from '../utils/uuid';
import { chatCoachService } from './chatCoachService';
import { sanitizeForAI, sanitizeObjectForAI } from '../utils/sanitizeAI';
import { hashPrompt } from '../utils/promptVersion';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

// ─── Food Analysis Cache ───────────────────────────────────────
// Caches AI results in AsyncStorage so repeat meals return instantly.
// Cache entries are tagged with a hash of the prompt that produced them; when the
// prompt text changes, the hash changes and old entries are silently invalidated.
const FOOD_CACHE_PREFIX = '@food_cache:';

interface CachedFoodResult {
  foods: Omit<ParsedFood, 'id'>[];
  summary?: string;
  cachedAt: number;
  promptVersion?: string;
}

function normalizeFoodInput(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function getCachedFood(input: string, expectedVersion: string): Promise<CachedFoodResult | null> {
  try {
    const key = FOOD_CACHE_PREFIX + normalizeFoodInput(input);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedFoodResult;
    if (parsed.promptVersion !== expectedVersion) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function setCachedFood(input: string, foods: ParsedFood[], summary: string | undefined, version: string): Promise<void> {
  try {
    const key = FOOD_CACHE_PREFIX + normalizeFoodInput(input);
    // Strip IDs before caching — fresh IDs are generated on each cache hit
    const stripped = foods.map(({ id, ...rest }) => rest);
    const entry: CachedFoodResult = { foods: stripped, summary, cachedAt: Date.now(), promptVersion: version };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Cache write failure is non-critical
  }
}

/**
 * Update the food cache for a meal prompt after the user edits macros.
 * Next time the same prompt is logged, the user-corrected values are used.
 */
export async function updateFoodCache(prompt: string, foods: ParsedFood[], summary?: string): Promise<void> {
  await setCachedFood(prompt, foods, summary, AGENTIC_PROMPT_VERSION);
}





const AGENTIC_ANALYSIS_PROMPT = `
You are an advanced 3-Stage Nutrition AI Agent designed to emulate a human nutritionist. Your goal is to provide the most accurate nutritional tracking possible by "thinking" through the dish composition.

### THE 3-STAGE PROCESS (Perform this internally):
1. **The Gatekeeper (Check & Clarify):**
   - Check if the user input is ambiguous (e.g., "Chicken Pasta").
   - **ONE-SHOT CLARIFICATION POLICY:**
     - Ask **one** comprehensive question covering ALL missing variables (Sauce, Portion, etc.).
     - If the user has already provided details (even if slight ambiguity remains), **DO NOT ASK AGAIN**. Assume reasonable defaults.
     - Return a "clarification_question" ONLY if totally critical info is missing.

2. **The Deconstructor (The Chef):**
   - **ALWAYS** break down composite items (Burgers, Sandwiches, Salads, Pizza, Tacos) into their core atomic ingredients.
   - **DO NOT** log generic entries like "Cheeseburger" or "Pizza Slice" unless impossible to decompose.
   - Log the Bread/Base, Proteins, Fats/Cheeses, Sauces, and Veggies as SEPARATE items.
   - Example: "Cheeseburger" -> Output 5 items: "Hamburger Bun", "Beef Patty", "Cheddar Cheese", "Ketchup", "Pickles".
   - Example: "Caesar Salad" -> Output 4 items: "Romaine Lettuce", "Croutons", "Caesar Dressing", "Parmesan Cheese".
   - **Crucial:** Always account for "hidden calories" (cooking oil, butter).

3. **The Quantifier (The Physicist):**
   - Convert vague units ("a bowl") into accurate gram weights.
   - Sum up the macros.
   - **LABEL PANEL RULE — MANUFACTURER DATA OUTRANKS YOU:** If the input contains a line starting with "LABEL PANEL", those figures were read off the physical packaging and they are the truth. Use them EXACTLY for calories, protein, carbs and fat. Do NOT re-estimate, do NOT round to a value you find more plausible, do NOT substitute figures you remember for that product. Scale them to the actual amount eaten using the stated basis: if the panel is per 100g and the item is a 60g bar, take 60 percent of every figure; if the panel is already per bar or per serving, use it as is and multiply by the quantity. Estimate ONLY the micronutrients the panel does not list. Confidence for that item is **high**, and \`confidence_reason\` should say the numbers came off the label.
   - **NAMED BRAND RULE:** If a brand is named but no panel was given, keep the brand in \`log_name\` and estimate from what you know of that product. Never silently swap it for a generic. If you do not know that specific product, estimate the category honestly and set confidence to **medium** at best.
   - **CRITICAL WEIGHT RULE:** If the user states an explicit weight in grams, ounces, pounds, or kilograms (e.g. "100g", "100 grams", "8 oz", "1 lb", "0.5 kg"), that is the TOTAL weight of the item. Use it directly. Do NOT multiply by quantity. Do NOT scale by per-piece weight. "100 grams chicken thigh" means total_weight_g = 100, not 100 pieces × 100g.
   - **CRITICAL IDENTITY RULE:** Preserve the specific cut, type, variety, brand, or preparation the user named. If they say "chicken thigh," do not substitute "chicken breast." If they say "skim milk," do not substitute "whole milk." If they say "brown rice," do not substitute "white rice." If they say "olive oil," do not substitute "vegetable oil." The user's words are authoritative for what the food IS. Your job is to estimate the macros, not pick the food.
   - **ESTIMATE MICRONUTRIENTS:** You MUST estimate Fiber, Sugar, Saturated Fat, Sodium, Potassium, Cholesterol, Calcium, Iron, Magnesium, Zinc, Omega-3 (total grams, ALA + EPA + DHA combined), and key Vitamins (A, C, D, B12). Use standard nutritional data.
   - **CRITICAL SUGAR BREAKDOWN:**
     - For items high in sugar (candy, soda, desserts, processed snacks), you **MUST** estimate \`added_sugars\`.
     - Do NOT leave \`added_sugars\` as 0 if the item is clearly a sweet treat (e.g. invalid: Candy Bar with 20g Sugar but 0g Added Sugar).
     - If the item is "Sugar Free" or "Keto" but sweet, you **MUST** estimate \`sugar_alcohols\`.

4. **The Estimator (Confidence):**
   - Rate confidence by **estimation accuracy**, not by how exhaustively the user described the food.
   - Ask yourself: "Given what the user said, how close is my calorie estimate to reality?"
     - **"high"** — Within roughly ±15%. The MAIN calorie drivers are pinned down: portion size, preparation method, and any high impact add-ons (oil, sauce, cheese, dressing, protein). You do NOT need brand, exact recipe, or every micro detail.
     - **"medium"** — Within roughly ±30%. One or two calorie drivers are unspecified but a reasonable default exists.
     - **"low"** — Could be off by more than 30%. A critical driver is unspecified and the default range is wide (e.g. "pasta" alone could be 300 or 900 kcal depending on sauce and portion).
   - **CRITICAL RULE:** If the user has specified portion AND preparation AND any obvious add-ons, mark HIGH. Do not demand more. Examples that ARE high:
     - "200g grilled chicken breast, no skin"
     - "2 slices of cheese pizza, thin crust"
     - "pasta with tomato sauce, 200g, no meat"
     - "1 medium banana"
     - "200g basmati rice, plain"
     - "chicken shawarma wrap with garlic sauce, 1 large"
   - Examples that are MEDIUM:
     - "chicken breast" (no portion, no preparation)
     - "1 slice of pizza" (no toppings, no size)
     - "rice and chicken" (portions and preparation missing)
   - Examples that are LOW:
     - "pasta" (no sauce, no portion, no protein info)
     - "salad" (could be 100 kcal or 800 kcal)
     - "burger" (size, toppings, sides all unknown)
   - For each item, set \`confidence_reason\` to a SHORT sentence (max 18 words) explaining the rating, specific to THIS food.
     - Example "high" for "200g grilled chicken breast, skinless": "Weight, preparation, and skin status all given. Minimal estimation needed."
     - Example "low" for "pasta": "Sauce, portion, and protein add-ons heavily affect calories. None were specified."
   - **DO NOT downgrade confidence for missing details that have small calorie impact** (e.g. exact pasta shape, brand of bread, freshness of vegetables). These do not move the estimate meaningfully.
   - **HARD STOP:** If you ever feel the urge to substitute a DIFFERENT food than what the user named (e.g. swap "thigh" for "breast"), do not do it. The user's named food is final. If you truly cannot estimate that food, set confidence to "low" and \`confidence_reason\` to explain why, but still keep the food name they gave you.

### OUTPUT INSTRUCTIONS:
Return a JSON Object.
EITHER:
A) If you need clarification:
{
  "clarification_question": "String (E.g., 'Was that a cream-based or tomato-based sauce? And roughly how big was the bowl?')"
}

OR

B) If you have enough info (or are making safe assumptions):
{
      "summary": "String (Short, clean summary with emojis, e.g. '🍜 2 Packets of Noodles, 🍎 1 Apple')",
      "items": [
        {
          "log_name": "String",
          "reasoning": "String",
          "quantity": Number,
          "unit": "String",
          "total_weight_g": Number,
          "confidence": "low" | "medium" | "high",
          "confidence_reason": "String — short, food-specific reason for this confidence level",
          "nutrition": {
            "calories": Number,
            "protein": Number,
            "carbs": Number,
            "fat": Number,
            "dietary_fiber": Number,
            "sugar": Number,
            "added_sugars": Number,
            "sugar_alcohols": Number,
            "saturated_fat": Number,
            "sodium_mg": Number,
            "potassium_mg": Number,
            "cholesterol_mg": Number,
            "calcium_mg": Number,
            "iron_mg": Number,
            "magnesium_mg": Number,
            "zinc_mg": Number,
            "omega_3_g": Number,
            "vitamin_a_mcg": Number,
            "vitamin_c_mg": Number,
            "vitamin_d_mcg": Number,
            "vitamin_b12_mcg": Number
          }
        }
      ]
    }

- Return ONLY valid JSON.
`;

// Cache version derived from the prompt text — bumps automatically when the prompt changes.
const AGENTIC_PROMPT_VERSION = hashPrompt(AGENTIC_ANALYSIS_PROMPT);

// Words that imply the food is liquid. When present, "oz" / "ounce" is treated
// as fluid oz (~29.57 g for water-density beverages) instead of weight oz (~28.35 g).
// Close enough for most drinks; will be slightly off for honey or oils but those
// are rarely ordered "by the ounce."
const LIQUID_FOOD_KEYWORDS = [
  'water', 'milk', 'juice', 'coffee', 'tea', 'soda', 'cola', 'pepsi', 'sprite',
  'beer', 'wine', 'champagne', 'cocktail', 'whiskey', 'vodka', 'gin', 'rum', 'tequila',
  'smoothie', 'shake', 'milkshake', 'protein shake', 'kombucha', 'lemonade', 'iced tea',
  'broth', 'stock', 'soup', 'oil', 'sauce', 'syrup', 'honey', 'cream',
  'lassi', 'ayran', 'jallab', 'tamarind drink', 'qamar al-din',
];

function hasLiquidContext(input: string): boolean {
  const lower = input.toLowerCase();
  return LIQUID_FOOD_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Extract a single explicit weight from the user's input, returned in grams.
 * Supports g, grams, oz, ounces, lb, lbs, pounds, kg, kilograms, ml, l, liters.
 * For "oz" in a liquid context, uses fluid oz conversion.
 * Returns null if no weight, multiple weights, or ambiguous input.
 */
function extractStatedWeightG(input: string): number | null {
  if (!input) return null;
  const re = /(\d+(?:\.\d+)?)\s*(kg|kilograms?|kilos?|g|grams?|oz|ounces?|fl\.?\s*oz|fluid\s*ounces?|lbs?|pounds?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?)\b/gi;
  const matches: Array<{ value: number; unit: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    matches.push({ value: parseFloat(m[1]), unit: m[2].toLowerCase().replace(/\s+/g, '') });
  }
  if (matches.length !== 1) return null; // 0 or multiple weights, do not enforce

  const { value, unit } = matches[0];
  if (unit.startsWith('kg') || unit.startsWith('kilo')) return value * 1000;
  if (unit.startsWith('lb') || unit.startsWith('pound')) return value * 453.592;
  // Volume units — assume water density (~1 g/ml).
  if (unit === 'ml' || unit.startsWith('millilit')) return value;
  if (unit === 'l' || unit.startsWith('lit')) return value * 1000;
  // Explicit fluid oz (e.g. "12 fl oz") always uses liquid conversion.
  if (unit.startsWith('floz') || unit.startsWith('fluidounce')) return value * 29.5735;
  if (unit.startsWith('oz') || unit.startsWith('ounce')) {
    // Plain "oz" — depends on context. Liquid food → fluid oz; otherwise weight oz.
    return value * (hasLiquidContext(input) ? 29.5735 : 28.3495);
  }
  return value; // grams
}

/**
 * If the user gave an explicit total weight and the AI returned a different weight for a
 * single-item meal, scale the nutrition values proportionally and override the weight.
 * This protects against AI quantity/weight confusion (e.g. "100 grams chicken thigh" being
 * misread as 100 pieces times per-piece weight).
 */
function enforceStatedWeight(userInput: string, items: any[]): any[] {
  const statedG = extractStatedWeightG(userInput);
  if (statedG === null || items.length !== 1) return items;

  const item = items[0];
  const aiWeight = Number(item.total_weight_g) || 0;
  if (aiWeight <= 0) return items;

  // Allow up to 5% drift (rounding, AI imprecision).
  const ratio = statedG / aiWeight;
  if (ratio > 0.95 && ratio < 1.05) return items;

  // If nutrition is missing or empty, do NOT scale. Returning an empty nutrition object
  // would produce a 0-calorie meal — worse than the AI's wrong weight. Trust the AI.
  if (!item.nutrition || typeof item.nutrition !== 'object') {
    if (__DEV__) console.warn('[enforceStatedWeight] nutrition missing, skipping scale');
    return items;
  }
  const nutritionEntries = Object.entries(item.nutrition);
  if (nutritionEntries.length === 0) {
    if (__DEV__) console.warn('[enforceStatedWeight] nutrition is empty object, skipping scale');
    return items;
  }
  // Require at least calories to be a valid number before we scale.
  const aiCalories = Number((item.nutrition as any).calories);
  if (!isFinite(aiCalories) || aiCalories < 0) {
    if (__DEV__) console.warn('[enforceStatedWeight] nutrition.calories invalid, skipping scale');
    return items;
  }

  const scaledNutrition: Record<string, number | unknown> = {};
  for (const [key, val] of nutritionEntries) {
    scaledNutrition[key] = typeof val === 'number' ? Number((val * ratio).toFixed(2)) : val;
  }
  if (__DEV__) console.log(`[enforceStatedWeight] scaling: AI=${aiWeight}g -> user=${statedG}g, ratio=${ratio.toFixed(3)}`);

  return [{
    ...item,
    total_weight_g: statedG,
    nutrition: scaledNutrition,
    // The AI's confidence stands. Note in reasoning that we scaled.
    reasoning: `${item.reasoning || ''} [Auto-scaled to user stated ${statedG}g.]`.trim(),
  }];
}

/**
 * Identity groups: members within a group are commonly confused by the AI but
 * are nutritionally distinct (chicken thigh vs breast, salmon vs tuna, etc).
 * If the user named one member and the AI returned a different member, we keep
 * the user's term and surface the swap to Sentry so we can measure how often
 * the prompt drifts.
 */
const IDENTITY_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  // chicken cuts
  ['thigh', 'thighs', 'breast', 'breasts', 'wing', 'wings', 'drumstick', 'drumsticks', 'leg quarter'],
  // beef cuts
  ['ribeye', 'sirloin', 'filet', 'tenderloin', 'brisket', 'flank', 'chuck', 't-bone', 'porterhouse'],
  // fish species
  ['salmon', 'tuna', 'cod', 'tilapia', 'mackerel', 'sea bass', 'seabass', 'halibut', 'trout', 'sardine', 'sardines'],
  // dairy fat tier (look for the qualifier paired with milk)
  ['skim milk', 'whole milk', '2% milk', '1% milk', 'low fat milk', 'full fat milk'],
  // bread types
  ['white bread', 'whole wheat bread', 'whole grain bread', 'sourdough', 'rye bread', 'multigrain bread', 'pita', 'naan'],
  // pasta shapes
  ['spaghetti', 'penne', 'rigatoni', 'fusilli', 'ravioli', 'lasagna', 'linguine', 'fettuccine', 'macaroni'],
  // rice
  ['white rice', 'brown rice', 'basmati', 'jasmine', 'sushi rice'],
  // egg prep
  ['scrambled', 'fried egg', 'fried eggs', 'boiled egg', 'boiled eggs', 'poached egg', 'poached eggs', 'omelet', 'omelette'],
  // potato prep
  ['baked potato', 'mashed potato', 'french fries', 'hash browns', 'sweet potato'],
  // coffee prep
  ['espresso', 'americano', 'latte', 'cappuccino', 'macchiato', 'mocha', 'flat white'],
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectIdentityToken(text: string, group: readonly string[]): string | null {
  if (!text) return null;
  // Try longer phrases first so "whole milk" beats "milk" if both ever appear.
  const sorted = [...group].sort((a, b) => b.length - a.length);
  for (const token of sorted) {
    const re = new RegExp(`\\b${escapeRegex(token)}\\b`, 'i');
    if (re.test(text)) return token;
  }
  return null;
}

/**
 * If the user named a specific food identity (e.g. "thigh") and the AI returned
 * a different one in the same group (e.g. "breast"), rewrite log_name to keep
 * the user's term. Nutrition stays untouched — we cannot deterministically
 * substitute correct macros — but the meal label will at least match what the
 * user said, and the user can edit macros if it matters.
 *
 * Limited to single-item meals: with multiple items we cannot tell which user
 * phrase maps to which AI item.
 */
function enforceFoodIdentity(userInput: string, items: any[]): any[] {
  if (!userInput || !Array.isArray(items) || items.length !== 1) return items;
  const item = items[0];
  if (!item || typeof item.log_name !== 'string') return items;

  for (const group of IDENTITY_GROUPS) {
    const userToken = detectIdentityToken(userInput, group);
    if (!userToken) continue;
    const aiToken = detectIdentityToken(item.log_name, group);
    if (!aiToken || aiToken.toLowerCase() === userToken.toLowerCase()) continue;

    if (__DEV__) {
      console.warn(`[enforceFoodIdentity] AI used "${aiToken}", user said "${userToken}" — rewriting log_name`);
    }
    try {
      Sentry.captureMessage(`Food identity swap: ai="${aiToken}" user="${userToken}"`, {
        level: 'warning',
        tags: { ai_call_type: 'food-analysis', identity_swap: 'true' },
        extra: { userInput, aiLogName: item.log_name },
      });
    } catch { /* sentry must never break flow */ }

    const rewritten = item.log_name.replace(new RegExp(escapeRegex(aiToken), 'i'), userToken);
    return [{
      ...item,
      log_name: rewritten,
      reasoning: `${item.reasoning || ''} [Identity preserved: kept user's "${userToken}".]`.trim(),
    }];
  }
  return items;
}

const AGENTIC_NUTRITION_FIELDS = [
  'calories', 'protein', 'carbs', 'fat',
  'dietary_fiber', 'sugar', 'added_sugars', 'sugar_alcohols',
  'saturated_fat', 'sodium_mg', 'potassium_mg', 'cholesterol_mg',
  'calcium_mg', 'iron_mg',
  'magnesium_mg', 'zinc_mg', 'omega_3_g',
  'vitamin_a_mcg', 'vitamin_c_mg', 'vitamin_d_mcg', 'vitamin_b12_mcg',
] as const;

const AGENTIC_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    clarification_question: { type: ['string', 'null'] },
    summary: { type: ['string', 'null'] },
    items: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        properties: {
          log_name: { type: 'string' },
          reasoning: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          total_weight_g: { type: 'number' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          confidence_reason: { type: 'string' },
          nutrition: {
            type: 'object',
            properties: Object.fromEntries(
              AGENTIC_NUTRITION_FIELDS.map((key) => [key, { type: 'number' as const }]),
            ),
            required: [...AGENTIC_NUTRITION_FIELDS],
            additionalProperties: false,
          },
        },
        required: ['log_name', 'reasoning', 'quantity', 'unit', 'total_weight_g', 'confidence', 'confidence_reason', 'nutrition'],
        additionalProperties: false,
      },
    },
  },
  required: ['clarification_question', 'summary', 'items'],
  additionalProperties: false,
};

// aiUnavailable says the call never landed. Without it a proxy outage looks
// exactly like "we did not recognise your food", which blames the user for
// our own downtime and teaches them to distrust a parser that never ran
export async function analyzeFoodWithChatGPT(foodInput: string, allowClarification: boolean = true): Promise<{ foods: ParsedFood[], summary?: string, clarificationQuestion?: string, aiUnavailable?: boolean }> {
  try {
    if (__DEV__) console.log('Starting Agentic Analysis for:', foodInput);

    // ── Cache check: return near-instantly for repeat meals ──
    const cached = await getCachedFood(foodInput, AGENTIC_PROMPT_VERSION);
    if (cached && cached.foods.length > 0) {
      if (__DEV__) console.log('Cache HIT for:', foodInput);
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay so UI transition feels smooth
      const cachedFoods: ParsedFood[] = cached.foods.map(f => ({ ...f, id: generateId() }));
      return { foods: cachedFoods, summary: cached.summary };
    }

    let finalPrompt = AGENTIC_ANALYSIS_PROMPT;
    if (!allowClarification) {
      finalPrompt += `\n\nCRITICAL OVERRIDE: clarification is disabled. Do not return a "clarification_question". You MUST return a non-empty "items" array AND a non-null "summary" string. Make reasonable assumptions for any missing details (default portions, default preparation). Set "confidence" to "low" if you had to guess, but never bail by returning empty items or a null summary.`;
    }

    const data = await invokeAI({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: finalPrompt },
        { role: 'user', content: sanitizeForAI(foodInput) }
      ],
      temperature: 0.3,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'food_analysis', strict: true, schema: AGENTIC_RESPONSE_SCHEMA },
      },
      call_type: 'food-analysis',
    });

    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    if (__DEV__) {
      console.log('[FoodAnalysis] input:', JSON.stringify(foodInput));
      console.log('[FoodAnalysis] raw response:', content);
    }

    const result = JSON.parse(content);

    if (result.clarification_question && allowClarification) {
      return { foods: [], clarificationQuestion: result.clarification_question };
    }

    if (__DEV__ && (!result.items || result.items.length === 0)) {
      console.warn('[FoodAnalysis] AI returned empty items. clarification_question:', result.clarification_question, 'summary:', result.summary);
    }

    // Deterministic guardrails:
    // 1) If the user gave an explicit weight, scale to match.
    // 2) If the AI swapped a specific food identity (thigh→breast, salmon→tuna),
    //    rewrite log_name to keep the user's term.
    const scaledItems = enforceStatedWeight(foodInput, result.items || []);
    const items = enforceFoodIdentity(foodInput, scaledItems);
    const finalFoods: ParsedFood[] = [];

    for (const item of items) {
      finalFoods.push({
        id: generateId(),
        name: item.log_name,
        quantity: item.quantity,
        unit: item.unit,
        weight_g: item.total_weight_g,
        calories: item.nutrition.calories,
        protein: item.nutrition.protein,
        carbs: item.nutrition.carbs,
        fat: item.nutrition.fat,
        dietary_fiber: item.nutrition.dietary_fiber,
        sugar: item.nutrition.sugar,
        added_sugars: item.nutrition.added_sugars,
        sugar_alcohols: item.nutrition.sugar_alcohols,
        saturated_fat: item.nutrition.saturated_fat,
        sodium_mg: item.nutrition.sodium_mg,
        potassium_mg: item.nutrition.potassium_mg,
        cholesterol_mg: item.nutrition.cholesterol_mg,
        calcium_mg: item.nutrition.calcium_mg,
        iron_mg: item.nutrition.iron_mg,
        magnesium_mg: item.nutrition.magnesium_mg,
        zinc_mg: item.nutrition.zinc_mg,
        omega_3_g: item.nutrition.omega_3_g,
        vitamin_a_mcg: item.nutrition.vitamin_a_mcg,
        vitamin_c_mg: item.nutrition.vitamin_c_mg,
        vitamin_d_mcg: item.nutrition.vitamin_d_mcg,
        vitamin_b12_mcg: item.nutrition.vitamin_b12_mcg,
        confidence: item.confidence,
        confidence_reason: item.confidence_reason,
      });
    }

    // ── Build a fallback summary if the AI returned items but skipped the summary. ──
    // The strict json_schema allows summary to be null, but the meal row UX needs SOMETHING
    // to display. Build a short title from the first 1-2 food names so the user does not see
    // "Image" or a blank row.
    let finalSummary: string | undefined = result.summary || undefined;
    if (!finalSummary && finalFoods.length > 0) {
      const names = finalFoods.slice(0, 2).map(f => f.name).filter(Boolean);
      if (finalFoods.length > 2) {
        finalSummary = `${names.join(', ')} + ${finalFoods.length - 2} more`;
      } else {
        finalSummary = names.join(', ');
      }
    }

    // ── Cache the result for future instant lookups ──
    if (finalFoods.length > 0) {
      setCachedFood(foodInput, finalFoods, finalSummary, AGENTIC_PROMPT_VERSION);
    }

    return { foods: finalFoods, summary: finalSummary };

  } catch (error) {
    if (__DEV__) console.error('Error in agentic food analysis:', error);
    // Fallback to local parsing. When even that finds nothing, say the AI was
    // unreachable rather than letting the caller blame the food
    const { parseFoodInput } = require('../utils/foodNutrition');
    const local: ParsedFood[] = parseFoodInput(foodInput);
    return { foods: local, aiUnavailable: local.length === 0 };
  }
}

// Returns null on failure so the caller can skip caching. Returning apologetic
// filler here used to get cached for a whole week as if it were the insight.
export async function generateWeeklyInsights(weeklyData: any): Promise<string | null> {
  try {
    const data = await invokeAI({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a personal nutrition analyst reviewing one person's actual food log data for the past week.

Write exactly 3 insights. Each is a short paragraph (3-4 sentences), separated by double newlines. No bullet points, no hyphens, no dashes, no emojis, no numbered lists, no headers. Just plain flowing sentences.

Rules for each insight:
1. Start with their specific numbers (exact calories, grams, food names, days). Never say "you did well" or "great job" without data backing it.
2. Explain the consequence or opportunity. Not "your protein was low" but "your protein averaged 68g against a 150g target, which means you're getting less than half of what your muscles need to recover, and this is likely why you feel hungrier by evening."
3. End with one specific action. Not "eat more protein" but "adding a Greek yogurt (150g) after lunch would close about 15g of that gap without changing your meals."

Pick the 3 most impactful from their data:
- Calorie accuracy: how close were they to target on average, and what does the gap mean for their goal timeline.
- Macro imbalances: which macro is furthest from target and what that does to their body practically (satiety, energy, muscle, fat storage).
- Day patterns: which days were off-track and what likely caused it (weekends, skipped meals, late logging).
- Food variety: are they eating the same 3-4 foods repeatedly, and what nutrients they might be missing.
- Meal timing: if most calories land in one window, what redistribution could do for energy and appetite.
- Logging gaps: how many days they actually logged and why incomplete data limits the advice you can give.
- If calorie banking data is present: how effectively they used their bank, whether their distribution pattern is healthy or shows restrict/binge tendencies, and whether their cap setting seems right for their behavior.

Tone: Like a nutritionist reviewing your food diary face-to-face. Specific, honest, no filler. Every sentence should contain a number or a food name from their data.`
        },
        {
          role: 'user',
          content: JSON.stringify(sanitizeObjectForAI(weeklyData))
        }
      ],
      temperature: 0.4,
      max_tokens: 600,
      call_type: 'weekly-insights',
    });
    return data.choices[0]?.message?.content || null;
  } catch (error) {
    if (__DEV__) console.error('Error generating insights:', error);
    return null;
  }
}

/**
 * Analyze food from an image using OpenAI Vision API
 */
// Packaged food is a lookup, not an estimate. A wrapper carries an exact answer
// and the old prompt walked straight past it, describing "a chocolate protein
// bar" while the brand sat legible in the frame. So the reader now has two jobs
// that used to be one: read any packaging, and describe anything that is food
// rather than product.
const VISION_READER_PROMPT = `You are a Food Label Reader and Food Analyst working from a single photo.

You have two separate jobs. Do both.

## JOB 1 — READ ANY PACKAGING

If the frame contains packaged or branded product (a protein bar, a yoghurt pot, a cereal box, a bottle, a ready meal, a sachet), read it.

**THE ABSOLUTE RULE — BRANDS ARE READ, NEVER RECOGNISED.**
Only report a brand or product name whose letters you can actually READ in this image. Never infer one from the shape of the wrapper, the colour scheme, the style of the packaging, or because it resembles a product you know. A wrapper you cannot read is an unbranded item, and that is a perfectly good answer. Set the field to null and move on.
A wrong brand is far worse than no brand, because a wrong brand comes attached to confident wrong numbers.

**THE NUTRITION PANEL IS THE JACKPOT.**
If a nutrition information panel is visible and legible, transcribe it. These are the manufacturer's own figures and they beat any estimate. Copy the digits you can see. Record what the figures are per: per 100g, per serving, per bar, per bottle. Never fill the panel from memory of the product. Only from digits visible in THIS image. If it is blurred, angled away, or cropped, leave it null.

Also record the net weight exactly as printed on the pack ("60g", "330ml", "4 x 25g"), and how many of the item appear in the frame.

## JOB 2 — DESCRIBE ANY PREPARED FOOD

For anything on a plate, in a bowl, or otherwise not in packaging, describe it in detail for calorie estimation. Name every visible component, the protein, the base, the sauce by type ("creamy garlic", "tomato and herb"), and the cooking method. Estimate portion sizes against whatever is in frame for scale, a fork, a hand, the plate rim. Mention visible oil or butter sheen ONLY where you can genuinely see it, and mention when a dish looks dry, because guessing oil onto everything inflates fat on every meal.

Name regional dishes by their actual names where you recognise them: machboos, biryani, shawarma, manakish, falafel, labneh, kunafa, karak. The nutrition pass knows these dishes. It cannot use a name you did not give it.

A frame can have both jobs in it (a protein bar next to a bowl of oats) or only one. If there is no packaging, return an empty packaged list. If there is no prepared food, return an empty prepared string. If there is no food at all, return both empty.`;

const VISION_READER_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'vision_reading',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['packaged', 'prepared'],
      properties: {
        packaged: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['brand', 'product', 'variant', 'net_weight_label', 'count', 'panel'],
            properties: {
              brand: { type: ['string', 'null'], description: 'Only if readable in the image' },
              product: { type: ['string', 'null'] },
              variant: { type: ['string', 'null'], description: 'Flavour or variant, if printed' },
              net_weight_label: { type: ['string', 'null'], description: 'Exactly as printed, e.g. "60g"' },
              count: { type: 'number', description: 'How many of this item are in the frame' },
              panel: {
                type: ['object', 'null'],
                additionalProperties: false,
                required: ['basis', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'fiber_g', 'saturated_fat_g', 'sodium_mg'],
                properties: {
                  basis: { type: 'string', description: 'e.g. "per 100g", "per bar (60g)", "per serving"' },
                  calories: { type: ['number', 'null'] },
                  protein_g: { type: ['number', 'null'] },
                  carbs_g: { type: ['number', 'null'] },
                  fat_g: { type: ['number', 'null'] },
                  sugar_g: { type: ['number', 'null'] },
                  fiber_g: { type: ['number', 'null'] },
                  saturated_fat_g: { type: ['number', 'null'] },
                  sodium_mg: { type: ['number', 'null'] },
                },
              },
            },
          },
        },
        prepared: { type: 'string', description: 'Prose description of non-packaged food, empty if none' },
      },
    },
  },
};

interface VisionPanel {
  basis: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  sugar_g: number | null;
  fiber_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
}

interface VisionPackaged {
  brand: string | null;
  product: string | null;
  variant: string | null;
  net_weight_label: string | null;
  count: number;
  panel: VisionPanel | null;
}

interface VisionReading {
  packaged: VisionPackaged[];
  prepared: string;
}

const parseVisionReading = (raw: string): VisionReading => {
  try {
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      packaged: Array.isArray(parsed?.packaged) ? parsed.packaged : [],
      prepared: typeof parsed?.prepared === 'string' ? parsed.prepared : '',
    };
  } catch {
    // A reader that returned prose instead of JSON is still useful. Treat the
    // whole thing as a description rather than losing the call
    return { packaged: [], prepared: raw };
  }
};

// Turns the reading into the text the nutrition pass consumes. A transcribed
// panel is passed through as a LABEL PANEL block, which that prompt is told to
// treat as manufacturer truth instead of re-estimating.
const describeReading = (r: VisionReading): string => {
  const parts: string[] = [];

  r.packaged.forEach(p => {
    const name = [p.brand, p.product, p.variant].filter(Boolean).join(' ').trim();
    const label = name || 'unbranded packaged item';
    const qty = p.count > 1 ? `${p.count} x ` : '';
    const weight = p.net_weight_label ? `, net weight ${p.net_weight_label}` : '';
    parts.push(`${qty}${label}${weight}`);

    if (p.panel) {
      const rows = [
        p.panel.calories != null && `calories ${p.panel.calories}`,
        p.panel.protein_g != null && `protein ${p.panel.protein_g}g`,
        p.panel.carbs_g != null && `carbs ${p.panel.carbs_g}g`,
        p.panel.fat_g != null && `fat ${p.panel.fat_g}g`,
        p.panel.sugar_g != null && `sugar ${p.panel.sugar_g}g`,
        p.panel.fiber_g != null && `fibre ${p.panel.fiber_g}g`,
        p.panel.saturated_fat_g != null && `saturated fat ${p.panel.saturated_fat_g}g`,
        p.panel.sodium_mg != null && `sodium ${p.panel.sodium_mg}mg`,
      ].filter(Boolean);
      if (rows.length) {
        parts.push(`LABEL PANEL for ${label} (${p.panel.basis}): ${rows.join(', ')}`);
      }
    }
  });

  if (r.prepared.trim()) parts.push(r.prepared.trim());

  return parts.join('. ');
};

export async function analyzeFoodFromImage(imageUri: string): Promise<{ foods: ParsedFood[], summary?: string }> {
  try {
    if (__DEV__) console.log('Reading image as base64 from URI:', imageUri);
    // Read image as base64 using legacy API
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Determine image format from URI
    const imageFormat = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    const imageDataUrl = `data:image/${imageFormat};base64,${base64Image}`;

    if (__DEV__) console.log('Sending request to OpenAI Vision API (Reader Mode)...');

    // Step 1: Vision AI reads the frame
    const visionData = await invokeAI({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: VISION_READER_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Read this frame for nutrition logging.' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ]
        }
      ],
      max_tokens: 900,
      response_format: VISION_READER_SCHEMA,
      call_type: 'food-image-vision',
    });

    const raw = visionData.choices[0]?.message?.content;
    if (!raw) throw new Error('No reading from Vision AI');

    const reading = parseVisionReading(raw);
    if (__DEV__) console.log('Vision reading:', JSON.stringify(reading));

    const description = describeReading(reading);
    if (!description.trim()) throw new Error('Vision AI found nothing to log');

    if (__DEV__) console.log('Handoff to nutrition pass:', description);

    // Step 2: Text Agent analyzes the reading
    // using the centralized logic (Gatekeeper -> Chef -> Physicist)
    const result = await analyzeFoodWithChatGPT(description, false);

    // If clarification is needed, we (unfortunately) can't ask the user in this flow yet without refactoring HomeScreen.
    // For now, we assume the Vision description was good enough. 
    // If it *still* asks for clarification, it returns empty foods.
    // To handle this better, we could recursively call with "Ignore ambiguity" flag, but let's trust gpt-4o vision + text.
    return { foods: result.foods, summary: result.summary };

  } catch (error) {
    if (__DEV__) console.error('Error in image analysis:', error);
    throw error;
  }
}

export async function getCoachChatResponse(sessionMessages: { role: string; content: string }[]): Promise<{ ok: boolean; text: string }> {
  try {
    const systemMessageContent = await chatCoachService.generateSystemMessage();

    // Construct the full payload: System Context + Session History
    // Sanitize user messages to prevent prompt injection
    const sanitizedMessages = sessionMessages.map(m => ({
      role: m.role,
      content: m.role === 'user' ? sanitizeForAI(m.content) : m.content,
    }));
    const finalMessages = [
      { role: 'system', content: systemMessageContent },
      ...sanitizedMessages
    ];

    const data = await invokeAI({
      model: 'gpt-4o-mini',
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 600,
      call_type: 'coach-chat',
    });
    const text = data.choices[0]?.message?.content?.trim();
    // An empty completion is not a usable answer, so the caller must not charge
    // a message for it.
    if (!text) return { ok: false, text: "I'm drawing a blank. Try again?" };
    return { ok: true, text };

  } catch (error) {
    return { ok: false, text: "I'm having trouble connecting to the nutrition matrix. Try again in a bit." };
  }
}

const SMART_SUGGEST_PROMPT = `
You are a proactive nutrition assistant called "Smart Suggest".
Your goal is to suggest the OPTIMUM NEXT MEAL for the user based on what they have already eaten today and **only suggesting foods they are known to eat**.

### User Context
You will receive:
1.  **Remaining Calories & Macros:** (e.g. 500 kcal left).
2.  **Current Time:** (Lunch, Dinner, etc).
3.  **Recent Logged Meals:** What they just ate today.
4.  **Available Foods:** A list of foods the user has logged in the past 30 days.
5.  **Special Mode Flag:** If "force_hungry" is true, the user has hit their calorie goal but is still hungry.

### Strict Rules
1.  **Hyper-Personalization:** You MUST suggest a meal composed of items found in the **Available Foods** list. Do not suggest generic foods (e.g., "Salmon") if it is not in their history, unless they have absolutely zero history.
2.  **Macro-Matching:** Select the meal from their history that best fits their remaining calorie/protein gap.
3.  **Optimization Hierarchy:**
      1. **Protein:** Prioritize hitting the protein goal first.
      2. **Fiber:** Then prioritize high fiber options.
      3. **Calorie Control:** Ensure it fits within the remaining calories.
4.  **Variety:** Do not suggest exactly what they just ate in their last meal today.
5.  **Quantity:** Specify exact portions (e.g., "Repeat your Greek Yogurt Bowl but add...", "Have your usual Chicken Wrap").

### Special Mode: FORCE_HUNGRY
If "force_hungry" is true:
- **OVERRIDE GOAL:** Ignore the remaining macros. The user has hit their limit but is genuinely hungry.
- **NEW PRIORITY:** Find the meal/snack from their history with:
  1. **HIGHEST SATIETY** (High Volume + High Fiber + High Protein)
  2. **LOWEST CALORIES**
- **Reasoning Focus:** Explain how this option will fill them up for the minimal calorie cost (e.g., "This Greek Salad is massive, packed with fiber, and only 150 kcal").

### Logic
- **Morning:** Suggest their most common breakfast item that fits.
- **High Calorie Gap:** Suggest one of their larger known meals.
- **Low Calorie Gap:** Suggest one of their known snacks.
- **Missing Data / Low History:** If 'Available Foods' is empty or very short, you may suggest generic healthy options that fit the macros, but prefer their logged foods if possible. Mention "Based on what I've seen so far..."

### Output Format
Return a strictly valid JSON object:
{
  "display_text": "Try a 200g Chicken Salad to hit your protein goal!",
  "loggable_text": "200g Grilled Chicken Breast, 100g Lettuce, 20g Dressing",
  "reasoning": "This choice packs 30g of protein and 8g of fiber, perfectly closing your gap for the day while keeping calories low."
}
`;

const SMART_SUGGEST_LIMIT_KEY = 'smart_suggest_limit_v1';

const SMART_SUGGEST_SCHEMA = {
  type: 'object',
  properties: {
    display_text: { type: 'string' },
    loggable_text: { type: 'string' },
    reasoning: { type: 'string' },
  },
  required: ['display_text', 'loggable_text', 'reasoning'],
  additionalProperties: false,
};

interface SmartSuggestionResult {
  displayText: string;
  loggableText: string;
  reasoning?: string;
}

export async function generateSmartSuggestion(context: any, forceNew: boolean = false, options?: { forceHungry?: boolean }): Promise<SmartSuggestionResult> {
  try {
    // 1. Check Daily Limit and Cache
    const now = new Date();
    const todayKey = now.toISOString().split('T')[0];

    const storedData = await AsyncStorage.getItem(SMART_SUGGEST_LIMIT_KEY);
    let usage = { date: todayKey, count: 0, suggestion: null as SmartSuggestionResult | null };

    if (storedData) {
      const parsed = JSON.parse(storedData);
      if (parsed.date === todayKey) {
        // Handle migration from old string suggestions
        if (typeof parsed.suggestion === 'string') {
          parsed.suggestion = { displayText: parsed.suggestion, loggableText: parsed.suggestion };
        }
        usage = parsed;
      }
    }

    // Return cached suggestion if available
    if (!forceNew && usage.suggestion) {
      return usage.suggestion;
    }

    // 2. call API with Cheaper Model
    const enrichedContext = {
      ...context,
      force_hungry: options?.forceHungry || false
    };

    const data = await invokeAI({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SMART_SUGGEST_PROMPT },
        { role: 'user', content: JSON.stringify(sanitizeObjectForAI(enrichedContext)) }
      ],
      temperature: 0.3,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'smart_suggestion', strict: true, schema: SMART_SUGGEST_SCHEMA },
      },
      call_type: 'smart-suggestion',
    });
    const content = data.choices[0]?.message?.content;

    let result: SmartSuggestionResult = {
      displayText: "Keep hitting those macros!",
      loggableText: "Healthy Meal"
    };

    if (content) {
      try {
        const parsed = JSON.parse(content);
        result = {
          displayText: parsed.display_text || content,
          loggableText: parsed.loggable_text || content,
          reasoning: parsed.reasoning
        };
      } catch (e) {
        // Fallback if JSON parsing fails (unlikely with json_object mode but safe)
        result = { displayText: content, loggableText: content };
      }
    }

    // 3. Save Cache (No Limit Increment)
    usage.suggestion = result;
    await AsyncStorage.setItem(SMART_SUGGEST_LIMIT_KEY, JSON.stringify(usage));

    return result;

  } catch (error) {
    console.error('Error generating smart suggestion:', error);
    return { displayText: "Smart Suggest is temporarily offline.", loggableText: "" };
  }
}

// ─── Confidence Improvement Hint ───────────────────────────────────────
// Fired lazily when the user taps a Low/Medium confidence badge.
// Returns food-specific guidance on what to add to the next log to raise confidence.

const CONFIDENCE_HINT_PROMPT = `
You are a nutrition logging coach.

Given a food name and the current confidence level of its nutrition estimate, return the SHORT, SPECIFIC information the user could add to their next log to raise the estimate's accuracy.

Tailor the hint to the food. For pasta, the missing variables are sauce + portion + protein. For pizza, slice count + size + toppings. For chicken, weight + preparation + skin. For salad, dressing + protein + portion. For rice, cooked or uncooked + cup or grams.

Output strict JSON with two fields:
- "what_to_add": a single sentence (max 22 words) listing the specific variables to include next time.
- "example": one example of a high-confidence rephrasing of the same food (max 14 words).

Tone: helpful, direct, no fluff. No emojis. No headers.
`;

const CONFIDENCE_HINT_SCHEMA = {
  type: 'object',
  properties: {
    what_to_add: { type: 'string' },
    example: { type: 'string' },
  },
  required: ['what_to_add', 'example'],
  additionalProperties: false,
};

const CONFIDENCE_HINT_CACHE_PREFIX = '@confidence_hint:';
const CONFIDENCE_HINT_PROMPT_VERSION = hashPrompt(CONFIDENCE_HINT_PROMPT);

export interface ConfidenceHint {
  what_to_add: string;
  example: string;
}

export async function generateConfidenceHint(foodName: string, currentConfidence: 'low' | 'medium'): Promise<ConfidenceHint | null> {
  try {
    const cacheKey = CONFIDENCE_HINT_CACHE_PREFIX + normalizeFoodInput(foodName);
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.promptVersion === CONFIDENCE_HINT_PROMPT_VERSION && parsed.hint) {
          return parsed.hint as ConfidenceHint;
        }
      } catch {
        // fall through to regenerate
      }
    }

    const data = await invokeAI({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CONFIDENCE_HINT_PROMPT },
        { role: 'user', content: `Food: ${sanitizeForAI(foodName, 200)}\nCurrent confidence: ${currentConfidence}` },
      ],
      temperature: 0.4,
      max_tokens: 150,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'confidence_hint', strict: true, schema: CONFIDENCE_HINT_SCHEMA },
      },
      call_type: 'confidence-hint',
    });
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    const hint = JSON.parse(content) as ConfidenceHint;
    AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ promptVersion: CONFIDENCE_HINT_PROMPT_VERSION, hint, cachedAt: Date.now() }),
    ).catch(() => {});
    return hint;
  } catch (error) {
    if (__DEV__) console.error('Error generating confidence hint:', error);
    return null;
  }
}
