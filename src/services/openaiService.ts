// OpenAI API service for food analysis
import { ParsedFood } from '../utils/foodNutrition';
import { invokeAI } from './aiProxyService';
import * as FileSystem from 'expo-file-system/legacy';
import { generateId } from '../utils/uuid';
import { chatCoachService } from './chatCoachService';
import { NutritionLibraryItem } from './dataStorage';
import { sanitizeForAI, sanitizeObjectForAI } from '../utils/sanitizeAI';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Food Analysis Cache ───────────────────────────────────────
// Caches AI results in AsyncStorage so repeat meals return instantly.
const FOOD_CACHE_PREFIX = '@food_cache:';
const FOOD_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CachedFoodResult {
  foods: Omit<ParsedFood, 'id'>[];
  summary?: string;
  cachedAt: number;
}

function normalizeFoodInput(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function getCachedFood(input: string): Promise<CachedFoodResult | null> {
  try {
    const key = FOOD_CACHE_PREFIX + normalizeFoodInput(input);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const cached: CachedFoodResult = JSON.parse(raw);
    if (Date.now() - cached.cachedAt > FOOD_CACHE_MAX_AGE_MS) {
      AsyncStorage.removeItem(key);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

async function setCachedFood(input: string, foods: ParsedFood[], summary?: string): Promise<void> {
  try {
    const key = FOOD_CACHE_PREFIX + normalizeFoodInput(input);
    // Strip IDs before caching — fresh IDs are generated on each cache hit
    const stripped = foods.map(({ id, ...rest }) => rest);
    const entry: CachedFoodResult = { foods: stripped, summary, cachedAt: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Cache write failure is non-critical
  }
}




const NUTRITION_ESTIMATION_PROMPT = `
You are an expert food scientist. Given a food name, provide the standard nutritional values per 100g.
Return ONLY a valid JSON object with no explanations.

Required JSON structure:
{
  "name": "Standard food name",
  "calories_per_100g": number,
  "protein_per_100g": number,
  "carbs_per_100g": number,
  "fat_per_100g": number,
  "fiber_per_100g": number,
  "sugar_per_100g": number,
  "added_sugars_per_100g": number,
  "sugar_alcohols_per_100g": number,
  "net_carbs_per_100g": number,
  "saturated_fat_per_100g": number,
  "trans_fat_per_100g": number,
  "polyunsaturated_fat_per_100g": number,
  "monounsaturated_fat_per_100g": number,
  "sodium_mg_per_100g": number,
  "potassium_mg_per_100g": number,
  "cholesterol_mg_per_100g": number,
  "calcium_mg_per_100g": number,
  "iron_mg_per_100g": number,
  "vitamin_a_mcg_per_100g": number,
  "vitamin_c_mg_per_100g": number,
  "vitamin_d_mcg_per_100g": number,
  "vitamin_e_mg_per_100g": number,
  "vitamin_k_mcg_per_100g": number,
  "vitamin_b12_mcg_per_100g": number,
  "standard_unit": "e.g., cup, slice, piece",
  "standard_serving_weight_g": number
}
`;

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
   - **ESTIMATE MICRONUTRIENTS:** You MUST estimate Fiber, Sugar, Saturated Fat, Sodium, Potassium, Cholesterol, and key Vitamins (A, C, D, B12), Calcium, and Iron. Use standard nutritional data.
   - **CRITICAL SUGAR BREAKDOWN:**
     - For items high in sugar (candy, soda, desserts, processed snacks), you **MUST** estimate \`added_sugars\`. 
     - Do NOT leave \`added_sugars\` as 0 if the item is clearly a sweet treat (e.g. invalid: Candy Bar with 20g Sugar but 0g Added Sugar).
     - If the item is "Sugar Free" or "Keto" but sweet, you **MUST** estimate \`sugar_alcohols\`.

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

export async function analyzeFoodWithChatGPT(foodInput: string, allowClarification: boolean = true): Promise<{ foods: ParsedFood[], summary?: string, clarificationQuestion?: string }> {
  try {
    if (__DEV__) console.log('Starting Agentic Analysis for:', foodInput);

    // ── Cache check: return near-instantly for repeat meals ──
    const cached = await getCachedFood(foodInput);
    if (cached && cached.foods.length > 0) {
      if (__DEV__) console.log('Cache HIT for:', foodInput);
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay so UI transition feels smooth
      const cachedFoods: ParsedFood[] = cached.foods.map(f => ({ ...f, id: generateId() }));
      return { foods: cachedFoods, summary: cached.summary };
    }

    let finalPrompt = AGENTIC_ANALYSIS_PROMPT;
    if (!allowClarification) {
      finalPrompt += `\n\nCRITICAL OVERRIDE: failed to clarify. You MUST NOT return a "clarification_question". You MUST make reasonable assumptions for any missing details and return the nutritional JSON.`;
    }

    const data = await invokeAI({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: finalPrompt },
        { role: 'user', content: sanitizeForAI(foodInput) }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      call_type: 'food-analysis',
    });

    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const result = JSON.parse(content);

    if (result.clarification_question && allowClarification) {
      return { foods: [], clarificationQuestion: result.clarification_question };
    }

    const items = result.items || [];
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
        vitamin_a_mcg: item.nutrition.vitamin_a_mcg,
        vitamin_c_mg: item.nutrition.vitamin_c_mg,
        vitamin_d_mcg: item.nutrition.vitamin_d_mcg,
        vitamin_b12_mcg: item.nutrition.vitamin_b12_mcg,
      });
    }

    // ── Cache the result for future instant lookups ──
    if (finalFoods.length > 0) {
      setCachedFood(foodInput, finalFoods, result.summary);
    }

    return { foods: finalFoods, summary: result.summary };

  } catch (error) {
    if (__DEV__) console.error('Error in agentic food analysis:', error);
    // Fallback to local parsing
    const { parseFoodInput } = require('../utils/foodNutrition');
    return { foods: parseFoodInput(foodInput) };
  }
}

// Helper to fetch deterministic factors for the library
async function fetchNutritionFactors(foodName: string): Promise<NutritionLibraryItem | null> {
  try {
    const data = await invokeAI({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: NUTRITION_ESTIMATION_PROMPT },
        { role: 'user', content: sanitizeForAI(foodName, 500) }
      ],
      temperature: 0.2,
      call_type: 'nutrition-factors',
    });
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    const result = JSON.parse(content);
    return {
      name: result.name || foodName,
      calories_per_100g: result.calories_per_100g || 0,
      protein_per_100g: result.protein_per_100g || 0,
      carbs_per_100g: result.carbs_per_100g || 0,
      fat_per_100g: result.fat_per_100g || 0,

      // Extended Macros
      dietary_fiber_per_100g: result.dietary_fiber_per_100g ?? result.fiber_per_100g, // Fallback for legacy prop
      sugar_per_100g: result.sugar_per_100g,
      added_sugars_per_100g: result.added_sugars_per_100g,
      sugar_alcohols_per_100g: result.sugar_alcohols_per_100g,
      net_carbs_per_100g: result.net_carbs_per_100g,

      saturated_fat_per_100g: result.saturated_fat_per_100g,
      trans_fat_per_100g: result.trans_fat_per_100g,
      polyunsaturated_fat_per_100g: result.polyunsaturated_fat_per_100g,
      monounsaturated_fat_per_100g: result.monounsaturated_fat_per_100g,

      sodium_mg_per_100g: result.sodium_mg_per_100g,
      potassium_mg_per_100g: result.potassium_mg_per_100g,
      cholesterol_mg_per_100g: result.cholesterol_mg_per_100g,
      calcium_mg_per_100g: result.calcium_mg_per_100g,
      iron_mg_per_100g: result.iron_mg_per_100g,

      vitamin_a_mcg_per_100g: result.vitamin_a_mcg_per_100g,
      vitamin_c_mg_per_100g: result.vitamin_c_mg_per_100g,
      vitamin_d_mcg_per_100g: result.vitamin_d_mcg_per_100g,
      vitamin_e_mg_per_100g: result.vitamin_e_mg_per_100g,
      vitamin_k_mcg_per_100g: result.vitamin_k_mcg_per_100g,
      vitamin_b12_mcg_per_100g: result.vitamin_b12_mcg_per_100g,

      standard_unit: result.standard_unit || 'serving',
      standard_serving_weight_g: result.standard_serving_weight_g || 100,
    };
  } catch (e) {
    console.error('Failed to fetch nutrition factors', e);
    return null;
  }
}

export async function generateWeeklyInsights(weeklyData: any): Promise<string> {
  try {
    const data = await invokeAI({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a friendly, encouraging nutrition coach.
            Analyze the provided weekly nutrition summary.
            Give ONE brilliant, specific, and positive insight about their eating patterns.
            Keep it under 30 words.
            Focus on trends like "You tend to eat more protein on weekends" or "Your calorie stability is impressive".
            Avoid negative or judgmental language. Use emojis sparingly.`
        },
        {
          role: 'user',
          content: JSON.stringify(sanitizeObjectForAI(weeklyData))
        }
      ],
      temperature: 0.7,
      max_tokens: 60,
      call_type: 'weekly-insights',
    });
    return data.choices[0]?.message?.content || "Keep up the good work! Your consistency allows us to spot helpful trends.";
  } catch (error) {
    if (__DEV__) console.error('Error generating insights:', error);
    return "Your weekly pattern shows solid consistency. Keep logging to unlock more detailed trends!";
  }
}

