// OpenAI API service for food analysis
import { ParsedFood } from '../utils/foodNutrition';
import { ParsedExercise, parseExerciseInput } from '../utils/exerciseParser';
import { config } from '../config/env';
import * as FileSystem from 'expo-file-system/legacy';
import { generateId } from '../utils/uuid';
import { chatCoachService } from './chatCoachService';

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
   - If the input is clear enough, break down complex dishes into atomic ingredients.
   - Example: "Pasta" (if context allows assumption) -> Cooked Pasta + Olive Oil/Butter + Sauce + Cheese + Protein.
   - **Crucial:** Always account for "hidden calories".

3. **The Quantifier (The Physicist):**
   - Convert vague units ("a bowl") into accurate gram weights.
   - Sum up the macros.

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
        "fat": Number
      }
    }
  ]
}

- Return ONLY valid JSON.
`;

export async function analyzeFoodWithChatGPT(foodInput: string): Promise<{ foods: ParsedFood[], clarificationQuestion?: string }> {
  // Validate API key
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

  try {
    if (__DEV__) console.log('Starting Agentic Analysis for:', foodInput);

    const response = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Strongly recommended for this logic depth
        messages: [
          { role: 'system', content: AGENTIC_ANALYSIS_PROMPT },
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

    if (result.clarification_question) {
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
        // We can put the reasoning in a hidden field if we ever want to show "Why this calorie count?"
        // For now, we trust the agent.
      });
    }

    return { foods: finalFoods };

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
export async function analyzeFoodFromImage(imageUri: string): Promise<ParsedFood[]> {
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
    const result = await analyzeFoodWithChatGPT(description);

    // If clarification is needed, we (unfortunately) can't ask the user in this flow yet without refactoring HomeScreen.
    // For now, we assume the Vision description was good enough. 
    // If it *still* asks for clarification, it returns empty foods.
    // To handle this better, we could recursively call with "Ignore ambiguity" flag, but let's trust gpt-4o vision + text.
    return result.foods;

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
Your goal is to suggest the OPTIMUM NEXT MEAL for the user based on what they have already eaten today and their specific goals.

### User Context
You will receive:
1.  **Remaining Calories & Macros:** (e.g. 500 kcal left, needs 30g protein).
2.  **Current Time:** To know if it's lunch, dinner, or snack time.
3.  **Recent Logged Meals:** What they just ate (avoid recommending the exact same thing unless they love it).
4.  **Goal:** e.g. "Lose Weight" or "Gain Muscle".

### Logic
- If it's morning (before 11am) and they listed 0 meals, suggest a high-protein breakfast.
- If they have many calories left but low protein, suggest a lean protein source.
- If they have few calories left, suggest a high-volume, low-cal snack.
- **ALWAYS include specific quantities and weights** (e.g., "150g Grilled Chicken", "200g Greek Yogurt").

### Output Format
- Return a **single plain text recommendation**.
- Be concise (max 2 sentences).
- Start directly with the suggestion (e.g., "Try a 200g Chicken Salad...").
`;

import AsyncStorage from '@react-native-async-storage/async-storage';

const SMART_SUGGEST_LIMIT_KEY = 'smart_suggest_limit_v1';
const DAILY_LIMIT = 2;

export async function generateSmartSuggestion(context: any, forceNew: boolean = false): Promise<string> {
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    return "Upgrade to Premium to unlock Smart Suggestions based on your unique metabolism!";
  }

  try {
    // 1. Check Daily Limit and Cache
    const now = new Date();
    const todayKey = now.toISOString().split('T')[0]; // "2023-10-27"

    const storedData = await AsyncStorage.getItem(SMART_SUGGEST_LIMIT_KEY);
    let usage = { date: todayKey, count: 0, suggestion: '' };

    if (storedData) {
      const parsed = JSON.parse(storedData);
      if (parsed.date === todayKey) {
        usage = parsed;
      }
    }

    // Return cached suggestion if available and not forcing new
    if (!forceNew && usage.suggestion) {
      return usage.suggestion;
    }

    if (usage.count >= DAILY_LIMIT) {
      return "You've reached your daily Smart Suggest limit. Check back tomorrow!";
    }

    // 2. call API with Cheaper Model
    const response = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost optimized
        messages: [
          { role: 'system', content: SMART_SUGGEST_PROMPT },
          { role: 'user', content: JSON.stringify(context) }
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    if (!response.ok) return "Unable to generate smart suggestion right now.";

    const data: OpenAIResponse = await response.json();
    const suggestion = data.choices[0]?.message?.content || "Keep hitting those macros!";

    // 3. Increment Limit and Save Cache
    usage.count += 1;
    usage.suggestion = suggestion; // Cache the new suggestion
    await AsyncStorage.setItem(SMART_SUGGEST_LIMIT_KEY, JSON.stringify(usage));

    return suggestion;

  } catch (error) {
    console.error('Error generating smart suggestion:', error);
    return "Smart Suggest is temporarily offline.";
  }
}