import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  Modal,
  Alert,
  findNodeHandle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../constants/typography';
import { Acid } from '../constants/acid';
import { format, subDays, subMonths, subYears, parseISO, startOfWeek, endOfWeek, startOfDay, isSameDay } from 'date-fns';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, Text as SvgText, Polygon, Rect } from 'react-native-svg';
import { Meal } from '../components/FoodLogSection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyticsService } from '../services/analyticsService';
import { generateWeeklyInsights } from '../services/openaiService';
import { dataStorage, DailySummary } from '../services/dataStorage';
import { generateInsights, getActionForInsight } from '../services/insightService';
import { patternDetectionService } from '../services/patternDetectionService';
import { InsightUnlocks, isInsightUnlocked, getInsightDefinition, InsightId } from '../utils/insightUnlockEngine';
import { ChartRange, CHART_RANGES, getRangeWindow, getPreviousWindow, isInRange, rangeLabel, previousRangeLabel } from '../utils/chartRange';
import { MicronutrientCard } from '../components/MicronutrientCard';

interface NutritionAnalysisScreenProps {
  onBack: () => void;
  onRequestLogMeal?: () => void;
  onRequestLogMealForDate?: (date: Date) => void;
  onRequestSetGoals?: () => void;
  mealsByDate?: Record<string, Meal[]>;
  summariesByDate?: Record<string, DailySummary>;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  isPremium?: boolean;
  calorieBankData?: {
    enabled: boolean;
    weeklyBudget: number;
    weeklyActual: number;
    bankBalance: number;
    bankUtilization: number;
    expiredCalories: number;
    dailyCapPercent: number;
    cycleStartDay: string;
    cycleStartDayNum: number; // 0=Sun, 1=Mon, ..., 6=Sat
    perDayBreakdown: { day: string; base: number; adjusted: number; actual: number; banked: number; spent: number }[];
    capHitDays: number;
    spendCapHitDays: number;
  } | null;
  insightUnlocks?: InsightUnlocks;
  visible?: boolean;
  initialTab?: 'Calories' | 'Macros' | 'Insights';
  scrollToInsight?: InsightId | null;
  onScrollToInsightConsumed?: () => void;
}

// One shared meaning for every range pill in the app. 1D is gone on purpose: a
// single dot is not a trend, and its old window was off by one anyway. 2Y was
// defined but never rendered as a button.
type TimeRange = ChartRange;
type TabType = 'Calories' | 'Macros' | 'Insights';

interface TopPriorityItem {
  kind: 'pattern' | 'warning' | 'pattern-rule' | 'suggestion' | 'achievement';
  rank: number;
  title: string;
  description: string;
  actionLabel: string | null;
  actionText: string | null;
  canLogMeal: boolean;
}

interface DailyNutrition {
  date: Date;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export const NutritionAnalysisScreen: React.FC<NutritionAnalysisScreenProps> = ({
  onBack,
  onRequestLogMeal,
  onRequestLogMealForDate,
  onRequestSetGoals,
  mealsByDate = {},
  summariesByDate,
  targetCalories: targetCaloriesProp,
  targetProtein: targetProteinProp,
  targetCarbs: targetCarbsProp,
  targetFat: targetFatProp,
  isPremium = false,
  calorieBankData = null,
  insightUnlocks = {},
  visible = false,
  initialTab,
  scrollToInsight = null,
  onScrollToInsightConsumed,
}) => {  const insightsScrollRef = useRef<ScrollView>(null);
  const insightSlotRefs = useRef<Partial<Record<InsightId, View | null>>>({});
  const pendingScrollRef = useRef<InsightId | null>(null);
  const consumedCbRef = useRef(onScrollToInsightConsumed);
  consumedCbRef.current = onScrollToInsightConsumed;

  // Scrolls the Insights list so the target card sits near the top. Measures the
  // card against the scroll content node, not its parent, because onLayout y is
  // parent relative and was landing the scroll ~200px too high. Returns false if
  // the card is not mounted yet so the caller can retry on the next frame.
  const scrollToInsightCard = (id: InsightId): boolean => {
    const slot = insightSlotRefs.current[id];
    const sv = insightsScrollRef.current as any;
    if (!slot || !sv) return false;
    let handle: number | null = null;
    if (typeof sv.getInnerViewNode === 'function') {
      const node = sv.getInnerViewNode();
      handle = typeof node === 'number' ? node : findNodeHandle(node);
    }
    if (handle == null && typeof sv.getScrollableNode === 'function') {
      handle = findNodeHandle(sv.getScrollableNode());
    }
    if (handle == null) handle = findNodeHandle(sv);
    if (handle == null) return false;
    slot.measureLayout(
      handle,
      (_x: number, y: number) => {
        insightsScrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
      },
      () => {},
    );
    return true;
  };

  const InsightSlot: React.FC<{ id: InsightId; children: React.ReactNode }> = ({ id, children }) => (
    <View ref={(node) => { insightSlotRefs.current[id] = node; }}>{children}</View>
  );

  const LockedInsightCard = ({ id }: { id: InsightId }) => {
    const def = getInsightDefinition(id);
    if (!def) return null;
    return (
      <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20, opacity: 0.5 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: Acid.mossDeep, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="lock" size={14} color={Acid.tx3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: Acid.tx }}>{def.name}</Text>
            <Text style={{ fontSize: 12, color: Acid.tx3 }}>{def.requirementText}</Text>
          </View>
        </View>
      </View>
    );
  };

  const isUnlocked = (id: InsightId) => isInsightUnlocked(id, insightUnlocks);

