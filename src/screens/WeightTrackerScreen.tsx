import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { usePreferences } from '../contexts/PreferencesContext';
import { format, subDays, subMonths, subYears, startOfDay } from 'date-fns';
import Svg, { Path, Circle, Line } from 'react-native-svg';

interface WeightTrackerScreenProps {
  onBack: () => void;
  initialCurrentWeightKg?: number | null;
  targetWeightKg?: number | null;
  onRequestSetGoals?: () => void;
}

interface WeightEntry {
  date: Date;
  weight: number;
}

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y';

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

  // Sample weight data - in a real app, this would come from storage/API
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>(() => {
    if (typeof initialCurrentWeightKg === 'number' && !isNaN(initialCurrentWeightKg) && initialCurrentWeightKg > 0) {
      return [{ date: new Date(), weight: initialCurrentWeightKg }];
    }
    return [];
  });

  const hasEntries = weightEntries.length > 0;

  const [targetWeight, setTargetWeight] = useState<number | null>(
    typeof targetWeightKg === 'number' && !isNaN(targetWeightKg) ? targetWeightKg : null
  );

  const currentWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weight : null;
  const targetWeightValue = targetWeight ?? 0;
  const hasMultipleEntries = weightEntries.length >= 2;
  const startingWeight = weightEntries.length > 0 ? weightEntries[0].weight : null;
  const dropFromStart =
    hasMultipleEntries && startingWeight !== null && currentWeight !== null
      ? startingWeight - currentWeight
      : null;

  useEffect(() => {
    if (typeof initialCurrentWeightKg === 'number' && !isNaN(initialCurrentWeightKg) && initialCurrentWeightKg > 0) {
      setWeightEntries((prevEntries) => {
        if (prevEntries.length === 0) {
          return [{ date: new Date(), weight: initialCurrentWeightKg }];
        }

        const alreadyHasInitial = prevEntries.some(entry =>
          Math.abs(entry.weight - initialCurrentWeightKg) < 0.01
        );
        if (alreadyHasInitial) {
          return prevEntries;
        }

        return [
          ...prevEntries,
          { date: new Date(), weight: initialCurrentWeightKg },
        ];
      });
    }
  }, [initialCurrentWeightKg]);

  useEffect(() => {
    if (typeof targetWeightKg === 'number' && !isNaN(targetWeightKg) && targetWeightKg > 0) {
      setTargetWeight(targetWeightKg);
    }
  }, [targetWeightKg]);

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
        startDate = subYears(now, 1);
    }
    
    return weightEntries.filter(entry => entry.date >= startDate);
  };

  const filteredData = getFilteredData();
  const graphData = filteredData.length > 0 ? filteredData : weightEntries;
  const hasGraphData = graphData.length > 0;

  // Calculate graph dimensions and points
  const graphWidth = 300;
  const graphHeight = 260;
  const padding = 20;
  const innerWidth = graphWidth - padding * 2;
  const innerHeight = graphHeight - padding * 2;

  const minWeight = hasGraphData ? Math.min(...graphData.map(d => d.weight)) : 0;
  const maxWeight = hasGraphData ? Math.max(...graphData.map(d => d.weight)) : 1;
  const weightRange = hasGraphData ? Math.max(maxWeight - minWeight, 0) : 0;
  const weightPadding = hasGraphData ? Math.max(weightRange * 0.1, 1) : 1;
  const axisMinWeight = hasGraphData ? minWeight - weightPadding : 0;
  const axisMaxWeight = hasGraphData ? maxWeight + weightPadding : 5;
  const axisWeightRange = Math.max(axisMaxWeight - axisMinWeight, 1);

  // Compute "nice" Y-axis ticks based on current data
  const generateYAxisTicks = () => {
    const desiredTicks = 6;
    if (desiredTicks <= 1) {
      return [axisMinWeight];
    }

    const step = axisWeightRange / (desiredTicks - 1);
    return Array.from({ length: desiredTicks }, (_, i) => axisMinWeight + step * i);
  };

  const yAxisTicks = generateYAxisTicks();

  const getDateRange = () => {
    if (graphData.length === 0) return '';
    const start = graphData[0].date;
    const end = graphData[graphData.length - 1].date;
    return `${format(start, 'd MMM yyyy')} - ${format(end, 'd MMM yyyy')}`;
  };

  // NOTE: Keep all charts using smooth spline paths for visual consistency across the app.
  const generateSmoothPath = () => {
    if (graphData.length === 0) return '';

    const points = graphData.map((entry, index) => {
      const x = padding + (index / (graphData.length - 1 || 1)) * innerWidth;
      const normalizedWeight = (entry.weight - axisMinWeight) / axisWeightRange;
      const y = padding + innerHeight - (normalizedWeight * innerHeight);
      return { x, y };
    });

    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const prev = i > 0 ? points[i - 1] : current;
      const after = i < points.length - 2 ? points[i + 2] : next;

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

    return path;
  };

  const handleLogWeight = () => {
    const weight = parseFloat(logWeight);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight.');
      return;
    }

    // Convert from display unit to kg for storage
    const weightKg = convertWeightFromDisplay(weight, weightUnit);

    const newEntry: WeightEntry = {
      date: logDate,
      weight: weightKg, // Store in kg
    };

    setWeightEntries([...weightEntries, newEntry].sort((a, b) => a.date.getTime() - b.date.getTime()));
    setLogWeight('');
    setLogDate(new Date());
    setShowLogModal(false);
  };

  const timeRanges: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', '2Y'];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#14B8A6" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Weight Tracker</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!hasEntries && (
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
              style={[styles.emptyStateButton, { backgroundColor: '#14B8A6' }]}
              onPress={() => {
                if (onRequestSetGoals) {
                  onRequestSetGoals();
                } else {
                  setShowLogModal(true);
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyStateButtonText}>
                {onRequestSetGoals ? 'Set Goals' : 'Log Weight'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Weight Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
              {currentWeight !== null 
                ? `${convertWeightToDisplay(currentWeight).toFixed(1)} ${getWeightUnitLabel()}` 
                : '--'}
            </Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Current</Text>
          </View>
          <View style={styles.summaryItem}>
          <View style={styles.changeContainer}>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
                {dropFromStart !== null 
                  ? `${convertWeightToDisplay(Math.abs(dropFromStart)).toFixed(1)} ${getWeightUnitLabel()}` 
                  : '--'}
            </Text>
              {dropFromStart !== null && dropFromStart > 0.05 && (
              <Feather name="trending-down" size={16} color="#10B981" style={styles.trendIcon} />
            )}
              {dropFromStart !== null && dropFromStart < -0.05 && (
              <Feather name="trending-up" size={16} color="#F97316" style={styles.trendIcon} />
            )}
          </View>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Drop</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
            {targetWeightValue > 0 
              ? `${convertWeightToDisplay(targetWeightValue).toFixed(1)} ${getWeightUnitLabel()}` 
              : '--'}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Target</Text>
          </View>
        </View>

        {hasGraphData && (
          <>
            {/* Graph Section */}
            <View style={styles.graphContainer}>
              <View style={[styles.graphCard, { backgroundColor: theme.colors.card }]}>
                {/* Y-axis labels */}
                <View style={styles.yAxisContainer}>
                  {yAxisTicks.map((value, index) => {
                    const ratio = Math.max(0, Math.min(1, (value - axisMinWeight) / axisWeightRange));
                    return (
                      <Text
                        key={index}
                        style={[
                          styles.yAxisLabel,
                          {
                            color: theme.colors.textTertiary,
                            top: padding + innerHeight - (ratio * innerHeight) - 8,
                          },
                        ]}
                      >
                        {convertWeightToDisplay(value).toFixed(1)}
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

                    {/* Line path */}
                    <Path
                      d={generateSmoothPath()}
                      fill="none"
                      stroke="#14B8A6"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Data points */}
                    {graphData.map((entry, index) => {
                      const x = padding + (index / (graphData.length - 1 || 1)) * innerWidth;
                      const normalizedWeight = (entry.weight - axisMinWeight) / axisWeightRange;
                      const y = padding + innerHeight - (normalizedWeight * innerHeight);
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

            {/* Information Box */}
            <View style={[styles.infoBox, { backgroundColor: theme.colors.input }]}>
              <Feather name="info" size={20} color="#14B8A6" />
              <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                Your weight is fluctuating. Consider tracking hydration and sleep patterns.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Log Weight Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.logButton, { backgroundColor: '#14B8A6' }]}
          onPress={() => setShowLogModal(true)}
        >
          <Text style={styles.logButtonText}>Log Weight</Text>
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
                  <Feather name="x" size={24} color="#14B8A6" />
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
                style={[styles.modalButton, { backgroundColor: '#14B8A6' }]}
                onPress={handleLogWeight}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
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
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
  },
  headerRight: {
    width: 40,
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
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
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendIcon: {
    marginTop: 2,
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
  yAxisRightContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 40,
    height: '100%',
    alignItems: 'flex-end',
  },
  yAxisLabel: {
    fontSize: Typography.fontSize.xs,
    position: 'absolute',
    right: 8,
  },
  graph: {
    marginLeft: 40,
    marginRight: 40,
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
    color: Colors.white,
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
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
});


