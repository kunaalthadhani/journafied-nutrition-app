import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { format, subDays, subMonths, subYears, parseISO } from 'date-fns';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Meal } from '../components/FoodLogSection';
import { analyticsService } from '../services/analyticsService';

interface NutritionAnalysisScreenProps {
  onBack: () => void;
  onRequestLogMeal?: () => void;
  onRequestLogMealForDate?: (date: Date) => void;
  onRequestSetGoals?: () => void;
  mealsByDate?: Record<string, Meal[]>;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
}

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y';
type TabType = 'Calories' | 'Macros';

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
  targetCalories: targetCaloriesProp,
  targetProtein: targetProteinProp,
  targetCarbs: targetCarbsProp,
  targetFat: targetFatProp,
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

  // Transform mealsByDate into DailyNutrition format
  const nutritionData = useMemo<DailyNutrition[]>(() => {
    const dailyData: DailyNutrition[] = [];
    
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
    
    // Sort by date (oldest first)
    return dailyData.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [mealsByDate]);

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

  const filteredData = getFilteredData();
  const graphData = filteredData;

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

  // Screen-level fade-in for smooth navigation (content only)
  const screenOpacity = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#10B981" />
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
              style={[styles.emptyStateButton, { backgroundColor: '#10B981' }]}
              onPress={() => {
                if (onRequestLogMeal) {
                  onRequestLogMeal();
                } else {
                  onBack();
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyStateButtonText}>
                Log Meal
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Calorie Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
              {averageCalories !== null ? `${averageCalories} Kcal` : '--'}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Average</Text>
          </View>
          <View style={styles.summaryItem}>
            {hasTargetCalories ? (
              <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
                {`${targetCalories} Kcal`}
              </Text>
            ) : (
              <TouchableOpacity
                style={styles.setGoalLink}
                onPress={handleSetGoalPress}
                activeOpacity={0.8}
              >
                <Text style={[styles.setGoalText, { color: '#10B981' }]}>Set Goal</Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Target</Text>
          </View>
        </View>

        {hasLoggedMeals && (
          <>
            {/* Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.input }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'Calories' && { backgroundColor: '#10B981' },
            ]}
            onPress={() => setActiveTab('Calories')}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'Calories' ? Colors.white : theme.colors.textSecondary,
                },
              ]}
            >
              Calories
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'Macros' && { backgroundColor: '#10B981' },
            ]}
            onPress={() => setActiveTab('Macros')}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'Macros' ? Colors.white : theme.colors.textSecondary,
                },
              ]}
            >
              Macros
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calories Chart Section */}
        {activeTab === 'Calories' && (
          <View style={styles.graphContainer}>
            <Animated.View style={[styles.graphCard, { backgroundColor: theme.colors.card, opacity: caloriesChartOpacity }]}>
              {/* Y-axis labels */}
              <View style={styles.yAxisContainer}>
                {(() => {
                  const maxCal = Math.ceil((maxCalories + caloriesPadding) / 100) * 100;
                  const minCal = Math.floor((minCalories - caloriesPadding) / 100) * 100;
                  return [0, 1, 2, 3, 4, 5].map((i) => {
                    const value = maxCal - (i / 5) * (maxCal - minCal);
                    return (
                      <Text
                        key={i}
                        style={[
                          styles.yAxisLabel,
                          {
                            color: theme.colors.textTertiary,
                            top: padding + (i / 5) * innerHeight - 8,
                          },
                        ]}
                      >
                        {value.toFixed(0)}
                      </Text>
                    );
                  });
                })()}
              </View>

              {/* Graph */}
              <View style={styles.graph}>
                <Svg width={graphWidth} height={graphHeight}>
                  <Defs>
                    <LinearGradient id="caloriesGradient" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0%" stopColor="#6EE7B7" />
                      <Stop offset="50%" stopColor="#10B981" />
                      <Stop offset="100%" stopColor="#22C55E" />
                    </LinearGradient>
                  </Defs>
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Line
                      key={i}
                      x1={padding}
                      y1={padding + (i / 5) * innerHeight}
                      x2={graphWidth - padding}
                      y2={padding + (i / 5) * innerHeight}
                      stroke={theme.colors.border}
                      strokeWidth={0.5}
                      strokeDasharray="2,2"
                    />
                  ))}

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
                        stroke="#10B981"
                        strokeWidth={1}
                        strokeDasharray="4,4"
                        opacity={0.5}
                      />
                    );
                  })()}

                  {/* Calories line path with left-to-right draw animation */}
                  {caloriesPath ? (
                    <AnimatedPath
                      d={caloriesPath}
                      fill="none"
                      stroke="url(#caloriesGradient)"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={`${LINE_DRAW_LENGTH}, ${LINE_DRAW_LENGTH}`}
                      strokeDashoffset={caloriesLineProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [LINE_DRAW_LENGTH, 0],
                      })}
                    />
                  ) : null}

                  {/* Data points */}
                  {caloriesData.map((entry, index) => {
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
                        fill="#10B981"
                      />
                    );
                  })}
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

            {/* Calories History Table */}
            {caloriesHistory.length > 0 && (
              <View style={[styles.historyContainer, { borderColor: theme.colors.border }]}>
                <Text style={[styles.historyTitle, { color: theme.colors.textPrimary }]}>
                  History
                </Text>
                <View style={styles.historyHeaderRow}>
                  <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary }]}>
                    Date
                  </Text>
                  <Text style={[styles.historyHeaderText, { color: theme.colors.textSecondary }]}>
                    Calories
                  </Text>
                  <View style={styles.historyHeaderSpacer} />
                </View>
                {caloriesHistory.map((entry) => (
                  <View key={entry.date.toISOString()} style={styles.historyRow}>
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
            {/* Daily Averages */}
            <View style={styles.averagesContainer}>
              <View style={styles.averageItem}>
                <View style={[styles.averageDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.averageLabel, { color: theme.colors.textSecondary }]}>Protein:</Text>
                <Text style={[styles.averageValue, { color: theme.colors.textPrimary }]}>
                  {averageProtein !== null ? `${averageProtein.toFixed(0)}g` : '--'}
                </Text>
              </View>
              <View style={styles.averageItem}>
                <View style={[styles.averageDot, { backgroundColor: '#FF7E67' }]} />
                <Text style={[styles.averageLabel, { color: theme.colors.textSecondary }]}>Carbs:</Text>
                <Text style={[styles.averageValue, { color: theme.colors.textPrimary }]}>
                  {averageCarbs !== null ? `${averageCarbs.toFixed(0)}g` : '--'}
                </Text>
              </View>
              <View style={styles.averageItem}>
                <View style={[styles.averageDot, { backgroundColor: '#40514E' }]} />
                <Text style={[styles.averageLabel, { color: theme.colors.textSecondary }]}>Fat:</Text>
                <Text style={[styles.averageValue, { color: theme.colors.textPrimary }]}>
                  {averageFat !== null ? `${averageFat.toFixed(0)}g` : '--'}
                </Text>
              </View>
            </View>

            <Animated.View style={[styles.graphCard, { backgroundColor: theme.colors.card, opacity: macrosChartOpacity }]}>
              {/* Y-axis labels */}
              <View style={styles.yAxisContainer}>
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const value = maxValue - (i / 5) * maxValue;
                  return (
                    <Text
                      key={i}
                      style={[
                        styles.yAxisLabel,
                        {
                          color: theme.colors.textTertiary,
                          top: padding + (i / 5) * innerHeight - 8,
                        },
                      ]}
                    >
                      {value.toFixed(0)}g
                    </Text>
                  );
                })}
              </View>

              {/* Graph */}
              <View style={styles.graph}>
                <Svg width={graphWidth} height={graphHeight}>
                  <Defs>
                    <LinearGradient id="proteinGradient" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0%" stopColor="#6EE7B7" />
                      <Stop offset="50%" stopColor="#10B981" />
                      <Stop offset="100%" stopColor="#22C55E" />
                    </LinearGradient>
                    <LinearGradient id="carbsGradient" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0%" stopColor="#FECDD3" />
                      <Stop offset="50%" stopColor="#FB7185" />
                      <Stop offset="100%" stopColor="#F97373" />
                    </LinearGradient>
                    <LinearGradient id="fatGradient" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0%" stopColor="#CBD5F5" />
                      <Stop offset="50%" stopColor="#64748B" />
                      <Stop offset="100%" stopColor="#475569" />
                    </LinearGradient>
                  </Defs>
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Line
                      key={i}
                      x1={padding}
                      y1={padding + (i / 5) * innerHeight}
                      x2={graphWidth - padding}
                      y2={padding + (i / 5) * innerHeight}
                      stroke={theme.colors.border}
                      strokeWidth={0.5}
                      strokeDasharray="2,2"
                    />
                  ))}

                  {/* Target lines */}
                  {targetProtein !== undefined && (() => {
                    const targetProteinY = padding + innerHeight - (targetProtein / maxValue) * innerHeight;
                    return (
                      <Line
                        x1={padding}
                        y1={targetProteinY}
                        x2={graphWidth - padding}
                        y2={targetProteinY}
                        stroke="#10B981"
                        strokeWidth={1}
                        strokeDasharray="4,4"
                        opacity={0.5}
                      />
                    );
                  })()}
                  {targetCarbs !== undefined && (() => {
                    const targetCarbsY = padding + innerHeight - (targetCarbs / maxValue) * innerHeight;
                    return (
                      <Line
                        x1={padding}
                        y1={targetCarbsY}
                        x2={graphWidth - padding}
                        y2={targetCarbsY}
                        stroke="#FF7E67"
                        strokeWidth={1}
                        strokeDasharray="4,4"
                        opacity={0.5}
                      />
                    );
                  })()}
                  {targetFat !== undefined && (() => {
                    const targetFatY = padding + innerHeight - (targetFat / maxValue) * innerHeight;
                    return (
                      <Line
                        x1={padding}
                        y1={targetFatY}
                        x2={graphWidth - padding}
                        y2={targetFatY}
                        stroke="#40514E"
                        strokeWidth={1}
                        strokeDasharray="4,4"
                        opacity={0.5}
                      />
                    );
                  })()}

                  {/* Protein line */}
                  {proteinPath ? (
                    <AnimatedPath
                      d={proteinPath}
                      fill="none"
                      stroke="url(#proteinGradient)"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={`${LINE_DRAW_LENGTH}, ${LINE_DRAW_LENGTH}`}
                      strokeDashoffset={macrosLineProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [LINE_DRAW_LENGTH, 0],
                      })}
                    />
                  ) : null}

                  {/* Carbs line */}
                  {carbsPath ? (
                    <AnimatedPath
                      d={carbsPath}
                      fill="none"
                      stroke="url(#carbsGradient)"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={`${LINE_DRAW_LENGTH}, ${LINE_DRAW_LENGTH}`}
                      strokeDashoffset={macrosLineProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [LINE_DRAW_LENGTH, 0],
                      })}
                    />
                  ) : null}

                  {/* Fat line */}
                  {fatPath ? (
                    <AnimatedPath
                      d={fatPath}
                      fill="none"
                      stroke="url(#fatGradient)"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={`${LINE_DRAW_LENGTH}, ${LINE_DRAW_LENGTH}`}
                      strokeDashoffset={macrosLineProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [LINE_DRAW_LENGTH, 0],
                      })}
                    />
                  ) : null}

                  {/* Data points */}
                  {graphData.map((entry, index) => {
                    const x = padding + (index / (graphData.length - 1 || 1)) * innerWidth;
                    
                    const proteinY = padding + innerHeight - (entry.protein / maxValue) * innerHeight;
                    const carbsY = padding + innerHeight - (entry.carbs / maxValue) * innerHeight;
                    const fatY = padding + innerHeight - (entry.fat / maxValue) * innerHeight;

                    return (
                      <React.Fragment key={index}>
                        <Circle cx={x} cy={proteinY} r={4} fill="#10B981" />
                        <Circle cx={x} cy={carbsY} r={4} fill="#FF7E67" />
                        <Circle cx={x} cy={fatY} r={4} fill="#40514E" />
                      </React.Fragment>
                    );
                  })}
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
                    <Text style={[styles.historyCellText, { color: '#10B981' }]}>
                      {`${entry.protein.toFixed(0)}g`}
                    </Text>
                    <Text style={[styles.historyCellText, { color: '#FF7E67' }]}>
                      {`${entry.carbs.toFixed(0)}g`}
                    </Text>
                    <Text style={[styles.historyCellText, { color: '#40514E' }]}>
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
          </View>
        )}

            {/* Information Box */}
            <View style={[styles.infoBox, { backgroundColor: theme.colors.input }]}>
              <Feather name="info" size={20} color="#10B981" />
              <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                Your protein intake is below target. Consider adding more lean protein to your meals.
              </Text>
            </View>
          </>
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
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.sm,
  },
  setGoalLink: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#10B981',
    marginBottom: 4,
  },
  setGoalText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    textAlign: 'center',
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
  averagesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  averageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  averageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  averageLabel: {
    fontSize: Typography.fontSize.sm,
  },
  averageValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
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
  yAxisContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: '100%',
  },
  yAxisLabel: {
    fontSize: Typography.fontSize.xs,
    position: 'absolute',
    right: 8,
  },
  graph: {
    marginLeft: 40,
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
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  timeRangeTextActive: {
    color: Colors.white,
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
});


