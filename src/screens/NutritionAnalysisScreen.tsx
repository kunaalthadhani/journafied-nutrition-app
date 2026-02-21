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
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { format, subDays, subMonths, subYears, parseISO, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, Text as SvgText, Polygon, Rect } from 'react-native-svg';
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
  const screenWidth = Dimensions.get('window').width;
  const graphWidth = screenWidth - 32 - 36; // content paddingHorizontal (16*2) + graphCard padding (18*2)
  const graphHeight = 260;
  const padding = 20;
  const paddingLeft = 45; // extra room for Y-axis labels
  const innerWidth = graphWidth - paddingLeft - padding;
  const innerHeight = graphHeight - padding * 2;
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
    analyticsService.trackTimeRangeFilterChange();
    setTimeRange(range);
  };

  const timeRanges: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y'];

  // Pill-style time range selector used across all tabs
  const renderTimeRangePills = () => (
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
  );

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
  }, [JSON.stringify(caloriesData), maxCalories, minCalories, caloriesPadding]);

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
                {[
                  { label: 'PROTEIN', value: averageProtein, color: '#3B82F6' },
                  { label: 'CARBS', value: averageCarbs, color: '#F59E0B' },
                  { label: 'FAT', value: averageFat, color: '#8B5CF6' },
                ].map((macro) => (
                  <View
                    key={macro.label}
                    style={{
                      flex: 1,
                      backgroundColor: theme.colors.card,
                      borderRadius: 14,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: macro.color }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textSecondary }}>
                        {macro.label}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: theme.colors.textPrimary, lineHeight: 30 }}>
                      {macro.value !== null ? macro.value.toFixed(0) : '--'}
                      <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.textTertiary }}>g</Text>
                    </Text>
                  </View>
                ))}
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
                            stroke={theme.colors.primary}
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
                            const minCal = Math.max(0, Math.floor((minCalories - caloriesPadding) / 100) * 100);
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
                  {renderTimeRangePills()}

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
                        <View key={entry.date.toISOString()} style={[styles.historyRow, { borderTopColor: theme.colors.border }]}>
                          <Text style={[styles.historyCellText, { color: theme.colors.textSecondary }]}>
                            {format(entry.date, 'd MMM yyyy')}
                          </Text>
                          <Text style={[styles.historyCellText, { color: theme.colors.textPrimary, textAlign: 'right' }]}>
                            {`${entry.calories.toFixed(0)} Kcal`}
                          </Text>
                          <TouchableOpacity
                            onPress={() => onRequestLogMealForDate?.(entry.date)}
                            style={{ padding: 4, marginLeft: 6 }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="edit-2" size={14} color={theme.colors.textSecondary} />
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
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
                            <Text style={{ fontSize: 12, color: theme.colors.textPrimary }}>C: {(scrubbingPoints[scrubbingIndex].data as any).carbs.toFixed(0)}g</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#8B5CF6' }} />
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
                                x1={paddingLeft}
                                y1={y}
                                x2={graphWidth - padding}
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
                                <Circle cx={pt.x} cy={carbsY} r={5} fill="#F59E0B" stroke={theme.colors.card} strokeWidth={2} />
                                <Circle cx={pt.x} cy={fatY} r={5} fill="#8B5CF6" stroke={theme.colors.card} strokeWidth={2} />
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
                      { label: 'Protein', color: '#3B82F6' },
                      { label: 'Carbs', color: '#F59E0B' },
                      { label: 'Fat', color: '#8B5CF6' },
                    ].map((item) => (
                      <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 10, height: 3, borderRadius: 1.5, backgroundColor: item.color }} />
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{item.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Time Range Selector */}
                  {renderTimeRangePills()}

                  {/* Date Range */}
                  <Text style={[styles.dateRange, { color: theme.colors.textSecondary }]}>
                    {getDateRange()}
                  </Text>

                  {/* Dynamic Macro Insight */}
                  {(() => {
                    const hasTargets = targetProtein !== undefined || targetCarbs !== undefined || targetFat !== undefined;

                    if (!hasTargets) {
                      return (
                        <View style={[styles.infoBox, { backgroundColor: theme.colors.input }]}>
                          <Feather name="target" size={18} color={theme.colors.primary} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                              Set macro goals to get personalized insights on your nutrition.
                            </Text>
                            <TouchableOpacity onPress={handleSetGoalPress} activeOpacity={0.7} style={{ marginTop: 6 }}>
                              <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>Set Goals</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }

                    // Compare each macro against its target
                    const insights: { macro: string; color: string; pct: number; status: 'low' | 'high' | 'on_track' }[] = [];

                    if (targetProtein !== undefined && averageProtein !== null) {
                      const pct = ((averageProtein - targetProtein) / targetProtein) * 100;
                      insights.push({ macro: 'Protein', color: '#3B82F6', pct, status: pct < -15 ? 'low' : pct > 15 ? 'high' : 'on_track' });
                    }
                    if (targetCarbs !== undefined && averageCarbs !== null) {
                      const pct = ((averageCarbs - targetCarbs) / targetCarbs) * 100;
                      insights.push({ macro: 'Carbs', color: '#F59E0B', pct, status: pct < -15 ? 'low' : pct > 15 ? 'high' : 'on_track' });
                    }
                    if (targetFat !== undefined && averageFat !== null) {
                      const pct = ((averageFat - targetFat) / targetFat) * 100;
                      insights.push({ macro: 'Fat', color: '#8B5CF6', pct, status: pct < -15 ? 'low' : pct > 15 ? 'high' : 'on_track' });
                    }

                    const offTrack = insights.filter(i => i.status !== 'on_track');
                    const allOnTrack = offTrack.length === 0 && insights.length > 0;

                    let icon: string;
                    let iconColor: string;
                    let message: string;

                    if (allOnTrack) {
                      icon = 'check-circle';
                      iconColor = '#10B981';
                      message = "All macros are within target range. You're nailing your nutrition goals — keep it up!";
                    } else if (offTrack.length > 0) {
                      // Pick the most off-track macro
                      const worst = offTrack.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
                      iconColor = worst.color;

                      if (worst.status === 'low') {
                        icon = 'arrow-down-circle';
                        const deficit = Math.abs(Math.round(worst.pct));
                        if (worst.macro === 'Protein') {
                          message = `Protein is ${deficit}% below target. Try adding eggs, Greek yogurt, or chicken to close the gap.`;
                        } else if (worst.macro === 'Carbs') {
                          message = `Carbs are ${deficit}% below target. Add whole grains, fruit, or oats to fuel your energy levels.`;
                        } else {
                          message = `Fat is ${deficit}% below target. Nuts, avocado, or olive oil are great healthy fat sources.`;
                        }
                      } else {
                        icon = 'arrow-up-circle';
                        const surplus = Math.round(worst.pct);
                        if (worst.macro === 'Protein') {
                          message = `Protein is ${surplus}% above target. Consider balancing portions with more vegetables and complex carbs.`;
                        } else if (worst.macro === 'Carbs') {
                          message = `Carbs are ${surplus}% over target. Try swapping refined carbs for vegetables or reducing portion sizes.`;
                        } else {
                          message = `Fat is ${surplus}% over target. Watch for hidden fats in sauces, fried food, and processed snacks.`;
                        }
                      }
                    } else {
                      return null;
                    }

                    return (
                      <View style={[styles.infoBox, { backgroundColor: theme.colors.input }]}>
                        <Feather name={icon as any} size={18} color={iconColor} />
                        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                          {message}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Macros History Table */}
                  {macrosHistory.length > 0 && (
                    <View style={[styles.historyContainer, { borderColor: theme.colors.border }]}>
                      <Text style={[styles.historyTitle, { color: theme.colors.textPrimary }]}>
                        History
                      </Text>
                      <View style={styles.historyHeaderRow}>
                        <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary, flex: 1.5 }]}>
                          Date
                        </Text>
                        <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
                          Protein
                        </Text>
                        <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
                          Carbs
                        </Text>
                        <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
                          Fat
                        </Text>
                        <View style={{ width: 28 }} />
                      </View>
                      {macrosHistory.map((entry) => (
                        <View key={entry.date.toISOString()} style={[styles.historyRow, { borderTopColor: theme.colors.border }]}>
                          <Text style={[styles.historyCellText, { color: theme.colors.textSecondary, flex: 1.5 }]}>
                            {format(entry.date, 'd MMM yyyy')}
                          </Text>
                          <Text style={[styles.historyCellText, { color: theme.colors.primary, textAlign: 'right' }]}>
                            {`${entry.protein.toFixed(0)}g`}
                          </Text>
                          <Text style={[styles.historyCellText, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
                            {`${entry.carbs.toFixed(0)}g`}
                          </Text>
                          <Text style={[styles.historyCellText, { color: theme.colors.textTertiary, textAlign: 'right' }]}>
                            {`${entry.fat.toFixed(0)}g`}
                          </Text>
                          <TouchableOpacity
                            onPress={() => onRequestLogMealForDate?.(entry.date)}
                            style={{ padding: 4, marginLeft: 6 }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="edit-2" size={14} color={theme.colors.textSecondary} />
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
                      <Feather name="lock" size={48} color={theme.colors.textSecondary} style={{ marginBottom: 16 }} />
                      <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                        Premium Feature
                      </Text>
                      <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
                        Unlock advanced analytics, AI-powered insights, and weekly trend reports.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 16 }}>

                      {/* ── Time Range Selector ── */}
                      {renderTimeRangePills()}

                      {/* ── AI Weekly Insight ── */}
                      {(insightText || isGeneratingInsight) && (
                        <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 20 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${theme.colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                              <Feather name="cpu" size={14} color={theme.colors.primary} />
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary }}>AI Weekly Insight</Text>
                          </View>
                          {isGeneratingInsight ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Feather name="loader" size={14} color={theme.colors.textSecondary} />
                              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' }}>Analyzing your nutrition data...</Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 13, color: theme.colors.textPrimary, lineHeight: 20 }}>
                              {insightText}
                            </Text>
                          )}
                        </View>
                      )}

                      {/* ── Macro Adherence Rings ── */}
                      {(targetProtein || targetCarbs || targetFat) && (
                        <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 20 }]}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>Goal Adherence</Text>
                          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 16 }}>Average vs. target</Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                            {[
                              { label: 'Protein', avg: averageProtein ?? 0, target: targetProtein, color: '#3B82F6' },
                              { label: 'Carbs', avg: averageCarbs ?? 0, target: targetCarbs, color: '#F59E0B' },
                              { label: 'Fat', avg: averageFat ?? 0, target: targetFat, color: '#8B5CF6' },
                              ...(targetCalories ? [{ label: 'Calories', avg: averageCalories ?? 0, target: targetCalories, color: theme.colors.primary }] : []),
                            ].filter(m => m.target).map((macro) => {
                              const pct = Math.min(1, macro.avg / (macro.target! || 1));
                              const circumference = 2 * Math.PI * 32;
                              return (
                                <View key={macro.label} style={{ alignItems: 'center' }}>
                                  <View style={{ position: 'relative', width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
                                    <Svg width={72} height={72} viewBox="0 0 80 80">
                                      <Circle cx="40" cy="40" r="32" stroke={theme.colors.input} strokeWidth="6" fill="transparent" />
                                      <Circle
                                        cx="40" cy="40" r="32"
                                        stroke={macro.color}
                                        strokeWidth="6"
                                        fill="transparent"
                                        strokeDasharray={`${circumference}`}
                                        strokeDashoffset={`${circumference * (1 - pct)}`}
                                        strokeLinecap="round"
                                        transform="rotate(-90, 40, 40)"
                                      />
                                    </Svg>
                                    <View style={{ position: 'absolute' }}>
                                      <Text style={{ fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center' }}>
                                        {Math.round(pct * 100)}%
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 6 }}>{macro.label}</Text>
                                  <Text style={{ fontSize: 10, color: theme.colors.textTertiary }}>{Math.round(macro.avg)}/{macro.target}{macro.label === 'Calories' ? '' : 'g'}</Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      {/* ── Calorie Trend Chart ── */}
                      {graphData.length >= 2 && (
                        <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 20 }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <View>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>Calorie Trend</Text>
                              <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Daily intake over time</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary }}>{averageCalories ?? 0}</Text>
                              <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>avg Kcal/day</Text>
                            </View>
                          </View>
                          {(() => {
                            const cW = graphWidth - 36; // card padding
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
                                    <Stop offset="0" stopColor={theme.colors.primary} stopOpacity="0.2" />
                                    <Stop offset="1" stopColor={theme.colors.primary} stopOpacity="0" />
                                  </LinearGradient>
                                </Defs>
                                {/* Grid lines */}
                                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                                  const y = cPadY + iH - r * iH;
                                  const label = Math.round(minV + r * range);
                                  return (
                                    <React.Fragment key={i}>
                                      <Line x1={cPadL} y1={y} x2={cW - cPadR} y2={y} stroke={theme.colors.border} strokeWidth={0.5} strokeDasharray="2,2" />
                                      <SvgText x={cPadL - 4} y={y + 3} fontSize="9" fill={theme.colors.textTertiary} textAnchor="end">{label}</SvgText>
                                    </React.Fragment>
                                  );
                                })}
                                {/* Area fill */}
                                <Path d={areaPath} fill="url(#calTrendGrad)" />
                                {/* Line */}
                                <Path d={linePath} fill="none" stroke={theme.colors.primary} strokeWidth={2} strokeLinejoin="round" />
                                {/* Avg dashed line */}
                                <Line x1={cPadL} y1={avgY} x2={cW - cPadR} y2={avgY} stroke={theme.colors.textSecondary} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
                                <SvgText x={cW - cPadR} y={avgY - 4} fontSize="9" fill={theme.colors.textSecondary} textAnchor="end">avg</SvgText>
                                {/* Target line */}
                                {targetY !== null && (
                                  <>
                                    <Line x1={cPadL} y1={targetY} x2={cW - cPadR} y2={targetY} stroke="#EF4444" strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
                                    <SvgText x={cW - cPadR} y={targetY - 4} fontSize="9" fill="#EF4444" textAnchor="end">target</SvgText>
                                  </>
                                )}
                                {/* Data dots */}
                                {pts.length <= 14 && pts.map((p, i) => (
                                  <Circle key={i} cx={p.x} cy={p.y} r={3} fill={theme.colors.card} stroke={theme.colors.primary} strokeWidth={1.5} />
                                ))}
                              </Svg>
                            );
                          })()}
                        </View>
                      )}

                      {/* ── Macro Split Bar ── */}
                      <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 20 }]}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>Macro Split</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 16 }}>Average daily ratio</Text>
                        {(() => {
                          const p = averageProtein ?? 0;
                          const c = averageCarbs ?? 0;
                          const f = averageFat ?? 0;
                          const totalG = p + c + f || 1;
                          const pPct = (p / totalG) * 100;
                          const cPct = (c / totalG) * 100;
                          const fPct = (f / totalG) * 100;
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
                                <View style={{ width: `${pCalPct}%`, backgroundColor: '#3B82F6' }} />
                                <View style={{ width: `${cCalPct}%`, backgroundColor: '#F59E0B' }} />
                                <View style={{ width: `${fCalPct}%`, backgroundColor: '#8B5CF6' }} />
                              </View>
                              {/* Labels */}
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                {[
                                  { label: 'Protein', grams: p, pct: pCalPct, color: '#3B82F6' },
                                  { label: 'Carbs', grams: c, pct: cCalPct, color: '#F59E0B' },
                                  { label: 'Fat', grams: f, pct: fCalPct, color: '#8B5CF6' },
                                ].map((m) => (
                                  <View key={m.label} style={{ alignItems: 'center', flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                                      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>{m.label}</Text>
                                    </View>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary }}>{Math.round(m.pct)}%</Text>
                                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>{Math.round(m.grams)}g/day</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          );
                        })()}
                      </View>

                      {/* ── Radar Chart ── */}
                      {radarData.length > 0 && (
                        <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 20, alignItems: 'center' }]}>
                          <View style={{ width: '100%', marginBottom: 8 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>Nutrition Balance</Text>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Target vs. actual performance</Text>
                          </View>
                          {renderRadarChart()}
                        </View>
                      )}

                      {/* ── Day-of-Week Activity ── */}
                      {graphData.length >= 3 && (
                        <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 20 }]}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>Weekly Pattern</Text>
                          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 16 }}>Average calories by day of week</Text>
                          {(() => {
                            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                            const dayBuckets: Record<string, { total: number; count: number }> = {};
                            dayNames.forEach(d => { dayBuckets[d] = { total: 0, count: 0 }; });

                            graphData.forEach(entry => {
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

                            const barChartW = graphWidth - 36;
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
                                        <Rect x={x} y={y} width={barW} height={Math.max(barH, 2)} rx={barW / 2} fill={isToday ? theme.colors.primary : `${theme.colors.primary}40`} />
                                        {d.avg > 0 && (
                                          <SvgText x={x + barW / 2} y={y - 4} fontSize="9" fill={theme.colors.textSecondary} textAnchor="middle" fontWeight="600">
                                            {d.avg}
                                          </SvgText>
                                        )}
                                        <SvgText x={x + barW / 2} y={barChartH + 14} fontSize="10" fill={isToday ? theme.colors.textPrimary : theme.colors.textSecondary} textAnchor="middle" fontWeight={isToday ? '700' : '500'}>
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

                      {/* ── Meal Timing ── */}
                      <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 20 }]}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>Meal Timing</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 16 }}>When are you eating?</Text>
                        {(() => {
                          const buckets = { Morning: { cals: 0, count: 0 }, Afternoon: { cals: 0, count: 0 }, Evening: { cals: 0, count: 0 } };
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
                            { key: 'Morning' as const, label: 'Morning', sub: '4AM – 12PM', icon: 'sunrise' as const, color: '#F59E0B' },
                            { key: 'Afternoon' as const, label: 'Afternoon', sub: '12PM – 5PM', icon: 'sun' as const, color: '#3B82F6' },
                            { key: 'Evening' as const, label: 'Evening', sub: '5PM – 4AM', icon: 'moon' as const, color: '#8B5CF6' },
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
                                          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary }}>{p.label}</Text>
                                          <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>{p.sub}</Text>
                                        </View>
                                      </View>
                                      <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary }}>{(pct * 100).toFixed(0)}%</Text>
                                        <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>~{avgCals} Kcal</Text>
                                      </View>
                                    </View>
                                    <View style={{ height: 6, backgroundColor: theme.colors.input, borderRadius: 3, overflow: 'hidden' }}>
                                      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: p.color, borderRadius: 3 }} />
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()}
                      </View>

                      {/* ── Top Foods ── */}
                      <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 20 }]}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>Top Foods</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 16 }}>Most logged items</Text>
                        {(() => {
                          const now = new Date();
                          const rangeDays = timeRange === '1W' ? 7 : timeRange === '1M' ? 30 : timeRange === '3M' ? 90 : timeRange === '6M' ? 180 : 365;
                          const cutoff = subDays(now, rangeDays);

                          const foodCounts: Record<string, { count: number; cals: number }> = {};
                          Object.values(mealsByDate).flat().forEach(meal => {
                            const d = new Date(meal.timestamp);
                            if (d < cutoff) return;
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
                            return <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 12 }}>Log more meals to see your top foods.</Text>;
                          }

                          return (
                            <View style={{ gap: 10 }}>
                              {sorted.map(([name, data], i) => (
                                <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <Text style={{ width: 18, fontSize: 12, fontWeight: '700', color: theme.colors.textTertiary, textAlign: 'center' }}>{i + 1}</Text>
                                  <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, textTransform: 'capitalize' }}>{name}</Text>
                                      <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{data.count}x  ·  {Math.round(data.cals / data.count)} Kcal avg</Text>
                                    </View>
                                    <View style={{ height: 4, backgroundColor: theme.colors.input, borderRadius: 2, overflow: 'hidden' }}>
                                      <View style={{ width: `${(data.count / maxCount) * 100}%`, height: '100%', backgroundColor: theme.colors.primary, borderRadius: 2 }} />
                                    </View>
                                  </View>
                                </View>
                              ))}
                            </View>
                          );
                        })()}
                      </View>

                      {/* ── Sugar Load ── */}
                      <View style={[styles.graphCard, { backgroundColor: theme.colors.card, padding: 20 }]}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>Sugar Load</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 16 }}>Natural vs. added sugars (daily avg)</Text>
                        {(() => {
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
                          const dailyLimit = 50;
                          const maxBar = Math.max(avgTotal, dailyLimit * 1.2);

                          return (
                            <View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
                                {[
                                  { label: 'Added', val: avgAdded, color: '#FB7185' },
                                  { label: 'Natural', val: avgNatural, color: '#4ADE80' },
                                  { label: 'Total', val: avgTotal, color: theme.colors.textPrimary },
                                ].map(s => (
                                  <View key={s.label} style={{ alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                      {s.label !== 'Total' && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: s.color }} />}
                                      <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{s.label}</Text>
                                    </View>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary }}>{s.val}g</Text>
                                  </View>
                                ))}
                              </View>
                              <View style={{ height: 20, flexDirection: 'row', borderRadius: 10, overflow: 'hidden', backgroundColor: theme.colors.input, position: 'relative', marginBottom: 6 }}>
                                <View style={{ width: `${(avgAdded / maxBar) * 100}%`, height: '100%', backgroundColor: '#FB7185' }} />
                                <View style={{ width: `${(avgNatural / maxBar) * 100}%`, height: '100%', backgroundColor: '#4ADE80' }} />
                                <View style={{ position: 'absolute', left: `${(dailyLimit / maxBar) * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: theme.colors.textPrimary }} />
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>0g</Text>
                                <Text style={{ fontSize: 10, color: theme.colors.textPrimary, fontWeight: '600' }}>Limit {dailyLimit}g</Text>
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
