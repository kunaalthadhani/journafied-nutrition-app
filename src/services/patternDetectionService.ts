import { dataStorage, DetectedPattern } from './dataStorage';
import { generateId } from '../utils/uuid';
import { config } from '../config/env';

interface OpenAIResponse {
    choices: { message: { content: string } }[];
}

/**
 * Pattern Detection Service
 * Analyzes user's meal logs to detect meaningful behavioral patterns
 * Only surfaces patterns with high confidence (>70%)
 */

const PATTERN_DETECTION_PROMPT = `
You are a behavioral pattern analyst for nutrition data.

Your task is to find STATISTICALLY MEANINGFUL patterns in a user's eating behavior.

### Rules:
1. **Only report patterns with HIGH CONFIDENCE** (supported by multiple data points)
2. **Focus on actionable correlations**, not obvious facts
3. **Be specific** about the relationship (e.g., "Low-protein breakfasts → evening overeating")
4. **Provide a concrete fix** that the user can implement

### Input Format:
You will receive an array of daily summaries with:
- Date
- Meals (with macros and timing)
- Total calories, protein, carbs, fat
- Whether they exceeded their goal

### Your Analysis Should Find:
- **Trigger Patterns:** What meal characteristics lead to overeating?
- **Correlation Patterns:** What foods/macros correlate with goal adherence?
- **Outcome Patterns:** What behaviors predict success vs. failure days?

### Output Format (JSON):
{
  "patterns": [
    {
      "type": "correlation",
      "title": "Low-protein breakfasts trigger evening overeating",
      "description": "On 8 out of 10 days when breakfast had <20g protein, you exceeded your calorie goal by dinnertime.",
      "fix": "Add Greek yogurt (150g) to your usual breakfast. This adds 15g protein and reduces evening cravings by ~40% based on your history.",
      "confidence": 80,
      "dataPoints": 10
    }
  ]
}

**Return empty array if no strong patterns found.**
`;

export const patternDetectionService = {
    /**
     * Analyze user's meal data and detect patterns
     * Only triggers if user has 14+ days of data
     */
    async analyzePatterns(): Promise<DetectedPattern[]> {
        try {
            // 1. Gather last 21 days of data
            const dailyData = [];
            const today = new Date();

            for (let i = 0; i < 21; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateKey = date.toISOString().split('T')[0];

                const meals = await dataStorage.getDailyLog(dateKey);

                if (meals.length > 0) {
                    dailyData.push({
                        date: dateKey,
                        meals: meals.map(m => ({
                            timestamp: m.timestamp,
                            totalCalories: m.foods.reduce((sum, f) => sum + f.calories, 0),
                            totalProtein: m.foods.reduce((sum, f) => sum + f.protein, 0),
                            foods: m.foods.map(f => f.name)
                        }))
                    });
                }
            }

            // Need at least 14 days of data
            if (dailyData.length < 14) {
                return [];
            }

            // 2. Call AI for pattern detection
            if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
                return [];
            }

            const response = await fetch(config.API_ENDPOINTS.OPENAI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: PATTERN_DETECTION_PROMPT },
                        { role: 'user', content: JSON.stringify({ dailyData: dailyData.slice(0, 14) }) }
                    ],
                    temperature: 0.3, // Lower temperature for more deterministic analysis
                    response_format: { type: "json_object" }
                }),
            });

            if (!response.ok) {
                console.error('Pattern detection API failed');
                return [];
            }

            const data: OpenAIResponse = await response.json();
            const content = data.choices[0]?.message?.content;

            if (!content) return [];

            const parsed = JSON.parse(content);
            const patterns: DetectedPattern[] = (parsed.patterns || [])
                .filter((p: any) => p.confidence >= 70) // Only high-confidence patterns
                .map((p: any) => ({
                    id: generateId(),
                    type: p.type || 'correlation',
                    title: p.title,
                    description: p.description,
                    fix: p.fix,
                    confidence: p.confidence,
                    dataPoints: p.dataPoints,
                    detectedAt: new Date().toISOString(),
                    dismissed: false
                }));

            // 3. Save patterns
            for (const pattern of patterns) {
                await dataStorage.saveDetectedPattern(pattern);
            }

            return patterns;

        } catch (error) {
            console.error('Pattern detection error:', error);
            return [];
        }
    },

    /**
     * Get active (non-dismissed) patterns
     */
    async getActivePatterns(): Promise<DetectedPattern[]> {
        const all = await dataStorage.getDetectedPatterns();
        return all.filter(p => !p.dismissed);
    },

    /**
     * Check if enough time has passed since last pattern detection
     * Run at most once per week
     */
    async shouldRunDetection(): Promise<boolean> {
        const patterns = await dataStorage.getDetectedPatterns();
        if (patterns.length === 0) return true;

        const lastDetection = patterns.reduce((latest, p) => {
            const pDate = new Date(p.detectedAt);
            return pDate > latest ? pDate : latest;
        }, new Date(0));

        const daysSince = Math.floor((Date.now() - lastDetection.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince >= 7;
    },

    /**
     * 🧪 TEST FUNCTION: Inject a demo pattern for UI testing
     * Call this from your app to see the pattern card immediately
     */
    async injectDemoPattern(): Promise<DetectedPattern> {
        const demoPattern: DetectedPattern = {
            id: generateId(),
            type: 'correlation',
            title: 'Low-protein breakfasts lead to evening overeating',
            description: 'On 8 out of 10 days when your breakfast had less than 20g protein, you exceeded your calorie goal by dinner time. This pattern has been consistent over the past 2 weeks.',
            fix: 'Add Greek yogurt (150g) to your usual breakfast. This adds 15g protein and historically reduces your evening cravings by ~40%.',
            confidence: 82,
            dataPoints: 10,
            detectedAt: new Date().toISOString(),
            dismissed: false
        };

        await dataStorage.saveDetectedPattern(demoPattern);
        console.log('✅ Demo pattern injected! Reload the app to see it.');
        return demoPattern;
    }
};
