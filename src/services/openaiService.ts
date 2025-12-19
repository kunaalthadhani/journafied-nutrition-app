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

const FOOD_STRUCTURE_PROMPT = `
You are an expert food analyst. Analyze the input to identify food items, portion sizes, and estimated weights.

Return ONLY a valid JSON array of objects with this structure:
[
  {
    "name": "General food name (e.g., 'Banana', 'Fried Egg')",
    "quantity": number,
    "unit": "unit description (e.g., 'medium', 'cup')",
    "preparation": "cooking method if specified",
    "estimated_weight_g": number (estimated weight in grams for this portion)
  }
]

Do not calculate calories or macros. Focus only on identifying the food and portion.
If you cannot identify any food, return [].
`;

const NUTRITION_ESTIMATION_PROMPT = `
You are a USDA nutrition database assistant.
Provide standard nutritional values per 100g for the specified food item.

Input: [Food Name]

Return ONLY a valid JSON object:
{
  "name": "Normalized canonical name",
  "calories_per_100g": number,
  "protein_per_100g": number,
  "carbs_per_100g": number,
  "fat_per_100g": number,
  
  // Detailed Macros
  "dietary_fiber_per_100g": number (optional),
  "sugar_per_100g": number (optional),
  "added_sugars_per_100g": number (optional),
  "sugar_alcohols_per_100g": number (optional),
  "net_carbs_per_100g": number (optional),
  
  "saturated_fat_per_100g": number (optional),
  "trans_fat_per_100g": number (optional),
  "polyunsaturated_fat_per_100g": number (optional),
  "monounsaturated_fat_per_100g": number (optional),
  "cholesterol_mg_per_100g": number (optional),

  // Minerals
  "sodium_mg_per_100g": number (optional),
  "potassium_mg_per_100g": number (optional),
  "calcium_mg_per_100g": number (optional),
  "iron_mg_per_100g": number (optional),
  
  // Vitamins
  "vitamin_a_mcg_per_100g": number (optional),
  "vitamin_c_mg_per_100g": number (optional),
  "vitamin_d_mcg_per_100g": number (optional),
  "vitamin_e_mg_per_100g": number (optional),
  "vitamin_k_mcg_per_100g": number (optional),
  "vitamin_b12_mcg_per_100g": number (optional),

  "standard_unit": "standard serving unit (e.g., 'medium', 'cup', 'slice')",
  "standard_serving_weight_g": number (weight of that standard unit)
}
`;

import { supabaseDataService } from './supabaseDataService';
import { NutritionLibraryItem } from './dataStorage';

