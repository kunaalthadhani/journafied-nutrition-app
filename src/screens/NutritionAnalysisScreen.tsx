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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { format, subDays, subMonths, subYears, parseISO, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, Text as SvgText, Polygon } from 'react-native-svg';
import { Meal } from '../components/FoodLogSection';
import { analyticsService } from '../services/analyticsService';
import { generateWeeklyInsights } from '../services/openaiService';
import { DailySummary } from '../services/dataStorage';

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
}

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y';
type TabType = 'Calories' | 'Macros' | 'Insights';

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
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('Calories');
  const [timeRange, setTimeRange] = useState<TimeRange>('1W');
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

  // Filter data based on time range
  const getFilteredData = () => {
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
      case '2Y':
        startDate = subYears(now, 2);
        break;
      default:
        startDate = subDays(now, 7);
    }

    return nutritionData.filter(entry => entry.date >= startDate);
  };

  const graphData = useMemo(() => getFilteredData(), [nutritionData, timeRange]);

  // Target values (in grams) - in a real app, these would come from saved goals
  const targetProtein = targetProteinProp && targetProteinProp > 0 ? targetProteinProp : undefined;
  const targetCarbs = targetCarbsProp && targetCarbsProp > 0 ? targetCarbsProp : undefined;
  const targetFat = targetFatProp && targetFatProp > 0 ? targetFatProp : undefined;

  // Check if there's any logged meal data
  const hasLoggedMeals = graphData.length > 0;

  // Calculate averages
  const averageProtein = hasLoggedMeals
    ? graphData.reduce((sum, entry) => sum + entry.protein, 0) / graphData.length
    : null;
  const averageCarbs = hasLoggedMeals
    ? graphData.reduce((sum, entry) => sum + entry.carbs, 0) / graphData.length
    : null;
  const averageFat = hasLoggedMeals
    ? graphData.reduce((sum, entry) => sum + entry.fat, 0) / graphData.length
    : null;

  const averageCalories = hasLoggedMeals
    ? Math.round(
      graphData.reduce((sum, entry) => {
        return sum + entry.calories;
      }, 0) / graphData.length
    )
    : null;
  const targetCalories = targetCaloriesProp && targetCaloriesProp > 0 ? targetCaloriesProp : undefined;
  const hasTargetCalories = targetCalories !== undefined;

  // Calculate graph dimensions
  const graphWidth = 300;
  const graphHeight = 260;
  const padding = 20;
  const innerWidth = graphWidth - padding * 2;
  const innerHeight = graphHeight - padding * 2;
  const LINE_DRAW_LENGTH = 1000; // used for left-to-right draw animations

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
  const generateSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';

    const points = values.map((value, index) => {
      const x = padding + (index / (values.length - 1 || 1)) * innerWidth;
      const normalizedValue = value / maxValue;
      const y = padding + innerHeight - (normalizedValue * innerHeight);
      return { x, y, value };
    });

    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
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

    return path;
  };

  // Generate smooth path for calories chart with improved smoothness
  const generateCaloriesPath = () => {
    if (caloriesData.length === 0) return '';

    const maxCal = Math.ceil((maxCalories + caloriesPadding) / 100) * 100;
    const minCal = Math.floor((minCalories - caloriesPadding) / 100) * 100;

    const points = caloriesData.map((entry, index) => {
      const x = padding + (index / (caloriesData.length - 1 || 1)) * innerWidth;
      const normalizedCalories = (entry.calories - minCal) / (maxCal - minCal);
      const y = padding + innerHeight - (normalizedCalories * innerHeight);
      return { x, y, calories: entry.calories };
    });

    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
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

    return path;
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    analyticsService.trackTimeRangeFilterChange();
    setTimeRange(range);
  };

  const timeRanges: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', '2Y'];

  // Screen-level slide-up for smooth navigation
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  const handleClose = () => {
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
  const caloriesLineProgress = useRef(new Animated.Value(1)).current;
  const macrosLineProgress = useRef(new Animated.Value(1)).current;
  const caloriesChartOpacity = useRef(new Animated.Value(1)).current;
  const macrosChartOpacity = useRef(new Animated.Value(1)).current;
  const AnimatedPath = useRef(Animated.createAnimatedComponent((Path as any))).current;

  // Scrubbing Interaction Logic
  const [scrubbingIndex, setScrubbingIndex] = useState<number | null>(null);

  // Calculate X coordinates for all data points (shared across both tabs)
  const scrubbingPoints = useMemo(() => {
    const data = activeTab === 'Calories' ? caloriesData : graphData;
    if (data.length === 0) return [];

    return data.map((entry, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * innerWidth;
      // For Y, we don't strictly need it for the X-scrubbing, but it helps for positioning the tooltip bubble near the "data".
      // For Macros, we might just position it at the top or follow the Protein line?
      // Let's position it near the top of the graph (padding + 20) to avoid overlapping the busy lines.
      const y = padding + 20;
      return { x, y, data: entry, index };
    });
  }, [caloriesData, graphData, activeTab, innerWidth, padding]);

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

  const handleTouch = (x: number) => {
    if (scrubbingPoints.length === 0) return;

    let closestIndex = 0;
    let minDiff = Infinity;

    scrubbingPoints.forEach((p, i) => {
      const diff = Math.abs(x - p.x);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    });

    setScrubbingIndex(closestIndex);
  };

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 90,
    }).start();
  }, []);

  // Animate calories line when data changes
  useEffect(() => {
    const path = generateCaloriesPath();
    setCaloriesPath(path);

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
  }, [JSON.stringify(caloriesData), maxCalories, minCalories, caloriesPadding]);

  // Animate macros lines when data changes
  useEffect(() => {
    setProteinPath(generateSmoothPath(graphData.map(d => d.protein)));
    setCarbsPath(generateSmoothPath(graphData.map(d => d.carbs)));
    setFatPath(generateSmoothPath(graphData.map(d => d.fat)));

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
  }, [JSON.stringify(graphData), maxValue]);

  // Insights State
  const [insightText, setInsightText] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const insightRequestInFlight = useRef(false);

  useEffect(() => {
    if (activeTab === 'Insights' && isPremium && !insightText && !insightRequestInFlight.current && graphData.length > 0) {
      insightRequestInFlight.current = true;
      setIsGeneratingInsight(true);
      // Prepare summary for AI
      const weeklySummary = {
        averageCalories,
        averageProtein,
        averageCarbs,
        averageFat,
        totalDaysLogged: graphData.length,
        calorieTrend: graphData.map(d => d.calories).slice(-7), // Last 7 entries
      };

      generateWeeklyInsights(weeklySummary)
        .then(text => {
          setInsightText(text);
        })
        .catch(err => console.error(err))
        .finally(() => {
          setIsGeneratingInsight(false);
          insightRequestInFlight.current = false;
        });
    }
  }, [activeTab, isPremium, graphData]);

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
      // value is 0-1+
      const r = Math.min(d.value, 1.1) * radius;
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
            <Polygon key={i} points={pointsStr} stroke={theme.colors.border} strokeWidth="1" fill="none" opacity={0.5} />
          ))}
          {/* Axis Lines */}
          {radarData.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            return <Line key={i} x1={center} y1={center} x2={x} y2={y} stroke={theme.colors.border} strokeWidth="1" opacity={0.5} />;
          })}
          {/* Data Shape */}
          <Polygon points={points} fill="rgba(59, 130, 246, 0.2)" stroke={theme.colors.primary} strokeWidth="2" />
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
                fill={theme.colors.textSecondary}
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <Animated.View
        style={{ flex: 1, transform: [{ translateY: slideAnim }] }}
      >
        {/* Header */}
        <View
          style={[styles.header, { borderBottomColor: theme.colors.border }]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Feather name="chevron-down" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Nutrition Analysis
          </Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        >
          {!hasLoggedMeals && (
            <View
              style={[
                styles.emptyStateContainer,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.emptyStateTitle, { color: theme.colors.textPrimary }]}>
                Log your first meal
              </Text>
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                Start tracking your nutrition by logging your meals.
              </Text>
              <TouchableOpacity
                style={[styles.emptyStateButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  if (onRequestLogMeal) {
                    onRequestLogMeal();
                  } else {
                    onBack();
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.emptyStateButtonText, { color: theme.colors.primaryForeground }]}>
                  Log Meal
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Dynamic Hero Summary */}
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 24, marginTop: 8 }}>
            {activeTab === 'Calories' ? (
              <>
                {/* Average Calories Hero */}
                <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>Average</Text>
                  <Text style={[styles.heroValue, { color: theme.colors.textPrimary }]}>
                    {averageCalories !== null ? `${averageCalories}` : '--'}
                    <Text style={{ fontSize: 14, fontWeight: 'normal', color: theme.colors.textTertiary }}> Kcal</Text>
                  </Text>
                </View>

                {/* Target Calories Hero */}
                <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>Target</Text>
                  {hasTargetCalories ? (
                    <Text style={[styles.heroValue, { color: theme.colors.textPrimary }]}>
                      {`${targetCalories}`}
                      <Text style={{ fontSize: 14, fontWeight: 'normal', color: theme.colors.textTertiary }}> Kcal</Text>
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleSetGoalPress} activeOpacity={0.7}>
                      <Text style={{ color: theme.colors.primary, fontWeight: '600', marginTop: 4 }}>Set Goal</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <>
                {/* Protein Hero */}
                <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderLeftWidth: 4, borderLeftColor: '#3B82F6' }]}>
                  <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>Protein</Text>
                  <Text style={[styles.heroValue, { color: theme.colors.textPrimary }]}>
                    {averageProtein !== null ? `${averageProtein.toFixed(0)}` : '--'}
                    <Text style={{ fontSize: 14, fontWeight: 'normal', color: theme.colors.textTertiary }}>g</Text>
                  </Text>
                </View>

                {/* Carbs Hero */}
                <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderLeftWidth: 4, borderLeftColor: '#EAB308' }]}>
                  <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>Carbs</Text>
                  <Text style={[styles.heroValue, { color: theme.colors.textPrimary }]}>
                    {averageCarbs !== null ? `${averageCarbs.toFixed(0)}` : '--'}
                    <Text style={{ fontSize: 14, fontWeight: 'normal', color: theme.colors.textTertiary }}>g</Text>
                  </Text>
                </View>

                {/* Fat Hero */}
                <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderLeftWidth: 4, borderLeftColor: '#EF4444' }]}>
                  <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>Fat</Text>
                  <Text style={[styles.heroValue, { color: theme.colors.textPrimary }]}>
                    {averageFat !== null ? `${averageFat.toFixed(0)}` : '--'}
                    <Text style={{ fontSize: 14, fontWeight: 'normal', color: theme.colors.textTertiary }}>g</Text>
                  </Text>
                </View>
              </>
            )}
          </View>

          {hasLoggedMeals && (
            <React.Fragment>
              {/* Tab Navigation */}
              <View style={[styles.tabContainer, { backgroundColor: theme.colors.input }]}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'Calories' && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setActiveTab('Calories')}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: activeTab === 'Calories' ? theme.colors.primaryForeground : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    Calories
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'Macros' && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setActiveTab('Macros')}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: activeTab === 'Macros' ? theme.colors.primaryForeground : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    Macros
                  </Text>
                </TouchableOpacity>
                {isPremium && (
                  <TouchableOpacity
                    style={[
                      styles.tab,
                      activeTab === 'Insights' && { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => setActiveTab('Insights')}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        {
                          color: activeTab === 'Insights' ? theme.colors.primaryForeground : theme.colors.textSecondary,
                        },
                      ]}
                    >
                      ✨ Insights
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Calories Chart Section */}
              {activeTab === 'Calories' && (
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
                            {format(scrubbingPoints[scrubbingIndex].data.date, 'MMM d')}
                          </Text>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>
                            {scrubbingPoints[scrubbingIndex].data.calories.toFixed(0)} Kcal
                          </Text>
                        </View>
                        {/* Triangle */}
                        <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: theme.colors.border, marginTop: -1 }} />
                        <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: theme.colors.card, marginTop: -7 }} />
                      </View>
                    )}

                    {/* Graph */}
                    <Animated.View style={[styles.graph, { opacity: caloriesChartOpacity }]}>
                      <Svg width={graphWidth} height={graphHeight}>
                        {/* Grid lines & Labels */}
                        {(() => {
                          const maxCal = Math.ceil((maxCalories + caloriesPadding) / 100) * 100;
                          const minCal = Math.floor((minCalories - caloriesPadding) / 100) * 100;
                          const range = maxCal - minCal || 1;

                          return [0, 1, 2, 3, 4, 5].map((i) => {
                            const ratio = i / 5;
                            const value = maxCal - ratio * range;
                            const y = padding + i * (innerHeight / 5); // Simple linear distribution

                            return (
                              <React.Fragment key={i}>
                                <Line
                                  x1={padding}
                                  y1={y}
                                  x2={graphWidth - padding}
                                  y2={y}
                                  stroke={theme.colors.border}
                                  strokeWidth={0.5}
                                  strokeDasharray="2,2"
                                />
                                <SvgText
                                  x={padding - 6}
                                  y={y + 3}
                                  fontSize={10}
                                  fill={theme.colors.textTertiary}
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
                          const minCal = Math.floor((minCalories - caloriesPadding) / 100) * 100;
                          const targetY = padding + innerHeight - ((targetCalories! - minCal) / (maxCal - minCal)) * innerHeight;
                          return (
                            <Line
                              x1={padding}
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
                            stroke={theme.colors.primary}
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${LINE_DRAW_LENGTH}, ${LINE_DRAW_LENGTH}`}
                            strokeDashoffset={caloriesLineProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [LINE_DRAW_LENGTH, 0],
                            })}
                          />
                        ) : null}

                        {/* Data points (dots) - hollow style */}
                        {caloriesData.length < 20 && caloriesData.map((entry, index) => {
                          const x = padding + (index / (caloriesData.length - 1 || 1)) * innerWidth;
                          const maxCal = Math.ceil((maxCalories + caloriesPadding) / 100) * 100;
                          const minCal = Math.floor((minCalories - caloriesPadding) / 100) * 100;
                          const normalizedCalories = (entry.calories - minCal) / (maxCal - minCal);
                          const y = padding + innerHeight - (normalizedCalories * innerHeight);
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

                        {/* Active Scrubber */}
                        {scrubbingIndex !== null && scrubbingPoints[scrubbingIndex] && (
                          (() => {
                            const pt = scrubbingPoints[scrubbingIndex];
                            const maxCal = Math.ceil((maxCalories + caloriesPadding) / 100) * 100;
                            const minCal = Math.floor((minCalories - caloriesPadding) / 100) * 100;
                            const normalizedCalories = (pt.data.calories - minCal) / (maxCal - minCal);
                            const y = padding + innerHeight - (normalizedCalories * innerHeight);

                            return (
                              <>
                                <Line
                                  x1={pt.x}
                                  y1={padding}
                                  x2={pt.x}
                                  y2={graphHeight - padding}
                                  stroke={theme.colors.textSecondary}
                                  strokeWidth={1}
                                  strokeDasharray="4,4"
                                />
                                <Circle
                                  cx={pt.x}
                                  cy={y}
                                  r={6}
                                  fill={theme.colors.primary}
                                  stroke={theme.colors.card}
                                  strokeWidth={3}
                                />
                              </>
                            );
                          })()
                        )}
                      </Svg>
                    </Animated.View>
                  </View>

                  {/* Time Range Selector */}
                  <View style={styles.timeRangeContainer}>
                    {timeRanges.map((range) => (
                      <TouchableOpacity
                        key={range}
                        style={[
                          styles.timeRangeButton,
                          timeRange === range && styles.timeRangeButtonActive,
                        ]}
                        onPress={() => handleTimeRangeChange(range)}
                      >
                        <Text
                          style={[
                            styles.timeRangeText,
                            timeRange === range
                              ? styles.timeRangeTextActive
                              : { color: theme.colors.textSecondary },
                          ]}
                        >
                          {range}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Date Range */}
                  <Text style={[styles.dateRange, { color: theme.colors.textSecondary }]}>
                    {getDateRange()}
                  </Text>

                  {/* Calories History Table */}
                  {caloriesHistory.length > 0 && (
                    <View style={[styles.historyContainer, { borderColor: theme.colors.border }]}>
                      <Text style={[styles.historyTitle, { color: theme.colors.textPrimary }]}>
                        History
                      </Text>
                      <View style={styles.historyHeaderSpacer} />
                      {/* Fixed Spacer issue if needed, but keeping basic structure */}
                      {caloriesHistory.map((entry) => (
                        <View key={entry.date.toISOString()} style={styles.historyRow}>
                          {/* Row content */}
                          <Text style={[styles.historyCellText, { color: theme.colors.textSecondary }]}>
                            {format(entry.date, 'd MMM yyyy')}
                          </Text>
                          <Text style={[styles.historyCellText, { color: theme.colors.textPrimary }]}>
                            {`${entry.calories.toFixed(0)} Kcal`}
                          </Text>
                          <View style={styles.historyActions}>
                            {onRequestLogMealForDate && (
                              <TouchableOpacity
                                onPress={() => onRequestLogMealForDate(entry.date)}
                                style={styles.historyEditButton}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Feather name="edit-2" size={14} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Macros Chart Section */}

              {activeTab === 'Macros' && (
                <View style={styles.graphContainer}>
                  <Animated.View
                    style={[styles.graphCard, { backgroundColor: theme.colors.card, opacity: macrosChartOpacity }]}
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
                        }}>
                          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 4, textAlign: 'center' }}>
                            {format(scrubbingPoints[scrubbingIndex].data.date, 'MMM d')}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />
                            <Text style={{ fontSize: 12, color: theme.colors.textPrimary }}>P: {(scrubbingPoints[scrubbingIndex].data as any).protein.toFixed(0)}g</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EAB308' }} />
                            <Text style={{ fontSize: 12, color: theme.colors.textPrimary }}>C: {(scrubbingPoints[scrubbingIndex].data as any).carbs.toFixed(0)}g</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                            <Text style={{ fontSize: 12, color: theme.colors.textPrimary }}>F: {(scrubbingPoints[scrubbingIndex].data as any).fat.toFixed(0)}g</Text>
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
                                x1={padding}
                                y1={y}
                                x2={graphWidth - padding}
                                y2={y}
                                stroke={theme.colors.border}
                                strokeWidth={0.5}
                                strokeDasharray="2,2"
                              />
                              <SvgText
                                x={padding - 6}
                                y={y + 3}
                                fontSize={10}
                                fill={theme.colors.textTertiary}
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
                              x1={padding}
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
                            strokeDasharray={`${LINE_DRAW_LENGTH}, ${LINE_DRAW_LENGTH}`}
                            strokeDashoffset={macrosLineProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [LINE_DRAW_LENGTH, 0],
                            })}
                          />
                        ) : null}
                        {carbsPath ? (
                          <AnimatedPath
                            d={carbsPath}
                            fill="none"
                            stroke="#EAB308"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${LINE_DRAW_LENGTH}, ${LINE_DRAW_LENGTH}`}
                            strokeDashoffset={macrosLineProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [LINE_DRAW_LENGTH, 0],
                            })}
                          />
                        ) : null}
                        {fatPath ? (
                          <AnimatedPath
                            d={fatPath}
                            fill="none"
                            stroke="#EF4444"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${LINE_DRAW_LENGTH}, ${LINE_DRAW_LENGTH}`}
                            strokeDashoffset={macrosLineProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [LINE_DRAW_LENGTH, 0],
                            })}
                          />
                        ) : null}

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
                                  y2={graphHeight - padding}
                                  stroke={theme.colors.textSecondary}
                                  strokeWidth={1}
                                  strokeDasharray="4,4"
                                />
                                <Circle cx={pt.x} cy={proteinY} r={5} fill="#3B82F6" stroke={theme.colors.card} strokeWidth={2} />
                                <Circle cx={pt.x} cy={carbsY} r={5} fill="#EAB308" stroke={theme.colors.card} strokeWidth={2} />
                                <Circle cx={pt.x} cy={fatY} r={5} fill="#EF4444" stroke={theme.colors.card} strokeWidth={2} />
                              </>
                            );
                          })()
                        )}

                      </Svg>
                    </View>
                  </Animated.View>


                  {/* Time Range Selector */}
                  <View style={styles.timeRangeContainer}>
                    {timeRanges.map((range) => (
                      <TouchableOpacity
                        key={range}
                        style={[
                          styles.timeRangeButton,
                          timeRange === range && styles.timeRangeButtonActive,
                        ]}
                        onPress={() => handleTimeRangeChange(range)}
                      >
                        <Text
                          style={[
                            styles.timeRangeText,
                            timeRange === range
                              ? styles.timeRangeTextActive
                              : { color: theme.colors.textSecondary },
                          ]}
                        >
                          {range}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Date Range */}
                  <Text style={[styles.dateRange, { color: theme.colors.textSecondary }]}>
                    {getDateRange()}
                  </Text>

                  {/* Macros History Table */}
                  {macrosHistory.length > 0 && (
                    <View style={[styles.historyContainer, { borderColor: theme.colors.border }]}>
                      <Text style={[styles.historyTitle, { color: theme.colors.textPrimary }]}>
                        History
                      </Text>
                      <View style={styles.historyHeaderRow}>
                        <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary }]}>
                          Date
                        </Text>
                        <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary }]}>
                          Protein
                        </Text>
                        <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary }]}>
                          Carbs
                        </Text>
                        <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary }]}>
                          Fat
                        </Text>
                        <View style={styles.historyHeaderSpacer} />
                      </View>
                      {macrosHistory.map((entry) => (
                        <View key={entry.date.toISOString()} style={styles.historyRow}>
                          <Text style={[styles.historyCellText, { color: theme.colors.textSecondary }]}>
                            {format(entry.date, 'd MMM yyyy')}
                          </Text>
                          <Text style={[styles.historyCellText, { color: theme.colors.primary }]}>
                            {`${entry.protein.toFixed(0)}g`}
                          </Text>
                          <Text style={[styles.historyCellText, { color: theme.colors.textSecondary }]}>
                            {`${entry.carbs.toFixed(0)}g`}
                          </Text>
                          <Text style={[styles.historyCellText, { color: theme.colors.textTertiary }]}>
                            {`${entry.fat.toFixed(0)}g`}
                          </Text>
                          <View style={styles.historyActions}>
                            {onRequestLogMealForDate && (
                              <TouchableOpacity
                                onPress={() => onRequestLogMealForDate(entry.date)}
                                style={styles.historyEditButton}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Feather name="edit-2" size={14} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}


                  {/* Information Box */}
                  <View style={[styles.infoBox, { backgroundColor: theme.colors.input }]}>
                    <Feather name="info" size={20} color={theme.colors.primary} />
                    <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                      Your protein intake is below target. Consider adding more lean protein to your meals.
                    </Text>
                  </View>
                </View>
              )}

              {/* Insights Tab */}
              {activeTab === 'Insights' && (
                <View style={styles.graphContainer}>
                  {!isPremium ? (
                    <View style={{ alignItems: 'center', padding: 40, opacity: 0.6 }}>
                      <Feather name="lock" size={48} color={theme.colors.textSecondary} style={{ marginBottom: 16 }} />
                      <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                        Premium Feature
                      </Text>
                      <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
                        Unlock advanced analytics, AI-powered insights, and weekly trend reports.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 20 }}>
                      {/* Radar Chart Card */}
                      <View style={[styles.graphCard, { backgroundColor: theme.colors.card, paddingVertical: 24, alignItems: 'center' }]}>
                        <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <View>
                            <Text style={[styles.chartTitle, { color: theme.colors.textPrimary, textAlign: 'left', marginBottom: 4 }]}>
                              Nutrition Balance
                            </Text>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                              Target vs. Actual
                            </Text>
                          </View>

                          {/* Time Range Badge/Selector */}
                          <View style={{ flexDirection: 'row', gap: 4, backgroundColor: theme.colors.input, borderRadius: 12, padding: 4 }}>
                            {(['1W', '1M', '6M', '1Y'] as TimeRange[]).map((range) => (
                              <TouchableOpacity
                                key={range}
                                onPress={() => handleTimeRangeChange(range)}
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 8,
                                  backgroundColor: timeRange === range ? theme.colors.card : 'transparent',
                                  shadowColor: timeRange === range ? '#000' : 'transparent',
                                  shadowOpacity: timeRange === range ? 0.05 : 0,
                                  shadowRadius: 2,
                                }}
                              >
                                <Text style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  color: timeRange === range ? theme.colors.textPrimary : theme.colors.textSecondary
                                }}>
                                  {range}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {renderRadarChart()}
                      </View>

                      {/* New Visual Consistency Scorecard */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        {/* Score Card */}
                        <View style={{
                          flex: 1,
                          backgroundColor: theme.colors.card,
                          borderRadius: 20,
                          padding: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                        }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>
                            CALORIES
                          </Text>
                          <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', width: 80, height: 80 }}>
                            <Svg height="80" width="80" viewBox="0 0 100 100">
                              <Circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke={theme.colors.input}
                                strokeWidth="8"
                                fill="transparent"
                              />
                              <Circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke={theme.colors.primary}
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={`${2 * Math.PI * 40}`}
                                strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.min(1, (radarData.find(d => d.label === 'Calories')?.value || 0)))}`}
                                strokeLinecap="round"
                                origin="50, 50"
                                rotation="-90"
                              />
                            </Svg>
                            <View style={{ position: 'absolute' }}>
                              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary }}>
                                {Math.round((radarData.find(d => d.label === 'Calories')?.value || 0) * 100)}%
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Status/Badge Card */}
                        <View style={{
                          flex: 1,
                          backgroundColor: theme.colors.card,
                          borderRadius: 20,
                          padding: 16,
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                        }}>
                          <View style={{ marginBottom: 12 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, letterSpacing: 0.5 }}>RATING</Text>
                          </View>
                          <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 4 }}>
                            {(() => {
                              const val = (radarData.find(d => d.label === 'Calories')?.value || 0) * 100;
                              if (val >= 90 && val <= 110) return 'Perfect';
                              if (val >= 80 && val <= 120) return 'Good';
                              return 'Off Track';
                            })()}
                          </Text>
                          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, lineHeight: 16 }}>
                            {(() => {
                              const val = (radarData.find(d => d.label === 'Calories')?.value || 0) * 100;
                              if (val >= 90 && val <= 110) return "You're hitting your calorie goals spot on!";
                              if (val >= 80 && val <= 120) return "You're close to your calorie target. Keep it up.";
                              return "Try to adjust your intake to meet your daily goals.";
                            })()}
                          </Text>
                        </View>
                      </View>




                      {/* Meal Timing Analysis Card */}
                      <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 24 }]}>
                        <View style={{ marginBottom: 20 }}>
                          <Text style={[styles.chartTitle, { color: theme.colors.textPrimary, textAlign: 'left', marginBottom: 4 }]}>
                            Meal Timing
                          </Text>
                          <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                            When are you eating?
                          </Text>
                        </View>

                        {/* Chart Drawing */}
                        {(() => {
                          // 1. Process Data
                          const buckets = {
                            Morning: { cals: 0, count: 0 },
                            Afternoon: { cals: 0, count: 0 },
                            Evening: { cals: 0, count: 0 }
                          };

                          const now = new Date();
                          const rangeDays = timeRange === '1W' ? 7 : timeRange === '1M' ? 30 : timeRange === '3M' ? 90 : timeRange === '6M' ? 180 : 365;
                          const cutoff = subDays(now, rangeDays);

                          let totalRangeCals = 0;
                          let totalDaysWithData = new Set<string>();

                          Object.values(mealsByDate).flat().forEach(meal => {
                            const d = new Date(meal.timestamp);
                            if (d < cutoff) return;

                            totalDaysWithData.add(d.toISOString().split('T')[0]);

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
                            { key: 'Morning', label: 'Morning', subLabel: '4AM - 12PM', icon: 'sunrise', color: '#F59E0B' },
                            { key: 'Afternoon', label: 'Afternoon', subLabel: '12PM - 5PM', icon: 'sun', color: '#3B82F6' },
                            { key: 'Evening', label: 'Evening', subLabel: '5PM - 4AM', icon: 'moon', color: '#8B5CF6' },
                          ] as const;

                          // Find max for bar scaling (relative to total helps visualize distribution better)
                          // Actually, for distribution, % of Total is best.

                          return (
                            <View style={{ gap: 20 }}>
                              {periods.map((p) => {
                                const bucket = buckets[p.key];
                                const percentage = totalRangeCals > 0 ? (bucket.cals / totalRangeCals) : 0;
                                const avgCals = Math.round(bucket.cals / daysCount);

                                return (
                                  <View key={p.key}>
                                    {/* Header Row */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{
                                          width: 32, height: 32, borderRadius: 8,
                                          backgroundColor: `${p.color}15`,
                                          alignItems: 'center', justifyContent: 'center'
                                        }}>
                                          <Feather name={p.icon as any} size={16} color={p.color} />
                                        </View>
                                        <View>
                                          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>
                                            {p.label}
                                          </Text>
                                          <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                            {p.subLabel}
                                          </Text>
                                        </View>
                                      </View>

                                      <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary }}>
                                          {(percentage * 100).toFixed(0)}%
                                        </Text>
                                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                          ~{avgCals} Kcal
                                        </Text>
                                      </View>
                                    </View>

                                    {/* Progress Bar */}
                                    <View style={{
                                      height: 8,
                                      backgroundColor: theme.colors.input,
                                      borderRadius: 4,
                                      overflow: 'hidden'
                                    }}>
                                      <View style={{
                                        width: `${percentage * 100}%`,
                                        height: '100%',
                                        backgroundColor: p.color,
                                        borderRadius: 4
                                      }} />
                                    </View>
                                  </View>
                                );
                              })}

                              {/* Insight Box */}
                              <View style={{
                                marginTop: 8,
                                padding: 12,
                                backgroundColor: theme.colors.input,
                                borderRadius: 12,
                                borderLeftWidth: 4,
                                borderLeftColor: theme.colors.primary
                              }}>
                                <Text style={{ fontSize: 13, color: theme.colors.textPrimary, lineHeight: 20 }}>
                                  <Text style={{ fontWeight: 'bold' }}>Quick Tip: </Text>
                                  {(() => {
                                    // Simple logic for tip
                                    const mP = buckets.Morning.cals / (totalRangeCals || 1);
                                    const eP = buckets.Evening.cals / (totalRangeCals || 1);

                                    if (totalRangeCals === 0) return "Log more meals to see your timing patterns.";
                                    if (eP > 0.5) return "Heavy evening eating can impact sleep quality. Try moving some calories to lunch.";
                                    if (mP < 0.15) return "Starting the day with a small breakfast can help stabilize energy levels.";
                                    return "Your meal timing is well balanced across the day.";
                                  })()}
                                </Text>
                              </View>
                            </View>
                          );
                        })()}
                      </View>

                      {/* Sugar Load Analysis Card */}
                      <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 24 }]}>
                        <View style={{ marginBottom: 20 }}>
                          <Text style={[styles.chartTitle, { color: theme.colors.textPrimary, textAlign: 'left', marginBottom: 4 }]}>
                            Sugar Load
                          </Text>
                          <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                            Natural vs. Added Sugars (Daily Avg)
                          </Text>
                        </View>

                        {(() => {
                          // 1. Calculate Sugar Averages
                          let totalSugar = 0;
                          let addedSugar = 0;
                          let daysWithData = new Set<string>();

                          const now = new Date();
                          const rangeDays = timeRange === '1W' ? 7 : timeRange === '1M' ? 30 : timeRange === '3M' ? 90 : timeRange === '6M' ? 180 : 365;
                          const cutoff = subDays(now, rangeDays);

                          Object.values(mealsByDate).flat().forEach(meal => {
                            const d = new Date(meal.timestamp);
                            if (d < cutoff) return;

                            daysWithData.add(d.toISOString().split('T')[0]);
                            meal.foods.forEach(f => {
                              totalSugar += (f.sugar || 0);
                              addedSugar += (f.added_sugars || 0);
                            });
                          });

                          const count = Math.max(1, daysWithData.size);
                          const avgTotal = Math.round(totalSugar / count);
                          const avgAdded = Math.round(addedSugar / count);
                          const avgNatural = Math.max(0, avgTotal - avgAdded);

                          // Recommended limits (e.g. AHA says ~36g for men, ~25g for women. Let's pick 50g as a general upper bound context)
                          const dailyLimit = 50;
                          const maxBar = Math.max(avgTotal, dailyLimit * 1.2);

                          const widthAdded = (avgAdded / maxBar) * 100;
                          const widthNatural = (avgNatural / maxBar) * 100;
                          const limitPos = (dailyLimit / maxBar) * 100;

                          return (
                            <View>
                              {/* Legend / Stats Row */}
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                <View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FB7185' }} />
                                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Added</Text>
                                  </View>
                                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>{avgAdded}g</Text>
                                </View>

                                <View style={{ height: '100%', width: 1, backgroundColor: theme.colors.border }} />

                                <View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} />
                                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Natural</Text>
                                  </View>
                                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>{avgNatural}g</Text>
                                </View>

                                <View style={{ height: '100%', width: 1, backgroundColor: theme.colors.border }} />

                                <View>
                                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 }}>Total</Text>
                                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>{avgTotal}g</Text>
                                </View>
                              </View>

                              {/* The Bar Chart */}
                              <View style={{ marginBottom: 8 }}>
                                <View style={{ height: 24, width: '100%', backgroundColor: theme.colors.input, borderRadius: 12, flexDirection: 'row', overflow: 'hidden', position: 'relative' }}>
                                  {/* Added Sugar Segment */}
                                  <View style={{ width: `${widthAdded}%`, height: '100%', backgroundColor: '#FB7185' }} />
                                  {/* Natural Sugar Segment */}
                                  <View style={{ width: `${widthNatural}%`, height: '100%', backgroundColor: '#4ADE80' }} />

                                  {/* Limit Line */}
                                  <View style={{ position: 'absolute', left: `${limitPos}%`, top: 0, bottom: 0, width: 2, backgroundColor: theme.colors.textPrimary, zIndex: 10 }} />
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                  <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>0g</Text>
                                  <Text style={{ fontSize: 10, color: theme.colors.textPrimary, fontWeight: '600', transform: [{ translateX: 10 }] }}>Limit ({dailyLimit}g)</Text>
                                  <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>{(maxBar).toFixed(0)}g+</Text>
                                </View>
                              </View>

                              {/* AI Insight Box */}
                              <View style={{
                                marginTop: 16,
                                padding: 12,
                                backgroundColor: theme.colors.input,
                                borderRadius: 12,
                                borderLeftWidth: 4,
                                borderLeftColor: avgAdded > dailyLimit ? '#FB7185' : '#4ADE80'
                              }}>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <Feather name="activity" size={16} color={avgAdded > dailyLimit ? '#FB7185' : '#4ADE80'} style={{ marginTop: 2 }} />
                                  <Text style={{ fontSize: 13, color: theme.colors.textPrimary, lineHeight: 20, flex: 1 }}>
                                    <Text style={{ fontWeight: 'bold' }}>Coach Insight: </Text>
                                    {(() => {
                                      if (avgTotal === 0) return "Log your food to see your sugar breakdown.";
                                      if (avgAdded > dailyLimit) return `Your added sugar average (${avgAdded}g) is high. Watch out for sugary drinks and processed snacks.`;
                                      if (avgAdded > 25) return "You're doing okay, but try swapping one sweet treat for fruit to lower added sugar.";
                                      return "Great job keeping added consumption low! Natural sugars from fruit are fueling you well.";
                                    })()}
                                  </Text>
                                </View>
                              </View>

                            </View>
                          );
                        })()}
                      </View>
                    </View>

                  )}
                </View>
              )}
            </React.Fragment>
          )}

        </ScrollView>
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
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
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
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  timeRangeButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    backgroundColor: 'rgba(15, 23, 42, 0.02)',
  },
  timeRangeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  timeRangeButtonActive: {
    backgroundColor: 'transparent',
    borderColor: '#000', // Will follow theme in inline styles if dynamic, but here static in stylesheet, best to rely on inline styles for dynamic colors or just fix this to use neutral if possible. Wait, Stylesheet is static.
    // Actually the dynamic style is applied in render, but let's check.
    // The render method uses: style={[styles.timeRangeButton, timeRange === range && styles.timeRangeButtonActive]}
    // So I should remove the color from here or update it later. But wait, I can't access theme here.
    // I should update the component render to use inline styles for active state or pass theme to styles (not possible easily).
    // Better to use a standard color here if it matches most themes, or override in render.
    // Given the previous code, I'll update the render method instead.
  },
  timeRangeTextActive: {
    color: '#000',
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
    borderColor: Colors.lightBorder,
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
    borderTopColor: Colors.lightBorder,
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
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
  },
  heroCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
});