  // Shown when an insight is unlocked but the user has not set goals, so it has
  // targets to compare against. Without this the card renders an empty gap.
  const NeedsGoalsCard = ({ name }: { name: string }) => (
    <TouchableOpacity onPress={handleSetGoalPress} activeOpacity={0.85} style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: Acid.lime + '15', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="target" size={14} color={Acid.lime} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: Acid.tx }}>{name}</Text>
          <Text style={{ fontSize: 12, color: Acid.tx2 }}>Set your goals to use this insight</Text>
        </View>
        <Feather name="chevron-right" size={16} color={Acid.tx3} />
      </View>
    </TouchableOpacity>
  );

  // Shown inside a tab when the user has data overall but none in the selected
  // time range, so the chart would otherwise sit empty or imply a flat zero week.
  const NoRangeDataCard = () => (
    <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 28, alignItems: 'center' }]}>
      <Feather name="bar-chart-2" size={28} color={Acid.tx3} style={{ marginBottom: 10 }} />
      <Text style={{ fontSize: 15, fontWeight: '600', color: Acid.tx, marginBottom: 4 }}>
        No meals logged in this range
      </Text>
      <Text style={{ fontSize: 13, color: Acid.tx2, textAlign: 'center' }}>
        Pick a wider range or log a meal to see your trend here.
      </Text>
    </View>
  );

  const toneForPriority = (kind: TopPriorityItem['kind']) => {
    if (kind === 'pattern') return { color: Acid.lime, icon: 'zap', badge: 'PATTERN' };
    if (kind === 'warning') return { color: Acid.error, icon: 'alert-triangle', badge: 'PRIORITY' };
    if (kind === 'pattern-rule') return { color: Acid.carbs, icon: 'trending-up', badge: 'PATTERN' };
    if (kind === 'achievement') return { color: Acid.good, icon: 'award', badge: 'WIN' };
    return { color: Acid.lime, icon: 'target', badge: 'SUGGESTED' };
  };

  // The headline card on the Insights tab: one thing to act on, with a concrete
  // next step. Self-hides when no insight or pattern is firing.
  const TopPriorityCard = () => {
    if (!topPriority) return null;
    const tone = toneForPriority(topPriority.kind);
    return (
      <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 18, borderLeftWidth: 3, borderLeftColor: tone.color }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${tone.color}15`, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={tone.icon as any} size={14} color={tone.color} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx, flex: 1 }}>{topPriority.title}</Text>
          <View style={{ backgroundColor: `${tone.color}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: tone.color }}>{tone.badge}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 19 }}>{topPriority.description}</Text>
        {/* Fixed window, unlike the range-driven cards below it. Saying so stops
            it reading as a summary of whatever range pill is selected. */}
        <Text style={{ fontSize: 11, color: Acid.tx3, marginTop: 6 }}>
          Based on your last 7 logged days
        </Text>
        {topPriority.actionText && (
          <View style={{ marginTop: 12, backgroundColor: Acid.mossDeep, borderRadius: 10, padding: 12 }}>
            {topPriority.actionLabel && (
              <Text style={{ fontSize: 12, fontWeight: '700', color: tone.color, marginBottom: 3 }}>{topPriority.actionLabel}</Text>
            )}
            <Text style={{ fontSize: 13, color: Acid.tx, lineHeight: 19 }}>{topPriority.actionText}</Text>
          </View>
        )}
        {topPriority.canLogMeal && onRequestLogMeal && (
          <TouchableOpacity onPress={onRequestLogMeal} activeOpacity={0.85} style={{ marginTop: 12, backgroundColor: tone.color, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>Log a meal</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'Calories');
  const [timeRange, setTimeRange] = useState<TimeRange>('1W');
  const [showInfo, setShowInfo] = useState(false);
  const [topPriority, setTopPriority] = useState<TopPriorityItem | null>(null);

  // The screen stays mounted inside a Modal across opens, so the initialTab in
  // useState only runs once. Reset the tab each time the modal opens so the last
  // session's tab does not leak into the next open. A pending scroll target
  // always means the Insights tab.
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = !!visible;
    if (visible && !wasVisible) {
      setActiveTab(scrollToInsight ? 'Insights' : initialTab || 'Calories');
    }
  }, [visible, initialTab, scrollToInsight]);

  useEffect(() => {
    if (!scrollToInsight) return;
    pendingScrollRef.current = scrollToInsight;
    setActiveTab('Insights');

    // The card mounts a frame or two after the tab switch. Retry on each frame
    // until it is measurable, then scroll. Give up after ~1s so an insight that
    // is not rendered (its data is off) does not wedge the parent's scroll
    // intent open forever.
    let frame = 0;
    let attempts = 0;
    const tick = () => {
      if (pendingScrollRef.current !== scrollToInsight) return;
      attempts += 1;
      if (scrollToInsightCard(scrollToInsight)) {
        pendingScrollRef.current = null;
        consumedCbRef.current?.();
        return;
      }
      if (attempts < 60) {
        frame = requestAnimationFrame(tick);
      } else {
        pendingScrollRef.current = null;
        consumedCbRef.current?.();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => { if (frame) cancelAnimationFrame(frame); };
  }, [scrollToInsight]);

  // The single most important thing to act on right now, drawn from the AI
  // pattern detector (premium, runs weekly) and the deterministic rule engine
  // (free, instant). Both were dead on this screen: patterns only surfaced on
  // Home and the rule engine was never called anywhere. Ranked so a high
  // confidence AI pattern wins, then warnings, then rule patterns, then wins.
  useEffect(() => {
    if (activeTab !== 'Insights' || !isPremium) return;
    let cancelled = false;
    (async () => {
      try {
        const [patterns, cached] = await Promise.all([
          patternDetectionService.getActivePatterns(),
          dataStorage.getUserMetricsSnapshot(),
        ]);
        // Same-day freshness check, mirroring the coach. Without it a cached
        // week-old snapshot kept feeding "last 7 days" claims from stale data
        // unless the user happened to open the coach.
        const cachedIsFresh =
          cached && format(new Date(cached.generatedAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        const snapshot = cachedIsFresh ? cached : (await dataStorage.generateUserMetricsSnapshot());
        const items: TopPriorityItem[] = [];

        for (const p of patterns) {
          items.push({
            kind: 'pattern',
            rank: 1000 + (p.confidence || 0),
            title: p.title,
            description: p.description,
            actionLabel: 'Try this',
            actionText: p.fix ?? null,
            canLogMeal: true,
          });
        }

        if (snapshot) {
          const typeRank: Record<string, number> = { warning: 500, pattern: 300, suggestion: 200, achievement: 100 };
          for (const insight of generateInsights(snapshot)) {
            const action = getActionForInsight(insight);
            items.push({
              kind: insight.type === 'pattern' ? 'pattern-rule' : insight.type,
              rank: typeRank[insight.type] ?? 0,
              title: insight.title,
              description: insight.description,
              actionLabel: action?.shortLabel ?? null,
              actionText: action?.description ?? null,
              canLogMeal: insight.type !== 'achievement' && insight.relatedMetric !== 'weight',
            });
          }
        }

        items.sort((a, b) => b.rank - a.rank);
        if (!cancelled) setTopPriority(items[0] ?? null);
      } catch {
        if (!cancelled) setTopPriority(null);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, isPremium, Object.keys(summariesByDate || {}).length]);

  const handleSetGoalPress = () => {
    if (onRequestSetGoals) {
      onRequestSetGoals();
    } else if (onBack) {
      onBack();
    }
  };

  // Transform data into DailyNutrition format
  const nutritionData = useMemo<DailyNutrition[]>(() => {
    const dailyData: DailyNutrition[] = [];

    // Priority: Use summariesByDate if available
    if (summariesByDate && Object.keys(summariesByDate).length > 0) {
      Object.values(summariesByDate).forEach(summary => {
        dailyData.push({
          date: parseISO(summary.date),
          calories: summary.totalCalories,
          protein: summary.totalProtein,
          fat: summary.totalFat,
          carbs: summary.totalCarbs,
        });
      });
    } else {
      // Fallback: Aggregate from mealsByDate (legacy/partial)
      // Iterate through all dates with meals
      Object.keys(mealsByDate).forEach((dateKey) => {
        const meals = mealsByDate[dateKey];
        if (!meals || meals.length === 0) return;

        // Aggregate all foods from all meals for this date
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;

        meals.forEach((meal) => {
          meal.foods.forEach((food) => {
            totalCalories += food.calories || 0;
            totalProtein += food.protein || 0;
            totalCarbs += food.carbs || 0;
            totalFat += food.fat || 0;
          });
        });

        // Parse the date key (YYYY-MM-DD) into a Date object
        const date = parseISO(dateKey);

        dailyData.push({
          date,
          calories: totalCalories,
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
        });
      });
    }

    // Sort by date (oldest first)
    return dailyData.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [mealsByDate, summariesByDate]);

  // Filter data based on time range. Window math lives in one shared helper so
  // every chart and card on this screen (and the weight screen) agrees on what a
  // pill means.
  const getFilteredData = () => {
    const window = getRangeWindow(timeRange);

    // Return only days the user actually logged inside the window. We deliberately
    // do NOT zero-fill unlogged days: a missing day is not a zero-calorie day, and
    // zero-filling was dragging the chart floor to 0, faking valleys in the line,
    // and padding the history table and averages with days that never happened.
    return nutritionData
      .filter((entry) => {
        if (!isInRange(entry.date, window)) return false;
        return entry.calories > 0 || entry.protein > 0 || entry.carbs > 0 || entry.fat > 0;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const graphData = useMemo(() => getFilteredData(), [nutritionData, timeRange]);

  // Target values (in grams) - in a real app, these would come from saved goals
  const targetProtein = targetProteinProp && targetProteinProp > 0 ? targetProteinProp : undefined;
  const targetCarbs = targetCarbsProp && targetCarbsProp > 0 ? targetCarbsProp : undefined;
  const targetFat = targetFatProp && targetFatProp > 0 ? targetFatProp : undefined;

  // graphData is already logged-only. "Any data ever" drives the first-run empty
  // state; "data in range" drives the per-range empty state. They differ: a user
  // with three weeks of history viewing a 1D window has data, just not here.
  const hasAnyData = nutritionData.length > 0;
  const hasDataInRange = graphData.length > 0;

  // Today is a partial, unsettled day. Averaging it in understates intake, so the
  // averages run over completed days. When today is the only logged day in the
  // window (day one, or a 1D view) fall back to it so the screen is not blank.
  const todayKey = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const completedDays = useMemo(
    () => graphData.filter(d => format(d.date, 'yyyy-MM-dd') !== todayKey),
    [graphData, todayKey]
  );
  const averageBasis = completedDays.length > 0 ? completedDays : graphData;
  const hasAverage = averageBasis.length > 0;
  // When today is the only logged day, the "average" is really just today so far.
  // Surface that instead of letting the fallback silently change the meaning.
  const averageIsTodayOnly = completedDays.length === 0 && graphData.length > 0;

  // Every range-driven insight card states its window through this one helper,
  // and guards its no-data state with this one note, so a new card cannot ship
  // unlabeled or rendering zeros for missing data.
  const rangeSubtitle = (text: string) =>
    averageIsTodayOnly ? `${text} · today so far` : `${text} · ${rangeLabel(timeRange)}`;
  const CardEmptyNote = () => (
    <Text style={{ fontSize: 13, color: Acid.tx2, textAlign: 'center', paddingVertical: 16 }}>
      No logged days in the {rangeLabel(timeRange)}. Pick a wider range.
    </Text>
  );

  const averageProtein = hasAverage
    ? averageBasis.reduce((sum, entry) => sum + entry.protein, 0) / averageBasis.length
    : null;
  const averageCarbs = hasAverage
    ? averageBasis.reduce((sum, entry) => sum + entry.carbs, 0) / averageBasis.length
    : null;
  const averageFat = hasAverage
    ? averageBasis.reduce((sum, entry) => sum + entry.fat, 0) / averageBasis.length
    : null;

  const averageCalories = hasAverage
    ? Math.round(averageBasis.reduce((sum, entry) => sum + entry.calories, 0) / averageBasis.length)
    : null;
  const targetCalories = targetCaloriesProp && targetCaloriesProp > 0 ? targetCaloriesProp : undefined;
  const hasTargetCalories = targetCalories !== undefined;

  // Selected window vs the equal-length window before it. The old chip compared
  // last-7-vs-prior-7 no matter which range was selected, which made the number
  // meaningless on 1M/1Y views.
  const periodComparison = useMemo(() => {
    const today = startOfDay(new Date());
    const current = getRangeWindow(timeRange);
    const previous = getPreviousWindow(timeRange);

    // Same logged-day rule as the chart, so the chip and the hero agree on
    // which days exist. Exclude today's partial day so the current average is
    // not understated.
    const isLogged = (d: DailyNutrition) => d.calories > 0 || d.protein > 0 || d.carbs > 0 || d.fat > 0;
    const currDays = nutritionData.filter(d =>
      isInRange(d.date, current) && startOfDay(d.date).getTime() !== today.getTime() && isLogged(d)
    );
    const prevDays = nutritionData.filter(d => isInRange(d.date, previous) && isLogged(d));

    if (currDays.length === 0 || prevDays.length === 0) return null;

    const avg = (arr: DailyNutrition[], key: keyof Omit<DailyNutrition, 'date'>) =>
      arr.reduce((s, d) => s + d[key], 0) / arr.length;

    // null, not 0: a previous window with none of this macro is "no comparison",
    // and rendering it as 0% claimed nothing changed.
    const pctChange = (curr: number, prev: number): number | null =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

    return {
      calories: pctChange(avg(currDays, 'calories'), avg(prevDays, 'calories')),
      protein: pctChange(avg(currDays, 'protein'), avg(prevDays, 'protein')),
      carbs: pctChange(avg(currDays, 'carbs'), avg(prevDays, 'carbs')),
      fat: pctChange(avg(currDays, 'fat'), avg(prevDays, 'fat')),
    };
  }, [nutritionData, timeRange]);

  // Calculate graph dimensions
  const screenWidth = Dimensions.get('window').width;
  const graphWidth = screenWidth - 32 - 36; // content paddingHorizontal (16*2) + graphCard padding (18*2)
  const graphHeight = 280;
  const padding = 20;
  const paddingBottom = 36; // extra room for x-axis date labels
  const paddingLeft = 45; // extra room for Y-axis labels
  const innerWidth = graphWidth - paddingLeft - padding;
  const innerHeight = graphHeight - padding - paddingBottom;
  // Pick evenly spaced indices for x-axis date labels (max ~5 labels to avoid crowding)
  const getXAxisLabelIndices = (count: number, maxLabels = 5): number[] => {
    if (count <= 1) return count === 1 ? [0] : [];
    if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
    const indices: number[] = [0];
    const step = (count - 1) / (maxLabels - 1);
    for (let i = 1; i < maxLabels - 1; i++) {
      indices.push(Math.round(step * i));
    }
    indices.push(count - 1);
    return indices;
  };

  // Format date label based on time range
  const formatXLabel = (date: Date): string => {
    if (timeRange === '1W') return format(date, 'EEE'); // "Mon"
    if (timeRange === '1M') return format(date, 'd MMM'); // "5 Feb"
    if (timeRange === '3M' || timeRange === '6M') return format(date, 'd MMM'); // "5 Feb"
    return format(date, 'MMM yyyy'); // "Feb 2026"
  };

  // Estimate SVG path length from points (bezier curves are ~1.5x longer than straight-line segments)
  const estimatePathLength = (points: { x: number; y: number }[]): number => {
    if (points.length < 2) return 0;
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.ceil(length * 1.5);
  };

  // Find max value across all macronutrients for Y-axis scaling
  const maxProtein = graphData.length > 0
    ? Math.max(...graphData.map(d => d.protein), targetProtein ?? 0)
    : (targetProtein ?? 0);
  const maxCarbs = graphData.length > 0
    ? Math.max(...graphData.map(d => d.carbs), targetCarbs ?? 0)
    : (targetCarbs ?? 0);
  const maxFat = graphData.length > 0
    ? Math.max(...graphData.map(d => d.fat), targetFat ?? 0)
    : (targetFat ?? 0);
  const maxValue = Math.ceil(Math.max(maxProtein, maxCarbs, maxFat, 50) / 25) * 25; // Round up to nearest 25, minimum 50

  const getDateRange = () => {
    if (graphData.length === 0) return '';
    const start = graphData[0].date;
    const end = graphData[graphData.length - 1].date;
    return `${format(start, 'd MMM yyyy')} - ${format(end, 'd MMM yyyy')}`;
  };

  // Calculate calories for each day
  const caloriesData = graphData.map(entry => ({
    date: entry.date,
    calories: entry.calories,
  }));

  // Table-friendly calories history (newest first, respects current time range)
  const caloriesHistory = useMemo(
    () => [...caloriesData].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [caloriesData]
  );

  // Table-friendly macros history (newest first, respects current time range)
  const macrosHistory = useMemo(
    () => [...graphData].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [graphData]
  );

  const minCalories = caloriesData.length > 0
    ? Math.min(...caloriesData.map(d => d.calories))
    : 0;
  const maxCalories = caloriesData.length > 0
    ? Math.max(...caloriesData.map(d => d.calories))
    : 2000;
  const caloriesRange = maxCalories - minCalories || 1;
  const caloriesPadding = caloriesRange * 0.1;

  // Generate smooth bezier curve path for a line with improved smoothness
  const generateSmoothPath = (values: number[]): { path: string; length: number } => {
    if (values.length === 0) return { path: '', length: 0 };

    const points = values.map((value, index) => {
      const x = paddingLeft + (index / (values.length - 1 || 1)) * innerWidth;
      const normalizedValue = value / maxValue;
      const y = padding + innerHeight - (normalizedValue * innerHeight);
      return { x, y, value };
    });

    if (points.length === 1) {
      return { path: `M ${points[0].x} ${points[0].y}`, length: 0 };
    }

    if (points.length === 2) {
      return { path: `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`, length: estimatePathLength(points) };
    }

    // Create smooth bezier curve with better control points
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const prev = i > 0 ? points[i - 1] : current;
      const after = i < points.length - 2 ? points[i + 2] : next;

      // Calculate smooth control points using Catmull-Rom-like approach
      const dx1 = next.x - prev.x;
      const dy1 = next.y - prev.y;
      const dx2 = after.x - current.x;
      const dy2 = after.y - current.y;

      // Control points for smooth curve
      const cp1x = current.x + dx1 / 6;
      const cp1y = current.y + dy1 / 6;
      const cp2x = next.x - dx2 / 6;
      const cp2y = next.y - dy2 / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }

    return { path, length: estimatePathLength(points) };
  };

  // Generate smooth path for calories chart with improved smoothness
  const generateCaloriesPath = (): { path: string; length: number } => {
    if (caloriesData.length === 0) return { path: '', length: 0 };

    const maxCal = Math.ceil((maxCalories + caloriesPadding) / 100) * 100;
    const minCal = Math.max(0, Math.floor((minCalories - caloriesPadding) / 100) * 100);

    const points = caloriesData.map((entry, index) => {
      const x = paddingLeft + (index / (caloriesData.length - 1 || 1)) * innerWidth;
      const normalizedCalories = (entry.calories - minCal) / (maxCal - minCal);
      const y = padding + innerHeight - (normalizedCalories * innerHeight);
      return { x, y, calories: entry.calories };
    });

    if (points.length === 1) {
      return { path: `M ${points[0].x} ${points[0].y}`, length: 0 };
    }

    if (points.length === 2) {
      return { path: `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`, length: estimatePathLength(points) };
    }

    // Create smooth bezier curve with better control points
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const prev = i > 0 ? points[i - 1] : current;
      const after = i < points.length - 2 ? points[i + 2] : next;

      // Calculate smooth control points using Catmull-Rom-like approach
      const dx1 = next.x - prev.x;
      const dy1 = next.y - prev.y;
      const dx2 = after.x - current.x;
      const dy2 = after.y - current.y;

      // Control points for smooth curve
      const cp1x = current.x + dx1 / 6;
      const cp1y = current.y + dy1 / 6;
      const cp2x = next.x - dx2 / 6;
      const cp2y = next.y - dy2 / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }

    return { path, length: estimatePathLength(points) };
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
  };

  const timeRanges: TimeRange[] = [...CHART_RANGES];

  // Underlined range words, the board's pattern everywhere
  const renderTimeRangePills = () => (
    <View style={{ flexDirection: 'row', gap: 22, alignSelf: 'center', marginBottom: 8 }}>
      {timeRanges.map((range) => (
        <TouchableOpacity
          key={range}
          onPress={() => handleTimeRangeChange(range)}
          style={{
            paddingVertical: 6,
            borderBottomWidth: 2,
            borderBottomColor: timeRange === range ? Acid.lime : 'transparent',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 1, color: timeRange === range ? Acid.lime : Acid.tx3 }}>
            {range}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Slide value retained at 0. iOS Modal handles entrance and exit animations.
  // Pan responder still uses this for drag feedback but no JS-driven entrance animation.
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleClose = () => {
    onBack();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  // Animated paths for calories and macros charts
  const [caloriesPath, setCaloriesPath] = useState<string>('');
  const [proteinPath, setProteinPath] = useState<string>('');
  const [carbsPath, setCarbsPath] = useState<string>('');
  const [fatPath, setFatPath] = useState<string>('');
  const [caloriesDrawLength, setCaloriesDrawLength] = useState(0);
  const [macrosDrawLength, setMacrosDrawLength] = useState(0);
  const caloriesLineProgress = useRef(new Animated.Value(0)).current;
  const macrosLineProgress = useRef(new Animated.Value(0)).current;
  const caloriesChartOpacity = useRef(new Animated.Value(0.15)).current;
  const macrosChartOpacity = useRef(new Animated.Value(0.15)).current;
  const AnimatedPath = useRef(Animated.createAnimatedComponent((Path as any))).current;

  // Scrubbing Interaction Logic
  const [scrubbingIndex, setScrubbingIndex] = useState<number | null>(null);

  // Calculate X coordinates for all data points (shared across both tabs)
  const scrubbingPoints = useMemo(() => {
    const data = activeTab === 'Calories' ? caloriesData : graphData;
    if (data.length === 0) return [];

    return data.map((entry, index) => {
      const x = paddingLeft + (index / (data.length - 1 || 1)) * innerWidth;
      // For Y, we don't strictly need it for the X-scrubbing, but it helps for positioning the tooltip bubble near the "data".
      // For Macros, we might just position it at the top or follow the Protein line?
      // Let's position it near the top of the graph (padding + 20) to avoid overlapping the busy lines.
      const y = padding + 20;
      return { x, y, data: entry, index };
    });
  }, [caloriesData, graphData, activeTab, innerWidth, paddingLeft]);

  // Keep a ref to the latest scrubbingPoints so the PanResponder never reads stale data
  const scrubbingPointsRef = useRef(scrubbingPoints);
  scrubbingPointsRef.current = scrubbingPoints;

  const handleTouch = (x: number) => {
    const points = scrubbingPointsRef.current;
    if (points.length === 0) return;

    let closestIndex = 0;
    let minDiff = Infinity;

    points.forEach((p, i) => {
      const diff = Math.abs(x - p.x);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    });

    setScrubbingIndex(closestIndex);
  };

  const graphPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        handleTouch(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        handleTouch(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        setScrubbingIndex(null);
      },
      onPanResponderTerminate: () => {
        setScrubbingIndex(null);
      },
    })
  ).current;

  // iOS Modal handles the entrance animation. No internal entrance needed.

  // Animate calories line when data changes
  useEffect(() => {
    const result = generateCaloriesPath();
    setCaloriesPath(result.path);
    setCaloriesDrawLength(result.length);

    // Reset animation state - fade chart in while drawing line
    caloriesChartOpacity.setValue(0.15);
    caloriesLineProgress.setValue(0);

    Animated.parallel([
      Animated.timing(caloriesChartOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(caloriesLineProgress, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: false, // animating SVG strokeDashoffset
      }),
    ]).start();
  }, [JSON.stringify(caloriesData), maxCalories, minCalories, caloriesPadding, timeRange]);

  // Animate macros lines when data changes
  useEffect(() => {
    const protein = generateSmoothPath(graphData.map(d => d.protein));
    const carbs = generateSmoothPath(graphData.map(d => d.carbs));
    const fat = generateSmoothPath(graphData.map(d => d.fat));

    setProteinPath(protein.path);
    setCarbsPath(carbs.path);
    setFatPath(fat.path);
    // Use the longest path so all three lines animate fully
    setMacrosDrawLength(Math.max(protein.length, carbs.length, fat.length));

    // Reset animation state - fade chart in while drawing lines
    macrosChartOpacity.setValue(0.15);
    macrosLineProgress.setValue(0);

    Animated.parallel([
      Animated.timing(macrosChartOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(macrosLineProgress, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: false,
      }),
    ]).start();
  }, [JSON.stringify(graphData), maxValue, timeRange]);

  // Insights State — cached per Monday week-key
  const INSIGHT_CACHE_KEY = '@trackkal:weeklyInsightCache';
  const [insightText, setInsightText] = useState<string | null>(null);
  const [insightIsNew, setInsightIsNew] = useState(false);
  const [insightCollapsed, setInsightCollapsed] = useState(false);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const insightRequestInFlight = useRef(false);

  // Get the start of the current week as cache key
  // When calorie bank is active, align to the bank's cycle start day
  const getWeekKey = () => {
    const weekStartDay = calorieBankData?.enabled ? calorieBankData.cycleStartDayNum : 1;
    return format(startOfWeek(new Date(), { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 }), 'yyyy-MM-dd');
  };

  useEffect(() => {
    // isUnlocked matters: this fires a PAID call, so a locked card must never
    // generate. The card gate alone does not stop the effect.
    if (activeTab !== 'Insights' || !isPremium || !isUnlocked('ai-weekly-insight') || insightRequestInFlight.current) return;
    if (insightText) return; // Already loaded this session

    // The card says WEEKLY, so feed the AI a fixed week: the last completed
    // logged days regardless of which range pill is selected, with today's
    // partial day excluded so a half-logged day does not read as undereating.
    const completedLogged = nutritionData
      .filter(d =>
        (d.calories > 0 || d.protein > 0 || d.carbs > 0 || d.fat > 0) &&
        format(d.date, 'yyyy-MM-dd') !== todayKey
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (completedLogged.length === 0) return;

    insightRequestInFlight.current = true;

    const loadOrGenerate = async () => {
      const weekKey = getWeekKey();

      // Check cache first
      try {
        const cached = await AsyncStorage.getItem(INSIGHT_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.weekKey === weekKey && parsed.text) {
            setInsightText(parsed.text);
            setInsightIsNew(false);
            insightRequestInFlight.current = false;
            return;
          }
        }
      } catch {
        // Cache miss, continue to generate
      }

      // Generate new insight
      setIsGeneratingInsight(true);
      try {
        const lastWeek = completedLogged.slice(-7);
        const lastTwoWeeks = completedLogged.slice(-14);

        // Day-of-week breakdown over the last two completed weeks
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayBuckets: Record<string, { cals: number[]; protein: number[] }> = {};
        dayNames.forEach(d => { dayBuckets[d] = { cals: [], protein: [] }; });
        lastTwoWeeks.forEach(entry => {
          const day = dayNames[entry.date.getDay()];
          dayBuckets[day].cals.push(Math.round(entry.calories));
          dayBuckets[day].protein.push(Math.round(entry.protein));
        });
        const dayOfWeekAvg: Record<string, { avgCal: number; avgProtein: number }> = {};
        Object.entries(dayBuckets).forEach(([day, data]) => {
          if (data.cals.length > 0) {
            dayOfWeekAvg[day] = {
              avgCal: Math.round(data.cals.reduce((a, b) => a + b, 0) / data.cals.length),
              avgProtein: Math.round(data.protein.reduce((a, b) => a + b, 0) / data.protein.length),
            };
          }
        });

        // Meal timing from raw meals
        const timingBuckets = { morning: 0, afternoon: 0, evening: 0 };
        const last7 = lastWeek.map(d => format(d.date, 'yyyy-MM-dd'));
        Object.entries(mealsByDate).forEach(([dateKey, meals]) => {
          if (!last7.includes(dateKey)) return;
          meals.forEach(meal => {
            const h = new Date(meal.timestamp).getHours();
            if (h >= 4 && h < 12) timingBuckets.morning++;
            else if (h >= 12 && h < 17) timingBuckets.afternoon++;
            else timingBuckets.evening++;
          });
        });

        // Top 5 foods
        const foodCounts: Record<string, number> = {};
        Object.values(mealsByDate).flat().forEach(meal => {
          if (!last7.includes(format(new Date(meal.timestamp), 'yyyy-MM-dd'))) return;
          meal.foods.forEach(f => {
            const name = f.name?.toLowerCase().trim();
            if (name) foodCounts[name] = (foodCounts[name] || 0) + 1;
          });
        });
        const topFoods = Object.entries(foodCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => `${name} (${count}x)`);

        // Daily breakdown and averages over the fixed week, not the range pills
        const dailyBreakdown = lastWeek.map(d => ({
          day: format(d.date, 'EEE'),
          cal: Math.round(d.calories),
          protein: Math.round(d.protein),
          carbs: Math.round(d.carbs),
          fat: Math.round(d.fat),
        }));
        const weekAvg = (key: 'calories' | 'protein' | 'carbs' | 'fat') =>
          Math.round(lastWeek.reduce((s, d) => s + d[key], 0) / lastWeek.length);

        const weeklySummary = {
          averageCalories: weekAvg('calories'),
          averageProtein: weekAvg('protein'),
          averageCarbs: weekAvg('carbs'),
          averageFat: weekAvg('fat'),
          targets: {
            calories: targetCalories ?? null,
            proteinG: targetProtein ?? null,
            carbsG: targetCarbs ?? null,
            fatG: targetFat ?? null,
          },
          totalDaysLogged: lastWeek.length,
          dailyBreakdown,
          dayOfWeekAvg,
          mealTimingDistribution: timingBuckets,
          topFoods,
          ...(calorieBankData ? { calorieBank: calorieBankData } : {}),
        };

        const text = await generateWeeklyInsights(weeklySummary);
        // null = the call failed. Do not cache failure text for a week; leave
        // the card empty so the next visit retries.
        if (text) {
          setInsightText(text);
          setInsightIsNew(true);
          await AsyncStorage.setItem(INSIGHT_CACHE_KEY, JSON.stringify({ weekKey, text, generatedAt: new Date().toISOString() }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsGeneratingInsight(false);
        insightRequestInFlight.current = false;
      }
    };

    loadOrGenerate();
  }, [activeTab, isPremium, insightUnlocks, nutritionData]);

  // Radar Chart Data Calculation
  const radarData = useMemo(() => {
    if (!targetProtein || !targetCarbs || !targetFat) return [];

    // Normalize to 0-1 range (capped at 1.2 for over-performance visualization)
    const pScore = Math.min(1.2, (averageProtein ?? 0) / targetProtein);
    const cScore = Math.min(1.2, (averageCarbs ?? 0) / targetCarbs);
    const fScore = Math.min(1.2, (averageFat ?? 0) / targetFat);

    // Calorie adherence score
    const calScore = targetCalories ? Math.min(1.2, (averageCalories || 0) / targetCalories) : 0;

    // We still calculate variance for internal logic if needed, but for the chart we use Calories
    // const calorieVariance = graphData.reduce((acc, curr) => acc + Math.pow(curr.calories - (averageCalories || 0), 2), 0) / graphData.length;
    // const consistScore = Math.max(0.2, 1 - (Math.sqrt(calorieVariance) / 1000));

    return [
      { label: 'Protein', value: pScore },
      { label: 'Carbs', value: cScore },
      { label: 'Fat', value: fScore },
      { label: 'Calories', value: calScore },
    ];
  }, [averageProtein, averageCarbs, averageFat, averageCalories, targetProtein, targetCarbs, targetFat, targetCalories, graphData]);

  const renderRadarChart = () => {
    const size = 220; // Reduced from 300
    const center = size / 2;
    const radius = 65; // Reduced from 90 to fit new size comfortably

    if (radarData.length === 0) return null;

    const angleStep = (Math.PI * 2) / radarData.length;

    const points = radarData.map((d, i) => {
      const angle = i * angleStep - Math.PI / 2; // Start at top
      // value is 0-1.2, matching the data cap so the overshoot band is drawable
      const r = Math.min(d.value, 1.2) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');

    // Background webs
    const webs = [0.25, 0.5, 0.75, 1].map(scale => {
      return radarData.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const r = scale * radius;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return `${x},${y}`;
      }).join(' ');
    });

    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <Svg height={size} width={size}>
          {/* Webs */}
          {webs.map((pointsStr, i) => (
            <Polygon key={i} points={pointsStr} stroke={Acid.hair} strokeWidth="1" fill="none" opacity={0.5} />
          ))}
          {/* Axis Lines */}
          {radarData.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            return <Line key={i} x1={center} y1={center} x2={x} y2={y} stroke={Acid.hair} strokeWidth="1" opacity={0.5} />;
          })}
          {/* Data Shape */}
          <Polygon points={points} fill="rgba(59, 130, 246, 0.2)" stroke={Acid.lime} strokeWidth="2" />
          {/* Labels */}
          {radarData.map((d, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const labelRadius = radius + 18; // Slightly closer
            const x = center + labelRadius * Math.cos(angle);
            const y = center + labelRadius * Math.sin(angle);
            return (
              <SvgText
                key={i}
                x={x}
                y={y + 4}
                fill={Acid.tx2}
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Acid.moss }]} edges={['top']}>
      <Animated.View
        style={{ flex: 1, transform: [{ translateY: slideAnim }] }}
      >
        {/* Header */}
        <View
          style={[styles.header, { borderBottomColor: Acid.hair }]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Feather name="chevron-down" size={24} color={Acid.tx} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Acid.tx }]}>
            Nutrition Analysis
          </Text>
          <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.headerRight}>
            <Feather name="info" size={20} color={Acid.tx2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={insightsScrollRef}
          style={styles.content}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        >
          {!hasAnyData && (
            <View
              style={[
                styles.emptyStateContainer,
                { backgroundColor: Acid.mossDeep, borderColor: Acid.hair },
              ]}
            >
              <Text style={[styles.emptyStateTitle, { color: Acid.tx }]}>
                Log your first meal
              </Text>
              <Text style={[styles.emptyStateText, { color: Acid.tx2 }]}>
                Start tracking your nutrition by logging your meals.
              </Text>
              <TouchableOpacity
                style={[styles.emptyStateButton, { backgroundColor: Acid.lime }]}
                onPress={() => {
                  if (onRequestLogMeal) {
                    onRequestLogMeal();
                  } else {
                    onBack();
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.emptyStateButtonText, { color: Acid.moss }]}>
                  Log Meal
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Dynamic Hero Summary */}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 24, marginTop: 8 }}>
            {activeTab === 'Calories' ? (
              <>
                {/* Average Calories Hero */}
                <View style={styles.heroCard}>
                  <Text style={[styles.heroLabel, { color: Acid.tx2 }]}>
                    {averageIsTodayOnly ? 'TODAY SO FAR' : 'AVG / DAY'}
                  </Text>
                  <Text style={[styles.heroValue, { color: Acid.tx }]} numberOfLines={1} adjustsFontSizeToFit>
                    {averageCalories !== null ? `${averageCalories}` : '--'}
                  </Text>
                  <Text style={[styles.heroUnit, { color: Acid.tx3 }]}>Kcal</Text>
                </View>

                {/* Target Calories Hero */}
                <View style={styles.heroCard}>
                  <Text style={[styles.heroLabel, { color: Acid.tx2 }]}>TARGET</Text>
                  {hasTargetCalories ? (
                    <>
                      <Text style={[styles.heroValue, { color: Acid.tx }]} numberOfLines={1} adjustsFontSizeToFit>
                        {`${targetCalories}`}
                      </Text>
                      <Text style={[styles.heroUnit, { color: Acid.tx3 }]}>Kcal</Text>
                    </>
                  ) : (
                    <TouchableOpacity onPress={handleSetGoalPress} activeOpacity={0.7}>
                      <Text style={{ color: Acid.lime, fontWeight: '600', marginTop: 4, fontSize: 14 }}>Set Goal</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Deficit / Surplus Hero */}
                {hasTargetCalories && averageCalories !== null && completedDays.length > 0 && (() => {
                  const diff = averageCalories - targetCalories!;
                  const isDeficit = diff < 0;
                  const isOnTrack = Math.abs(diff) <= 50;
                  const color = isOnTrack ? Acid.good : isDeficit ? Acid.protein : Acid.error;
                  const label = isOnTrack ? 'ON TRACK' : isDeficit ? 'DEFICIT' : 'SURPLUS';
                  return (
                    <View style={styles.heroCard}>
                      <Text style={[styles.heroLabel, { color: Acid.tx2 }]}>{label}</Text>
                      <Text style={[styles.heroValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
                        {isOnTrack ? '0' : isDeficit ? `${diff}` : `+${diff}`}
                      </Text>
                      <Text style={[styles.heroUnit, { color: Acid.tx3 }]}>Kcal</Text>
                    </View>
                  );
                })()}
              </>
            ) : (
              <>
                {[
                  { label: 'PROTEIN', value: averageProtein, color: Acid.protein },
                  { label: 'CARBS', value: averageCarbs, color: Acid.carbs },
                  { label: 'FAT', value: averageFat, color: Acid.fat },
                ].map((macro) => (
                  <View
                    key={macro.label}
                    style={styles.heroCard}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: macro.color }} />
                      <Text style={[styles.heroLabel, { color: Acid.tx2 }]}>
                        {macro.label}
                      </Text>
                    </View>
                    <Text style={[styles.heroValue, { color: Acid.tx }]} numberOfLines={1} adjustsFontSizeToFit>
                      {macro.value !== null ? macro.value.toFixed(0) : '--'}
                    </Text>
                    <Text style={[styles.heroUnit, { color: Acid.tx3 }]}>
                      {averageIsTodayOnly ? 'g · today so far' : 'g · avg/day'}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>

          {hasAnyData && (
            <React.Fragment>
              {/* Tab Navigation */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'Calories' && styles.tabActive]}
                  onPress={() => setActiveTab('Calories')}
                >
                  <Text style={[styles.tabText, { color: activeTab === 'Calories' ? Acid.lime : Acid.tx3 }]}>
                    Calories
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'Macros' && styles.tabActive]}
                  onPress={() => setActiveTab('Macros')}
                >
                  <Text style={[styles.tabText, { color: activeTab === 'Macros' ? Acid.lime : Acid.tx3 }]}>
                    Macros
                  </Text>
                </TouchableOpacity>
                {isPremium && (
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'Insights' && styles.tabActive]}
                    onPress={() => setActiveTab('Insights')}
                  >
                    <Text style={[styles.tabText, { color: activeTab === 'Insights' ? Acid.lime : Acid.tx3 }]}>
                      Insights
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Calories Chart Section */}
              {activeTab === 'Calories' && (
                <View style={styles.graphContainer}>
                  {!hasDataInRange && <NoRangeDataCard />}
                  {hasDataInRange && (
                  <View
                    style={[
                      styles.graphCard,
                      {
                        backgroundColor: Acid.mossDeep,
                        shadowColor: '#000',
                      },
                    ]}
                    {...graphPanResponder.panHandlers}
                  >
                    {/* Tooltip Overlay */}
                    {scrubbingIndex !== null && scrubbingPoints[scrubbingIndex] && (
                      <View
                        style={{
                          position: 'absolute',
                          left: scrubbingPoints[scrubbingIndex].x - 60,
                          top: scrubbingPoints[scrubbingIndex].y - 70, // Matched offset
                          width: 120,
                          alignItems: 'center',
                          zIndex: 10,
                          pointerEvents: 'none',
                        }}
                      >
                        <View style={{
                          backgroundColor: Acid.mossDeep,
                          borderRadius: 8,
                          padding: 8,
                          borderWidth: 1,
                          borderColor: Acid.hair,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 3,
                          alignItems: 'center'
                        }}>
                          <Text style={{ fontSize: 12, color: Acid.tx2, marginBottom: 2 }}>
                            {format(scrubbingPoints[scrubbingIndex].data.date, 'MMM d')}
                          </Text>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: Acid.tx }}>
                            {scrubbingPoints[scrubbingIndex].data.calories.toFixed(0)} Kcal
                          </Text>
                        </View>
                        {/* Triangle */}
                        <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: Acid.hair, marginTop: -1 }} />
                        <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: Acid.mossDeep, marginTop: -7 }} />
                      </View>
                    )}

                    {/* Graph */}
                    <Animated.View style={[styles.graph, { opacity: caloriesChartOpacity }]}>
                      <Svg width={graphWidth} height={graphHeight}>
                        {/* Grid lines & Labels */}
                        {(() => {
                          const maxCal = Math.ceil((maxCalories + caloriesPadding) / 100) * 100;
                          const minCal = Math.max(0, Math.floor((minCalories - caloriesPadding) / 100) * 100);
                          const range = maxCal - minCal || 1;

                          return [0, 1, 2, 3, 4, 5].map((i) => {
                            const ratio = i / 5;
                            const value = maxCal - ratio * range;
                            const y = padding + i * (innerHeight / 5); // Simple linear distribution

                            return (
                              <React.Fragment key={i}>
                                <Line
                                  x1={paddingLeft}
                                  y1={y}
                                  x2={graphWidth - padding}
                                  y2={y}
                                  stroke={Acid.hair}
                                  strokeWidth={0.5}
                                  strokeDasharray="2,2"
                                />
                                <SvgText
                                  x={paddingLeft - 6}
                                  y={y + 3}
                                  fontSize={10}
                                  fill={Acid.tx3}
                                  textAnchor="end"
                                >
                                  {value.toFixed(0)}
                                </SvgText>
                              </React.Fragment>
                            );
                          });
                        })()}

                        {/* Target line */}
                        {hasTargetCalories && (() => {
                          const maxCal = Math.ceil((maxCalories + caloriesPadding) / 100) * 100;
                          const minCal = Math.max(0, Math.floor((minCalories - caloriesPadding) / 100) * 100);
                          const targetY = padding + innerHeight - ((targetCalories! - minCal) / (maxCal - minCal)) * innerHeight;
                          return (
                            <Line
                              x1={paddingLeft}
                              y1={targetY}
                              x2={graphWidth - padding}
                              y2={targetY}
                              stroke="#EF4444"
                              strokeWidth={1}
                              strokeDasharray="4,4"
                              opacity={0.5}
                            />
                          );
                        })()}

                        {/* Calories line path */}
                        {caloriesPath ? (
                          <AnimatedPath
                            d={caloriesPath}
                            fill="none"
                            stroke={Acid.lime}
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${caloriesDrawLength}, ${caloriesDrawLength}`}
                            strokeDashoffset={caloriesLineProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [caloriesDrawLength, 0],
                            })}
                          />
                        ) : null}

                        {/* Data points (dots) - hollow style */}
                        {caloriesData.length < 20 && caloriesData.map((entry, index) => {
                          const x = paddingLeft + (index / (caloriesData.length - 1 || 1)) * innerWidth;
                          const maxCal = Math.ceil((maxCalories + caloriesPadding) / 100) * 100;
                          const minCal = Math.max(0, Math.floor((minCalories - caloriesPadding) / 100) * 100);
                          const normalizedCalories = (entry.calories - minCal) / (maxCal - minCal);
                          const y = padding + innerHeight - (normalizedCalories * innerHeight);
                          return (
                            <Circle
                              key={index}
                              cx={x}
                              cy={y}
                              r={4}
                              fill={Acid.mossDeep}
                              stroke={Acid.lime}
                              strokeWidth={2}
                            />
                          );
                        })}

                        {/* X-axis date labels */}
                        {getXAxisLabelIndices(caloriesData.length).map((idx) => {
                          const x = paddingLeft + (idx / (caloriesData.length - 1 || 1)) * innerWidth;
                          return (
                            <SvgText
                              key={`xlbl-${idx}`}
                              x={x}
                              y={graphHeight - 8}
                              fontSize="10"
                              fill={Acid.tx3}
                              textAnchor="middle"
                            >
                              {formatXLabel(caloriesData[idx].date)}
                            </SvgText>
                          );
                        })}

                        {/* Active Scrubber */}
                        {scrubbingIndex !== null && scrubbingPoints[scrubbingIndex] && (
                          (() => {
                            const pt = scrubbingPoints[scrubbingIndex];
                            const maxCal = Math.ceil((maxCalories + caloriesPadding) / 100) * 100;
                            const minCal = Math.max(0, Math.floor((minCalories - caloriesPadding) / 100) * 100);
                            const normalizedCalories = (pt.data.calories - minCal) / (maxCal - minCal);
                            const y = padding + innerHeight - (normalizedCalories * innerHeight);

                            return (
                              <>
                                <Line
                                  x1={pt.x}
                                  y1={padding}
                                  x2={pt.x}
                                  y2={padding + innerHeight}
                                  stroke={Acid.tx2}
                                  strokeWidth={1}
                                  strokeDasharray="4,4"
                                />
                                <Circle
                                  cx={pt.x}
                                  cy={y}
                                  r={6}
                                  fill={Acid.lime}
                                  stroke={Acid.mossDeep}
                                  strokeWidth={3}
                                />
                              </>
                            );
                          })()
                        )}
                      </Svg>
                    </Animated.View>
                  </View>
                  )}

                  {/* Time Range Selector */}
                  {renderTimeRangePills()}

                  {/* Date Range */}
                  <Text style={[styles.dateRange, { color: Acid.tx2 }]}>
                    {getDateRange()}
                  </Text>

                  {/* What the numbers mean. This one line was the whole "numbers
                      change but I don't know what's shown" complaint. */}
                  {hasDataInRange && (
                    <Text style={{ fontSize: 12, color: Acid.tx3, textAlign: 'center', paddingTop: 2 }}>
                      {averageIsTodayOnly
                        ? 'Only today is logged so far. Averages start tomorrow.'
                        : `Average of ${completedDays.length} logged ${completedDays.length === 1 ? 'day' : 'days'} in the ${rangeLabel(timeRange)}. Today counts once complete.`}
                    </Text>
                  )}

                  {/* Selected period vs the equal period before it */}
                  {periodComparison && periodComparison.calories !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}>
                      <Feather name="trending-up" size={14} color={Acid.tx2} />
                      <Text style={{ fontSize: 13, color: Acid.tx2 }}>vs {previousRangeLabel(timeRange)}:</Text>
                      {(() => {
                        const val = periodComparison.calories ?? 0;
                        const color = val === 0 ? Acid.tx2 : val > 0 ? Acid.error : Acid.good;
                        const sign = val > 0 ? '+' : '';
                        return (
                          <View style={{ backgroundColor: `${color}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color }}>{sign}{val}% cal</Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* Calories History Table */}
                  {caloriesHistory.length > 0 && (
                    <View style={[styles.historyContainer, { borderColor: Acid.hair }]}>
                      <Text style={[styles.historyTitle, { color: Acid.tx }]}>
                        History
                      </Text>
                      <View style={styles.historyHeaderSpacer} />
                      {/* Fixed Spacer issue if needed, but keeping basic structure */}
                      {caloriesHistory.map((entry) => (
                        <View key={entry.date.toISOString()} style={[styles.historyRow, { borderTopColor: Acid.hair }]}>
                          <Text style={[styles.historyCellText, { color: Acid.tx2 }]}>
                            {format(entry.date, 'd MMM yyyy')}
                          </Text>
                          <Text style={[styles.historyCellText, { color: Acid.tx, textAlign: 'right' }]}>
                            {`${entry.calories.toFixed(0)} Kcal`}
                          </Text>
                          <TouchableOpacity
                            onPress={() => onRequestLogMealForDate?.(entry.date)}
                            style={{ padding: 4, marginLeft: 6 }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="edit-2" size={14} color={Acid.tx2} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Macros Chart Section */}

              {activeTab === 'Macros' && (
                <View style={styles.graphContainer}>
                  {!hasDataInRange && <NoRangeDataCard />}
                  {hasDataInRange && (<>
                  <Animated.View
                    style={[styles.graphCard, { backgroundColor: Acid.mossDeep, opacity: macrosChartOpacity }]}
                    {...graphPanResponder.panHandlers}
                  >
                    {/* Tooltip Overlay */}
                    {scrubbingIndex !== null && scrubbingPoints[scrubbingIndex] && (
                      <View
                        style={{
                          position: 'absolute',
                          left: scrubbingPoints[scrubbingIndex].x - 60,
                          top: 10,
                          width: 120,
                          alignItems: 'center',
                          zIndex: 10,
                          pointerEvents: 'none',
                        }}
                      >
                        <View style={{
                          backgroundColor: Acid.mossDeep,
                          borderRadius: 8,
                          padding: 8,
                          borderWidth: 1,
                          borderColor: Acid.hair,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 3,
                        }}>
                          <Text style={{ fontSize: 12, color: Acid.tx2, marginBottom: 4, textAlign: 'center' }}>
                            {format(scrubbingPoints[scrubbingIndex].data.date, 'MMM d')}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Acid.protein }} />
                            <Text style={{ fontSize: 12, color: Acid.tx }}>P: {(scrubbingPoints[scrubbingIndex].data as any).protein.toFixed(0)}g</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Acid.carbs }} />
                            <Text style={{ fontSize: 12, color: Acid.tx }}>C: {(scrubbingPoints[scrubbingIndex].data as any).carbs.toFixed(0)}g</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Acid.fat }} />
                            <Text style={{ fontSize: 12, color: Acid.tx }}>F: {(scrubbingPoints[scrubbingIndex].data as any).fat.toFixed(0)}g</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Graph */}
                    <View style={styles.graph}>
                      <Svg width={graphWidth} height={graphHeight}>
                        {/* Grid lines & Y-axis labels */}
                        {[0, 1, 2, 3, 4, 5].map((i) => {
                          const value = maxValue - (i / 5) * maxValue;
                          const y = padding + i * (innerHeight / 5);
                          return (
                            <React.Fragment key={i}>
                              <Line
                                x1={paddingLeft}
                                y1={y}
                                x2={graphWidth - padding}
                                y2={y}
                                stroke={Acid.hair}
                                strokeWidth={0.5}
                                strokeDasharray="2,2"
                              />
                              <SvgText
                                x={paddingLeft - 6}
                                y={y + 3}
                                fontSize={10}
                                fill={Acid.tx3}
                                textAnchor="end"
                              >
                                {value.toFixed(0)}
                              </SvgText>
                            </React.Fragment>
                          );
                        })}

                        {/* Target lines */}
                        {targetProtein !== undefined && (() => {
                          const targetProteinY = padding + innerHeight - (targetProtein / maxValue) * innerHeight;
                          return (
                            <Line
                              x1={paddingLeft}
                              y1={targetProteinY}
                              x2={graphWidth - padding}
                              y2={targetProteinY}
                              stroke="#3B82F6"
                              strokeWidth={1}
                              strokeDasharray="4,4"
                              opacity={0.5}
                            />
                          );
                        })()}
                        {/* Carbs & Fat targets omitted for brevity in design, or can extend similarly */}

                        {/* Lines */}
                        {proteinPath ? (
                          <AnimatedPath
                            d={proteinPath}
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${macrosDrawLength}, ${macrosDrawLength}`}
                            strokeDashoffset={macrosLineProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [macrosDrawLength, 0],
                            })}
                          />
                        ) : null}
                        {carbsPath ? (
                          <AnimatedPath
                            d={carbsPath}
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${macrosDrawLength}, ${macrosDrawLength}`}
                            strokeDashoffset={macrosLineProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [macrosDrawLength, 0],
                            })}
                          />
                        ) : null}
                        {fatPath ? (
                          <AnimatedPath
                            d={fatPath}
                            fill="none"
                            stroke="#8B5CF6"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${macrosDrawLength}, ${macrosDrawLength}`}
                            strokeDashoffset={macrosLineProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [macrosDrawLength, 0],
                            })}
                          />
                        ) : null}

                        {/* X-axis date labels */}
                        {getXAxisLabelIndices(graphData.length).map((idx) => {
                          const x = paddingLeft + (idx / (graphData.length - 1 || 1)) * innerWidth;
                          return (
                            <SvgText
                              key={`xlbl-${idx}`}
                              x={x}
                              y={graphHeight - 8}
                              fontSize="10"
                              fill={Acid.tx3}
                              textAnchor="middle"
                            >
                              {formatXLabel(graphData[idx].date)}
                            </SvgText>
                          );
                        })}

                        {/* Active Scrubber */}
                        {scrubbingIndex !== null && scrubbingPoints[scrubbingIndex] && (
                          (() => {
                            const pt = scrubbingPoints[scrubbingIndex];
                            const proteinY = padding + innerHeight - ((pt.data as any).protein / maxValue) * innerHeight;
                            const carbsY = padding + innerHeight - ((pt.data as any).carbs / maxValue) * innerHeight;
                            const fatY = padding + innerHeight - ((pt.data as any).fat / maxValue) * innerHeight;

                            return (
                              <>
                                <Line
                                  x1={pt.x}
                                  y1={padding}
                                  x2={pt.x}
                                  y2={padding + innerHeight}
                                  stroke={Acid.tx2}
                                  strokeWidth={1}
                                  strokeDasharray="4,4"
                                />
                                <Circle cx={pt.x} cy={proteinY} r={5} fill="#3B82F6" stroke={Acid.mossDeep} strokeWidth={2} />
                                <Circle cx={pt.x} cy={carbsY} r={5} fill="#F59E0B" stroke={Acid.mossDeep} strokeWidth={2} />
                                <Circle cx={pt.x} cy={fatY} r={5} fill="#8B5CF6" stroke={Acid.mossDeep} strokeWidth={2} />
                              </>
                            );
                          })()
                        )}

                      </Svg>
                    </View>
                  </Animated.View>

                  {/* Macros Legend */}
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingVertical: 8 }}>
                    {[
                      { label: 'Protein', color: Acid.protein },
                      { label: 'Carbs', color: Acid.carbs },
                      { label: 'Fat', color: Acid.fat },
                    ].map((item) => (
                      <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 10, height: 3, borderRadius: 1.5, backgroundColor: item.color }} />
                        <Text style={{ fontSize: 12, color: Acid.tx2 }}>{item.label}</Text>
                      </View>
                    ))}
                    {targetProtein !== undefined && (
                      // The dashed protein-target line otherwise reads as a second
                      // protein series.
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                          {[0, 1, 2].map(i => (
                            <View key={i} style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: Acid.protein, opacity: 0.6 }} />
                          ))}
                        </View>
                        <Text style={{ fontSize: 12, color: Acid.tx2 }}>Protein target</Text>
                      </View>
                    )}
                  </View>
                  </>)}

                  {/* Time Range Selector */}
                  {renderTimeRangePills()}

                  {/* Date Range */}
                  <Text style={[styles.dateRange, { color: Acid.tx2 }]}>
                    {getDateRange()}
                  </Text>

                  {/* Same context line as the Calories tab */}
                  {hasDataInRange && (
                    <Text style={{ fontSize: 12, color: Acid.tx3, textAlign: 'center', paddingTop: 2 }}>
                      {averageIsTodayOnly
                        ? 'Only today is logged so far. Averages start tomorrow.'
                        : `Average of ${completedDays.length} logged ${completedDays.length === 1 ? 'day' : 'days'} in the ${rangeLabel(timeRange)}. Today counts once complete.`}
                    </Text>
                  )}

                  {/* Selected period vs the equal period before it (macros) */}
                  {periodComparison && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, flexWrap: 'wrap' }}>
                      <Feather name="trending-up" size={14} color={Acid.tx2} />
                      <Text style={{ fontSize: 13, color: Acid.tx2 }}>vs {previousRangeLabel(timeRange)}:</Text>
                      {[
                        { label: 'P', val: periodComparison.protein, color: Acid.protein as string },
                        { label: 'C', val: periodComparison.carbs, color: Acid.carbs as string },
                        { label: 'F', val: periodComparison.fat, color: Acid.fat as string },
                      ].filter((m): m is { label: string; val: number; color: string } => m.val !== null).map((m) => {
                        const chipColor = m.val === 0 ? Acid.tx2 : m.val > 0 ? m.color : Acid.good;
                        const sign = m.val > 0 ? '+' : '';
                        return (
                          <View key={m.label} style={{ backgroundColor: `${chipColor}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: chipColor }}>{sign}{m.val}% {m.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Dynamic Macro Insight */}
                  {(() => {
                    const hasTargets = targetProtein !== undefined || targetCarbs !== undefined || targetFat !== undefined;

                    if (!hasTargets) {
                      return (
                        <View style={[styles.infoBox, { backgroundColor: Acid.mossDeep }]}>
                          <Feather name="target" size={18} color={Acid.lime} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.infoText, { color: Acid.tx2 }]}>
                              Set macro goals to get personalized insights on your nutrition.
                            </Text>
                            <TouchableOpacity onPress={handleSetGoalPress} activeOpacity={0.7} style={{ marginTop: 6 }}>
                              <Text style={{ color: Acid.lime, fontWeight: '600', fontSize: 13 }}>Set Goals</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }

                    // A partial today must not be scored against full-day targets:
                    // half a day of eating always reads as "way below target".
                    if (averageIsTodayOnly) {
                      return (
                        <View style={[styles.infoBox, { backgroundColor: Acid.mossDeep }]}>
                          <Feather name="clock" size={18} color={Acid.tx2} />
                          <Text style={[styles.infoText, { color: Acid.tx2, flex: 1 }]}>
                            Today is still in progress. Macro insights compare completed days against your targets.
                          </Text>
                        </View>
                      );
                    }

                    // Compare each macro against its target
                    const insights: { macro: string; color: string; pct: number; status: 'low' | 'high' | 'on_track' }[] = [];

                    if (targetProtein !== undefined && averageProtein !== null) {
                      const pct = ((averageProtein - targetProtein) / targetProtein) * 100;
                      insights.push({ macro: 'Protein', color: Acid.protein, pct, status: pct < -15 ? 'low' : pct > 15 ? 'high' : 'on_track' });
                    }
                    if (targetCarbs !== undefined && averageCarbs !== null) {
                      const pct = ((averageCarbs - targetCarbs) / targetCarbs) * 100;
                      insights.push({ macro: 'Carbs', color: Acid.carbs, pct, status: pct < -15 ? 'low' : pct > 15 ? 'high' : 'on_track' });
                    }
                    if (targetFat !== undefined && averageFat !== null) {
                      const pct = ((averageFat - targetFat) / targetFat) * 100;
                      insights.push({ macro: 'Fat', color: Acid.fat, pct, status: pct < -15 ? 'low' : pct > 15 ? 'high' : 'on_track' });
                    }

                    const offTrack = insights.filter(i => i.status !== 'on_track');
                    const allOnTrack = offTrack.length === 0 && insights.length > 0;

                    let icon: string;
                    let iconColor: string;
                    let message: string;

                    if (allOnTrack) {
                      icon = 'check-circle';
                      iconColor = Acid.good;
                      message = `All macros are within target range over the ${rangeLabel(timeRange)}. You're nailing your nutrition goals — keep it up!`;
                    } else if (offTrack.length > 0) {
                      // Pick the most off-track macro
                      const worst = offTrack.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
                      iconColor = worst.color;

                      if (worst.status === 'low') {
                        icon = 'arrow-down-circle';
                        const deficit = Math.abs(Math.round(worst.pct));
                        if (worst.macro === 'Protein') {
                          message = `Protein is ${deficit}% below target over the ${rangeLabel(timeRange)}. Try adding eggs, Greek yogurt, or chicken to close the gap.`;
                        } else if (worst.macro === 'Carbs') {
                          message = `Carbs are ${deficit}% below target over the ${rangeLabel(timeRange)}. Add whole grains, fruit, or oats to fuel your energy levels.`;
                        } else {
                          message = `Fat is ${deficit}% below target over the ${rangeLabel(timeRange)}. Nuts, avocado, or olive oil are great healthy fat sources.`;
                        }
                      } else {
                        icon = 'arrow-up-circle';
                        const surplus = Math.round(worst.pct);
                        if (worst.macro === 'Protein') {
                          message = `Protein is ${surplus}% above target over the ${rangeLabel(timeRange)}. Consider balancing portions with more vegetables and complex carbs.`;
                        } else if (worst.macro === 'Carbs') {
                          message = `Carbs are ${surplus}% over target over the ${rangeLabel(timeRange)}. Try swapping refined carbs for vegetables or reducing portion sizes.`;
                        } else {
                          message = `Fat is ${surplus}% over target over the ${rangeLabel(timeRange)}. Watch for hidden fats in sauces, fried food, and processed snacks.`;
                        }
                      }
                    } else {
                      return null;
                    }

                    return (
                      <View style={[styles.infoBox, { backgroundColor: Acid.mossDeep }]}>
                        <Feather name={icon as any} size={18} color={iconColor} />
                        <Text style={[styles.infoText, { color: Acid.tx2 }]}>
                          {message}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Macros History Table */}
                  {macrosHistory.length > 0 && (
                    <View style={[styles.historyContainer, { borderColor: Acid.hair }]}>
                      <Text style={[styles.historyTitle, { color: Acid.tx }]}>
                        History
                      </Text>
                      <View style={styles.historyHeaderRow}>
                        <Text style={[styles.historyHeaderText, { color: Acid.tx2, flex: 1.5 }]}>
                          Date
                        </Text>
                        <Text style={[styles.historyHeaderText, { color: Acid.tx2, textAlign: 'right' }]}>
                          Protein
                        </Text>
                        <Text style={[styles.historyHeaderText, { color: Acid.tx2, textAlign: 'right' }]}>
                          Carbs
                        </Text>
                        <Text style={[styles.historyHeaderText, { color: Acid.tx2, textAlign: 'right' }]}>
                          Fat
                        </Text>
                        <View style={{ width: 28 }} />
                      </View>
                      {macrosHistory.map((entry) => (
                        <View key={entry.date.toISOString()} style={[styles.historyRow, { borderTopColor: Acid.hair }]}>
                          <Text style={[styles.historyCellText, { color: Acid.tx2, flex: 1.5 }]}>
                            {format(entry.date, 'd MMM yyyy')}
                          </Text>
                          <Text style={[styles.historyCellText, { color: Acid.lime, textAlign: 'right' }]}>
                            {`${entry.protein.toFixed(0)}g`}
                          </Text>
                          <Text style={[styles.historyCellText, { color: Acid.tx2, textAlign: 'right' }]}>
                            {`${entry.carbs.toFixed(0)}g`}
                          </Text>
                          <Text style={[styles.historyCellText, { color: Acid.tx3, textAlign: 'right' }]}>
                            {`${entry.fat.toFixed(0)}g`}
                          </Text>
                          <TouchableOpacity
                            onPress={() => onRequestLogMealForDate?.(entry.date)}
                            style={{ padding: 4, marginLeft: 6 }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="edit-2" size={14} color={Acid.tx2} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}


                </View>
              )}

              {/* Insights Tab */}
              {activeTab === 'Insights' && (
                <View style={styles.graphContainer}>
                  {!isPremium ? (
                    <View style={{ alignItems: 'center', padding: 40, opacity: 0.6 }}>
                      <Feather name="lock" size={48} color={Acid.tx2} style={{ marginBottom: 16 }} />
                      <Text style={{ color: Acid.tx, fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                        Premium Feature
                      </Text>
                      <Text style={{ color: Acid.tx2, textAlign: 'center' }}>
                        Unlock advanced analytics, AI-powered insights, and weekly trend reports.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 16 }}>

                      {/* ── Time Range Selector ── */}
                      {renderTimeRangePills()}

                      {/* ── Top Priority (deterministic insight + AI pattern) ── */}
                      <TopPriorityCard />

                      {/* ── AI Weekly Insight (collapsible) ── */}
                      <InsightSlot id="ai-weekly-insight">
                      {!isUnlocked('ai-weekly-insight') ? (
                        <LockedInsightCard id="ai-weekly-insight" />
                      ) : (insightText || isGeneratingInsight) && (
                        <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => !isGeneratingInsight && setInsightCollapsed(prev => !prev)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                          >
                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${Acid.lime}15`, alignItems: 'center', justifyContent: 'center' }}>
                              <Feather name="cpu" size={14} color={Acid.lime} />
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx }}>AI Weekly Insight</Text>
                            {insightIsNew && !isGeneratingInsight && (
                              <View style={{ backgroundColor: Acid.good, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>NEW</Text>
                              </View>
                            )}
                            <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {!isGeneratingInsight && (
                                <Text style={{ fontSize: 10, color: Acid.tx3 }}>
                                  Refreshes every {calorieBankData?.enabled ? calorieBankData.cycleStartDay : 'Monday'}
                                </Text>
                              )}
                              {!isGeneratingInsight && (
                                <Feather name={insightCollapsed ? 'chevron-down' : 'chevron-up'} size={16} color={Acid.tx3} />
                              )}
                            </View>
                          </TouchableOpacity>
                          {!insightCollapsed && (
                            <View style={{ marginTop: 12 }}>
                              {isGeneratingInsight ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Feather name="loader" size={14} color={Acid.tx2} />
                                  <Text style={{ fontSize: 13, color: Acid.tx2, fontStyle: 'italic' }}>Analyzing your nutrition data...</Text>
                                </View>
                              ) : (
                                <Text style={{ fontSize: 13, color: Acid.tx, lineHeight: 20 }}>
                                  {insightText}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                      </InsightSlot>

                      {/* ── Calorie Bank Insights ── */}
                      {calorieBankData?.enabled && (
                        <InsightSlot id="calorie-bank">
                          {!isUnlocked('calorie-bank') && <LockedInsightCard id="calorie-bank" />}
                          {isUnlocked('calorie-bank') && (
                        <>
                          {/* Bank Utilization */}
                          <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#22C55E15', alignItems: 'center', justifyContent: 'center' }}>
                                <Feather name="credit-card" size={14} color="#22C55E" />
                              </View>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx }}>Calorie Bank</Text>
                              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Calorie Bank', 'Shows your weekly calorie budget progress, how much you have banked, and your bank utilization. The budget number counts only days you logged. Utilization tells you what percentage of your banked calories you actually used. Cap days counts the days you saved the maximum your daily cap allows.')}>
                                <Feather name="info" size={13} color={Acid.tx3} />
                              </TouchableOpacity>
                              <View style={{ backgroundColor: '#22C55E20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 'auto' }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: Acid.good }}>ACTIVE</Text>
                              </View>
                            </View>

                            {/* Budget progress */}
                            <View style={{ marginBottom: 16 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ fontSize: 12, color: Acid.tx2 }}>Weekly budget</Text>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: Acid.tx }}>
                                  {Math.round(calorieBankData.weeklyActual).toLocaleString()} / {Math.round(calorieBankData.weeklyBudget).toLocaleString()} kcal
                                </Text>
                              </View>
                              <View style={{ height: 8, borderRadius: 4, backgroundColor: Acid.mossDeep, overflow: 'hidden' }}>
                                <View style={{
                                  height: '100%', borderRadius: 4,
                                  width: `${Math.min(100, (calorieBankData.weeklyActual / (calorieBankData.weeklyBudget || 1)) * 100)}%`,
                                  backgroundColor: calorieBankData.weeklyActual > calorieBankData.weeklyBudget ? Acid.error : Acid.good,
                                }} />
                              </View>
                            </View>

                            {/* Stats grid */}
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <View style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: Acid.mossDeep }}>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: Acid.good }}>+{Math.round(calorieBankData.bankBalance)}</Text>
                                <Text style={{ fontSize: 10, color: Acid.tx3, marginTop: 2 }}>Banked</Text>
                              </View>
                              <View style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: Acid.mossDeep }}>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: Acid.tx }}>{calorieBankData.bankUtilization}%</Text>
                                <Text style={{ fontSize: 10, color: Acid.tx3, marginTop: 2 }}>Utilization</Text>
                              </View>
                              <View style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: Acid.mossDeep }}>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: Acid.tx }}>{calorieBankData.capHitDays}</Text>
                                <Text style={{ fontSize: 10, color: Acid.tx3, marginTop: 2 }}>Cap days</Text>
                              </View>
                            </View>
                          </View>

                          {/* Daily Distribution */}
                          {calorieBankData.perDayBreakdown.length > 0 && (
                            <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx }}>Bank Distribution</Text>
                                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Bank Distribution', 'Shows how much you banked or spent each day of your current cycle. Green bars are days you ate under target and saved calories. Amber bars are days you ate over and drew from the bank. This helps you see whether your week is balanced or if you are front-loading restriction and back-loading spending.')}>
                                  <Feather name="info" size={13} color={Acid.tx3} />
                                </TouchableOpacity>
                              </View>
                              <Text style={{ fontSize: 12, color: Acid.tx2, marginBottom: 16 }}>Daily banking and spending this cycle · "skipped" = day not logged</Text>
                              {calorieBankData.perDayBreakdown.map((day, i) => {
                                const dayDate = new Date(day.day + 'T12:00:00');
                                const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayDate.getDay()];
                                const todayStr = format(new Date(), 'yyyy-MM-dd');
                                const isToday = day.day === todayStr;
                                const maxBar = calorieBankData.dailyCapPercent / 100 * day.base;
                                const bankedPct = maxBar > 0 ? Math.min(1, day.banked / maxBar) : 0;
                                const spentPct = maxBar > 0 ? Math.min(1, day.spent / maxBar) : 0;
                                // By date, not by actual===0: a past day where the user
                                // logged only zero-calorie items is not "future".
                                const isFuture = day.day > todayStr;
                                // A skipped day must not render like a perfect on-target
                                // day. The engine assumes base for unlogged past days,
                                // which made both show as "0".
                                const isSkipped = !isFuture && !isToday && (summariesByDate?.[day.day]?.entryCount ?? 0) === 0;

                                return (
                                  <View key={day.day} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, opacity: isSkipped ? 0.55 : 1 }}>
                                    <Text style={{
                                      width: 32, fontSize: 12,
                                      fontWeight: isToday ? '700' : '400',
                                      color: isToday ? Acid.tx : Acid.tx2,
                                    }}>{dayLabel}</Text>
                                    <View style={{ flex: 1, height: 16, borderRadius: 4, backgroundColor: Acid.mossDeep, overflow: 'hidden', flexDirection: 'row' }}>
                                      {!isFuture && !isSkipped && day.banked > 0 && (
                                        <View style={{ width: `${bankedPct * 100}%`, height: '100%', backgroundColor: Acid.good, borderRadius: 4 }} />
                                      )}
                                      {!isFuture && !isSkipped && day.spent > 0 && (
                                        <View style={{ width: `${spentPct * 100}%`, height: '100%', backgroundColor: Acid.carbs, borderRadius: 4 }} />
                                      )}
                                    </View>
                                    <Text style={{ width: 50, textAlign: 'right', fontSize: 11, color: isFuture || isSkipped ? Acid.tx3 : Acid.tx2 }}>
                                      {isFuture ? '—' : isSkipped ? 'skipped' : day.banked > 0 ? `+${Math.round(day.banked)}` : day.spent > 0 ? `-${Math.round(day.spent)}` : '0'}
                                    </Text>
                                  </View>
                                );
                              })}
                              <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: Acid.good }} />
                                  <Text style={{ fontSize: 10, color: Acid.tx3 }}>Banked</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: Acid.carbs }} />
                                  <Text style={{ fontSize: 10, color: Acid.tx3 }}>Spent</Text>
                                </View>
                              </View>
                            </View>
                          )}
                        </>
                          )}
                        </InsightSlot>
                      )}

                      {/* ── Macro Adherence Rings ── */}
                      <InsightSlot id="goal-adherence">
                      {!isUnlocked('goal-adherence') && <LockedInsightCard id="goal-adherence" />}
                      {isUnlocked('goal-adherence') && !(targetProtein || targetCarbs || targetFat) && <NeedsGoalsCard name="Goal Adherence" />}
                      {isUnlocked('goal-adherence') && (targetProtein || targetCarbs || targetFat) && (
                        <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx }}>Goal Adherence</Text>
                            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Goal Adherence', 'Shows how close your average daily intake is to your targets for each macro and calories. 100% means you are hitting the target exactly. Below 100% means you are under, above means you are over. This helps you see which macros need attention and whether your overall intake matches your plan.')}>
                              <Feather name="info" size={13} color={Acid.tx3} />
                            </TouchableOpacity>
                          </View>
                          <Text style={{ fontSize: 12, color: Acid.tx2, marginBottom: 16 }}>{rangeSubtitle('Average vs. target')}</Text>
                          {!hasAverage ? <CardEmptyNote /> : (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                            {[
                              { label: 'Protein', avg: averageProtein ?? 0, target: targetProtein, color: Acid.protein },
                              { label: 'Carbs', avg: averageCarbs ?? 0, target: targetCarbs, color: Acid.carbs },
                              { label: 'Fat', avg: averageFat ?? 0, target: targetFat, color: Acid.fat },
                              ...(targetCalories ? [{ label: 'Calories', avg: averageCalories ?? 0, target: targetCalories, color: Acid.lime }] : []),
                            ].filter(m => m.target).map((macro) => {
                              // The number tells the truth (140% is 140%); only the
                              // ring is capped at a full circle. Clamping both hid
                              // every overshoot as a perfect 100%.
                              const rawPct = macro.avg / (macro.target! || 1);
                              const ringPct = Math.min(1, rawPct);
                              const circumference = 2 * Math.PI * 32;
                              return (
                                <View key={macro.label} style={{ alignItems: 'center' }}>
                                  <View style={{ position: 'relative', width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
                                    <Svg width={72} height={72} viewBox="0 0 80 80">
                                      <Circle cx="40" cy="40" r="32" stroke={Acid.mossDeep} strokeWidth="6" fill="transparent" />
                                      <Circle
                                        cx="40" cy="40" r="32"
                                        stroke={macro.color}
                                        strokeWidth="6"
                                        fill="transparent"
                                        strokeDasharray={`${circumference}`}
                                        strokeDashoffset={`${circumference * (1 - ringPct)}`}
                                        strokeLinecap="round"
                                        transform="rotate(-90, 40, 40)"
                                      />
                                    </Svg>
                                    <View style={{ position: 'absolute' }}>
                                      <Text style={{ fontSize: 14, fontWeight: '800', color: Acid.tx, textAlign: 'center' }}>
                                        {Math.round(rawPct * 100)}%
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: Acid.tx2, marginTop: 6 }}>{macro.label}</Text>
                                  <Text style={{ fontSize: 10, color: Acid.tx3 }}>{Math.round(macro.avg)}/{macro.target}{macro.label === 'Calories' ? '' : 'g'}</Text>
                                </View>
                              );
                            })}
                          </View>
                          )}
                        </View>
                      )}
                      </InsightSlot>

                      {/* ── Calorie Trend Chart ── */}
                      <InsightSlot id="calorie-trend">
                      {!isUnlocked('calorie-trend') && <LockedInsightCard id="calorie-trend" />}
                      {isUnlocked('calorie-trend') && graphData.length >= 2 && (
                        <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx }}>Calorie Trend</Text>
                                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Calorie Trend', 'Tracks your daily calorie intake over time as a line chart. The dashed line shows your average and the red line shows your target. Use this to spot upward or downward trends in your eating. A steady line near target means consistency. A rising line means you are gradually eating more than planned.')}>
                                  <Feather name="info" size={13} color={Acid.tx3} />
                                </TouchableOpacity>
                              </View>
                              <Text style={{ fontSize: 12, color: Acid.tx2 }}>{rangeSubtitle('Daily intake')}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: Acid.tx }}>{averageCalories ?? 0}</Text>
                              <Text style={{ fontSize: 11, color: Acid.tx2 }}>avg Kcal / logged day</Text>
                            </View>
                          </View>
                          {(() => {
                            // graphWidth assumes graphCard's 18px padding; this card pads 20
                            const cW = graphWidth - 4;
                            const cH = 140;
                            const cPadL = 35;
                            const cPadR = 10;
                            const cPadY = 16;
                            const iW = cW - cPadL - cPadR;
                            const iH = cH - cPadY * 2;
                            const vals = graphData.map(d => d.calories);
                            const maxV = Math.max(...vals, targetCalories ?? 0, 100);
                            const minV = 0;
                            const range = maxV - minV || 1;
                            const avg = averageCalories ?? 0;

                            const pts = vals.map((v, i) => ({
                              x: cPadL + (i / (vals.length - 1 || 1)) * iW,
                              y: cPadY + iH - ((v - minV) / range) * iH,
                            }));
                            const avgY = cPadY + iH - ((avg - minV) / range) * iH;
                            const targetY = targetCalories ? cPadY + iH - ((targetCalories - minV) / range) * iH : null;

                            // Area fill path
                            const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                            const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${cPadY + iH} L ${pts[0].x} ${cPadY + iH} Z`;

                            return (
                              <Svg width={cW} height={cH}>
                                <Defs>
                                  <LinearGradient id="calTrendGrad" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor={Acid.lime} stopOpacity="0.2" />
                                    <Stop offset="1" stopColor={Acid.lime} stopOpacity="0" />
                                  </LinearGradient>
                                </Defs>
                                {/* Grid lines */}
                                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                                  const y = cPadY + iH - r * iH;
                                  const label = Math.round(minV + r * range);
                                  return (
                                    <React.Fragment key={i}>
                                      <Line x1={cPadL} y1={y} x2={cW - cPadR} y2={y} stroke={Acid.hair} strokeWidth={0.5} strokeDasharray="2,2" />
                                      <SvgText x={cPadL - 4} y={y + 3} fontSize="9" fill={Acid.tx3} textAnchor="end">{label}</SvgText>
                                    </React.Fragment>
                                  );
                                })}
                                {/* Area fill */}
                                <Path d={areaPath} fill="url(#calTrendGrad)" />
                                {/* Line */}
                                <Path d={linePath} fill="none" stroke={Acid.lime} strokeWidth={2} strokeLinejoin="round" />
                                {/* Avg dashed line */}
                                <Line x1={cPadL} y1={avgY} x2={cW - cPadR} y2={avgY} stroke={Acid.tx2} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
                                <SvgText x={cW - cPadR} y={avgY - 4} fontSize="9" fill={Acid.tx2} textAnchor="end">avg</SvgText>
                                {/* Target line */}
                                {targetY !== null && (
                                  <>
                                    <Line x1={cPadL} y1={targetY} x2={cW - cPadR} y2={targetY} stroke="#EF4444" strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
                                    <SvgText x={cW - cPadR} y={targetY - 4} fontSize="9" fill="#EF4444" textAnchor="end">target</SvgText>
                                  </>
                                )}
                                {/* Data dots */}
                                {pts.length <= 14 && pts.map((p, i) => (
                                  <Circle key={i} cx={p.x} cy={p.y} r={3} fill={Acid.mossDeep} stroke={Acid.lime} strokeWidth={1.5} />
                                ))}
                              </Svg>
                            );
                          })()}
                        </View>
                      )}
                      </InsightSlot>

                      {/* ── Macro Split Bar ── */}
                      <InsightSlot id="macro-split">
                      {!isUnlocked('macro-split') && <LockedInsightCard id="macro-split" />}
                      {isUnlocked('macro-split') && <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx }}>Macro Split</Text>
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Macro Split', 'Breaks down your average daily calories into protein, carbs, and fat as a percentage. The colored bar shows the proportion visually. This helps you see if your diet is balanced or leaning too heavily toward one macro. For example, a very low protein percentage often leads to muscle loss and increased hunger.')}>
                            <Feather name="info" size={13} color={Acid.tx3} />
                          </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 12, color: Acid.tx2, marginBottom: 16 }}>{rangeSubtitle('Average daily ratio')}</Text>
                        {!hasAverage ? <CardEmptyNote /> : (() => {
                          const p = averageProtein ?? 0;
                          const c = averageCarbs ?? 0;
                          const f = averageFat ?? 0;
                          // Calorie-based ratio
                          const pCal = p * 4;
                          const cCal = c * 4;
                          const fCal = f * 9;
                          const totalCal = pCal + cCal + fCal || 1;
                          const pCalPct = (pCal / totalCal) * 100;
                          const cCalPct = (cCal / totalCal) * 100;
                          const fCalPct = (fCal / totalCal) * 100;

                          return (
                            <View>
                              {/* Stacked bar */}
                              <View style={{ height: 28, flexDirection: 'row', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
                                <View style={{ width: `${pCalPct}%`, backgroundColor: Acid.protein }} />
                                <View style={{ width: `${cCalPct}%`, backgroundColor: Acid.carbs }} />
                                <View style={{ width: `${fCalPct}%`, backgroundColor: Acid.fat }} />
                              </View>
                              {/* Labels */}
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                {[
                                  { label: 'Protein', grams: p, pct: pCalPct, color: Acid.protein },
                                  { label: 'Carbs', grams: c, pct: cCalPct, color: Acid.carbs },
                                  { label: 'Fat', grams: f, pct: fCalPct, color: Acid.fat },
                                ].map((m) => (
                                  <View key={m.label} style={{ alignItems: 'center', flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                                      <Text style={{ fontSize: 12, fontWeight: '600', color: Acid.tx2 }}>{m.label}</Text>
                                    </View>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: Acid.tx }}>{Math.round(m.pct)}%</Text>
                                    <Text style={{ fontSize: 11, color: Acid.tx3 }}>{Math.round(m.grams)}g/day</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          );
                        })()}
                      </View>}
                      </InsightSlot>

                      {/* ── Micronutrients ── */}
                      <InsightSlot id="micronutrient-balance">
                      {!isUnlocked('micronutrient-balance') && <LockedInsightCard id="micronutrient-balance" />}
                      {isUnlocked('micronutrient-balance') && summariesByDate && (
                        <MicronutrientCard summariesByDate={summariesByDate} timeRange={timeRange} />
                      )}
                      </InsightSlot>

                      {/* ── Radar Chart ── */}
                      <InsightSlot id="nutrition-balance">
                      {!isUnlocked('nutrition-balance') && <LockedInsightCard id="nutrition-balance" />}
                      {isUnlocked('nutrition-balance') && radarData.length === 0 && <NeedsGoalsCard name="Nutrition Balance" />}
                      {isUnlocked('nutrition-balance') && radarData.length > 0 && (
                        <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20, alignItems: 'center' }]}>
                          <View style={{ width: '100%', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx }}>Nutrition Balance</Text>
                              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Nutrition Balance', 'A radar chart comparing your actual intake against your targets across all macros. A perfectly balanced shape means you are hitting every target evenly. If one axis is shorter than the others, that macro needs more attention. This gives you a quick visual of your overall nutrition quality.')}>
                                <Feather name="info" size={13} color={Acid.tx3} />
                              </TouchableOpacity>
                            </View>
                            <Text style={{ fontSize: 12, color: Acid.tx2 }}>{rangeSubtitle('Target vs. your average per logged day')}</Text>
                          </View>
                          {hasAverage ? renderRadarChart() : <CardEmptyNote />}
                        </View>
                      )}
                      </InsightSlot>

                      {/* ── Day-of-Week Activity ── */}
                      <InsightSlot id="weekly-pattern">
                      {!isUnlocked('weekly-pattern') && <LockedInsightCard id="weekly-pattern" />}
                      {isUnlocked('weekly-pattern') && completedDays.length >= 3 && (
                        <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx }}>Weekly Pattern</Text>
                            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Weekly Pattern', 'Shows your average calorie intake for each day of the week. This reveals habits you might not notice. Many people eat significantly more on weekends or less on Mondays. Knowing your pattern helps you plan ahead for days you tend to overeat.')}>
                              <Feather name="info" size={13} color={Acid.tx3} />
                            </TouchableOpacity>
                          </View>
                          <Text style={{ fontSize: 12, color: Acid.tx2, marginBottom: 16 }}>Average calories by day of week · {rangeLabel(timeRange)}</Text>
                          {(() => {
                            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                            const dayBuckets: Record<string, { total: number; count: number }> = {};
                            dayNames.forEach(d => { dayBuckets[d] = { total: 0, count: 0 }; });

                            // Completed days only: today's half-logged calories would
                            // drag its weekday bar down, breaking the screen rule
                            // that today never enters an average.
                            completedDays.forEach(entry => {
                              const dayIdx = entry.date.getDay(); // 0=Sun
                              const dayName = dayNames[dayIdx === 0 ? 6 : dayIdx - 1]; // Mon=0
                              dayBuckets[dayName].total += entry.calories;
                              dayBuckets[dayName].count++;
                            });

                            const dayAvgs = dayNames.map(d => ({
                              day: d,
                              avg: dayBuckets[d].count > 0 ? Math.round(dayBuckets[d].total / dayBuckets[d].count) : 0,
                            }));
                            const maxDayAvg = Math.max(...dayAvgs.map(d => d.avg), 1);

                            // graphWidth assumes graphCard's 18px padding; this card pads 20
                            const barChartW = graphWidth - 4;
                            const barChartH = 120;
                            const barGap = 6;
                            const barW = (barChartW - barGap * 6) / 7;

                            return (
                              <View>
                                <Svg width={barChartW} height={barChartH + 20}>
                                  {dayAvgs.map((d, i) => {
                                    const barH = (d.avg / maxDayAvg) * (barChartH - 16);
                                    const x = i * (barW + barGap);
                                    const y = barChartH - barH;
                                    const isToday = dayNames[(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)] === d.day;
                                    return (
                                      <React.Fragment key={d.day}>
                                        <Rect x={x} y={y} width={barW} height={Math.max(barH, 2)} rx={barW / 2} fill={isToday ? Acid.lime : `${Acid.lime}40`} />
                                        {d.avg > 0 && (
                                          <SvgText x={x + barW / 2} y={y - 4} fontSize="9" fill={Acid.tx2} textAnchor="middle" fontWeight="600">
                                            {d.avg}
                                          </SvgText>
                                        )}
                                        <SvgText x={x + barW / 2} y={barChartH + 14} fontSize="10" fill={isToday ? Acid.tx : Acid.tx2} textAnchor="middle" fontWeight={isToday ? '700' : '500'}>
                                          {d.day}
                                        </SvgText>
                                      </React.Fragment>
                                    );
                                  })}
                                </Svg>
                              </View>
                            );
                          })()}
                        </View>
                      )}
                      </InsightSlot>

                      {/* ── Meal Timing ── */}
                      <InsightSlot id="meal-timing">
                      {!isUnlocked('meal-timing') && <LockedInsightCard id="meal-timing" />}
                      {isUnlocked('meal-timing') && <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx }}>Meal Timing</Text>
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Meal Timing', 'Breaks down what percentage of your calories you eat in the morning, afternoon, and evening. If most of your calories come from evening meals, it may explain energy dips during the day or late-night hunger. Spreading intake more evenly can improve energy and reduce overeating.')}>
                            <Feather name="info" size={13} color={Acid.tx3} />
                          </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 12, color: Acid.tx2, marginBottom: 16 }}>When are you eating? · {rangeLabel(timeRange)}</Text>
                        {(() => {
                          const buckets = { Morning: { cals: 0, count: 0 }, Afternoon: { cals: 0, count: 0 }, Evening: { cals: 0, count: 0 } };
                          // Same window as the chart, and LOCAL day keys — the old
                          // UTC keys split one local day into two, inflating the
                          // day count and understating the daily average.
                          const window = getRangeWindow(timeRange);
                          let totalRangeCals = 0;
                          let totalDaysWithData = new Set<string>();

                          Object.values(mealsByDate).flat().forEach(meal => {
                            const d = new Date(meal.timestamp);
                            if (!isInRange(d, window)) return;
                            totalDaysWithData.add(format(d, 'yyyy-MM-dd'));
                            const h = d.getHours();
                            let bucket: keyof typeof buckets = 'Evening';
                            if (h >= 4 && h < 12) bucket = 'Morning';
                            else if (h >= 12 && h < 17) bucket = 'Afternoon';
                            const mealCals = meal.foods.reduce((acc, f) => acc + (f.calories || 0), 0);
                            buckets[bucket].cals += mealCals;
                            buckets[bucket].count++;
                            totalRangeCals += mealCals;
                          });
                          const daysCount = Math.max(1, totalDaysWithData.size);

                          const periods = [
                            { key: 'Morning' as const, label: 'Morning', sub: '4AM – 12PM', icon: 'sunrise' as const, color: Acid.carbs },
                            { key: 'Afternoon' as const, label: 'Afternoon', sub: '12PM – 5PM', icon: 'sun' as const, color: Acid.protein },
                            { key: 'Evening' as const, label: 'Evening', sub: '5PM – 4AM', icon: 'moon' as const, color: Acid.fat },
                          ];

                          return (
                            <View style={{ gap: 16 }}>
                              {periods.map((p) => {
                                const bucket = buckets[p.key];
                                const pct = totalRangeCals > 0 ? bucket.cals / totalRangeCals : 0;
                                const avgCals = Math.round(bucket.cals / daysCount);
                                return (
                                  <View key={p.key}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: `${p.color}15`, alignItems: 'center', justifyContent: 'center' }}>
                                          <Feather name={p.icon} size={14} color={p.color} />
                                        </View>
                                        <View>
                                          <Text style={{ fontSize: 13, fontWeight: '600', color: Acid.tx }}>{p.label}</Text>
                                          <Text style={{ fontSize: 10, color: Acid.tx2 }}>{p.sub}</Text>
                                        </View>
                                      </View>
                                      <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: Acid.tx }}>{(pct * 100).toFixed(0)}%</Text>
                                        <Text style={{ fontSize: 10, color: Acid.tx2 }}>~{avgCals} Kcal</Text>
                                      </View>
                                    </View>
                                    <View style={{ height: 6, backgroundColor: Acid.mossDeep, borderRadius: 3, overflow: 'hidden' }}>
                                      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: p.color, borderRadius: 3 }} />
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()}
                      </View>}
                      </InsightSlot>

                      {/* ── Top Foods ── */}
                      <InsightSlot id="top-foods">
                      {!isUnlocked('top-foods') && <LockedInsightCard id="top-foods" />}
                      {isUnlocked('top-foods') && <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx }}>Top Foods</Text>
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Top Foods', 'Lists the foods you log most often, ranked by frequency. This shows what your diet actually looks like day to day. If the same 3 foods dominate, you may be missing key nutrients. More variety generally means better micronutrient coverage and less food fatigue.')}>
                            <Feather name="info" size={13} color={Acid.tx3} />
                          </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 12, color: Acid.tx2, marginBottom: 16 }}>Most logged items · {rangeLabel(timeRange)}</Text>
                        {(() => {
                          const window = getRangeWindow(timeRange);

                          const foodCounts: Record<string, { count: number; cals: number }> = {};
                          Object.values(mealsByDate).flat().forEach(meal => {
                            const d = new Date(meal.timestamp);
                            if (!isInRange(d, window)) return;
                            meal.foods.forEach(f => {
                              const name = f.name?.toLowerCase().trim();
                              if (!name) return;
                              if (!foodCounts[name]) foodCounts[name] = { count: 0, cals: 0 };
                              foodCounts[name].count++;
                              foodCounts[name].cals += f.calories || 0;
                            });
                          });

                          const sorted = Object.entries(foodCounts)
                            .sort((a, b) => b[1].count - a[1].count)
                            .slice(0, 5);
                          const maxCount = sorted.length > 0 ? sorted[0][1].count : 1;

                          if (sorted.length === 0) {
                            return <Text style={{ fontSize: 13, color: Acid.tx2, textAlign: 'center', paddingVertical: 12 }}>Log more meals to see your top foods.</Text>;
                          }

                          return (
                            <View style={{ gap: 10 }}>
                              {sorted.map(([name, data], i) => (
                                <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <Text style={{ width: 18, fontSize: 12, fontWeight: '700', color: Acid.tx3, textAlign: 'center' }}>{i + 1}</Text>
                                  <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 }}>
                                      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: Acid.tx, textTransform: 'capitalize', flex: 1, flexShrink: 1 }}>{name}</Text>
                                      <Text style={{ fontSize: 11, color: Acid.tx2, flexShrink: 0 }}>{data.count}x · {Math.round(data.cals / data.count)} Kcal avg</Text>
                                    </View>
                                    <View style={{ height: 4, backgroundColor: Acid.mossDeep, borderRadius: 2, overflow: 'hidden' }}>
                                      <View style={{ width: `${(data.count / maxCount) * 100}%`, height: '100%', backgroundColor: Acid.lime, borderRadius: 2 }} />
                                    </View>
                                  </View>
                                </View>
                              ))}
                            </View>
                          );
                        })()}
                      </View>}
                      </InsightSlot>

                      {/* ── Sugar Load ── */}
                      <InsightSlot id="sugar-load">
                      {!isUnlocked('sugar-load') && <LockedInsightCard id="sugar-load" />}
                      {isUnlocked('sugar-load') && (
                      <View style={[styles.graphCard, { backgroundColor: Acid.mossDeep, padding: 20 }]}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Sugar Load</Text>
                        <Text style={{ fontSize: 12, color: Acid.tx2, marginBottom: 16 }}>Natural vs. added sugars, daily average · {rangeLabel(timeRange)}</Text>
                        {(() => {
                          let totalSugar = 0;
                          let addedSugar = 0;
                          let daysWithData = new Set<string>();
                          // Same window as the chart, LOCAL day keys (see Meal Timing).
                          const window = getRangeWindow(timeRange);

                          Object.values(mealsByDate).flat().forEach(meal => {
                            const d = new Date(meal.timestamp);
                            if (!isInRange(d, window)) return;
                            daysWithData.add(format(d, 'yyyy-MM-dd'));
                            meal.foods.forEach(f => {
                              totalSugar += (f.sugar || 0);
                              addedSugar += (f.added_sugars || 0);
                            });
                          });

                          const count = Math.max(1, daysWithData.size);
                          const avgTotal = Math.round(totalSugar / count);
                          const avgAdded = Math.round(addedSugar / count);
                          const avgNatural = Math.max(0, avgTotal - avgAdded);
                          const dailyLimit = 50;
                          const maxBar = Math.max(avgTotal, dailyLimit * 1.2);

                          return (
                            <View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
                                {[
                                  { label: 'Added', val: avgAdded, color: '#FB7185' },
                                  { label: 'Natural', val: avgNatural, color: '#4ADE80' },
                                  { label: 'Total', val: avgTotal, color: Acid.tx },
                                ].map(s => (
                                  <View key={s.label} style={{ alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                      {s.label !== 'Total' && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: s.color }} />}
                                      <Text style={{ fontSize: 11, color: Acid.tx2 }}>{s.label}</Text>
                                    </View>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: Acid.tx }}>{s.val}g</Text>
                                  </View>
                                ))}
                              </View>
                              <View style={{ height: 20, flexDirection: 'row', borderRadius: 10, overflow: 'hidden', backgroundColor: Acid.mossDeep, position: 'relative', marginBottom: 6 }}>
                                <View style={{ width: `${(avgAdded / maxBar) * 100}%`, height: '100%', backgroundColor: '#FB7185' }} />
                                <View style={{ width: `${(avgNatural / maxBar) * 100}%`, height: '100%', backgroundColor: '#4ADE80' }} />
                                <View style={{ position: 'absolute', left: `${(dailyLimit / maxBar) * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: Acid.tx }} />
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 10, color: Acid.tx2 }}>0g</Text>
                                <Text style={{ fontSize: 10, color: Acid.tx, fontWeight: '600' }}>Limit {dailyLimit}g</Text>
                              </View>
                            </View>
                          );
                        })()}
                      </View>
                      )}
                      </InsightSlot>

                    </View>
                  )}
                </View>
              )}
            </React.Fragment>
          )}

        </ScrollView>
      </Animated.View>

      {/* Info Modal */}
      <Modal
        visible={showInfo}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInfo(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Acid.moss }}>
          <View style={[styles.infoHeader, { borderBottomColor: Acid.hair }]}>
            <View style={styles.infoHeaderBtn} />
            <Text style={[styles.infoHeaderTitle, { color: Acid.tx }]}>About Nutrition Analysis</Text>
            <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.infoHeaderBtn}>
              <Feather name="x" size={22} color={Acid.tx} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.infoContent}>
            <Text style={[styles.infoSectionTitle, { color: Acid.tx }]}>Overview</Text>
            <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
              Nutrition Analysis gives you a visual breakdown of your daily eating. It tracks calories and macronutrients (protein, carbs, fat) over time so you can spot trends and stay on track with your goals.
            </Text>

            <Text style={[styles.infoSectionTitle, { color: Acid.tx }]}>Calories Tab</Text>
            <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
              The bar chart shows your daily calorie intake. The dashed line represents your calorie target. Days where you went over your target will show in a different colour. Use the time range selector (1D, 1W, 1M, etc.) to zoom in or out.
            </Text>

            <Text style={[styles.infoSectionTitle, { color: Acid.tx }]}>Macros Tab</Text>
            <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
              The Macros tab breaks down your protein, carbs, and fat intake. It shows how each macro contributes to your daily nutrition and whether you are hitting your targets. This is useful for making sure you are getting enough protein or managing your carb intake.
            </Text>

            <Text style={[styles.infoSectionTitle, { color: Acid.tx }]}>Insights Tab</Text>
            <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
              The Insights tab provides an AI-generated summary of your eating patterns. It highlights your top foods, average intake, and suggestions for improvement. Insights are refreshed periodically based on your logged meals.
            </Text>

            <View style={[styles.infoDivider, { backgroundColor: Acid.hair }]} />

            <Text style={[styles.infoSectionTitle, { color: Acid.tx }]}>Tips</Text>
            <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
              For the most accurate analysis, log everything you eat throughout the day. Even small snacks and drinks count toward your daily totals. The more consistently you log, the more useful the trends and insights become.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontFamily: Acid.serifItalic,
    fontSize: 22,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: Typography.fontSize.xs,
  },

  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Acid.hair,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: Acid.lime,
  },
  tabText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  graphContainer: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 16,
    textAlign: 'center',
  },

  graphCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  graph: {
    marginLeft: 0, // Removed specialized margin for inline axes
    marginRight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRange: {
    textAlign: 'center',
    fontSize: Typography.fontSize.sm,
    marginBottom: 24,
  },
  historyContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
  },
  historyTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  historyHeaderText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  historyHeaderSpacer: {
    width: 40,
    alignItems: 'flex-end',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  historyCellText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyEditButton: {
    padding: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  emptyStateContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    marginTop: 24,
    marginBottom: 16,
    alignItems: 'center',
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyStateButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
  },
  heroCard: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 88,
  },
  heroLabel: {
    fontSize: 10,
    marginBottom: 4,
    letterSpacing: 1.5,
  },
  heroValue: {
    fontFamily: Acid.serif,
    fontSize: 28,
    lineHeight: 32,
    minHeight: 32,
  },
  heroUnit: {
    fontSize: 12,
    fontWeight: Typography.fontWeight.medium,
    marginTop: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  infoHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoHeaderTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    textAlign: 'center',
  },
  infoContent: {
    padding: 24,
    paddingBottom: 60,
  },
  infoSectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 8,
  },
  infoBody: {
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.6,
    marginBottom: 16,
  },
  infoDivider: {
    height: 1,
    marginVertical: 24,
  },
});