export async function analyzeFoodWithChatGPT(foodInput: string): Promise<ParsedFood[]> {
  // Validate API key before making request
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

  try {
    if (__DEV__) console.log('Step 1: Parsing food structure for:', foodInput);

    // 1. Structure Parsing (No Macros)
    const structureResponse = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.OPENAI_CONFIG.model,
        messages: [
          { role: 'system', content: FOOD_STRUCTURE_PROMPT },
          { role: 'user', content: foodInput }
        ],
        temperature: 0.3, // Lower temperature for more deterministic structure
        max_tokens: config.OPENAI_CONFIG.max_tokens,
      }),
    });

    if (!structureResponse.ok) throw new Error(`OpenAI API error: ${structureResponse.status}`);
    const structureData: OpenAIResponse = await structureResponse.json();
    const structureContent = structureData.choices[0]?.message?.content;
    if (!structureContent) throw new Error('No response from OpenAI');

    const parsedItems: ParsedStructure[] = JSON.parse(structureContent);
    const finalFoods: ParsedFood[] = [];

    // 2. Nutrition Lookup & Calculation
    for (const item of parsedItems) {
      if (__DEV__) console.log(`Processing item: ${item.name}`);

      // Try reading from Library
      let libraryItem = await supabaseDataService.fetchNutritionFromLibrary(item.name);

      if (!libraryItem) {
        if (__DEV__) console.log(`Cache miss for ${item.name}. Fetching nutrition factors...`);

        // Fallback: Ask AI for factors (The "One-Time Hallucination")
        libraryItem = await fetchNutritionFactors(item.name);

        // Save to Library for future deterministic use
        if (libraryItem) {
          await supabaseDataService.saveNutritionToLibrary(libraryItem);
        }
      }

      if (libraryItem) {
        // Calculate based on 100g factors
        // Formula: (grams / 100) * factor
        const weight = item.estimated_weight_g || libraryItem.standard_serving_weight_g;
        const ratio = weight / 100;

        finalFoods.push({
          id: generateId(),
          name: libraryItem.name, // Use canonical name
          quantity: item.quantity,
          unit: item.unit,
          weight_g: weight,
          calories: Math.round(libraryItem.calories_per_100g * ratio),
          protein: Number((libraryItem.protein_per_100g * ratio).toFixed(1)),
          carbs: Number((libraryItem.carbs_per_100g * ratio).toFixed(1)),
          fat: Number((libraryItem.fat_per_100g * ratio).toFixed(1)),

          // Detailed Macros
          dietary_fiber: libraryItem.dietary_fiber_per_100g ? Number((libraryItem.dietary_fiber_per_100g * ratio).toFixed(1)) : undefined,
          sugar: libraryItem.sugar_per_100g ? Number((libraryItem.sugar_per_100g * ratio).toFixed(1)) : undefined,
          added_sugars: libraryItem.added_sugars_per_100g ? Number((libraryItem.added_sugars_per_100g * ratio).toFixed(1)) : undefined,
          sugar_alcohols: libraryItem.sugar_alcohols_per_100g ? Number((libraryItem.sugar_alcohols_per_100g * ratio).toFixed(1)) : undefined,
          net_carbs: libraryItem.net_carbs_per_100g ? Number((libraryItem.net_carbs_per_100g * ratio).toFixed(1)) : undefined,

          // Fat Breakdown
          saturated_fat: libraryItem.saturated_fat_per_100g ? Number((libraryItem.saturated_fat_per_100g * ratio).toFixed(1)) : undefined,
          trans_fat: libraryItem.trans_fat_per_100g ? Number((libraryItem.trans_fat_per_100g * ratio).toFixed(1)) : undefined,
          polyunsaturated_fat: libraryItem.polyunsaturated_fat_per_100g ? Number((libraryItem.polyunsaturated_fat_per_100g * ratio).toFixed(1)) : undefined,
          monounsaturated_fat: libraryItem.monounsaturated_fat_per_100g ? Number((libraryItem.monounsaturated_fat_per_100g * ratio).toFixed(1)) : undefined,
          cholesterol_mg: libraryItem.cholesterol_mg_per_100g ? Math.round(libraryItem.cholesterol_mg_per_100g * ratio) : undefined,

          // Minerals
          sodium_mg: libraryItem.sodium_mg_per_100g ? Math.round(libraryItem.sodium_mg_per_100g * ratio) : undefined,
          potassium_mg: libraryItem.potassium_mg_per_100g ? Math.round(libraryItem.potassium_mg_per_100g * ratio) : undefined,
          calcium_mg: libraryItem.calcium_mg_per_100g ? Math.round(libraryItem.calcium_mg_per_100g * ratio) : undefined,
          iron_mg: libraryItem.iron_mg_per_100g ? Number((libraryItem.iron_mg_per_100g * ratio).toFixed(1)) : undefined,

          // Vitamins
          vitamin_a_mcg: libraryItem.vitamin_a_mcg_per_100g ? Math.round(libraryItem.vitamin_a_mcg_per_100g * ratio) : undefined,
          vitamin_c_mg: libraryItem.vitamin_c_mg_per_100g ? Number((libraryItem.vitamin_c_mg_per_100g * ratio).toFixed(1)) : undefined,
          vitamin_d_mcg: libraryItem.vitamin_d_mcg_per_100g ? Number((libraryItem.vitamin_d_mcg_per_100g * ratio).toFixed(1)) : undefined,
          vitamin_e_mg: libraryItem.vitamin_e_mg_per_100g ? Number((libraryItem.vitamin_e_mg_per_100g * ratio).toFixed(1)) : undefined,
          vitamin_k_mcg: libraryItem.vitamin_k_mcg_per_100g ? Math.round(libraryItem.vitamin_k_mcg_per_100g * ratio) : undefined,
          vitamin_b12_mcg: libraryItem.vitamin_b12_mcg_per_100g ? Number((libraryItem.vitamin_b12_mcg_per_100g * ratio).toFixed(2)) : undefined,
        });
      } else {
        // Safe fallback
        finalFoods.push({
          id: generateId(),
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          weight_g: item.estimated_weight_g || 100,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        });
      }
    }

    return finalFoods;

  } catch (error) {
    if (__DEV__) console.error('Error in deterministic food analysis:', error);
    // Fallback to local parsing if everything fails
    const { parseFoodInput } = require('../utils/foodNutrition');
    return parseFoodInput(foodInput);
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
    if (__DEV__) console.log('Image read, length:', base64Image.length);

    // Determine image format from URI
    const imageFormat = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    const imageDataUrl = `data:image/${imageFormat};base64,${base64Image}`;

    // Use vision-capable model (gpt-4o or gpt-4-vision-preview)
    const visionModel = 'gpt-4o'; // or 'gpt-4-vision-preview'

    if (__DEV__) console.log('Sending request to OpenAI Vision API...');
    const response = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: visionModel,
        messages: [
          {
            role: 'system',
            content: IMAGE_ANALYSIS_PROMPT + `
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
    
    // Detailed Macros
    "dietary_fiber": total_dietary_fiber_g,
    "sugar": total_sugar_g,
    "added_sugars": total_added_sugars_g,
    "sugar_alcohols": total_sugar_alcohols_g,
    "net_carbs": total_net_carbs_g,
    
    "saturated_fat": total_saturated_fat_g,
    "trans_fat": total_trans_fat_g,
    "polyunsaturated_fat": total_poly_fat_g,
    "monounsaturated_fat": total_mono_fat_g,
    "cholesterol_mg": total_cholesterol_mg,

    // Minerals
    "sodium_mg": total_sodium_mg,
    "potassium_mg": total_potassium_mg,
    "calcium_mg": total_calcium_mg,
    "iron_mg": total_iron_mg,
    
    // Vitamins
    "vitamin_a_mcg": total_vit_a_mcg,
    "vitamin_c_mg": total_vit_c_mg,
    "vitamin_d_mcg": total_vit_d_mcg,
    "vitamin_e_mg": total_vit_e_mg,
    "vitamin_k_mcg": total_vit_k_mcg,
    "vitamin_b12_mcg": total_vit_b12_mcg
  }
]

If you cannot identify any food items, return an empty array: []
`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this food image and provide nutritional information for all visible food items. Estimate portion sizes based on what you see in the image.'
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
        temperature: config.OPENAI_CONFIG.temperature,
        max_tokens: config.OPENAI_CONFIG.max_tokens,
      }),
    });

    if (__DEV__) console.log('OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      if (__DEV__) console.error('OpenAI API error response:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data: OpenAIResponse = await response.json();
    if (__DEV__) console.log('OpenAI response received');

    const content = data.choices[0]?.message?.content;
    if (__DEV__) console.log('Response content length:', content?.length || 0);

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let parsedFoods;
    try {
      parsedFoods = JSON.parse(content);
      if (__DEV__) console.log('Parsed foods count:', parsedFoods.length);
    } catch (parseError) {
      if (__DEV__) console.error('JSON parse error:', parseError);
      if (__DEV__) console.error('Content:', content);
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    // Add unique IDs to each food item (food items don't need UUIDs, they're stored in JSONB)
    const foodsWithIds = parsedFoods.map((food: any) => ({
      ...food,
      id: food.id || generateId(),
    }));

    if (__DEV__) console.log('Returning parsed foods:', foodsWithIds.length);
    return foodsWithIds;

  } catch (error) {
    if (__DEV__) console.error('Error analyzing food from image:', error);
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
- Be specific. Don't just say "eat protein". Say "How about a Grilled Chicken Salad with light dressing? It fits your 400kcal remaining perfectly."

### Output Format
- Return a **single plain text recommendation**.
- Be concise (max 2 sentences).
- No markdown headers.
- Start directly with the suggestion (e.g., "Since you're low on protein...")
`;

export async function generateSmartSuggestion(context: any): Promise<string> {
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    return "Upgrade to Premium to unlock Smart Suggestions based on your unique metabolism!";
  }

  try {
    const response = await fetch(config.API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
    return data.choices[0]?.message?.content || "Keep hitting those macros!";

  } catch (error) {
    console.error('Error generating smart suggestion:', error);
    return "Smart Suggest is temporarily offline.";
  }
}