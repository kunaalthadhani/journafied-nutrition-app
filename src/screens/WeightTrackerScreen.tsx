import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  PanResponder,
  findNodeHandle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { InsightUnlocks, isInsightUnlocked, getInsightDefinition, InsightId } from '../utils/insightUnlockEngine';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { Acid } from '../constants/acid';
import { usePreferences } from '../contexts/PreferencesContext';
import { useUser } from '../contexts/UserContext';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import { ChartRange, CHART_RANGES, getRangeWindow, isInRange, rangeLabel, weeklyTrendSlope } from '../utils/chartRange';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { WeightRuler } from '../components/WeightRuler';
import { dataStorage, DailySummary } from '../services/dataStorage';
import { analyticsService } from '../services/analyticsService';
import { invokeAI } from '../services/aiProxyService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '../utils/uuid';

interface WeightTrackerScreenProps {
  onBack: () => void;
  initialCurrentWeightKg?: number | null;
  targetWeightKg?: number | null;
  onRequestSetGoals?: () => void;
  isPremium?: boolean;
  insightUnlocks?: InsightUnlocks;
  visible?: boolean;
  initialTab?: 'Tracker' | 'Insights';
  openLogRequest?: boolean;
  onLogRequestConsumed?: () => void;
  scrollToInsight?: InsightId | null;
  onScrollToInsightConsumed?: () => void;
}

interface WeightEntry {
  id?: string;
  date: Date;
  weight: number;
  updatedAt?: string;
  seeded?: boolean; // onboarding starting weight, display only, never persisted
}

// Shared with the calorie charts so a pill means the same thing on both screens.
// The old local math made 1W an 8-day window here and 7 days there.
type TimeRange = ChartRange;
type TabType = 'Tracker' | 'Insights';

