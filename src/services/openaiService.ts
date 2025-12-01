// OpenAI API service for food analysis
import { ParsedFood } from '../utils/foodNutrition';
import { ParsedExercise, parseExerciseInput } from '../utils/exerciseParser';
import { config } from '../config/env';
import * as FileSystem from 'expo-file-system/legacy';
import { generateId } from '../utils/uuid';

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
    "fat": total_fat_in_grams
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

export async function analyzeFoodWithChatGPT(foodInput: string): Promise<ParsedFood[]> {
  // Validate API key before making request
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

  try {
    if (__DEV__) console.log('Calling OpenAI API for food analysis:', foodInput);
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
            content: FOOD_ANALYSIS_PROMPT + `
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
    "fat": total_fat_in_grams
  }
]

If you cannot identify any food items, return an empty array: []
`
          },
          {
            role: 'user',
            content: foodInput
          }
        ],
        temperature: config.OPENAI_CONFIG.temperature,
        max_tokens: config.OPENAI_CONFIG.max_tokens,
      }),
    });
    
    if (__DEV__) console.log('OpenAI API response status:', response.status);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data: OpenAIResponse = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const parsedFoods = JSON.parse(content);
    
    // Add unique IDs to each food item (food items don't need UUIDs, they're stored in JSONB)
    const foodsWithIds = parsedFoods.map((food: any) => ({
      ...food,
      id: food.id || generateId(),
    }));

    return foodsWithIds;

  } catch (error) {
    if (__DEV__) console.error('Error analyzing food with ChatGPT:', error);
    
    // Fallback to local parsing if ChatGPT fails
    if (__DEV__) console.log('Falling back to local food parsing...');
    const { parseFoodInput } = require('../utils/foodNutrition');
    return parseFoodInput(foodInput);
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

// Validation function to ensure the response format is correct
function validateFoodResponse(foods: any[]): boolean {
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
    "fat": total_fat_in_grams
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