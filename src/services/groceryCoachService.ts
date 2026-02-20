
import { invokeAI } from './aiProxyService';
import { UserMetricsSnapshot, Insight } from './dataStorage';
import { GrocerySuggestionResult } from './GrocerySuggestionService';
import { sanitizeObjectForAI } from '../utils/sanitizeAI';

export interface GroceryContext {
    userGoal: string; // lose, maintain, gain
    targetCalories: number;
    avgCalories: number;
    consistencyScore: number;
    weightTrendChange: number | null; // raw kg change
    activeInsightTypes: string[];
    commonFoods: string[];
}

// Re-adding skipped interfaces
export interface GroceryCoachExplanation {
    title: string;
    summary: string;
    itemExplanations: {
        [foodName: string]: string;
    };
}


const GROCERY_COACH_SYSTEM_PROMPT = `
You are a calm, practical, and non-preachy nutrition coach.
Your task is to explain a pre-generated grocery list to a user based on their recent data context.

You will receive:
1. A "Grocery Suggestion Result" (the list of foods).
2. A "Grocery Context" object (containing goals, caloric intake, weight trends, and consistency).

GOAL: Explain WHY these specific foods are on the list and provide a high-level strategy summary.

REASONING INSTRUCTIONS:
- Analyze the user's Context (calories vs target, weight trend, consistency).
- If the user is Consistent (Score > 75%), eating near maintenance calories (Avg ~ Target), and Weight is Stable (Change ~ 0) but goal is "Left":
  -> Consider that "Hidden Calories" from preparation methods (oils, sauces) or portion creep might be the cause.
  -> Gently hypothesize this in the 'summary', e.g., "Since you're so consistent but weight is stable, we might look at how foods are prepared (oils/sauces)."
  -> Do NOT state this as fact. Use phrasing like "might be," "consider checking," or "hypothesis."
- If Protein is low (implied by high-level insights), emphasize protein choices.
- If Fiber is low, emphasize veggie/carb choices.

STRICT GUARDRAILS:
1. Do NOT add new foods. Only explain the ones provided.
2. Do NOT remove foods.
3. Do NOT suggest specific quantities (e.g., "Eat 3 eggs") unless they match the list.
4. Do NOT invent specific micronutrient data.
5. Do NOT give medical advice.
6. Use a calm, helpful tone.
7. Connect the food to the context.

OUTPUT FORMAT:
Return ONLY a valid JSON object with this shape:
{
  "title": "A short, encouraging title for this list",
  "summary": "A 1-2 sentence summary of the strategy, incorporating any plateau/preparation reasoning if applicable.",
  "itemExplanations": {
    "Food Name": "One short sentence explaining this choice."
  }
}
`;

export const groceryCoachService = {
    async getGroceryCoachExplanation(
        groceryResult: GrocerySuggestionResult,
        context: GroceryContext
    ): Promise<GroceryCoachExplanation | null> {

        try {
            // 1. Prepare Context (sanitize user-controlled food names to prevent prompt injection)
            const safeContext = sanitizeObjectForAI(context);
            const safeItems = sanitizeObjectForAI(groceryResult.items.map(i => ({ name: i.name, category: i.category })));
            const contextString = JSON.stringify(safeContext, null, 2);
            const listString = JSON.stringify(safeItems);

            const userPrompt = `Please explain this grocery list.\n\nGROCERY LIST:\n${listString}\n\nUSER CONTEXT:\n${contextString}`;

            // 2. Call AI via proxy
            const data = await invokeAI({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: GROCERY_COACH_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.5,
                max_tokens: 450,
                response_format: { type: "json_object" },
                call_type: 'grocery-coach',
            });
            const content = data.choices[0]?.message?.content;

            if (!content) return null;

            // 4. Parse & Validate
            const parsed = JSON.parse(content) as GroceryCoachExplanation;

            // Basic validation check
            if (!parsed.title || !parsed.itemExplanations) {
                console.error('Grocery Coach: Invalid JSON structure');
                return null;
            }

            return parsed;

        } catch (error) {
            console.error('Grocery Coach Service Error:', error);
            return null;
        }
    }
};
