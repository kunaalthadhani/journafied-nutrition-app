// OpenAI API service for food analysis
import { ParsedFood } from '../utils/foodNutrition';
import { ParsedExercise, parseExerciseInput } from '../utils/exerciseParser';
import { config } from '../config/env';
import * as FileSystem from 'expo-file-system/legacy';
import { generateId } from '../utils/uuid';
import { chatCoachService } from './chatCoachService';
import { NutritionLibraryItem } from './dataStorage';

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

const FOOD_ANALYSIS_PROMPT = `
You are an expert nutritionist and food analyst. Your job is to understand what the user ate and provide accurate nutritional information.

Analyze the food input carefully:
- Identify all food items mentioned
- Consider cooking methods (grilled, fried, boiled, etc.)
- Account for portion sizes and descriptors (large, small, cup, handful)
- Include condiments and additions mentioned
- Use the most accurate nutritional data from USDA or similar databases

Return ONLY a valid JSON array with detailed nutritional information:
`;

const IMAGE_ANALYSIS_PROMPT = `
You are an expert nutritionist and food analyst. Analyze the food image provided and estimate the nutritional information.

Look at the image carefully and:
- Identify all visible food items
- Estimate portion sizes based on visual cues (plates, bowls, common serving sizes)
- Consider cooking methods visible in the image (grilled, fried, boiled, etc.)
- Account for visible condiments, sauces, and additions
- Estimate weights based on typical serving sizes for the foods identified
- Use accurate nutritional data from USDA or similar databases

Return ONLY a valid JSON array with detailed nutritional information:

Return format (JSON array only, no other text):
[
  {
    "name": "Food name",
    "quantity": number,
    "unit": "description of quantity (e.g., 'medium banana', 'cup of rice')",
    "weight_g": estimated_weight_in_grams,
    "calories": total_calories_for_this_quantity,
    "protein": total_protein_in_grams,
    "carbs": total_carbs_in_grams,
    "fat": total_fat_in_grams,
    "fiber": total_fiber_in_grams_optional,
    "sugar": total_sugar_in_grams_optional,
    "sodium_mg": total_sodium_mg_optional,
    "potassium_mg": total_potassium_mg_optional,
    "saturated_fat": total_saturated_fat_g_optional,
    "cholesterol_mg": total_cholesterol_mg_optional
  }
]

If you cannot identify any food items, return an empty array: []

Example input: "I had one large banana and two eggs"
Example output: [
  {
    "name": "Large Banana",
    "quantity": 1,
    "unit": "large banana",
    "weight_g": 136,
    "calories": 121,
    "protein": 1.5,
    "carbs": 31.1,
    "fat": 0.4
  },
  {
    "name": "Eggs",
    "quantity": 2,
    "unit": "large eggs",
    "weight_g": 100,
    "calories": 310,
    "protein": 26,
    "carbs": 2.2,
    "fat": 22
  }
]
`;

const EXERCISE_ANALYSIS_PROMPT = `
You are a certified fitness coach. Analyze the user's text to identify any exercises or workouts they completed and estimate calories burned.

For each exercise:
- Identify the movement (e.g., Running, Walking, Cycling, Strength Training).
- Estimate duration in minutes (convert hours if needed).
- Classify intensity as "low", "moderate", or "high".
- Estimate calories burned using reasonable MET values for the activity and intensity.

If the text includes multiple exercises, include each as its own entry.

Return ONLY a JSON array in the following shape:
[
  {
    "name": "Running",
    "duration_minutes": 30,
    "intensity": "high",
    "calories": 320,
    "notes": "Sunset run with strides"
  }
]

If you cannot identify any exercises, return an empty array [].
`;

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

// New Types for Step 1 Parsing
interface ParsedStructure {
  name: string;
  quantity: number;
  unit: string;
  preparation?: string;
  estimated_weight_g: number; // We still ask AI for this to handle unit conversion for now
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
  // Validate API key
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

