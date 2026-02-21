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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { useTheme } from '../constants/theme';
import { usePreferences } from '../contexts/PreferencesContext';
import { format, subDays, subMonths, subYears, startOfDay } from 'date-fns';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, Text as SvgText, Rect, G } from 'react-native-svg';
import { dataStorage } from '../services/dataStorage';
import { analyticsService } from '../services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '../utils/uuid';

interface WeightTrackerScreenProps {
  onBack: () => void;
  initialCurrentWeightKg?: number | null;
  targetWeightKg?: number | null;
  onRequestSetGoals?: () => void;
}

interface WeightEntry {
  id?: string;
  date: Date;
  weight: number;
  updatedAt?: string;
}

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';

export const WeightTrackerScreen: React.FC<WeightTrackerScreenProps> = ({
  onBack,
  initialCurrentWeightKg,
  targetWeightKg,
  onRequestSetGoals,
}) => {
  const theme = useTheme();
  const { convertWeightToDisplay, convertWeightFromDisplay, getWeightUnitLabel, weightUnit } = usePreferences();
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [showLogModal, setShowLogModal] = useState(false);
  const [logWeight, setLogWeight] = useState('');
  const [logDate, setLogDate] = useState(new Date());
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null);
  const [editingWeight, setEditingWeight] = useState<string>('');
  const [insight, setInsight] = useState<string>('');
  const [insightGeneratedDate, setInsightGeneratedDate] = useState<string | null>(null);
  const [goalType, setGoalType] = useState<'lose' | 'maintain' | 'gain' | undefined>(undefined);
  const [insightIcon, setInsightIcon] = useState<string>('info');
  const [insightIconColor, setInsightIconColor] = useState<string>('');
  const [showInfo, setShowInfo] = useState(false);

  // Start empty — load effect populates from storage
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const dataLoaded = useRef(false); // gate to prevent persist before load
  const [isReady, setIsReady] = useState(false); // gate to prevent flash of empty state

  const hasEntries = weightEntries.length > 0;

  const [targetWeight, setTargetWeight] = useState<number | null>(
    typeof targetWeightKg === 'number' && !isNaN(targetWeightKg) ? targetWeightKg : null
  );

  const currentWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weight : null;
  const targetWeightValue = targetWeight ?? 0;
  const hasMultipleEntries = weightEntries.length >= 2;
  const startingWeight = weightEntries.length > 0 ? weightEntries[0].weight : null;
  const weightChangeFromStart =
    hasMultipleEntries && startingWeight !== null && currentWeight !== null
      ? currentWeight - startingWeight // Positive = gained, Negative = lost
      : null;

  // Determine label and value based on goal type
  const isGainGoal = goalType === 'gain';
  const changeLabel = isGainGoal ? 'Gain' : 'Drop';
  const changeValue = weightChangeFromStart !== null
    ? (isGainGoal ? weightChangeFromStart : -weightChangeFromStart) // For gain: show positive, for lose: show positive (drop)
    : null;

  // Deduplicate entries by date — keep only the most recently updated per day
  const deduplicateByDate = (entries: WeightEntry[]): WeightEntry[] => {
    const byDay = new Map<string, WeightEntry>();
    for (const entry of entries) {
      const dayKey = format(entry.date, 'yyyy-MM-dd');
      const existing = byDay.get(dayKey);
      if (!existing) {
        byDay.set(dayKey, entry);
      } else {
        // Keep the one with the latest updatedAt, or the latest date object
        const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const entryTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
        if (entryTime > existingTime) {
          byDay.set(dayKey, entry);
        }
      }
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  // Load weight entries, insight, and goal on mount
  useEffect(() => {
    (async () => {
      const savedEntries = await dataStorage.loadWeightEntries();
      let entries: WeightEntry[];

      if (savedEntries.length > 0) {
        entries = deduplicateByDate(
          savedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        );
      } else if (typeof initialCurrentWeightKg === 'number' && !isNaN(initialCurrentWeightKg) && initialCurrentWeightKg > 0) {
        // Only seed an initial entry if storage is truly empty
        entries = [{
          id: generateId(),
          date: new Date(),
          weight: initialCurrentWeightKg,
          updatedAt: new Date().toISOString(),
        }];
      } else {
        entries = [];
      }

      dataLoaded.current = true; // allow persist effect to run
      setWeightEntries(entries);

      // Load goal type
      const savedGoals = await dataStorage.loadGoals();
      if (savedGoals?.goal) {
        setGoalType(savedGoals.goal);
      }

      // Load saved insight if it was generated today
      try {
        const savedInsightData = await AsyncStorage.getItem('@trackkal:weightInsight');
        if (savedInsightData) {
          const { insight: savedInsight, date: savedDate } = JSON.parse(savedInsightData);
          const today = format(new Date(), 'yyyy-MM-dd');
          if (savedDate === today && savedInsight) {
            setInsight(savedInsight);
            setInsightGeneratedDate(savedDate);
          }
        }
      } catch (error) {
        // Ignore errors loading insight
      }

      setIsReady(true);
    })();
  }, []);

  // Persist weight entries whenever they change — but only after initial load
  useEffect(() => {
    if (!dataLoaded.current) return; // don't overwrite storage before load completes
    dataStorage.saveWeightEntries(weightEntries);
  }, [weightEntries]);

  useEffect(() => {
    if (typeof targetWeightKg === 'number' && !isNaN(targetWeightKg) && targetWeightKg > 0) {
      setTargetWeight(targetWeightKg);
    }
  }, [targetWeightKg]);

  // Filter data based on time range - memoized to update when timeRange or weightEntries change
  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '1W':
        startDate = subDays(now, 7);
        break;
      case '1M':
        startDate = subMonths(now, 1);
        break;
      case '3M':
        startDate = subMonths(now, 3);
        break;
      case '6M':
        startDate = subMonths(now, 6);
        break;
      case '1Y':
        startDate = subYears(now, 1);
        break;
      default:
        startDate = subYears(now, 1);
    }

    // Filter and sort by date to ensure chronological order
    const filtered = weightEntries
      .filter(entry => {
        // Compare dates at start of day to avoid time component issues
        const entryDate = startOfDay(entry.date);
        const startDateDay = startOfDay(startDate);
        return entryDate >= startDateDay;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return filtered;
  }, [timeRange, weightEntries]);

  const graphData = filteredData.length > 0 ? filteredData : weightEntries;
  const hasGraphData = graphData.length > 0;

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

  // Screen-level slide-up for smooth navigation
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  const handleClose = () => {
    // Save in background — don't block the dismiss animation
    dataStorage.saveWeightEntries(weightEntries);

    Animated.timing(slideAnim, {
      toValue: Dimensions.get('window').height,
      duration: 300,
      useNativeDriver: true,
    }).start(onBack);
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

  const dateRange = useMemo(() => {
    const dataToUse = filteredData.length > 0 ? filteredData : weightEntries;
    if (dataToUse.length === 0) return '';
    const start = dataToUse[0].date;
    const end = dataToUse[dataToUse.length - 1].date;
    return `${format(start, 'd MMM yyyy')} - ${format(end, 'd MMM yyyy')}`;
  }, [filteredData, weightEntries]);

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

  // Chart animation — skip on first load, only animate on time range change
  const [graphPath, setGraphPath] = useState<string>('');
  const [drawLength, setDrawLength] = useState(0);
  const chartOpacity = useRef(new Animated.Value(1)).current;
  const lineProgress = useRef(new Animated.Value(1)).current;
  const AnimatedPath = useRef(Animated.createAnimatedComponent(Path as any)).current;
  const hasAnimatedOnce = useRef(false);
  const shouldAnimate = useRef(false); // only true when user changes time range

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 90,
    }).start();
  }, []);

  useEffect(() => {
    const { path: newPath, length } = generateSmoothPath();
    setGraphPath(newPath);
    setDrawLength(length);

    if (!hasAnimatedOnce.current) {
      // First load — show graph immediately, no animation
      hasAnimatedOnce.current = true;
      chartOpacity.setValue(1);
      lineProgress.setValue(1);
      return;
    }

    if (!shouldAnimate.current) {
      // Data changed but not from a time range switch — show immediately
      chartOpacity.setValue(1);
      lineProgress.setValue(1);
      return;
    }

    // Time range changed — animate
    shouldAnimate.current = false;
    chartOpacity.setValue(0.15);
    lineProgress.setValue(0);

    Animated.parallel([
      Animated.timing(chartOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(lineProgress, {
        toValue: 1,
        duration: 800,
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

    // Check if an entry already exists for this day — replace it instead of duplicating
    const existingIndex = weightEntries.findIndex(e => format(e.date, 'yyyy-MM-dd') === logDayKey);

    let updated: WeightEntry[];
    if (existingIndex >= 0) {
      updated = [...weightEntries];
      updated[existingIndex] = {
        ...updated[existingIndex],
        weight: weightKg,
        updatedAt: new Date().toISOString(),
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
            if (editingEntryIndex === index) {
              handleCancelEditEntry();
            }
          },
        },
      ]
    );
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    analyticsService.trackTimeRangeFilterChange();
    shouldAnimate.current = true; // trigger line-draw animation
    setTimeRange(range);
    // Reset insight when time range changes so it regenerates with new data
    setInsightGeneratedDate(null);
    setInsight('');
    // Clear stored insight so it regenerates
    AsyncStorage.removeItem('@trackkal:weightInsight').catch(() => {
      // Ignore storage errors
    });
  };

  const timeRanges: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y'];

  // Generate insights based on weight data - only once per day
  useEffect(() => {
    if (!hasGraphData || graphData.length < 2) {
      return;
    }

    // Check if we've already generated insight today
    const today = format(new Date(), 'yyyy-MM-dd');
    if (insightGeneratedDate === today) {
      return; // Already generated today, don't regenerate
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
      let iconColor = theme.colors.textSecondary;

      if (variability > 0.02) {
        icon = 'activity';
        iconColor = theme.colors.warning;
        insightText = 'Your weight is fluctuating. Consider tracking hydration and sleep patterns to identify patterns.';
      } else if (weightChangeAbs < 0.5) {
        icon = 'check-circle';
        iconColor = theme.colors.success;
        insightText = 'Your weight has been stable. Great consistency! Keep maintaining your current routine.';
      } else if (weightChange > 0.5) {
        icon = 'trending-up';
        iconColor = isGainGoal ? theme.colors.success : theme.colors.error;
        insightText = `You've gained ${convertWeightToDisplay(weightChangeAbs).toFixed(1)} ${getWeightUnitLabel()} over this period.`;
      } else if (weightChange < -0.5) {
        icon = 'trending-down';
        iconColor = isGainGoal ? theme.colors.error : theme.colors.success;
        insightText = `You've lost ${convertWeightToDisplay(weightChangeAbs).toFixed(1)} ${getWeightUnitLabel()} over this period. Keep up the great progress!`;
      } else {
        icon = 'minus-circle';
        iconColor = theme.colors.textSecondary;
        insightText = 'Your weight shows minimal change. Small fluctuations are normal and expected.';
      }

      return { text: insightText, icon, iconColor };
    };

    const result = generateInsight();
    setInsight(result.text);
    setInsightIcon(result.icon);
    setInsightIconColor(result.iconColor);
    setInsightGeneratedDate(today);

    // Save insight to storage so it persists across app restarts
    AsyncStorage.setItem('@trackkal:weightInsight', JSON.stringify({
      insight: result.text,
      date: today
    })).catch(() => {
      // Ignore storage errors
    });
  }, [hasGraphData, graphData, insightGeneratedDate, convertWeightToDisplay, getWeightUnitLabel]);



  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <Animated.View
        style={{ flex: 1, transform: [{ translateY: slideAnim }] }}
      >
        {/* Header - Drag to close */}
        <View
          style={[styles.header, { borderBottomColor: theme.colors.border }]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Feather name="chevron-down" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Weight Tracker
          </Text>
          <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.headerRight}>
            <Feather name="info" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Main scrollable content; moves above keyboard when editing rows */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            keyboardShouldPersistTaps="handled"
          >
            {isReady && !hasEntries && (
              <View
                style={[
                  styles.emptyStateContainer,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.emptyStateTitle, { color: theme.colors.textPrimary }]}>
                  Let’s set your goals
                </Text>
                <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                  Add your targets to start tracking your weight journey.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyStateButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    if (onRequestSetGoals) {
                      onRequestSetGoals();
                    } else {
                      setShowLogModal(true);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.emptyStateButtonText, { color: theme.colors.primaryForeground }]}>
                    {onRequestSetGoals ? 'Set Goals' : 'Log Weight'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Weight Summary - Hero Cards */}
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 24, marginTop: 8 }}>
              {/* Current Weight Hero */}
              <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>Current</Text>
                <Text style={[styles.heroValue, { color: theme.colors.textPrimary }]}>
                  {currentWeight !== null
                    ? `${convertWeightToDisplay(currentWeight).toFixed(1)}`
                    : '--'}
                  <Text style={{ fontSize: 14, fontWeight: 'normal', color: theme.colors.textTertiary }}>{getWeightUnitLabel()}</Text>
                </Text>
              </View>

              {/* Change Hero */}
              <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>{changeLabel}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {changeValue !== null && changeValue > 0.05 && (
                    <Feather name={isGainGoal ? "trending-up" : "trending-down"} size={16} color={isGainGoal ? theme.colors.success : theme.colors.error} />
                  )}
                  {changeValue !== null && changeValue < -0.05 && (
                    <Feather name={isGainGoal ? "trending-down" : "trending-up"} size={16} color={isGainGoal ? theme.colors.error : theme.colors.success} />
                  )}
                  <Text style={[styles.heroValue, { color: theme.colors.textPrimary }]}>
                    {changeValue !== null
                      ? `${convertWeightToDisplay(Math.abs(changeValue)).toFixed(1)}`
                      : '--'}
                  </Text>
                </View>
              </View>

              {/* Target Hero */}
              <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>Target</Text>
                {targetWeightValue > 0 ? (
                  <Text style={[styles.heroValue, { color: theme.colors.textPrimary }]}>
                    {`${convertWeightToDisplay(targetWeightValue).toFixed(1)}`}
                    <Text style={{ fontSize: 14, fontWeight: 'normal', color: theme.colors.textTertiary }}>{getWeightUnitLabel()}</Text>
                  </Text>
                ) : (
                  <TouchableOpacity
                    onPress={() => onRequestSetGoals?.()}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: theme.colors.primary, fontWeight: '600', marginTop: 4 }}>Set Goal</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {hasGraphData && (
              <>
                {/* Graph Section */}
                <View style={styles.graphContainer}>
                  <View
                    style={[
                      styles.graphCard,
                      {
                        backgroundColor: theme.colors.card,
                        shadowColor: theme.colors.shadow,
                      },
                    ]}
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
                          backgroundColor: theme.colors.card,
                          borderRadius: 8,
                          padding: 8,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 3,
                          alignItems: 'center'
                        }}>
                          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 }}>
                            {format(graphPoints[scrubbingIndex].data.date, 'MMM d, yyyy')}
                          </Text>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>
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
                          borderTopColor: theme.colors.border,
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
                          borderTopColor: theme.colors.card,
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
                                stroke={theme.colors.border}
                                strokeWidth={0.5}
                                strokeDasharray="2,2"
                              />
                              <SvgText
                                x={paddingLeft - 6}
                                y={y + 3}
                                fontSize={10}
                                fill={theme.colors.textTertiary}
                                textAnchor="end"
                              >
                                {convertWeightToDisplay(value).toFixed(0)}
                              </SvgText>
                            </React.Fragment>
                          );
                        })}

                        {/* Line path with solid color and left-to-right draw animation */}
                        {graphPath ? (
                          <AnimatedPath
                            d={graphPath}
                            fill="none"
                            stroke={theme.colors.primary}
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
                              fill={theme.colors.card}
                              stroke={theme.colors.primary}
                              strokeWidth={2}
                            />
                          );
                        })}

                        {/* Scrubber Active Cursor - Highlighted Line and Big Dot */}
                        {scrubbingIndex !== null && graphPoints[scrubbingIndex] && (
                          <>
                            <Line
                              x1={graphPoints[scrubbingIndex].x}
                              y1={graphPadding}
                              x2={graphPoints[scrubbingIndex].x}
                              y2={graphHeight - graphPadding}
                              stroke={theme.colors.textSecondary}
                              strokeWidth={1}
                              strokeDasharray="4,4"
                            />
                            <Circle
                              cx={graphPoints[scrubbingIndex].x}
                              cy={graphPoints[scrubbingIndex].y}
                              r={6}
                              fill={theme.colors.primary}
                              stroke={theme.colors.card}
                              strokeWidth={3}
                            />
                          </>
                        )}
                      </Svg>
                    </Animated.View>
                  </View>

                  {/* Time Range Selector */}
                  <View style={{ flexDirection: 'row', gap: 4, backgroundColor: theme.colors.input, borderRadius: 12, padding: 4, alignSelf: 'center', marginBottom: 8 }}>
                    {timeRanges.map((range) => (
                      <TouchableOpacity
                        key={range}
                        onPress={() => handleTimeRangeChange(range)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: timeRange === range ? theme.colors.card : 'transparent',
                          shadowColor: timeRange === range ? '#000' : 'transparent',
                          shadowOpacity: timeRange === range ? 0.05 : 0,
                          shadowRadius: 2,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: timeRange === range ? theme.colors.textPrimary : theme.colors.textSecondary }}>
                          {range}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Date Range */}
                  <Text style={[styles.dateRange, { color: theme.colors.textSecondary }]}>
                    {dateRange}
                  </Text>

                  {/* Insight below date range */}
                  {insight && (
                    <View style={[styles.insightBox, { backgroundColor: theme.colors.input }]}>
                      <Feather name={insightIcon as any} size={18} color={insightIconColor} />
                      <Text style={[styles.insightText, { color: theme.colors.textSecondary }]}>
                        {insight}
                      </Text>
                    </View>
                  )}

                  {/* History Table */}
                  {historyEntries.length > 0 && (
                    <View style={[styles.historyContainer, { borderColor: theme.colors.border }]}>
                      <Text style={[styles.historyTitle, { color: theme.colors.textPrimary }]}>
                        History
                      </Text>
                      <View style={styles.historyHeaderRow}>
                        <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary }]}>
                          Date
                        </Text>
                        <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary }]}>
                          Weight
                        </Text>
                        <View style={styles.historyHeaderSpacer} />
                      </View>
                      {historyEntries.map((entry, index) => {
                        const isEditing = editingEntryIndex === index;
                        return (
                          <View key={entry.id || index} style={[styles.historyRow, { borderTopColor: theme.colors.border }]}>
                            <Text style={[styles.historyCellText, { color: theme.colors.textSecondary }]}>
                              {format(entry.date, 'd MMM yyyy')}
                            </Text>
                            {isEditing ? (
                              <TextInput
                                style={[
                                  styles.historyWeightInput,
                                  { color: theme.colors.textPrimary, borderColor: theme.colors.border },
                                ]}
                                value={editingWeight}
                                onChangeText={setEditingWeight}
                                keyboardType="decimal-pad"
                              />
                            ) : (
                              <Text style={[styles.historyCellText, { color: theme.colors.textPrimary }]}>
                                {`${convertWeightToDisplay(entry.weight).toFixed(1)} ${getWeightUnitLabel()}`}
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
                                    <Feather name="check" size={16} color={theme.colors.primary} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={handleCancelEditEntry}
                                    style={styles.historyIconButton}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Feather name="x" size={16} color={theme.colors.textSecondary} />
                                  </TouchableOpacity>
                                </>
                              ) : (
                                <>
                                  <TouchableOpacity
                                    onPress={() => handleStartEditEntry(index)}
                                    style={styles.historyIconButton}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Feather name="edit-2" size={14} color={theme.colors.textSecondary} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => handleDeleteEntry(index)}
                                    style={styles.historyIconButton}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Feather name="trash-2" size={14} color={theme.colors.textSecondary} />
                                  </TouchableOpacity>
                                </>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Log Weight Button (fixed at bottom, not moved by KeyboardAvoidingView) */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.logButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              // Check if already logged today
              const today = new Date();
              const todayKey = format(today, 'yyyy-MM-dd');
              const alreadyLogged = weightEntries.some(e => format(e.date, 'yyyy-MM-dd') === todayKey);

              if (alreadyLogged) {
                Alert.alert(
                  'Weight Already Logged',
                  'You’ve already logged today’s weight.\nYou can edit it anytime if you need to make a change.',
                  [{ text: 'OK' }]
                );
                return;
              }
              setShowLogModal(true);
            }}
          >
            <Text style={[styles.logButtonText, { color: theme.colors.primaryForeground }]}>Log Weight</Text>
          </TouchableOpacity>
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
              <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Log Weight</Text>
                  <TouchableOpacity onPress={() => setShowLogModal(false)}>
                    <Feather name="x" size={24} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.weightInput, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                  placeholder={`Enter weight (${getWeightUnitLabel()})`}
                  placeholderTextColor={theme.colors.textTertiary}
                  value={logWeight}
                  onChangeText={setLogWeight}
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleLogWeight}
                >
                  <Text style={[styles.modalButtonText, { color: theme.colors.primaryForeground }]}>Save</Text>
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
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <View style={[styles.infoHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.infoHeaderBtn} />
              <Text style={[styles.infoHeaderTitle, { color: theme.colors.textPrimary }]}>About Weight Tracker</Text>
              <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.infoHeaderBtn}>
                <Feather name="x" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.infoContent}>
              <Text style={[styles.infoSectionTitle, { color: theme.colors.textPrimary }]}>Overview</Text>
              <Text style={[styles.infoBody, { color: theme.colors.textSecondary }]}>
                Weight Tracker helps you monitor your progress over time. At the top you will see your current weight, your target weight, and how much you have dropped or gained since you started tracking, based on your goal.
              </Text>

              <Text style={[styles.infoSectionTitle, { color: theme.colors.textPrimary }]}>Graph</Text>
              <Text style={[styles.infoBody, { color: theme.colors.textSecondary }]}>
                The chart plots your weight entries over time. You can scrub across it to see individual readings. Below the graph, use the timeline selector (1W, 1M, 3M, 6M, 1Y) to zoom in on a specific time period.
              </Text>

              <Text style={[styles.infoSectionTitle, { color: theme.colors.textPrimary }]}>Insight</Text>
              <Text style={[styles.infoBody, { color: theme.colors.textSecondary }]}>
                The insight section gives you an AI-generated summary of your weight trend, updated once per day. It looks at your recent entries and highlights whether you are progressing toward your goal, staying flat, or moving in the opposite direction.
              </Text>

              <Text style={[styles.infoSectionTitle, { color: theme.colors.textPrimary }]}>History</Text>
              <Text style={[styles.infoBody, { color: theme.colors.textSecondary }]}>
                Below the insight you will find your full weight history. Each entry can be edited by tapping on it, which lets you correct a value if you entered it wrong. Tapping an entry will also take you to that day so you can review what you logged.
              </Text>

              <View style={[styles.infoDivider, { backgroundColor: theme.colors.border }]} />

              <Text style={[styles.infoSectionTitle, { color: theme.colors.textPrimary }]}>How it Works</Text>
              <Text style={[styles.infoBody, { color: theme.colors.textSecondary }]}>
                Weight can be tracked once per day. If you log more than once on the same day, only the most recent entry is kept. You can always go back and edit a previous entry if needed.
              </Text>
              <Text style={[styles.infoBody, { color: theme.colors.textSecondary }]}>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
  },
  headerRight: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heroCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    flex: 1,
  },
  heroLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
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
  dateRange: {
    textAlign: 'center',
    fontSize: Typography.fontSize.sm,
    marginBottom: 12,
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
  historyIconButton: {
    padding: 4,
  },
  historyWeightInput: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  logButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
  },
  weightInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: Typography.fontSize.md,
    marginBottom: 16,
  },
  modalButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
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
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
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
});