/**
 * Analyze food from an image using OpenAI Vision API
 */
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

    if (__DEV__) console.log('Sending request to OpenAI Vision API (Describer Mode)...');

    // Step 1: Vision AI describes the food
    const visionData = await invokeAI({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a specialized Food Analyst.
            Describe the food in this image in extreme detail.
            Identify every visible ingredient, sauce (e.g. "Creamy Alfredo", "Tomato Basil"), and estimate precise portion sizes (e.g. "Approx 200g", "1 Large Bowl").
            If you see oil or butter sheen, mention it.
            Return ONLY the description text.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this dish for caloric analysis.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      temperature: 0.3,
      max_tokens: 300,
      call_type: 'food-image-vision',
    });

    const description = visionData.choices[0]?.message?.content;

    if (!description) throw new Error('No description from Vision AI');

    if (__DEV__) console.log('Vision Description:', description);

    // Step 2: Text Agent analyzes the description
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

export async function getCoachChatResponse(sessionMessages: { role: string; content: string }[]): Promise<string> {
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
      model: 'gpt-4o',
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 600,
      call_type: 'coach-chat',
    });
    return data.choices[0]?.message?.content || "I'm drawing a blank. Try again?";

  } catch (error) {
    return "I'm having trouble connecting to the nutrition matrix. Try again in a bit.";
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
      response_format: { type: "json_object" },
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
