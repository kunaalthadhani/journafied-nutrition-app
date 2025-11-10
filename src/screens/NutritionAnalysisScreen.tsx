import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { format, subDays, subMonths, subYears } from 'date-fns';
import Svg, { Path, Circle, Line } from 'react-native-svg';

interface NutritionAnalysisScreenProps {
  onBack: () => void;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
}

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y';
type TabType = 'Calories' | 'Macros';

interface DailyNutrition {
  date: Date;
  protein: number;
  fat: number;
  carbs: number;
}

export const NutritionAnalysisScreen: React.FC<NutritionAnalysisScreenProps> = ({
  onBack,
  targetCalories: targetCaloriesProp,
  targetProtein: targetProteinProp,
  targetCarbs: targetCarbsProp,
  targetFat: targetFatProp,
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('Calories');
  const [timeRange, setTimeRange] = useState<TimeRange>('1W');

  // Sample nutrition data - in a real app, this would come from storage/API
  const [nutritionData] = useState<DailyNutrition[]>([
    { date: subDays(new Date(), 6), protein: 85, fat: 45, carbs: 120 },
    { date: subDays(new Date(), 5), protein: 92, fat: 50, carbs: 135 },
    { date: subDays(new Date(), 4), protein: 78, fat: 42, carbs: 110 },
    { date: subDays(new Date(), 3), protein: 95, fat: 48, carbs: 145 },
    { date: subDays(new Date(), 2), protein: 88, fat: 46, carbs: 125 },
    { date: subDays(new Date(), 1), protein: 90, fat: 47, carbs: 130 },
    { date: new Date(), protein: 87, fat: 44, carbs: 128 },
  ]);

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
  const graphData = filteredData.length > 0 ? filteredData : nutritionData;

  // Target values (in grams) - in a real app, these would come from saved goals
  const targetProtein = targetProteinProp && targetProteinProp > 0 ? targetProteinProp : undefined;
  const targetCarbs = targetCarbsProp && targetCarbsProp > 0 ? targetCarbsProp : undefined;
  const targetFat = targetFatProp && targetFatProp > 0 ? targetFatProp : undefined;

  // Calculate averages
  const averageProtein = graphData.length > 0
    ? graphData.reduce((sum, entry) => sum + entry.protein, 0) / graphData.length
    : 0;
  const averageCarbs = graphData.length > 0
    ? graphData.reduce((sum, entry) => sum + entry.carbs, 0) / graphData.length
    : 0;
  const averageFat = graphData.length > 0
    ? graphData.reduce((sum, entry) => sum + entry.fat, 0) / graphData.length
    : 0;

  const averageCalories = Math.round(
    graphData.reduce((sum, entry) => {
      const calories = (entry.protein * 4) + (entry.carbs * 4) + (entry.fat * 9);
      return sum + calories;
    }, 0) / graphData.length
  );
  const targetCalories = targetCaloriesProp && targetCaloriesProp > 0 ? targetCaloriesProp : undefined;
  const hasTargetCalories = targetCalories !== undefined;

  // Calculate graph dimensions
  const graphWidth = 300;
  const graphHeight = 260;
  const padding = 20;
  const innerWidth = graphWidth - padding * 2;
  const innerHeight = graphHeight - padding * 2;

  // Find max value across all macronutrients for Y-axis scaling
  const maxProtein = Math.max(...graphData.map(d => d.protein), targetProtein ?? 0);
  const maxCarbs = Math.max(...graphData.map(d => d.carbs), targetCarbs ?? 0);
  const maxFat = Math.max(...graphData.map(d => d.fat), targetFat ?? 0);
  const maxValue = Math.ceil(Math.max(maxProtein, maxCarbs, maxFat) / 25) * 25; // Round up to nearest 25

  const getDateRange = () => {
    if (graphData.length === 0) return '';
    const start = graphData[0].date;
    const end = graphData[graphData.length - 1].date;
    return `${format(start, 'd MMM yyyy')} - ${format(end, 'd MMM yyyy')}`;
  };

  // Calculate calories for each day
  const caloriesData = graphData.map(entry => ({
    date: entry.date,
    calories: (entry.protein * 4) + (entry.carbs * 4) + (entry.fat * 9),
  }));

  const minCalories = Math.min(...caloriesData.map(d => d.calories));
  const maxCalories = Math.max(...caloriesData.map(d => d.calories));
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

  const timeRanges: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', '2Y'];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#14B8A6" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          Nutrition Analysis
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Calorie Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
              {averageCalories} Kcal
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Average</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
              {hasTargetCalories ? `${targetCalories} Kcal` : '--'}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Target</Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.input }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'Calories' && { backgroundColor: '#14B8A6' },
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
              activeTab === 'Macros' && { backgroundColor: '#14B8A6' },
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
            <View style={[styles.graphCard, { backgroundColor: theme.colors.card }]}>
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
                        stroke="#14B8A6"
                        strokeWidth={1}
                        strokeDasharray="4,4"
                        opacity={0.5}
                      />
                    );
                  })()}

                  {/* Calories line path */}
                  <Path
                    d={generateCaloriesPath()}
                    fill="none"
                    stroke="#14B8A6"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

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
                        fill="#14B8A6"
                      />
                    );
                  })}
                </Svg>
              </View>
            </View>

            {/* Time Range Selector */}
            <View style={styles.timeRangeContainer}>
              {timeRanges.map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.timeRangeButton,
                    timeRange === range && { backgroundColor: '#14B8A6' },
                  ]}
                  onPress={() => setTimeRange(range)}
                >
                  <Text
                    style={[
                      styles.timeRangeText,
                      {
                        color: timeRange === range ? Colors.white : theme.colors.textSecondary,
                      },
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
          </View>
        )}

        {/* Macros Chart Section */}
        {activeTab === 'Macros' && (
          <View style={styles.graphContainer}>
            {/* Daily Averages */}
            <View style={styles.averagesContainer}>
              <View style={styles.averageItem}>
                <View style={[styles.averageDot, { backgroundColor: '#14B8A6' }]} />
                <Text style={[styles.averageLabel, { color: theme.colors.textSecondary }]}>Protein:</Text>
                <Text style={[styles.averageValue, { color: theme.colors.textPrimary }]}>
                  {averageProtein.toFixed(0)}g
                </Text>
              </View>
              <View style={styles.averageItem}>
                <View style={[styles.averageDot, { backgroundColor: '#FF7E67' }]} />
                <Text style={[styles.averageLabel, { color: theme.colors.textSecondary }]}>Carbs:</Text>
                <Text style={[styles.averageValue, { color: theme.colors.textPrimary }]}>
                  {averageCarbs.toFixed(0)}g
                </Text>
              </View>
              <View style={styles.averageItem}>
                <View style={[styles.averageDot, { backgroundColor: '#40514E' }]} />
                <Text style={[styles.averageLabel, { color: theme.colors.textSecondary }]}>Fat:</Text>
                <Text style={[styles.averageValue, { color: theme.colors.textPrimary }]}>
                  {averageFat.toFixed(0)}g
                </Text>
              </View>
            </View>

            <View style={[styles.graphCard, { backgroundColor: theme.colors.card }]}>
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
                        stroke="#14B8A6"
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
                  <Path
                    d={generateSmoothPath(graphData.map(d => d.protein))}
                    fill="none"
                    stroke="#14B8A6"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Carbs line */}
                  <Path
                    d={generateSmoothPath(graphData.map(d => d.carbs))}
                    fill="none"
                    stroke="#FF7E67"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Fat line */}
                  <Path
                    d={generateSmoothPath(graphData.map(d => d.fat))}
                    fill="none"
                    stroke="#40514E"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data points */}
                  {graphData.map((entry, index) => {
                    const x = padding + (index / (graphData.length - 1 || 1)) * innerWidth;
                    
                    const proteinY = padding + innerHeight - (entry.protein / maxValue) * innerHeight;
                    const carbsY = padding + innerHeight - (entry.carbs / maxValue) * innerHeight;
                    const fatY = padding + innerHeight - (entry.fat / maxValue) * innerHeight;

                    return (
                      <React.Fragment key={index}>
                        <Circle cx={x} cy={proteinY} r={4} fill="#14B8A6" />
                        <Circle cx={x} cy={carbsY} r={4} fill="#FF7E67" />
                        <Circle cx={x} cy={fatY} r={4} fill="#40514E" />
                      </React.Fragment>
                    );
                  })}
                </Svg>
              </View>
            </View>

            {/* Time Range Selector */}
            <View style={styles.timeRangeContainer}>
              {timeRanges.map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.timeRangeButton,
                    timeRange === range && { backgroundColor: '#14B8A6' },
                  ]}
                  onPress={() => setTimeRange(range)}
                >
                  <Text
                    style={[
                      styles.timeRangeText,
                      {
                        color: timeRange === range ? Colors.white : theme.colors.textSecondary,
                      },
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
          </View>
        )}

        {/* Information Box */}
        <View style={[styles.infoBox, { backgroundColor: theme.colors.input }]}>
          <Feather name="info" size={20} color="#14B8A6" />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            Your protein intake is below target. Consider adding more lean protein to your meals.
          </Text>
        </View>
      </ScrollView>
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
  },
  timeRangeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  dateRange: {
    textAlign: 'center',
    fontSize: Typography.fontSize.sm,
    marginBottom: 24,
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
});