  try {
    if (__DEV__) console.log('Starting Agentic Analysis for:', foodInput);

    let finalPrompt = AGENTIC_ANALYSIS_PROMPT;
    if (!allowClarification) {
      finalPrompt += `\n\nCRITICAL OVERRIDE: failed to clarify. You MUST NOT return a "clarification_question". You MUST make reasonable assumptions for any missing details and return the nutritional JSON.`;
    }

    const response = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Strongly recommended for this logic depth
        messages: [
          { role: 'system', content: finalPrompt },
          { role: 'user', content: foodInput }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data: OpenAIResponse = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const result = JSON.parse(content);

    if (result.clarification_question && allowClarification) {
      return { foods: [], clarificationQuestion: result.clarification_question };
    }

    const items = result.items || [];
    const finalFoods: ParsedFood[] = [];

    for (const item of items) {
      // We skip the sequential DB lookup for the *macros* because the Agent has done a better job 
      // of calculating the composite macros (Chicken + Sauce + Pasta) than our generic DB would (just "Pasta").
      // However, we still format it as ParsedFood.

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
    const response = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.OPENAI_CONFIG.model,
        messages: [
          { role: 'system', content: NUTRITION_ESTIMATION_PROMPT },
          { role: 'user', content: foodName }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) return null;
    const data: OpenAIResponse = await response.json();
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

export async function analyzeExerciseWithChatGPT(exerciseInput: string): Promise<ParsedExercise[]> {
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

  try {
    const response = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.OPENAI_CONFIG.model,
        messages: [
          { role: 'system', content: EXERCISE_ANALYSIS_PROMPT },
          { role: 'user', content: exerciseInput },
        ],
        temperature: Math.min(0.8, Math.max(0.2, config.OPENAI_CONFIG.temperature)),
        max_tokens: config.OPENAI_CONFIG.max_tokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data: OpenAIResponse = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error('Exercise response is not an array');
    }

    const exercises: ParsedExercise[] = parsed
      .map((exercise: any) => ({
        id: generateId(),
        name: exercise.name || 'Exercise',
        duration_minutes: Math.round(
          Number(
            exercise.duration_minutes ??
            exercise.duration ??
            exercise.minutes ??
            exercise.time ??
            0
          ) || 0
        ),
        intensity: exercise.intensity || 'moderate',
        calories: Math.round(
          Number(exercise.calories ?? exercise.calories_burned ?? exercise.energy ?? 0) || 0
        ),
        notes: exercise.notes,
      }))
      .filter((exercise) => exercise.duration_minutes > 0 || exercise.calories > 0);

    return exercises;
  } catch (error) {
    if (__DEV__) console.error('Error analyzing exercise with ChatGPT:', error);
    return parseExerciseInput(exerciseInput);
  }
}

// ... (existing code)

export async function generateWeeklyInsights(weeklyData: any): Promise<string> {
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    // Return a default canned insight if no API key
    return "Great job tracking this week! Your protein intake is steady. Try boosting fiber next week for even better energy.";
  }

  try {
    const response = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.OPENAI_CONFIG.model,
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
            content: JSON.stringify(weeklyData)
          }
        ],
        temperature: 0.7,
        max_tokens: 60,
      }),
    });

    if (!response.ok) return "You're doing great! Consistent tracking is the key to success. Keep it up!";

    const data: OpenAIResponse = await response.json();
    return data.choices[0]?.message?.content || "Keep up the good work! Your consistency allows us to spot helpful trends.";
  } catch (error) {
    if (__DEV__) console.error('Error generating insights:', error);
    return "Your weekly pattern shows solid consistency. Keep logging to unlock more detailed trends!";
  }
}

// Validation function to ensure the response format is correct
function validateFoodResponse(foods: any[]): boolean {
  // ...
  if (!Array.isArray(foods)) return false;

  return foods.every(food =>
    typeof food.name === 'string' &&
    typeof food.quantity === 'number' &&
    typeof food.unit === 'string' &&
    typeof food.weight_g === 'number' &&
    typeof food.calories === 'number' &&
    typeof food.protein === 'number' &&
    typeof food.carbs === 'number' &&
    typeof food.fat === 'number'
  );
}

/**
 * Analyze food from an image using OpenAI Vision API
 */
export async function analyzeFoodFromImage(imageUri: string): Promise<{ foods: ParsedFood[], summary?: string }> {
  // Validate API key before making request
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

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
    const visionResponse = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
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
        max_tokens: 300,
      }),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      if (__DEV__) console.error('Vision API error response:', errorText);
      throw new Error(`Vision API error: ${visionResponse.status} - ${errorText}`);
    }

    const visionData = await visionResponse.json();
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
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

  try {
    const systemMessageContent = await chatCoachService.generateSystemMessage();

    // Construct the full payload: System Context + Session History
    const finalMessages = [
      { role: 'system', content: systemMessageContent },
      ...sessionMessages
    ];

    const response = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use high-intelligence model for the Coach personality
        messages: finalMessages,
        temperature: 0.7, // Allow some creativity/wit
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI Error details:', errText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data: OpenAIResponse = await response.json();
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

import AsyncStorage from '@react-native-async-storage/async-storage';

const SMART_SUGGEST_LIMIT_KEY = 'smart_suggest_limit_v1';
const DAILY_LIMIT = 2;

interface SmartSuggestionResult {
  displayText: string;
  loggableText: string;
  reasoning?: string;
}

export async function generateSmartSuggestion(context: any, forceNew: boolean = false, options?: { forceHungry?: boolean }): Promise<SmartSuggestionResult> {
  const fallback = { displayText: "Upgrade to Premium for Smart Suggestions!", loggableText: "" };

  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    return fallback;
  }

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

    const response = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SMART_SUGGEST_PROMPT },
          { role: 'user', content: JSON.stringify(enrichedContext) }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) return { displayText: "Unable to generate suggestion right now.", loggableText: "" };

    const data: OpenAIResponse = await response.json();
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
