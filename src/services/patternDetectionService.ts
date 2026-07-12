import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { dataStorage, DetectedPattern } from './dataStorage';
import { detectPatterns, EngineDay } from '../utils/patternEngine';

/**
 * Pattern Detection Service
 * Deterministic: patterns come from src/utils/patternEngine.ts, computed
 * directly from the user's logs. No AI call, so detection is free and
 * refreshes daily instead of weekly. Every count shown to the user is real.
 */

// Run marker: detection refreshes at most once a day.
const LAST_RUN_KEY = '@trackkal:lastPatternRun';
const RUN_INTERVAL_MS = 20 * 60 * 60 * 1000; // 20h, so it lands once per calendar day

// How long a dismissal holds. After this, a pattern that is STILL true in the
// data may resurface with fresh numbers.
const DISMISS_HOLD_MS = 30 * 24 * 60 * 60 * 1000;

// Detection runs every 20h, so anything not re-confirmed within 48h stopped
// being true and must drop from every surface.
const ACTIVE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

const WINDOW_DAYS = 21;
const MIN_LOGGED_DAYS = 14;

// Meals logged onto a past date, or dumped in one batch session, carry the
// logging time not the eating time. Those hours must not feed time detectors.
const BATCH_LOG_SPAN_MS = 45 * 60 * 1000;

export const patternDetectionService = {
    /**
     * Compute patterns from the last 21 days (today excluded, it is live
     * and unsettled) and store them under stable per-detector ids.
     */
    async analyzePatterns(): Promise<DetectedPattern[]> {
        try {
            const goals = await dataStorage.loadGoals();
            const bankConfig = await dataStorage.loadCalorieBankConfig();

            // A day only counts once enough of it was logged to be meaningful.
            const settledFloor = Math.max(500, (goals?.calories || 0) * 0.4);

            const days: EngineDay[] = [];
            const today = new Date();

            for (let i = WINDOW_DAYS; i >= 1; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateKey = format(date, 'yyyy-MM-dd');

                const meals = await dataStorage.getDailyLog(dateKey);
                if (meals.length === 0) continue;

                const timestamps = meals.map(m => m.timestamp);
                const batchLogged = meals.length >= 2 &&
                    Math.max(...timestamps) - Math.min(...timestamps) <= BATCH_LOG_SPAN_MS;

                const mapped = meals.map(m => {
                    const loggedSameDay = format(new Date(m.timestamp), 'yyyy-MM-dd') === dateKey;
                    return {
                        hour: loggedSameDay && !batchLogged ? new Date(m.timestamp).getHours() : -1,
                        calories: m.foods.reduce((s, f) => s + (Number.isFinite(f.calories) ? f.calories : 0), 0),
                        protein: m.foods.reduce((s, f) => s + (Number.isFinite(f.protein) ? f.protein : 0), 0),
                        foods: m.foods.map(f => ({ name: f.name, protein: Number.isFinite(f.protein) ? f.protein : 0 })),
                    };
                });

                const totalCalories = mapped.reduce((s, m) => s + m.calories, 0);
                if (totalCalories < settledFloor) continue;

                days.push({
                    date: dateKey,
                    weekday: date.getDay(),
                    meals: mapped,
                    totalCalories,
                    totalProtein: mapped.reduce((s, m) => s + m.protein, 0),
                });
            }

            // Stamp the run whatever happens next: under-data users must not
            // re-run on every launch.
            await AsyncStorage.setItem(LAST_RUN_KEY, new Date().toISOString());

            if (days.length < MIN_LOGGED_DAYS) return [];

            const stored = await dataStorage.getDetectedPatterns();
            const now = Date.now();

            // Drop AI-era rows (random uuid ids); the deterministic engine owns
            // this store now and the bulk write below scrubs the cloud copy too.
            const cleaned = stored.filter(p => p.id.startsWith('det:'));

            // Detectors under a dismissal hold are excluded BEFORE the top-3
            // cut so they never block a live finding from surfacing.
            const held = new Set(
                cleaned
                    .filter(p => p.dismissed &&
                        now - new Date(p.dismissedAt || p.detectedAt).getTime() < DISMISS_HOLD_MS)
                    .map(p => p.id.slice(4))
            );

            const findings = detectPatterns({
                days,
                windowDays: WINDOW_DAYS,
                calorieTarget: goals?.calories || undefined,
                proteinTarget: goals?.proteinGrams || undefined,
                bankEnabled: bankConfig?.enabled || false,
            }, held);

            const fresh: DetectedPattern[] = findings.map(f => ({
                id: `det:${f.key}`,
                type: f.type,
                title: f.title,
                description: f.description,
                fix: f.fix,
                confidence: f.confidence,
                dataPoints: f.dataPoints,
                priority: f.priority,
                detectedAt: new Date().toISOString(),
                dismissed: false,
            }));

            const freshIds = new Set(fresh.map(p => p.id));
            const finalSet = [...cleaned.filter(p => !freshIds.has(p.id)), ...fresh];

            const changed = fresh.length > 0 || finalSet.length !== stored.length;
            if (changed) {
                await dataStorage.replaceDetectedPatterns(finalSet);
            }

            return fresh;
        } catch (error) {
            console.error('Pattern detection error:', error);
            return [];
        }
    },

    /**
     * Active patterns: engine-owned, not dismissed, re-confirmed within 48h,
     * strongest first.
     */
    async getActivePatterns(): Promise<DetectedPattern[]> {
        const all = await dataStorage.getDetectedPatterns();
        const now = Date.now();
        return all
            .filter(p => {
                if (!p.id.startsWith('det:')) return false;
                if (p.dismissed) return false;
                return now - new Date(p.detectedAt).getTime() <= ACTIVE_MAX_AGE_MS;
            })
            .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    },

    /**
     * Detection is free now, so it refreshes daily. The marker also covers
     * runs that found nothing.
     */
    async shouldRunDetection(): Promise<boolean> {
        const marker = await AsyncStorage.getItem(LAST_RUN_KEY);
        if (!marker) return true;
        return Date.now() - new Date(marker).getTime() >= RUN_INTERVAL_MS;
    },
};