// Deduplicate entries by date -- keep only the most recently updated per day
const deduplicateByDate = (entries: WeightEntry[]): WeightEntry[] => {
  const byDay = new Map<string, WeightEntry>();
  for (const entry of entries) {
    const dayKey = format(entry.date, 'yyyy-MM-dd');
    const existing = byDay.get(dayKey);
    if (!existing) {
      byDay.set(dayKey, entry);
    } else {
      const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const entryTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
      if (entryTime > existingTime) {
        byDay.set(dayKey, entry);
      }
    }
  }
  return Array.from(byDay.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const WeightTrackerScreen: React.FC<WeightTrackerScreenProps> = ({
  onBack,
  initialCurrentWeightKg,
  targetWeightKg,
  onRequestSetGoals,
  isPremium = false,
  insightUnlocks = {},
  visible = false,
  initialTab: initialTabProp,
  openLogRequest,
  onLogRequestConsumed,
  scrollToInsight = null,
  onScrollToInsightConsumed,
}) => {
  const insightsScrollRef = useRef<ScrollView>(null);
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
      <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A', opacity: 0.5 }]}>
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

  // Shown in the Tracker tab when the user has weigh-ins but none fall in the
  // selected time range, so the chart would otherwise be blank or, worse, show
  // the whole history while the range pills say something narrower.
  const NoRangeDataCard = () => (
    <View style={[styles.graphCard, { padding: 28, alignItems: 'center' }]}>
      <Feather name="bar-chart-2" size={28} color={Acid.tx3} style={{ marginBottom: 10 }} />
      <Text style={{ fontSize: 15, fontWeight: '600', color: Acid.tx, marginBottom: 4 }}>
        No weigh-ins in this range
      </Text>
      <Text style={{ fontSize: 13, color: Acid.tx2, textAlign: 'center' }}>
        Pick a wider range or log a weight to see your trend.
      </Text>
    </View>
  );

  // An unlocked insight card whose data source is empty must say WHY instead of
  // silently vanishing: unlocks are all-time, card data is recent-window, so
  // "unlocked but dataless" is a normal state, not an error.
  const EmptyInsightCard = ({ title, hint }: { title: string; hint: string }) => (
    <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
      <Text style={[styles.bmiTitle, { color: Acid.tx }]}>{title}</Text>
      <Text style={{ fontSize: 13, color: Acid.tx2, marginTop: 6, lineHeight: 19 }}>{hint}</Text>
    </View>
  );

  const isUnlocked = (id: InsightId) => isInsightUnlocked(id, insightUnlocks);
  const { convertWeightToDisplay, convertWeightFromDisplay, getWeightUnitLabel, weightUnit } = usePreferences();
  const { weightEntries: contextWeightEntries, goals: contextGoals } = useUser();
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [showLogModal, setShowLogModal] = useState(false);
  const [logWeight, setLogWeight] = useState('');
  const [logDate, setLogDate] = useState(new Date());
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null);
  const [editingWeight, setEditingWeight] = useState<string>('');
  const [insight, setInsight] = useState<string>('');
  const [goalType, setGoalType] = useState<'lose' | 'maintain' | 'gain' | undefined>(
    contextGoals?.goal as 'lose' | 'maintain' | 'gain' | undefined
  );
  const [insightIcon, setInsightIcon] = useState<string>('info');
  const [insightIconColor, setInsightIconColor] = useState<string>('');
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(initialTabProp || 'Tracker');

  // The screen stays mounted inside a Modal across opens, so the initialTab in
  // useState only runs once. Reset the tab each time the modal opens so the last
  // session's tab does not leak into the next open. A pending scroll target
  // always means the Insights tab.
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = !!visible;
    if (visible && !wasVisible) {
      setActiveTab(scrollToInsight ? 'Insights' : initialTabProp || 'Tracker');
    }
  }, [visible, initialTabProp, scrollToInsight]);

  useEffect(() => {
    if (!scrollToInsight) return;
    pendingScrollRef.current = scrollToInsight;
    setActiveTab('Insights');

    // The card mounts a frame or two after the tab switch. Retry on each frame
    // until it is measurable, then scroll. Give up after ~1s so an insight that
    // is not rendered does not wedge the parent's scroll intent open forever.
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

  const [heightCm, setHeightCm] = useState<number | null>(() => {
    if (contextGoals?.heightCm && contextGoals.heightCm > 0) return contextGoals.heightCm;
    if (contextGoals?.heightFeet && contextGoals.heightFeet > 0) {
      return ((contextGoals.heightFeet * 12) + (contextGoals.heightInches || 0)) * 2.54;
    }
    return null;
  });

  // The screen stays mounted across modal opens, so a height change delivered
  // through context (background goal sync, another device) must flow into BMI.
  // The lazy initializer above only ever runs once.
  useEffect(() => {
    if (contextGoals?.heightCm && contextGoals.heightCm > 0) {
      setHeightCm(contextGoals.heightCm);
    } else if (contextGoals?.heightFeet && contextGoals.heightFeet > 0) {
      setHeightCm(((contextGoals.heightFeet * 12) + (contextGoals.heightInches || 0)) * 2.54);
    }
  }, [contextGoals?.heightCm, contextGoals?.heightFeet, contextGoals?.heightInches]);

  // Initialize from UserContext (already loaded) — no async delay
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>(() => {
    if (contextWeightEntries.length > 0) {
      const mapped = contextWeightEntries.map(e => ({
        date: e.date instanceof Date ? e.date : new Date(e.date),
        weight: e.weight,
      }));
      return deduplicateByDate(mapped.sort((a, b) => a.date.getTime() - b.date.getTime()));
    }
    if (typeof initialCurrentWeightKg === 'number' && !isNaN(initialCurrentWeightKg) && initialCurrentWeightKg > 0) {
      return [{ date: startOfDay(new Date()), weight: initialCurrentWeightKg, seeded: true }];
    }
    return [];
  });
  const dataLoaded = useRef(contextWeightEntries.length > 0); // already loaded if context has data
  const [isReady, setIsReady] = useState(contextWeightEntries.length > 0); // ready immediately if context has data

  const hasEntries = weightEntries.length > 0;

  const [targetWeight, setTargetWeight] = useState<number | null>(
    typeof targetWeightKg === 'number' && !isNaN(targetWeightKg) ? targetWeightKg : null
  );

  const currentWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weight : null;
  const targetWeightValue = targetWeight ?? 0;
  const hasMultipleEntries = weightEntries.length >= 2;
  // Real weigh-ins only. The seeded onboarding weight is display-only and must
  // not count in consistency, fluctuation, monthly comparison, or records.
  const realEntries = useMemo(() => weightEntries.filter(e => !e.seeded), [weightEntries]);
  const startingWeight = weightEntries.length > 0 ? weightEntries[0].weight : null;
  const weightChangeFromStart =
    hasMultipleEntries && startingWeight !== null && currentWeight !== null
      ? currentWeight - startingWeight // Positive = gained, Negative = lost
      : null;

  // Determine label and value based on actual weight change direction
  const isGainGoal = goalType === 'gain';
  const changeLabel = weightChangeFromStart !== null
    ? (weightChangeFromStart > 0 ? 'Gain' : weightChangeFromStart < 0 ? 'Drop' : 'Change')
    : isGainGoal ? 'Gain' : 'Drop';
  const changeValue = weightChangeFromStart !== null
    ? weightChangeFromStart // Keep raw value (positive = gained, negative = lost)
    : null;

  // deduplicateByDate moved above component

  // Load secondary data on mount (weight entries + goals already from UserContext)
  useEffect(() => {
    dataLoaded.current = true;

    (async () => {
      // Load daily calorie summaries for correlation cards
      try {
        const summaries = await dataStorage.loadDailySummaries();
        setDailySummaries(summaries);
      } catch (error) {
        // Ignore
      }

      // Load cached deficit insight
      try {
        const cached = await AsyncStorage.getItem('@trackkal:deficitInsight');
        if (cached) {
          const { insight: savedText, weekKey } = JSON.parse(cached);
          const now = new Date();
          const dayOfWeek = now.getDay();
          const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
          const currentWeekKey = format(monday, 'yyyy-MM-dd');
          if (weekKey === currentWeekKey && savedText) {
            setDeficitInsight(savedText);
            setDeficitInsightDate(currentWeekKey);
          }
        }
      } catch (error) {
        // Ignore
      }

      setIsReady(true);
    })();
  }, []);

  // Persist weight entries whenever they change -- but only after initial load.
  // The onboarding seed is display only. Persisting it turns it into a real
  // today dated weigh in, which then blocks logging every day on the PWA.
  useEffect(() => {
    if (!dataLoaded.current) return; // don't overwrite storage before load completes
    const real = weightEntries.filter(e => !e.seeded);
    // Never auto-persist an empty set. An empty state here is a re-init or reset
    // race, not a user action, and the storage layer would otherwise have had to
    // decide whether to wipe. Real deletions go through handleDeleteEntry.
    if (real.length === 0) return;
    dataStorage.saveWeightEntries(real);
  }, [weightEntries]);

  useEffect(() => {
    if (typeof targetWeightKg === 'number' && !isNaN(targetWeightKg) && targetWeightKg > 0) {
      setTargetWeight(targetWeightKg);
    }
  }, [targetWeightKg]);

  // Filter data based on time range - memoized to update when timeRange or weightEntries change.
  // Shared window helper: same bounds as the calorie charts, upper bound included
  // so a future-dated weigh-in can no longer sit in every range forever.
  const filteredData = useMemo(() => {
    const window = getRangeWindow(timeRange);
    return weightEntries
      .filter(entry => isInRange(entry.date, window))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [timeRange, weightEntries]);

  // Do NOT fall back to all entries when the range is empty: that silently shows
  // the full history while the range pills claim something narrower. An empty
  // range renders a "no data in range" card instead (the pills stay reachable).
  const graphData = filteredData;
  const hasGraphData = graphData.length > 0;

  // BMI calculation
  const bmiData = useMemo(() => {
    if (!currentWeight || !heightCm || heightCm <= 0) return null;
    const heightM = heightCm / 100;
    const bmi = currentWeight / (heightM * heightM);
    let category: string;
    let categoryColor: string;
    if (bmi < 18.5) {
      category = 'Underweight';
      categoryColor = Acid.protein; // blue
    } else if (bmi < 25) {
      category = 'Normal';
      categoryColor = Acid.good; // green
    } else if (bmi < 30) {
      category = 'Overweight';
      categoryColor = Acid.carbs; // amber
    } else {
      category = 'Obese';
      categoryColor = Acid.error; // red
    }
    // Position on the scale (15-40)
    const barMin = 15;
    const barMax = 40;
    const position = Math.max(0, Math.min(1, (bmi - barMin) / (barMax - barMin)));
    // The healthy BMI band translated into kg for this height, so the card
    // can say what weight the band actually means.
    const healthyLowKg = 18.5 * heightM * heightM;
    const healthyHighKg = 24.9 * heightM * heightM;
    return { bmi, category, categoryColor, position, healthyLowKg, healthyHighKg };
  }, [currentWeight, heightCm]);

  // Goal progress calculation
  const goalProgressData = useMemo(() => {
    if (!currentWeight || !targetWeight || !startingWeight) return null;
    if (goalType === 'maintain') {
      const diff = Math.abs(currentWeight - targetWeight);
      return { percentage: 100, progressRatio: 1, achieved: 0, remaining: diff, status: diff < 1 ? 'On Target' : 'Off Target', statusColor: diff < 1 ? Acid.good : Acid.carbs, isGain: false, isMaintain: true };
    }
    const isGain = goalType === 'gain';
    const totalRequired = Math.abs(targetWeight - startingWeight);
    if (totalRequired === 0) return null;
    // Signed: negative means moved AWAY from the goal. Math.abs here used to
    // render a 2 kg regression as "Lost so far: 2.0 kg".
    const achieved = isGain ? currentWeight - startingWeight : startingWeight - currentWeight;
    const remaining = isGain ? targetWeight - currentWeight : currentWeight - targetWeight;
    const ratio = Math.max(0, Math.min(1, achieved / totalRequired));
    // Bar clamps, number tells the truth (overshoot shows >100%).
    const percentage = Math.round((achieved / totalRequired) * 100);
    const goalReached = remaining <= 0;
    // Status names what it measures: net change since the first weigh-in, not a
    // trend. "On Track" from an all-time sign contradicted the trend cards.
    const status = goalReached ? 'Goal Reached' : achieved > 0 ? 'Net progress' : achieved === 0 ? 'No net change' : 'Below start';
    const statusColor = goalReached ? Acid.good : achieved > 0 ? Acid.good : achieved === 0 ? Acid.tx3 : Acid.carbs;
    return { percentage: Math.max(0, percentage), progressRatio: ratio, achieved, remaining: Math.max(0, remaining), status, statusColor, isGain, isMaintain: false };
  }, [currentWeight, targetWeight, startingWeight, goalType]);

  // Weekly rate of change over a FIXED last-3-months window. This card lives on
  // the Insights tab where the range pills do not render, so following the
  // Tracker tab's invisible pill selection made the number change for no visible
  // reason. Fixed window also matches the goal-date projection below it.
  // Least-squares fit, so one noisy weigh-in cannot swing it.
  const weeklyRateData = useMemo(() => {
    const window3M = getRangeWindow('3M');
    const inWindow = realEntries.filter(e => isInRange(new Date(e.date), window3M));
    if (inWindow.length < 2) return null;
    const sorted = [...inWindow].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstDate = new Date(sorted[0].date).getTime();
    const lastDate = new Date(sorted[sorted.length - 1].date).getTime();
    const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
    if (daysDiff < 3) return null; // need at least 3 days of data
    const weeks = daysDiff / 7;
    const totalChange = sorted[sorted.length - 1].weight - sorted[0].weight;
    const slope = weeklyTrendSlope(sorted.map((e) => ({ date: new Date(e.date), value: e.weight })));
    if (slope === null) return null;
    const weeklyRate = slope; // positive = gaining, negative = losing
    const absRate = Math.abs(weeklyRate);
    const direction = weeklyRate > 0.01 ? 'gaining' : weeklyRate < -0.01 ? 'losing' : 'maintaining';
    // Color based on goal alignment
    let statusColor: string = Acid.tx3; // neutral for maintaining
    if (direction !== 'maintaining' && goalType) {
      const aligned = (goalType === 'gain' && weeklyRate > 0) || (goalType === 'lose' && weeklyRate < 0) || goalType === 'maintain';
      statusColor = aligned ? Acid.good : Acid.carbs;
    } else if (direction !== 'maintaining') {
      statusColor = weeklyRate > 0 ? Acid.protein : Acid.carbs;
    }
    return { weeklyRate, absRate, direction, statusColor, totalWeeks: weeks, totalChange, entryCount: sorted.length };
  }, [realEntries, goalType]);

  // Trend rate over a FIXED last-3-months window, independent of the chart
  // pills. The goal-date projection must not swing because the user toggled the
  // chart to 1W and a water dip read as a kilo-per-week trend.
  const projectionRate = useMemo(() => {
    const window = getRangeWindow('3M');
    const recent = weightEntries
      .filter((e) => isInRange(e.date, window))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (recent.length < 2) return null;
    const spanDays =
      (new Date(recent[recent.length - 1].date).getTime() - new Date(recent[0].date).getTime()) /
      (1000 * 60 * 60 * 24);
    if (spanDays < 3) return null;
    return weeklyTrendSlope(recent.map((e) => ({ date: new Date(e.date), value: e.weight })));
  }, [weightEntries]);

  // Estimated goal date
  const estimatedGoalData = useMemo(() => {
    if (projectionRate === null || !currentWeight || !targetWeight || goalType === 'maintain') return null;
    const remaining = targetWeight - currentWeight; // negative if losing goal, positive if gaining
    const rate = projectionRate; // positive = gaining, negative = losing
    // Check if already reached
    if ((goalType === 'lose' && currentWeight <= targetWeight) || (goalType === 'gain' && currentWeight >= targetWeight)) {
      return { reached: true, weeksLeft: 0, date: null, statusColor: Acid.good, message: 'Goal reached!' };
    }
    // Check if moving in wrong direction or stalled
    if (Math.abs(rate) < 0.01) {
      return { reached: false, weeksLeft: null, date: null, statusColor: Acid.tx3, message: 'Not enough change to project a date' };
    }
    const movingRight = (goalType === 'lose' && rate < 0) || (goalType === 'gain' && rate > 0);
    if (!movingRight) {
      return { reached: false, weeksLeft: null, date: null, statusColor: Acid.carbs, message: 'Currently moving away from goal' };
    }
    const weeksLeft = Math.abs(remaining / rate);
    const goalDate = new Date();
    goalDate.setDate(goalDate.getDate() + Math.round(weeksLeft * 7));
    return { reached: false, weeksLeft, date: goalDate, statusColor: Acid.good, message: null };
  }, [projectionRate, currentWeight, targetWeight, goalType]);

  // Logging consistency (this week)
  const loggingConsistency = useMemo(() => {
    if (realEntries.length === 0) return null;
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const daysInWeekSoFar = mondayOffset + 1; // how many days have passed this week (including today)
    const loggedDays = new Set<string>();
    realEntries.forEach(e => {
      const d = new Date(e.date);
      if (d >= weekStart && d <= endOfDay(now)) {
        loggedDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    });
    const count = loggedDays.size;
    const ratio = daysInWeekSoFar > 0 ? count / daysInWeekSoFar : 0;
    const statusColor = ratio >= 0.8 ? Acid.good : ratio >= 0.5 ? Acid.carbs : Acid.error;
    const message = count === 7 ? 'Perfect week!' : count === daysInWeekSoFar ? 'On track for a perfect week!' : count === 0 ? 'No weigh-ins yet this week.' : null;
    return { count, total: 7, daysInWeekSoFar, ratio, statusColor, message };
  }, [realEntries]);

  // Weight Fluctuation Range (last 7 days)
  const fluctuationData = useMemo(() => {
    if (realEntries.length < 2) return null;
    // 7 calendar days including today, same convention as the shared 1W window.
    const week = getRangeWindow('1W');
    const recent = realEntries.filter(e => isInRange(new Date(e.date), week));
    if (recent.length < 2) return null;
    const weights = recent.map(e => e.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min;
    const isNormal = range < 2; // <2kg is normal daily fluctuation
    return { min, max, range, isNormal, entryCount: recent.length };
  }, [realEntries]);

  // Monthly Comparison
  const monthlyComparison = useMemo(() => {
    if (realEntries.length < 2) return null;
    const now = new Date();
    const endOfToday = endOfDay(now);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = realEntries.filter(e => { const d = new Date(e.date); return d >= thisMonthStart && d <= endOfToday; });
    const lastMonth = realEntries.filter(e => { const d = new Date(e.date); return d >= lastMonthStart && d < thisMonthStart; });
    const calcChange = (entries: typeof weightEntries) => {
      if (entries.length < 2) return null;
      const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return sorted[sorted.length - 1].weight - sorted[0].weight;
    };
    const thisChange = calcChange(thisMonth);
    const lastChange = calcChange(lastMonth);
    const thisMonthName = now.toLocaleDateString('en-US', { month: 'long' });
    const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long' });
    return { thisChange, lastChange, thisMonthName, lastMonthName };
  }, [realEntries]);

  // Milestones / Records
  const milestoneData = useMemo(() => {
    if (realEntries.length === 0) return null;
    const sorted = [...realEntries].sort((a, b) => a.weight - b.weight);
    const lowestEntry = sorted[0];
    const highestEntry = sorted[sorted.length - 1];
    const totalChange = startingWeight && currentWeight ? Math.abs(currentWeight - startingWeight) : null;
    // Milestone thresholds. Maintain goals hardcode percentage 100, which was
    // granting "You reached your goal!" to users 5 kg off target.
    const milestones: string[] = [];
    if (goalProgressData && !goalProgressData.isMaintain) {
      const pct = goalProgressData.percentage;
      if (pct >= 100) milestones.push('You reached your goal!');
      else if (pct >= 75) milestones.push("You're 75% of the way there!");
      else if (pct >= 50) milestones.push('Halfway to your goal!');
      else if (pct >= 25) milestones.push("You're 25% of the way there!");
    }
    if (totalChange && totalChange >= 5) milestones.push(`You've changed ${convertWeightToDisplay(totalChange).toFixed(1)} ${getWeightUnitLabel()} total`);
    return {
      lowest: { weight: lowestEntry.weight, date: new Date(lowestEntry.date) },
      highest: { weight: highestEntry.weight, date: new Date(highestEntry.date) },
      totalChange,
      milestones,
    };
  }, [realEntries, startingWeight, currentWeight, goalProgressData, convertWeightToDisplay, getWeightUnitLabel]);

  // Calorie data for Weight vs Calories and Deficit/Surplus cards
  const [dailySummaries, setDailySummaries] = useState<Record<string, DailySummary>>({});
  const [deficitInsight, setDeficitInsight] = useState<string>('');
  const [deficitInsightDate, setDeficitInsightDate] = useState<string | null>(null);
  const [deficitInsightLoading, setDeficitInsightLoading] = useState(false);
  const deficitInFlightRef = useRef(false);

  // Calculate graph dimensions and points
  const screenWidth = Dimensions.get('window').width;
  const graphWidth = screenWidth - 32 - 36; // content paddingHorizontal (16*2) + graphCard padding (18*2)
  const graphHeight = 260;
  const graphPadding = 20;
  const paddingLeft = 45; // extra room for Y-axis labels
  const innerWidth = graphWidth - paddingLeft - graphPadding;
  const innerHeight = graphHeight - graphPadding * 2;

  const estimatePathLength = (points: { x: number; y: number }[]): number => {
    if (points.length < 2) return 0;
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.ceil(length * 1.5); // 1.5x for bezier overhead
  };

  // Slide value retained at 0. iOS Modal handles entrance and exit animations.
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleClose = () => {
    // Never persist the seeded onboarding weight: the persist effect filters it
    // for exactly the reason documented there, and this direct save was the one
    // path that leaked it into storage as a real weigh-in.
    dataStorage.saveWeightEntries(weightEntries.filter(e => !e.seeded));
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
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  const minWeight = hasGraphData ? Math.min(...graphData.map(d => d.weight)) : 0;
  const maxWeight = hasGraphData ? Math.max(...graphData.map(d => d.weight)) : 1;

  const { axisMinWeight, axisMaxWeight, axisWeightRange, yAxisTicks } = React.useMemo(() => {
    if (!hasGraphData) {
      const min = 0;
      const max = 5;
      const range = max - min || 1;
      return {
        axisMinWeight: min,
        axisMaxWeight: max,
        axisWeightRange: range,
        yAxisTicks: [0, 1, 2, 3, 4, 5],
      };
    }

    const rawRange = Math.max(maxWeight - minWeight, 0);
    const axisPad = Math.max(rawRange * 0.1, 1);
    let minAxis = Math.floor(minWeight - axisPad);
    let maxAxis = Math.ceil(maxWeight + axisPad);
    if (minAxis === maxAxis) {
      // Ensure non‑zero span
      minAxis -= 1;
      maxAxis += 1;
    }
    const range = Math.max(maxAxis - minAxis, 1);

    // Choose an integer step so labels are whole numbers and dots land exactly on grid lines.
    const approxStep = Math.max(1, Math.round(range / 5));
    const ticks: number[] = [];
    for (let v = minAxis; v <= maxAxis; v += approxStep) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] !== maxAxis) {
      ticks.push(maxAxis);
    }

    return {
      axisMinWeight: minAxis,
      axisMaxWeight: maxAxis,
      axisWeightRange: range,
      yAxisTicks: ticks,
    };
  }, [hasGraphData, minWeight, maxWeight]);

  // Full history table (all entries, newest first)
  const historyEntries = useMemo(
    () => [...weightEntries].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [weightEntries]
  );

  // Points calculation for graph plotting and interaction mapping
  const graphPoints = useMemo(() => {
    if (graphData.length === 0) return [];
    return graphData.map((entry, index) => {
      const x = paddingLeft + (index / (graphData.length - 1 || 1)) * innerWidth;
      const normalizedWeight = (entry.weight - axisMinWeight) / axisWeightRange;
      const y = graphPadding + innerHeight - (normalizedWeight * innerHeight);
      return { x, y, data: entry };
    });
  }, [graphData, axisMinWeight, axisWeightRange, innerWidth, innerHeight]);

  // A few evenly spaced date labels along the X axis, month names for long
  // ranges, day + month for short ones.
  const xAxisLabels = useMemo(() => {
    if (graphPoints.length === 0) return [] as { x: number; label: string }[];
    const fmt = timeRange === '1W' || timeRange === '1M' ? 'd MMM' : 'MMM';
    if (graphPoints.length === 1) {
      return [{ x: graphPoints[0].x, label: format(graphData[0].date, fmt).toUpperCase() }];
    }
    const count = Math.min(graphPoints.length, timeRange === '1W' ? 3 : 4);
    const labels: { x: number; label: string }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i / (count - 1)) * (graphPoints.length - 1));
      const label = format(graphData[idx].date, fmt).toUpperCase();
      if (seen.has(label)) continue;
      seen.add(label);
      labels.push({ x: graphPoints[idx].x, label });
    }
    return labels;
  }, [graphPoints, graphData, timeRange]);

  // Where the goal line sits, but only when the target falls inside the axis
  // window. A far-away goal gets a corner annotation instead of flattening the
  // whole chart.
  const goalLineY = useMemo(() => {
    if (!targetWeightValue || !hasGraphData) return null;
    if (targetWeightValue < axisMinWeight || targetWeightValue > axisMaxWeight) return null;
    const ratio = (targetWeightValue - axisMinWeight) / axisWeightRange;
    return graphPadding + innerHeight - ratio * innerHeight;
  }, [targetWeightValue, hasGraphData, axisMinWeight, axisMaxWeight, axisWeightRange, innerHeight]);

  // Trend over the weigh-ins in view, for the ledger header.
  const ledgerTrend = useMemo(() => {
    const pts = graphData.filter(e => !e.seeded).map(e => ({ date: e.date, value: e.weight }));
    return weeklyTrendSlope(pts);
  }, [graphData]);

  const [scrubbingIndex, setScrubbingIndex] = useState<number | null>(null);

  // Keep a ref to graphPoints so PanResponder always reads fresh data
  const graphPointsRef = useRef(graphPoints);
  graphPointsRef.current = graphPoints;

  const handleTouch = (x: number) => {
    const points = graphPointsRef.current;
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
      // Don't capture on start - let ScrollView handle initial vertical gestures
      onStartShouldSetPanResponderCapture: () => false,
      // Only claim move if gesture is more horizontal than vertical (scrubbing vs scrolling)
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 5,
      onMoveShouldSetPanResponderCapture: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 5,
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

  // NOTE: Keep all charts using smooth spline paths for visual consistency across the app.
  const generateSmoothPath = (): { path: string; length: number } => {
    if (graphPoints.length === 0) return { path: '', length: 0 };
    if (graphPoints.length === 1) return { path: `M ${graphPoints[0].x} ${graphPoints[0].y}`, length: 0 };
    if (graphPoints.length === 2) {
      const path = `M ${graphPoints[0].x} ${graphPoints[0].y} L ${graphPoints[1].x} ${graphPoints[1].y}`;
      return { path, length: estimatePathLength(graphPoints) };
    }

    let path = `M ${graphPoints[0].x} ${graphPoints[0].y}`;
    for (let i = 0; i < graphPoints.length - 1; i++) {
      const current = graphPoints[i];
      const next = graphPoints[i + 1];
      const after = i < graphPoints.length - 2 ? graphPoints[i + 2] : next;
      const prev = i > 0 ? graphPoints[i - 1] : current;

      const dx1 = next.x - prev.x;
      const dy1 = next.y - prev.y;
      const dx2 = after.x - current.x;
      const dy2 = after.y - current.y;

      const cp1x = current.x + dx1 / 6;
      const cp1y = current.y + dy1 / 6;
      const cp2x = next.x - dx2 / 6;
      const cp2y = next.y - dy2 / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }
    return { path, length: estimatePathLength(graphPoints) };
  };

  // Chart animation -- fade in + line draw on every data change (matches NutritionAnalysis)
  const [graphPath, setGraphPath] = useState<string>('');
  const [drawLength, setDrawLength] = useState(0);
  const chartOpacity = useRef(new Animated.Value(0.15)).current;
  const lineProgress = useRef(new Animated.Value(0)).current;
  const AnimatedPath = useRef(Animated.createAnimatedComponent(Path as any)).current;

  // iOS Modal handles the entrance animation. No internal entrance needed.

  useEffect(() => {
    const { path: newPath, length } = generateSmoothPath();
    setGraphPath(newPath);
    setDrawLength(length);

    // Always animate: fade in from 0.15 + slow line draw (matches NutritionAnalysis)
    chartOpacity.setValue(0.15);
    lineProgress.setValue(0);

    Animated.parallel([
      Animated.timing(chartOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(lineProgress, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: false,
      }),
    ]).start();
  }, [graphData]);

  const handleLogWeight = () => {
    const weight = parseFloat(logWeight);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight.');
      return;
    }

    // Convert from display unit to kg for storage
    const weightKg = convertWeightFromDisplay(weight, weightUnit);

    const logDayKey = format(logDate, 'yyyy-MM-dd');

    // Check if an entry already exists for this day -- replace it instead of duplicating
    const existingIndex = weightEntries.findIndex(e => format(e.date, 'yyyy-MM-dd') === logDayKey);

    let updated: WeightEntry[];
    if (existingIndex >= 0) {
      updated = [...weightEntries];
      updated[existingIndex] = {
        ...updated[existingIndex],
        id: updated[existingIndex].id || generateId(),
        weight: weightKg,
        updatedAt: new Date().toISOString(),
        seeded: false,
      };
    } else {
      const newEntry: WeightEntry = {
        id: generateId(),
        date: logDate,
        weight: weightKg,
        updatedAt: new Date().toISOString(),
      };
      updated = [...weightEntries, newEntry].sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    setWeightEntries(updated);
    // Track weight entry logged
    analyticsService.trackWeightEntryLogged(logDate);
    setLogWeight('');
    setLogDate(new Date());
    setShowLogModal(false);
  };

  useEffect(() => {
    if (showLogModal) {
      setLogDate(new Date());
    }
  }, [showLogModal]);

  const handleStartEditEntry = (index: number) => {
    const entry = historyEntries[index];
    if (!entry) return;
    setEditingEntryIndex(index);
    setEditingWeight(convertWeightToDisplay(entry.weight).toFixed(1));
  };

  const handleCancelEditEntry = () => {
    setEditingEntryIndex(null);
    setEditingWeight('');
  };

  const handleSaveEditEntry = () => {
    if (editingEntryIndex === null) return;
    const parsed = parseFloat(editingWeight);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight.');
      return;
    }

    const weightKg = convertWeightFromDisplay(parsed, weightUnit);

    setWeightEntries(prev => {
      // historyEntries is sorted newest-first; map back to original order
      const sorted = [...prev].sort((a, b) => b.date.getTime() - a.date.getTime());
      if (!sorted[editingEntryIndex]) return prev;
      sorted[editingEntryIndex] = {
        ...sorted[editingEntryIndex],
        weight: weightKg,
        updatedAt: new Date().toISOString(),
      };
      // restore ascending order for storage and graph
      const restored = sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
      return restored;
    });

    handleCancelEditEntry();
  };

  const handleDeleteEntry = (index: number) => {
    const entry = historyEntries[index];
    if (!entry) return;

    // Simplified deletion using object reference
    Alert.alert(
      'Delete Entry',
      `Delete weight entry for ${format(entry.date, 'd MMM yyyy')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setWeightEntries(prev => prev.filter(e => e !== entry));
            // Explicit soft delete by id. Removing it from state alone used to
            // rely on the save-diff to infer the deletion, the same mechanism
            // that could wipe everything.
            if ((entry as any).id) dataStorage.deleteWeightEntry((entry as any).id);
            if (editingEntryIndex === index) {
              handleCancelEditEntry();
            }
          },
        },
      ]
    );
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    // The insight effect below recomputes from the new range on its own.
    setInsight('');
  };

  const timeRanges: TimeRange[] = [...CHART_RANGES];

  // The tab bar's plus menu can ask this page to open the log sheet directly.
  useEffect(() => {
    if (openLogRequest && isReady) {
      onLogRequestConsumed?.();
      handleLogPress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLogRequest, isReady]);

  const handleLogPress = () => {
    // Prefill the meter at the latest weigh-in so logging is one nudge, not a hunt.
    if (currentWeight !== null) setLogWeight(convertWeightToDisplay(currentWeight).toFixed(1));
    const today = new Date();
    const todayKey = format(today, 'yyyy-MM-dd');
    const alreadyLogged = weightEntries.some(e => !e.seeded && format(e.date, 'yyyy-MM-dd') === todayKey);
    if (alreadyLogged) {
      Alert.alert(
        'Weight Already Logged',
        "You've already logged today's weight.\nYou can edit it anytime if you need to make a change.",
        [{ text: 'OK' }]
      );
      return;
    }
    setShowLogModal(true);
  };

  // Generate the trend sentence from the visible range. It used to be cached
  // once per day, which froze it on whichever range happened to be open first.
  // It is cheap local math, so it now follows the pills like everything else.
  useEffect(() => {
    if (!hasGraphData || graphData.length < 2) {
      return;
    }

    // Generate insight based on weight trends
    const generateInsight = () => {
      const weights = graphData.map(entry => entry.weight);
      const dates = graphData.map(entry => entry.date);

      // Calculate trend
      const firstWeight = weights[0];
      const lastWeight = weights[weights.length - 1];
      const weightChange = lastWeight - firstWeight;
      const weightChangeAbs = Math.abs(weightChange);
      const daysDiff = (dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24);

      // Calculate variability (standard deviation)
      const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
      const variance = weights.reduce((sum, w) => sum + Math.pow(w - avgWeight, 2), 0) / weights.length;
      const stdDev = Math.sqrt(variance);
      const variability = stdDev / avgWeight; // Coefficient of variation

      // Calculate rate of change
      const weeklyChange = daysDiff > 0 ? (weightChange / daysDiff) * 7 : 0;

      let insightText = '';
      let icon = 'info';
      let iconColor: string = Acid.tx2;

      if (variability > 0.02) {
        icon = 'activity';
        iconColor = Acid.carbs;
        insightText = 'Your weight is fluctuating. Consider tracking hydration and sleep patterns to identify patterns.';
      } else if (weightChangeAbs < 0.5) {
        icon = 'check-circle';
        iconColor = Acid.good;
        insightText = 'Your weight has been stable. Great consistency! Keep maintaining your current routine.';
      } else if (weightChange > 0.5) {
        icon = 'trending-up';
        iconColor = isGainGoal ? Acid.good : Acid.error;
        insightText = `You've gained ${convertWeightToDisplay(weightChangeAbs).toFixed(1)} ${getWeightUnitLabel()} over the ${rangeLabel(timeRange)}.`;
      } else if (weightChange < -0.5) {
        icon = 'trending-down';
        iconColor = isGainGoal ? Acid.error : Acid.good;
        insightText = `You've lost ${convertWeightToDisplay(weightChangeAbs).toFixed(1)} ${getWeightUnitLabel()} over the ${rangeLabel(timeRange)}. Keep up the great progress!`;
      } else {
        icon = 'minus-circle';
        iconColor = Acid.tx2;
        insightText = 'Your weight shows minimal change. Small fluctuations are normal and expected.';
      }

      return { text: insightText, icon, iconColor };
    };

    const result = generateInsight();
    setInsight(result.text);
    setInsightIcon(result.icon);
    setInsightIconColor(result.iconColor);
  }, [hasGraphData, graphData, timeRange, convertWeightToDisplay, getWeightUnitLabel]);

  // Weight vs Calories correlation data (last 14 days)
  const calorieCorrelation = useMemo(() => {
    if (weightEntries.length < 3 || Object.keys(dailySummaries).length === 0) return null;
    const now = new Date();
    const days: { date: string; weight: number; calories: number }[] = [];
    // Last 14 COMPLETED days: today is live and unsettled, and a 300 kcal
    // morning charted as a full day dragged the whole correlation.
    for (let i = 14; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateKey = format(d, 'yyyy-MM-dd');
      const entry = realEntries.find(e => format(new Date(e.date), 'yyyy-MM-dd') === dateKey);
      const summary = dailySummaries[dateKey];
      if (entry && summary && summary.totalCalories > 0) {
        days.push({ date: dateKey, weight: entry.weight, calories: summary.totalCalories });
      }
    }
    if (days.length < 3) return null;
    const avgCalories = days.reduce((s, d) => s + d.calories, 0) / days.length;
    const avgWeight = days.reduce((s, d) => s + d.weight, 0) / days.length;
    const maxCalories = Math.max(...days.map(d => d.calories));
    const minCalories = Math.min(...days.map(d => d.calories));
    const maxWeight = Math.max(...days.map(d => d.weight));
    const minWeight = Math.min(...days.map(d => d.weight));
    return { days, avgCalories, avgWeight, maxCalories, minCalories, maxWeight, minWeight };
  }, [realEntries, dailySummaries]);

  // Deficit/Surplus Impact — AI-powered, refreshed every Monday
  useEffect(() => {
    // This fires a paid OpenAI call, so never run it for non-premium users or
    // before the insight is unlocked. The effect runs regardless of which tab is
    // visible, so the render-time gate on the card is not enough to stop the cost.
    if (!isPremium || !isUnlocked('deficit-surplus-ai')) return;
    // Wait for the cache read on mount: dailySummaries lands before the cached
    // weekKey does, and firing in that gap re-bought the insight every launch.
    if (!isReady) return;
    // One call at a time. Without this, every dep change during a pending or
    // failed call fired another paid request.
    if (deficitInFlightRef.current) return;
    if (realEntries.length < 7 || Object.keys(dailySummaries).length === 0) return;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    const currentWeekKey = format(monday, 'yyyy-MM-dd');
    if (deficitInsightDate === currentWeekKey) return; // already generated this week

    const generateDeficitInsight = async () => {
      deficitInFlightRef.current = true;
      setDeficitInsightLoading(true);
      try {
        // Collect last 4 weeks of data
        const weeklyData: { week: string; avgCalories: number; weightChange: number; daysLogged: number }[] = [];
        for (let w = 0; w < 4; w++) {
          const weekStart = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - (w + 1) * 7);
          const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
          const weekEntries = realEntries.filter(e => { const d = new Date(e.date); return d >= weekStart && d < weekEnd; });
          if (weekEntries.length < 2) continue;
          const sorted = [...weekEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const wChange = sorted[sorted.length - 1].weight - sorted[0].weight;
          let calTotal = 0, calCount = 0;
          for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
            const key = format(d, 'yyyy-MM-dd');
            if (dailySummaries[key] && dailySummaries[key].totalCalories > 0) {
              calTotal += dailySummaries[key].totalCalories;
              calCount++;
            }
          }
          if (calCount > 0) {
            weeklyData.push({ week: format(weekStart, 'MMM d'), avgCalories: Math.round(calTotal / calCount), weightChange: wChange, daysLogged: calCount });
          }
        }
        if (weeklyData.length < 2) { setDeficitInsightLoading(false); deficitInFlightRef.current = false; return; }

        const response = await invokeAI({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a concise nutrition coach. Analyze the weekly calorie and weight data. Give ONE short insight (2 sentences max) about the relationship between calorie intake and weight change. Be encouraging. Use specific numbers from the data. Weeks with few logged days are unreliable averages, treat them with caution. Do not use emojis.' },
            { role: 'user', content: `Weekly data (most recent first):\n${weeklyData.map(w => `${w.week}: avg ${w.avgCalories} kcal/day (${w.daysLogged} of 7 days logged), weight ${w.weightChange > 0 ? '+' : ''}${w.weightChange.toFixed(1)}kg`).join('\n')}\n\nGoal: ${goalType || 'not set'}` },
          ],
          temperature: 0.7,
          max_tokens: 100,
          call_type: 'deficit-surplus-insight',
        });
        const text = response?.choices?.[0]?.message?.content?.trim();
        if (!text) return;
        setDeficitInsight(text);
        setDeficitInsightDate(currentWeekKey);
        AsyncStorage.setItem('@trackkal:deficitInsight', JSON.stringify({ insight: text, weekKey: currentWeekKey })).catch(() => {});
      } catch (error) {
        // Silently fail
      } finally {
        setDeficitInsightLoading(false);
        deficitInFlightRef.current = false;
      }
    };
    generateDeficitInsight();
  }, [isReady, realEntries, dailySummaries, deficitInsightDate, goalType, isPremium, insightUnlocks]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Acid.moss }]}
      edges={['top']}
    >
      <Animated.View
        style={{ flex: 1, transform: [{ translateY: slideAnim }] }}
      >
        {/* Header chrome - Drag to close */}
        <View
          style={styles.header}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Feather name="chevron-down" size={24} color={Acid.tx2} />
          </TouchableOpacity>
          <View />
          <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.headerRight}>
            <Feather name="info" size={20} color={Acid.tx3} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
        {/* Title row: serif wordmark left, range words right */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 }}>
          <Text style={{ fontFamily: Acid.serif, fontSize: 32, lineHeight: 38, color: Acid.tx }}>Weight</Text>
          {hasEntries && activeTab === 'Tracker' && (
            <View style={{ flexDirection: 'row', gap: 14, paddingBottom: 6 }}>
              {timeRanges.map((range) => (
                <TouchableOpacity
                  key={range}
                  onPress={() => handleTimeRangeChange(range)}
                  style={{ borderBottomWidth: 2, borderBottomColor: timeRange === range ? Acid.lime : 'transparent', paddingBottom: 2 }}
                >
                  <Text style={{ fontSize: 11, letterSpacing: 1, fontWeight: '600', color: timeRange === range ? Acid.lime : Acid.tx3 }}>
                    {range}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Hero: current weight huge, the story in one line under it */}
        {hasEntries && (
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontFamily: Acid.serif, fontSize: 56, lineHeight: 62, color: Acid.tx }}>
                {currentWeight !== null ? convertWeightToDisplay(currentWeight).toFixed(1) : '--'}
              </Text>
              <Text style={{ fontSize: 20, color: Acid.tx3, marginLeft: 6 }}>{getWeightUnitLabel()}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {changeValue !== null && Math.abs(changeValue) > 0.05 && (
                <Feather
                  name={changeValue < 0 ? 'trending-down' : 'trending-up'}
                  size={13}
                  color={(changeValue < 0) !== isGainGoal ? Acid.good : Acid.error}
                />
              )}
              <Text style={{ fontSize: 11, letterSpacing: 1.2, color: Acid.tx2 }}>
                {changeValue !== null
                  ? `${convertWeightToDisplay(Math.abs(changeValue)).toFixed(1)} ${getWeightUnitLabel().toUpperCase()} ${changeLabel.toUpperCase()} SINCE ${format(new Date(weightEntries[0].date), 'd MMM').toUpperCase()}`
                  : 'FIRST WEIGH-IN'}
                {`  ·  ${realEntries.length} WEIGH-IN${realEntries.length === 1 ? '' : 'S'}`}
              </Text>
            </View>
            {!targetWeightValue && (
              <TouchableOpacity onPress={() => onRequestSetGoals?.()} activeOpacity={0.7}>
                <Text style={{ fontSize: 11, letterSpacing: 1.5, color: Acid.lime, fontWeight: '600', marginTop: 8 }}>SET A GOAL →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tab Navigation */}
        {hasEntries && (
          <View style={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: 4 }}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'Tracker' && styles.tabActive]}
                onPress={() => setActiveTab('Tracker')}
              >
                <Text
                  style={[styles.tabText, { color: activeTab === 'Tracker' ? Acid.lime : Acid.tx3 }]}
                >
                  Tracker
                </Text>
              </TouchableOpacity>
              {isPremium && (
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'Insights' && styles.tabActive]}
                  onPress={() => setActiveTab('Insights')}
                >
                  <Text
                    style={[styles.tabText, { color: activeTab === 'Insights' ? Acid.lime : Acid.tx3 }]}
                  >
                    Insights
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Main scrollable content; moves above keyboard when editing rows */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            ref={insightsScrollRef}
            style={styles.content}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            keyboardShouldPersistTaps="handled"
          >
            {activeTab === 'Tracker' && isReady && !hasEntries && (
              <View
                style={[
                  styles.emptyStateContainer,
                  { backgroundColor: Acid.mossDeep, borderColor: Acid.hair },
                ]}
              >
                <Text style={[styles.emptyStateTitle, { color: Acid.tx }]}>
                  Let's set your goals
                </Text>
                <Text style={[styles.emptyStateText, { color: Acid.tx2 }]}>
                  Add your targets to start tracking your weight journey.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyStateButton, { backgroundColor: Acid.lime }]}
                  onPress={() => {
                    if (onRequestSetGoals) {
                      onRequestSetGoals();
                    } else {
                      setShowLogModal(true);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.emptyStateButtonText, { color: Acid.moss }]}>
                    {onRequestSetGoals ? 'Set Goals' : 'Log Weight'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'Tracker' && (
            <>
            {hasEntries && (
              <>
                {/* Graph Section */}
                <View style={styles.graphContainer}>
                  {hasGraphData ? (
                  <View
                    style={styles.graphCard}
                    {...graphPanResponder.panHandlers}
                  >
                    {/* Scrubbing Tooltip Overlay */}
                    {scrubbingIndex !== null && graphPoints[scrubbingIndex] && (
                      <View
                        style={{
                          position: 'absolute',
                          left: Math.max(4, Math.min(graphWidth - 124, graphPoints[scrubbingIndex].x - 60)),
                          top: Math.max(4, graphPoints[scrubbingIndex].y - 70),
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
                            {format(graphPoints[scrubbingIndex].data.date, 'MMM d, yyyy')}
                          </Text>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: Acid.tx }}>
                            {convertWeightToDisplay(graphPoints[scrubbingIndex].data.weight).toFixed(1)} {getWeightUnitLabel()}
                          </Text>
                        </View>
                        {/* Little triangle arrow at bottom */}
                        <View style={{
                          width: 0,
                          height: 0,
                          borderLeftWidth: 6,
                          borderRightWidth: 6,
                          borderTopWidth: 6,
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                          borderTopColor: Acid.hair,
                          marginTop: -1
                        }} />
                        <View style={{
                          width: 0,
                          height: 0,
                          borderLeftWidth: 5,
                          borderRightWidth: 5,
                          borderTopWidth: 5,
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                          borderTopColor: Acid.mossDeep,
                          marginTop: -7
                        }} />
                      </View>
                    )}

                    {/* Graph with inline Y-axis labels */}
                    <Animated.View style={[styles.graph, { opacity: chartOpacity }]}>
                      <Svg width={graphWidth} height={graphHeight}>
                        {/* Grid lines + Y-axis labels aligned to tick values */}
                        {yAxisTicks.map((value, index) => {
                          const ratio = Math.max(
                            0,
                            Math.min(1, (value - axisMinWeight) / axisWeightRange)
                          );
                          const y = graphPadding + innerHeight - ratio * innerHeight;
                          return (
                            <React.Fragment key={index}>
                              <Line
                                x1={paddingLeft}
                                y1={y}
                                x2={graphWidth - graphPadding}
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
                                {convertWeightToDisplay(value).toFixed(0)}
                              </SvgText>
                            </React.Fragment>
                          );
                        })}

                        {/* Goal on the horizon: dashed line when the target is
                            inside the axis window, corner note when it is not */}
                        {goalLineY !== null && (
                          <>
                            <Line
                              x1={paddingLeft}
                              y1={goalLineY}
                              x2={graphWidth - graphPadding}
                              y2={goalLineY}
                              stroke={Acid.lime + '66'}
                              strokeWidth={1}
                              strokeDasharray="6,4"
                            />
                            <SvgText
                              x={graphWidth - graphPadding}
                              y={goalLineY - 5}
                              fontSize={9}
                              fill={Acid.tx3}
                              textAnchor="end"
                            >
                              {`GOAL ${convertWeightToDisplay(targetWeightValue).toFixed(1)}`}
                            </SvgText>
                          </>
                        )}
                        {targetWeightValue > 0 && goalLineY === null && (
                          <SvgText
                            x={graphWidth - graphPadding}
                            y={targetWeightValue < axisMinWeight ? graphHeight - graphPadding - 4 : graphPadding + 8}
                            fontSize={9}
                            fill={Acid.tx3}
                            textAnchor="end"
                          >
                            {`GOAL ${convertWeightToDisplay(targetWeightValue).toFixed(1)} ${targetWeightValue < axisMinWeight ? '↓' : '↑'}`}
                          </SvgText>
                        )}

                        {/* X-axis date labels */}
                        {xAxisLabels.map((l, i) => (
                          <SvgText
                            key={`x-${i}`}
                            x={l.x}
                            y={graphHeight - 2}
                            fontSize={9}
                            fill={Acid.tx3}
                            textAnchor="middle"
                          >
                            {l.label}
                          </SvgText>
                        ))}

                        {/* Line path with solid color and left-to-right draw animation */}
                        {graphPath ? (
                          <AnimatedPath
                            d={graphPath}
                            fill="none"
                            stroke={Acid.lime}
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${drawLength}, ${drawLength}`}
                            strokeDashoffset={lineProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [drawLength, 0],
                            })}
                          />
                        ) : null}

                        {/* Data points (dots) - only show if few points to avoid clutter, or if highlighted */}
                        {graphData.length < 20 && graphData.map((entry, index) => {
                          if (!graphPoints[index]) return null;
                          const { x, y } = graphPoints[index];
                          return (
                            <Circle
                              key={index}
                              cx={x}
                              cy={y}
                              r={4}
                              fill={Acid.moss}
                              stroke={Acid.lime}
                              strokeWidth={2}
                            />
                          );
                        })}

                        {/* The latest weigh-in gets a solid lime endpoint */}
                        {graphPoints.length > 0 && (
                          <Circle
                            cx={graphPoints[graphPoints.length - 1].x}
                            cy={graphPoints[graphPoints.length - 1].y}
                            r={4.5}
                            fill={Acid.lime}
                          />
                        )}

                        {/* Scrubber Active Cursor - Highlighted Line and Big Dot */}
                        {scrubbingIndex !== null && graphPoints[scrubbingIndex] && (
                          <>
                            <Line
                              x1={graphPoints[scrubbingIndex].x}
                              y1={graphPadding}
                              x2={graphPoints[scrubbingIndex].x}
                              y2={graphHeight - graphPadding}
                              stroke={Acid.tx2}
                              strokeWidth={1}
                              strokeDasharray="4,4"
                            />
                            <Circle
                              cx={graphPoints[scrubbingIndex].x}
                              cy={graphPoints[scrubbingIndex].y}
                              r={6}
                              fill={Acid.lime}
                              stroke={Acid.moss}
                              strokeWidth={3}
                            />
                          </>
                        )}
                      </Svg>
                    </Animated.View>
                  </View>
                  ) : (
                  <NoRangeDataCard />
                  )}

                  {/* What the chart shows. Seeded onboarding weight is plotted
                      but is not a real weigh-in, so it stays out of the count. */}
                  {hasGraphData && (() => {
                    const realWeighIns = graphData.filter(e => !e.seeded).length;
                    if (realWeighIns === 0) {
                      return (
                        <Text style={{ fontSize: 12, color: Acid.tx3, textAlign: 'center', paddingTop: 2 }}>
                          Starting weight from onboarding. Log a weigh-in to start your trend.
                        </Text>
                      );
                    }
                    return (
                      <Text style={{ fontSize: 12, color: Acid.tx3, textAlign: 'center', paddingTop: 2 }}>
                        {realWeighIns} {realWeighIns === 1 ? 'weigh-in' : 'weigh-ins'} in the {rangeLabel(timeRange)}
                      </Text>
                    );
                  })()}

                  {/* Insight below date range */}
                  {insight && (
                    <View style={[styles.insightBox, { backgroundColor: Acid.mossDeep }]}>
                      <Feather name={insightIcon as any} size={18} color={insightIconColor} />
                      <Text style={[styles.insightText, { color: Acid.tx2 }]}>
                        {insight}
                      </Text>
                    </View>
                  )}

                  {/* Weigh-in ledger */}
                  {historyEntries.length > 0 && (
                    <View style={styles.historyContainer}>
                      <View style={styles.ledgerHeaderRow}>
                        <Text style={styles.ledgerHeaderText}>RECENT WEIGH-INS</Text>
                        {ledgerTrend !== null && (
                          <Text style={styles.ledgerHeaderText}>
                            {`TREND ${ledgerTrend < -0.005 ? '▾' : ledgerTrend > 0.005 ? '▴' : '·'} ${convertWeightToDisplay(Math.abs(ledgerTrend)).toFixed(2)} ${getWeightUnitLabel().toUpperCase()} / WEEK`}
                          </Text>
                        )}
                      </View>
                      {historyEntries.map((entry, index) => {
                        const isEditing = editingEntryIndex === index;
                        const older = historyEntries[index + 1];
                        const delta = older ? entry.weight - older.weight : null;
                        return (
                          <View key={entry.id || index} style={[styles.historyRow, { borderTopColor: Acid.hair }]}>
                            <Text style={{ width: 62, fontSize: 12, color: Acid.tx3 }}>
                              {format(entry.date, 'd MMM')}
                            </Text>
                            {isEditing ? (
                              <TextInput
                                style={styles.historyWeightInput}
                                selectionColor={Acid.lime}
                                value={editingWeight}
                                onChangeText={setEditingWeight}
                                keyboardType="decimal-pad"
                              />
                            ) : (
                              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline' }}>
                                <Text style={{ fontFamily: Acid.serif, fontSize: 17, color: Acid.tx }}>
                                  {convertWeightToDisplay(entry.weight).toFixed(1)}
                                </Text>
                                <Text style={{ fontSize: 11, color: Acid.tx3, marginLeft: 4 }}>{getWeightUnitLabel()}</Text>
                              </View>
                            )}
                            {!isEditing && delta !== null && Math.abs(delta) > 0.001 && (
                              <Text style={{ fontSize: 12, fontWeight: '600', marginRight: 12, color: (delta < 0) !== isGainGoal ? Acid.good : Acid.carbs }}>
                                {`${delta < 0 ? '▾' : '▴'} ${convertWeightToDisplay(Math.abs(delta)).toFixed(1)}`}
                              </Text>
                            )}
                            <View style={styles.historyActions}>
                              {isEditing ? (
                                <>
                                  <TouchableOpacity
                                    onPress={handleSaveEditEntry}
                                    style={styles.historyIconButton}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Feather name="check" size={16} color={Acid.lime} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={handleCancelEditEntry}
                                    style={styles.historyIconButton}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Feather name="x" size={16} color={Acid.tx2} />
                                  </TouchableOpacity>
                                </>
                              ) : (
                                <>
                                  <TouchableOpacity
                                    onPress={() => handleStartEditEntry(index)}
                                    style={styles.historyIconButton}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Feather name="edit-2" size={14} color={Acid.tx2} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => handleDeleteEntry(index)}
                                    style={styles.historyIconButton}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Feather name="trash-2" size={14} color={Acid.tx2} />
                                  </TouchableOpacity>
                                </>
                              )}
                            </View>
                          </View>
                        );
                      })}
                      {/* Log link at the foot of the ledger, mock style */}
                      <TouchableOpacity onPress={handleLogPress} activeOpacity={0.7} style={{ paddingVertical: 18 }}>
                        <Text style={{ fontSize: 12, letterSpacing: 1.5, color: Acid.lime, fontWeight: '600' }}>
                          LOG TODAY'S WEIGHT →
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

              </>
            )}
            </>
            )}

            {/* Insights Tab */}
            {activeTab === 'Insights' && isPremium && (
              <View style={{ marginTop: 8, gap: 16 }}>
                {/* ===== ACTIVE CARDS (only render when data is available) ===== */}

                {/* 1. Goal Progress */}
                <InsightSlot id="goal-progress">
                {!isUnlocked('goal-progress') && <LockedInsightCard id="goal-progress" />}
                {isUnlocked('goal-progress') && goalProgressData && !goalProgressData.isMaintain && (
                  <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
                    <View style={styles.bmiHeaderRow}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.bmiTitle, { color: Acid.tx }]}>Goal Progress</Text>
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Goal Progress', 'Shows how far you have come toward your target weight as a percentage. The progress bar fills as you get closer. Lost/gained so far and remaining are shown below. This gives you a clear picture of where you stand without needing to do the math yourself.')}>
                            <Feather name="info" size={13} color={Acid.tx3} />
                          </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                          <Text style={[styles.bmiGaugeValue, { color: goalProgressData.statusColor }]}>
                            {goalProgressData.percentage}%
                          </Text>
                          <View style={[styles.bmiCategoryBadge, { backgroundColor: goalProgressData.statusColor + '15' }]}>
                            <Text style={[styles.bmiCategoryText, { color: goalProgressData.statusColor }]}>
                              {goalProgressData.status}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, color: Acid.tx3, marginBottom: 1 }}>Current</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: Acid.tx2 }}>
                          {convertWeightToDisplay(currentWeight!).toFixed(1)} {getWeightUnitLabel()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.goalProgressBar}>
                      <View style={[styles.goalProgressFill, { width: `${goalProgressData.progressRatio * 100}%`, backgroundColor: goalProgressData.statusColor }]} />
                    </View>
                    <View style={styles.goalEndpoints}>
                      <Text style={{ fontSize: 11, color: Acid.tx3 }}>
                        Started: {convertWeightToDisplay(startingWeight!).toFixed(1)} {getWeightUnitLabel()}
                      </Text>
                      <Text style={{ fontSize: 11, color: Acid.tx3 }}>
                        Target: {convertWeightToDisplay(targetWeight!).toFixed(1)} {getWeightUnitLabel()}
                      </Text>
                    </View>
                    <View style={styles.goalStatsRow}>
                      <View style={styles.goalStatItem}>
                        {/* achieved is signed: negative = moved away from the goal,
                            so the label flips instead of lying. */}
                        <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>
                          {goalProgressData.achieved >= 0
                            ? (goalProgressData.isGain ? 'Gained so far' : 'Lost so far')
                            : (goalProgressData.isGain ? 'Lost so far' : 'Gained so far')}
                        </Text>
                        <Text style={[styles.goalStatValue, { color: goalProgressData.achieved < 0 ? Acid.carbs : Acid.tx }]}>
                          {convertWeightToDisplay(Math.abs(goalProgressData.achieved)).toFixed(1)} {getWeightUnitLabel()}
                        </Text>
                      </View>
                      <View style={[styles.goalStatItem, { alignItems: 'flex-end' }]}>
                        <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>Remaining</Text>
                        <Text style={[styles.goalStatValue, { color: Acid.tx }]}>
                          {convertWeightToDisplay(goalProgressData.remaining).toFixed(1)} {getWeightUnitLabel()}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                </InsightSlot>

                {/* 2. Estimated Goal Date */}
                <InsightSlot id="estimated-goal-date">
                {!isUnlocked('estimated-goal-date') && <LockedInsightCard id="estimated-goal-date" />}
                {isUnlocked('estimated-goal-date') && estimatedGoalData && (
                  <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.bmiTitle, { color: Acid.tx }]}>Estimated Goal Date</Text>
                      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Estimated Goal Date', 'Calculates when you will reach your target weight based on your trend over the last 3 months (or as much of it as you have logged). This updates as you log more weight entries. If progress stalls, the date will push further out, which is a signal to review your plan.')}>
                        <Feather name="info" size={13} color={Acid.tx3} />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 11, color: Acid.tx3, marginTop: 1 }}>
                      Based on your last 3 months trend
                    </Text>
                    {estimatedGoalData.reached ? (
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                        <Text style={[styles.bmiGaugeValue, { color: Acid.good }]}>Done!</Text>
                        <View style={[styles.bmiCategoryBadge, { backgroundColor: Acid.good + '15' }]}>
                          <Text style={[styles.bmiCategoryText, { color: Acid.good }]}>Goal Reached</Text>
                        </View>
                      </View>
                    ) : estimatedGoalData.date ? (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                          <Text style={[styles.bmiGaugeValue, { color: estimatedGoalData.statusColor }]}>
                            {estimatedGoalData.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: Acid.tx2 }}>
                            {estimatedGoalData.date.getFullYear()}
                          </Text>
                        </View>
                        <View style={[styles.goalStatsRow, { marginTop: 16 }]}>
                          <View style={styles.goalStatItem}>
                            <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>Time remaining</Text>
                            <Text style={[styles.goalStatValue, { color: Acid.tx }]}>
                              {estimatedGoalData.weeksLeft! < 1
                                ? `${Math.round(estimatedGoalData.weeksLeft! * 7)} days`
                                : estimatedGoalData.weeksLeft! >= 52
                                ? `${(estimatedGoalData.weeksLeft! / 52).toFixed(1)} years`
                                : `${Math.round(estimatedGoalData.weeksLeft!)} weeks`}
                            </Text>
                          </View>
                          <View style={[styles.goalStatItem, { alignItems: 'flex-end' }]}>
                            <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>Weight to {goalType === 'gain' ? 'gain' : 'lose'}</Text>
                            <Text style={[styles.goalStatValue, { color: Acid.tx }]}>
                              {convertWeightToDisplay(Math.abs(targetWeight! - currentWeight!)).toFixed(1)} {getWeightUnitLabel()}
                            </Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <Text style={[styles.bmiEmptyText, { color: Acid.tx2, textAlign: 'left', marginTop: 4 }]}>
                        {estimatedGoalData.message}
                      </Text>
                    )}
                  </View>
                )}
                </InsightSlot>

                {/* 3. Weekly Rate of Change */}
                <InsightSlot id="weekly-rate">
                {!isUnlocked('weekly-rate') && <LockedInsightCard id="weekly-rate" />}
                {isUnlocked('weekly-rate') && weeklyRateData && (
                  <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
                    <View style={styles.bmiHeaderRow}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.bmiTitle, { color: Acid.tx }]}>Weekly Rate of Change</Text>
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Weekly Rate of Change', 'Shows how much weight you are losing or gaining per week, fitted across every weigh-in from your last 3 months so one odd weigh-in cannot distort it. A healthy rate for weight loss is 0.5 to 1 kg per week. Faster than that usually means muscle loss. Slower is fine but may need patience. This number helps you decide if your calorie target needs adjustment.')}>
                            <Feather name="info" size={13} color={Acid.tx3} />
                          </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 11, color: Acid.tx3, marginTop: 1 }}>
                          Trend across {weeklyRateData.entryCount} weigh-ins · last 3 months
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                          <Text style={[styles.bmiGaugeValue, { color: weeklyRateData.statusColor }]}>
                            {weeklyRateData.direction === 'maintaining' ? '0.0' : convertWeightToDisplay(weeklyRateData.absRate).toFixed(1)}
                          </Text>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: Acid.tx2 }}>
                            {getWeightUnitLabel()}/week
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.bmiCategoryBadge, { backgroundColor: weeklyRateData.statusColor + '15', alignSelf: 'flex-start', marginTop: 4 }]}>
                        <Text style={[styles.bmiCategoryText, { color: weeklyRateData.statusColor, textTransform: 'capitalize' }]}>
                          {weeklyRateData.direction}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.goalStatsRow}>
                      <View style={styles.goalStatItem}>
                        {/* Endpoint math, unlike the fitted headline rate. Named
                            so rate x weeks not equalling this is not "a bug". */}
                        <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>First vs latest weigh-in</Text>
                        <Text style={[styles.goalStatValue, { color: Acid.tx }]}>
                          {weeklyRateData.totalChange > 0 ? '+' : ''}{convertWeightToDisplay(weeklyRateData.totalChange).toFixed(1)} {getWeightUnitLabel()}
                        </Text>
                      </View>
                      <View style={[styles.goalStatItem, { alignItems: 'flex-end' }]}>
                        <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>Over</Text>
                        <Text style={[styles.goalStatValue, { color: Acid.tx }]}>
                          {weeklyRateData.totalWeeks < 1 ? `${Math.round(weeklyRateData.totalWeeks * 7)} days` : `${weeklyRateData.totalWeeks.toFixed(1)} weeks`}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                </InsightSlot>

                {/* 4. Deficit/Surplus Impact (AI) */}
                <InsightSlot id="deficit-surplus-ai">
                {!isUnlocked('deficit-surplus-ai') && <LockedInsightCard id="deficit-surplus-ai" />}
                {isUnlocked('deficit-surplus-ai') && !deficitInsight && !deficitInsightLoading && (
                  <EmptyInsightCard
                    title="Deficit & Surplus Impact"
                    hint="Needs two recent weeks that each have 2+ weigh-ins and logged meals. Keep logging both and the AI analysis appears here."
                  />
                )}
                {isUnlocked('deficit-surplus-ai') && (deficitInsight || deficitInsightLoading) && (
                  <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.bmiTitle, { color: Acid.tx }]}>Deficit & Surplus Impact</Text>
                        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Deficit & Surplus Impact', 'AI analysis of how your calorie intake is affecting your weight. It looks at the relationship between what you eat and how your weight responds, then explains what the numbers mean in practical terms. Refreshed weekly so the analysis stays relevant to your recent behavior.')}>
                          <Feather name="info" size={13} color={Acid.tx3} />
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.bmiCategoryBadge, { backgroundColor: Acid.fat + '15' }]}>
                        <Text style={[styles.bmiCategoryText, { color: Acid.fat }]}>AI</Text>
                      </View>
                    </View>
                    {deficitInsightLoading ? (
                      <Text style={{ fontSize: 13, color: Acid.tx3, marginTop: 8, lineHeight: 20, fontStyle: 'italic' }}>
                        Analyzing your data...
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 13, color: Acid.tx2, marginTop: 8, lineHeight: 20 }}>
                        {deficitInsight}
                      </Text>
                    )}
                    <Text style={{ fontSize: 10, color: Acid.tx3, marginTop: 10 }}>
                      Refreshed weekly on Mondays
                    </Text>
                  </View>
                )}
                </InsightSlot>

                {/* 5. Weight vs Calories */}
                <InsightSlot id="weight-vs-calories">
                {!isUnlocked('weight-vs-calories') && <LockedInsightCard id="weight-vs-calories" />}
                {isUnlocked('weight-vs-calories') && !calorieCorrelation && (
                  <EmptyInsightCard
                    title="Weight vs Calories"
                    hint="Needs 3 days in the last 14 with both a weigh-in and logged food. Today does not count until it is complete."
                  />
                )}
                {isUnlocked('weight-vs-calories') && calorieCorrelation && (
                  <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.bmiTitle, { color: Acid.tx }]}>Weight vs Calories</Text>
                      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Weight vs Calories', 'Overlays your daily calorie intake (blue bars) with your weight trend (green line) on the same chart. This helps you see the direct relationship between what you eat and what the scale shows. If calories drop but weight stays flat, it may take a few more days to show, or water retention could be masking progress.')}>
                        <Feather name="info" size={13} color={Acid.tx3} />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12, color: Acid.tx2, marginTop: 2, marginBottom: 12 }}>
                      {calorieCorrelation.days.length} {calorieCorrelation.days.length === 1 ? 'day' : 'days'} with both a weigh-in and logged food in the last 14 days · today excluded
                    </Text>
                    <View style={{ height: 120 }}>
                      <Svg width="100%" height="120">
                        {calorieCorrelation.days.map((d, i) => {
                          const barWidth = (100 / calorieCorrelation.days.length) * 0.6;
                          const x = (i / calorieCorrelation.days.length) * 100 + (100 / calorieCorrelation.days.length) * 0.2;
                          const calRange = calorieCorrelation.maxCalories - calorieCorrelation.minCalories || 1;
                          const barH = ((d.calories - calorieCorrelation.minCalories) / calRange) * 80 + 10;
                          return (
                            <Path
                              key={`bar-${i}`}
                              d={`M${x}%,${110 - barH} L${x}%,110 L${x + barWidth}%,110 L${x + barWidth}%,${110 - barH} Z`}
                              fill={Acid.protein + '20'}
                              stroke={Acid.protein}
                              strokeWidth={0.5}
                            />
                          );
                        })}
                        {calorieCorrelation.days.length > 1 && (
                          <Path
                            d={calorieCorrelation.days.map((d, i) => {
                              // Bar-center positions so each day's weight dot sits
                              // over that day's calorie bar.
                              const x = ((i + 0.5) / calorieCorrelation.days.length) * 100;
                              const wRange = calorieCorrelation.maxWeight - calorieCorrelation.minWeight || 1;
                              const y = 100 - ((d.weight - calorieCorrelation.minWeight) / wRange) * 80 - 5;
                              return `${i === 0 ? 'M' : 'L'}${x}%,${y}`;
                            }).join(' ')}
                            stroke={Acid.good}
                            strokeWidth={2}
                            fill="none"
                          />
                        )}
                        {calorieCorrelation.days.map((d, i) => {
                          const x = ((i + 0.5) / calorieCorrelation.days.length) * 100;
                          const wRange = calorieCorrelation.maxWeight - calorieCorrelation.minWeight || 1;
                          const y = 100 - ((d.weight - calorieCorrelation.minWeight) / wRange) * 80 - 5;
                          return <Circle key={`dot-${i}`} cx={`${x}%`} cy={y} r={3} fill={Acid.good} />;
                        })}
                      </Svg>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Acid.protein }} />
                        <Text style={{ fontSize: 11, color: Acid.tx2 }}>Calories (avg {Math.round(calorieCorrelation.avgCalories)})</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Acid.good }} />
                        <Text style={{ fontSize: 11, color: Acid.tx2 }}>Weight ({getWeightUnitLabel()})</Text>
                      </View>
                    </View>
                  </View>
                )}
                </InsightSlot>

                {/* 6. Monthly Comparison */}
                <InsightSlot id="monthly-comparison">
                {!isUnlocked('monthly-comparison') && <LockedInsightCard id="monthly-comparison" />}
                {isUnlocked('monthly-comparison') && monthlyComparison && (monthlyComparison.thisChange !== null || monthlyComparison.lastChange !== null) && (
                  <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.bmiTitle, { color: Acid.tx }]}>Monthly Comparison</Text>
                      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Monthly Comparison', 'Compares your weight change this month versus last month. This shows whether your progress is accelerating, slowing down, or staying consistent. If last month you lost 2 kg and this month only 0.5 kg, it might be time to reassess your approach or check if a plateau is forming.')}>
                        <Feather name="info" size={13} color={Acid.tx3} />
                      </TouchableOpacity>
                    </View>
                    {monthlyComparison.thisChange !== null && monthlyComparison.lastChange !== null ? (
                      <Text style={{ fontSize: 13, color: Acid.tx2, marginTop: 2, lineHeight: 20 }}>
                        You {monthlyComparison.thisChange < 0 ? 'lost' : 'gained'}{' '}
                        <Text style={{ fontWeight: '700', color: Acid.tx }}>
                          {convertWeightToDisplay(Math.abs(monthlyComparison.thisChange)).toFixed(1)} {getWeightUnitLabel()}
                        </Text>
                        {' '}in {monthlyComparison.thisMonthName} so far vs{' '}
                        <Text style={{ fontWeight: '700', color: Acid.tx }}>
                          {convertWeightToDisplay(Math.abs(monthlyComparison.lastChange)).toFixed(1)} {getWeightUnitLabel()}
                        </Text>
                        {' '}in {monthlyComparison.lastMonthName}.
                      </Text>
                    ) : null}
                    <View style={[styles.goalStatsRow, { marginTop: 16 }]}>
                      <View style={styles.goalStatItem}>
                        <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>{monthlyComparison.thisMonthName} (so far)</Text>
                        <Text style={[styles.goalStatValue, { color: monthlyComparison.thisChange !== null ? (monthlyComparison.thisChange < 0 ? Acid.good : Acid.protein) : Acid.tx3 }]}>
                          {monthlyComparison.thisChange !== null ? `${monthlyComparison.thisChange > 0 ? '+' : ''}${convertWeightToDisplay(monthlyComparison.thisChange).toFixed(1)} ${getWeightUnitLabel()}` : 'Not enough data'}
                        </Text>
                      </View>
                      <View style={[styles.goalStatItem, { alignItems: 'flex-end' }]}>
                        <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>{monthlyComparison.lastMonthName}</Text>
                        <Text style={[styles.goalStatValue, { color: monthlyComparison.lastChange !== null ? (monthlyComparison.lastChange < 0 ? Acid.good : Acid.protein) : Acid.tx3 }]}>
                          {monthlyComparison.lastChange !== null ? `${monthlyComparison.lastChange > 0 ? '+' : ''}${convertWeightToDisplay(monthlyComparison.lastChange).toFixed(1)} ${getWeightUnitLabel()}` : 'Not enough data'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                </InsightSlot>

                {/* 7. Milestones & Records */}
                <InsightSlot id="milestones-records">
                {!isUnlocked('milestones-records') && <LockedInsightCard id="milestones-records" />}
                {isUnlocked('milestones-records') && milestoneData && (
                  <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.bmiTitle, { color: Acid.tx }]}>Milestones & Records</Text>
                      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Milestones & Records', 'Tracks your achievements and extremes. Shows your lowest and highest recorded weights with dates, plus milestones like breaking through round numbers or reaching new lows. These markers give you something to celebrate and a record of how far you have come.')}>
                        <Feather name="info" size={13} color={Acid.tx3} />
                      </TouchableOpacity>
                    </View>
                    {milestoneData.milestones.length > 0 && (
                      <View style={{ marginTop: 8, gap: 6 }}>
                        {milestoneData.milestones.map((m, i) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: Acid.good + '20', alignItems: 'center', justifyContent: 'center' }}>
                              <Feather name="award" size={12} color="#10B981" />
                            </View>
                            <Text style={{ fontSize: 13, color: Acid.tx, fontWeight: '600', flex: 1 }}>{m}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={[styles.goalStatsRow, { marginTop: 16 }]}>
                      <View style={styles.goalStatItem}>
                        <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>Lowest recorded</Text>
                        <Text style={[styles.goalStatValue, { color: Acid.protein }]}>
                          {convertWeightToDisplay(milestoneData.lowest.weight).toFixed(1)} {getWeightUnitLabel()}
                        </Text>
                        <Text style={{ fontSize: 10, color: Acid.tx3 }}>
                          {format(milestoneData.lowest.date, 'MMM d, yyyy')}
                        </Text>
                      </View>
                      <View style={[styles.goalStatItem, { alignItems: 'flex-end' }]}>
                        <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>Highest recorded</Text>
                        <Text style={[styles.goalStatValue, { color: Acid.error }]}>
                          {convertWeightToDisplay(milestoneData.highest.weight).toFixed(1)} {getWeightUnitLabel()}
                        </Text>
                        <Text style={{ fontSize: 10, color: Acid.tx3 }}>
                          {format(milestoneData.highest.date, 'MMM d, yyyy')}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                </InsightSlot>

                {/* 8. Weight Fluctuation */}
                <InsightSlot id="weight-fluctuation">
                {!isUnlocked('weight-fluctuation') && <LockedInsightCard id="weight-fluctuation" />}
                {isUnlocked('weight-fluctuation') && fluctuationData && (
                  <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.bmiTitle, { color: Acid.tx }]}>Weight Fluctuation</Text>
                      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Weight Fluctuation', `Shows how much your weight varied over the past 7 days. A range of up to ${convertWeightToDisplay(2).toFixed(0)} ${getWeightUnitLabel()} is completely normal and caused by water, sodium, and digestion. If the fluctuation is larger, it does not necessarily mean fat gain. Tracking this over time helps you stop reacting emotionally to daily scale changes.`)}>
                        <Feather name="info" size={13} color={Acid.tx3} />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 13, color: Acid.tx2, marginTop: 2, lineHeight: 20 }}>
                      Your weight varied by <Text style={{ fontWeight: '700', color: fluctuationData.isNormal ? Acid.good : Acid.carbs }}>{convertWeightToDisplay(fluctuationData.range).toFixed(1)} {getWeightUnitLabel()}</Text> over the last 7 days
                      {fluctuationData.isNormal ? ' — that\'s normal.' : ' — consider tracking hydration and sodium.'}
                    </Text>
                    <View style={[styles.goalStatsRow, { marginTop: 16 }]}>
                      <View style={styles.goalStatItem}>
                        <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>Lowest</Text>
                        <Text style={[styles.goalStatValue, { color: Acid.protein }]}>
                          {convertWeightToDisplay(fluctuationData.min).toFixed(1)} {getWeightUnitLabel()}
                        </Text>
                      </View>
                      <View style={[styles.goalStatItem, { alignItems: 'flex-end' }]}>
                        <Text style={[styles.goalStatLabel, { color: Acid.tx3 }]}>Highest</Text>
                        <Text style={[styles.goalStatValue, { color: Acid.error }]}>
                          {convertWeightToDisplay(fluctuationData.max).toFixed(1)} {getWeightUnitLabel()}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                </InsightSlot>

                {/* 9. Logging Consistency */}
                <InsightSlot id="logging-consistency">
                {!isUnlocked('logging-consistency') && <LockedInsightCard id="logging-consistency" />}
                {isUnlocked('logging-consistency') && loggingConsistency && (
                  <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
                    <View style={styles.bmiHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.bmiTitle, { color: Acid.tx }]}>Logging Consistency</Text>
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Logging Consistency', 'Shows how many days this week you logged your weight. Consistent logging gives the app better data to work with, which means more accurate trend lines, better AI insights, and more reliable goal date estimates. Aim for at least 4 to 5 days per week.')}>
                            <Feather name="info" size={13} color={Acid.tx3} />
                          </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 13, color: Acid.tx2, marginTop: 2, lineHeight: 20 }}>
                          You logged <Text style={{ fontWeight: '700', color: loggingConsistency.statusColor }}>{loggingConsistency.count} out of 7</Text> days this week.
                        </Text>
                      </View>
                    </View>
                    <View style={styles.consistencyDotsRow}>
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                        const now = new Date();
                        const dayOfWeek = now.getDay();
                        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                        const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset + i);
                        dayDate.setHours(0, 0, 0, 0);
                        const dayKey = `${dayDate.getFullYear()}-${dayDate.getMonth()}-${dayDate.getDate()}`;
                        const logged = weightEntries.some(e => {
                          const d = new Date(e.date);
                          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === dayKey;
                        });
                        const isFuture = dayDate > now;
                        const isToday = dayDate.toDateString() === now.toDateString();
                        return (
                          <View key={i} style={styles.consistencyDayItem}>
                            <View style={[
                              styles.consistencyDot,
                              logged
                                ? { backgroundColor: Acid.good }
                                : isFuture
                                ? { backgroundColor: Acid.hair, opacity: 0.4 }
                                : { backgroundColor: Acid.hair },
                              isToday && { borderWidth: 2, borderColor: Acid.tx },
                            ]} />
                            <Text style={{ fontSize: 10, color: Acid.tx3, marginTop: 4 }}>{day}</Text>
                          </View>
                        );
                      })}
                    </View>
                    {loggingConsistency.message && (
                      <Text style={{ fontSize: 12, color: loggingConsistency.statusColor, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                        {loggingConsistency.message}
                      </Text>
                    )}
                  </View>
                )}
                </InsightSlot>

                {/* 10. BMI */}
                <InsightSlot id="bmi">
                {!isUnlocked('bmi') && <LockedInsightCard id="bmi" />}
                {isUnlocked('bmi') && !bmiData && (
                  <EmptyInsightCard
                    title="BMI"
                    hint="Needs a current weight and your height. Log a weigh-in, and set your height in your goal plan if it is missing."
                  />
                )}
                {isUnlocked('bmi') && bmiData && (
                  <View style={[styles.bmiCard, { backgroundColor: Acid.mossDeep, shadowColor: '#0F172A' }]}>
                    <View style={styles.bmiHeaderRow}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.bmiTitle, { color: Acid.tx }]}>Body Mass Index</Text>
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => Alert.alert('Body Mass Index', 'BMI is a ratio of your weight to your height. It gives a rough estimate of whether you are underweight, normal, overweight, or obese. It is not perfect because it does not account for muscle mass, but it is a useful baseline number. The gauge shows where you fall on the scale and the colored zones show the healthy range.')}>
                            <Feather name="info" size={13} color={Acid.tx3} />
                          </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                          <Text style={[styles.bmiGaugeValue, { color: Acid.tx }]}>
                            {bmiData.bmi.toFixed(1)}
                          </Text>
                          <Text style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: '600', color: bmiData.categoryColor }}>
                            {bmiData.category.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, color: Acid.tx3, marginBottom: 1 }}>Weight</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: Acid.tx2 }}>{convertWeightToDisplay(currentWeight!).toFixed(1)} {getWeightUnitLabel()}</Text>
                        <Text style={{ fontSize: 10, color: Acid.tx3, marginTop: 6, marginBottom: 1 }}>Height</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: Acid.tx2 }}>
                          {/* Show height in the unit the user entered it in */}
                          {contextGoals?.heightFeet && contextGoals.heightFeet > 0 && !(contextGoals?.heightCm && contextGoals.heightCm > 0)
                            ? `${contextGoals.heightFeet}'${contextGoals.heightInches || 0}"`
                            : heightCm! >= 100 ? `${(heightCm! / 100).toFixed(2)} m` : `${Math.round(heightCm!)} cm`}
                        </Text>
                      </View>
                    </View>
                    {/* The scale: muted zone bands, a lime needle at your BMI,
                        boundary numbers underneath. No legend row, the bands
                        and the category word above carry it. */}
                    <View style={{ paddingTop: 10 }}>
                      <View style={{ height: 26, justifyContent: 'center' }}>
                        <View style={{ flexDirection: 'row', height: 5, borderRadius: 2.5, overflow: 'hidden' }}>
                          <View style={{ flex: 3.5, backgroundColor: Acid.protein + '45' }} />
                          <View style={{ flex: 6.5, backgroundColor: Acid.good + '55' }} />
                          <View style={{ flex: 5, backgroundColor: Acid.carbs + '45' }} />
                          <View style={{ flex: 10, backgroundColor: Acid.error + '40' }} />
                        </View>
                        <View
                          style={{
                            position: 'absolute',
                            left: `${bmiData.position * 100}%`,
                            marginLeft: -1.5,
                            width: 3,
                            height: 20,
                            borderRadius: 1.5,
                            backgroundColor: Acid.lime,
                            shadowColor: Acid.lime,
                            shadowOpacity: 0.8,
                            shadowRadius: 5,
                            shadowOffset: { width: 0, height: 0 },
                            elevation: 3,
                          }}
                        />
                      </View>
                      <View style={{ height: 14 }}>
                        <Text style={{ position: 'absolute', left: '14%', marginLeft: -10, fontSize: 9, color: Acid.tx3 }}>18.5</Text>
                        <Text style={{ position: 'absolute', left: '40%', marginLeft: -7, fontSize: 9, color: Acid.tx3 }}>25</Text>
                        <Text style={{ position: 'absolute', left: '60%', marginLeft: -7, fontSize: 9, color: Acid.tx3 }}>30</Text>
                      </View>
                      {/* BMI translated into weight, so the number is actionable */}
                      <Text style={{ fontSize: 12, color: Acid.tx2, lineHeight: 18, marginTop: 10 }}>
                        Healthy for your height: {convertWeightToDisplay(bmiData.healthyLowKg).toFixed(1)}–{convertWeightToDisplay(bmiData.healthyHighKg).toFixed(1)} {getWeightUnitLabel()}
                      </Text>
                      {targetWeightValue > 0 && heightCm && heightCm > 0 && (() => {
                        const tb = targetWeightValue / ((heightCm / 100) * (heightCm / 100));
                        const tCat = tb < 18.5 ? { w: 'Underweight', c: Acid.protein } : tb < 25 ? { w: 'Normal', c: Acid.good } : tb < 30 ? { w: 'Overweight', c: Acid.carbs } : { w: 'Obese', c: Acid.error };
                        return (
                          <Text style={{ fontSize: 12, color: Acid.tx3, lineHeight: 18, marginTop: 2 }}>
                            Your target {convertWeightToDisplay(targetWeightValue).toFixed(1)} {getWeightUnitLabel()} lands at BMI {tb.toFixed(1)} · <Text style={{ color: tCat.c, fontWeight: '600' }}>{tCat.w}</Text>
                          </Text>
                        );
                      })()}
                    </View>
                  </View>
                )}
                </InsightSlot>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        </View>

        {/* Log Weight Modal */}
        <Modal
          visible={showLogModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowLogModal(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowLogModal(false)}
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <View style={[styles.modalContent, { backgroundColor: Acid.mossDeep }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: Acid.tx }]}>Log Weight</Text>
                  <TouchableOpacity onPress={() => setShowLogModal(false)}>
                    <Feather name="x" size={24} color={Acid.tx} />
                  </TouchableOpacity>
                </View>
                {/* The meter: readout in serif, tape below, drag to set */}
                <View style={{ alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ fontFamily: Acid.serif, fontSize: 54, lineHeight: 60, color: Acid.tx }}>
                      {logWeight || '--'}
                    </Text>
                    <Text style={{ fontSize: 16, color: Acid.tx3, marginLeft: 6 }}>{getWeightUnitLabel()}</Text>
                  </View>
                </View>
                <View style={{ marginBottom: 20 }}>
                  <WeightRuler
                    min={weightUnit === 'kg' ? 30 : 66}
                    max={weightUnit === 'kg' ? 250 : 550}
                    initialValue={parseFloat(logWeight) || (currentWeight !== null ? convertWeightToDisplay(currentWeight) : (weightUnit === 'kg' ? 70 : 154))}
                    onChange={(v) => setLogWeight(v.toFixed(1))}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: Acid.lime }]}
                  onPress={handleLogWeight}
                >
                  <Text style={[styles.modalButtonText, { color: Acid.moss }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

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
              <Text style={[styles.infoHeaderTitle, { color: Acid.tx }]}>About Weight Tracker</Text>
              <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.infoHeaderBtn}>
                <Feather name="x" size={22} color={Acid.tx} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.infoContent}>
              <Text style={[styles.infoSectionTitle, { color: Acid.tx }]}>Overview</Text>
              <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
                Weight Tracker helps you monitor your progress over time. At the top you will see your current weight, your target weight, and how much you have dropped or gained since you started tracking, based on your goal.
              </Text>

              <Text style={[styles.infoSectionTitle, { color: Acid.tx }]}>Graph</Text>
              <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
                The chart plots your weight entries over time. You can scrub across it to see individual readings. Below the graph, use the timeline selector (1W, 1M, 3M, 6M, 1Y) to zoom in on a specific time period.
              </Text>

              <Text style={[styles.infoSectionTitle, { color: Acid.tx }]}>Insight</Text>
              <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
                The insight section gives you an AI-generated summary of your weight trend, updated once per day. It looks at your recent entries and highlights whether you are progressing toward your goal, staying flat, or moving in the opposite direction.
              </Text>

              <Text style={[styles.infoSectionTitle, { color: Acid.tx }]}>History</Text>
              <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
                Below the insight you will find your full weight history. Each entry can be edited by tapping on it, which lets you correct a value if you entered it wrong. Tapping an entry will also take you to that day so you can review what you logged.
              </Text>

              <View style={[styles.infoDivider, { backgroundColor: Acid.hair }]} />

              <Text style={[styles.infoSectionTitle, { color: Acid.tx }]}>How it Works</Text>
              <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
                Weight can be tracked once per day. If you log more than once on the same day, only the most recent entry is kept. You can always go back and edit a previous entry if needed.
              </Text>
              <Text style={[styles.infoBody, { color: Acid.tx2 }]}>
                For the most accurate tracking, try to weigh yourself at the same time each day, ideally in the morning before eating. Day-to-day fluctuations are normal. Focus on the overall trend rather than individual readings.
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </Animated.View>
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
    paddingVertical: 10,
  },
  backButton: {
    padding: 8,
  },
  headerRight: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  graphContainer: {
    marginBottom: 24,
  },
  graphCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    position: 'relative',
  },
  graph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  insightText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  historyContainer: {
    marginTop: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Acid.hair,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  ledgerHeaderText: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: Acid.tx3,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyIconButton: {
    padding: 4,
  },
  historyWeightInput: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Acid.tx,
    borderBottomWidth: 1.5,
    borderBottomColor: Acid.lime,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  emptyStateContainer: {
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
    borderRadius: 999,
  },
  emptyStateButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: Acid.serifItalic,
    fontSize: 22,
  },
  modalButton: {
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: Acid.lime,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  modalButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  // Info modal styles
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
    fontFamily: Acid.serifItalic,
    fontSize: 19,
    textAlign: 'center',
  },
  infoContent: {
    padding: Spacing.lg,
    paddingBottom: 60,
  },
  infoSectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: Spacing.sm,
  },
  infoBody: {
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.6,
    marginBottom: Spacing.md,
  },
  infoDivider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Acid.hair,
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
  // BMI card styles — matches NutritionAnalysis graphCard pattern
  bmiCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  bmiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  bmiTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  bmiGaugeValue: {
    fontFamily: Acid.serif,
    fontSize: 32,
  },
  bmiCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  bmiCategoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bmiEmptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  goalProgressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Acid.hair,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalEndpoints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  goalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  goalStatItem: {
    gap: 2,
  },
  goalStatLabel: {
    fontSize: 11,
  },
  goalStatValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  consistencyDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  consistencyDayItem: {
    alignItems: 'center',
  },
  consistencyDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});



