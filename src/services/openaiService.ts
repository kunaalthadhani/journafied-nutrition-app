// OpenAI API service for food analysis
import { ParsedFood } from '../utils/foodNutrition';
import { config } from '../config/env';

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

const FOOD_ANALYSIS_PROMPT = `
You are a nutrition expert. Analyze the food input and return ONLY a valid JSON array of food items with their nutritional information.

For each food item, calculate the nutritional values based on the quantity and size mentioned. Use standard nutritional databases (USDA, etc.).

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

export async function analyzeFoodWithChatGPT(foodInput: string): Promise<ParsedFood[]> {
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
            content: FOOD_ANALYSIS_PROMPT
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
    
    // Add unique IDs to each food item
    const foodsWithIds = parsedFoods.map((food: any) => ({
      ...food,
      id: `chatgpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }));

    return foodsWithIds;

  } catch (error) {
    console.error('Error analyzing food with ChatGPT:', error);
    
    // Fallback to local parsing if ChatGPT fails
    console.log('Falling back to local food parsing...');
    const { parseFoodInput } = require('../utils/foodNutrition');
    return parseFoodInput(foodInput);
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