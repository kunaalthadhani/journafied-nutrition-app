import React, { useState } from 'react';
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
import { format, subDays, subMonths, subYears, startOfDay } from 'date-fns';
import Svg, { Path, Circle, Line } from 'react-native-svg';

interface WeightTrackerScreenProps {
  onBack: () => void;
}

interface WeightEntry {
  date: Date;
  weight: number;
}

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y';

export const WeightTrackerScreen: React.FC<WeightTrackerScreenProps> = ({ onBack }) => {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [showLogModal, setShowLogModal] = useState(false);
  const [logWeight, setLogWeight] = useState('');
  const [logDate, setLogDate] = useState(new Date());

  // Sample weight data - in a real app, this would come from storage/API
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([
    { date: subDays(new Date(), 365), weight: 64.5 },
    { date: subDays(new Date(), 340), weight: 64.2 },
    { date: subDays(new Date(), 300), weight: 63.8 },
    { date: subDays(new Date(), 270), weight: 63.5 },
    { date: subDays(new Date(), 240), weight: 63.2 },
    { date: subDays(new Date(), 210), weight: 63.0 },
    { date: subDays(new Date(), 180), weight: 62.8 },
    { date: subDays(new Date(), 150), weight: 62.5 },
    { date: subDays(new Date(), 120), weight: 62.3 },
    { date: subDays(new Date(), 90), weight: 62.0 },
    { date: subDays(new Date(), 60), weight: 61.8 },
    { date: subDays(new Date(), 30), weight: 61.5 },
    { date: subDays(new Date(), 7), weight: 61.3 },
    { date: new Date(), weight: 61.2 },
  ]);

  const targetWeight = 60;
  const currentWeight = weightEntries[weightEntries.length - 1]?.weight || 0;
  const firstWeight = weightEntries[0]?.weight || currentWeight;
  const weightChange = currentWeight - firstWeight;
  const averageWeight = weightEntries.length > 0
    ? weightEntries.reduce((sum, entry) => sum + entry.weight, 0) / weightEntries.length
    : 0;

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

  // Calculate graph dimensions and points
  const graphWidth = 300;
  const graphHeight = 260;
  const padding = 20;
  const innerWidth = graphWidth - padding * 2;
  const innerHeight = graphHeight - padding * 2;

  const minWeight = Math.min(...graphData.map(d => d.weight));
  const maxWeight = Math.max(...graphData.map(d => d.weight));
  const weightRange = maxWeight - minWeight || 1;
  const weightPadding = weightRange * 0.1;

  const getDateRange = () => {
    if (graphData.length === 0) return '';
    const start = graphData[0].date;
    const end = graphData[graphData.length - 1].date;
    return `${format(start, 'd MMM yyyy')} - ${format(end, 'd MMM yyyy')}`;
  };

  // Generate path for line chart
  const generatePath = () => {
    if (graphData.length === 0) return '';
    
    const points = graphData.map((entry, index) => {
      const x = padding + (index / (graphData.length - 1 || 1)) * innerWidth;
      const normalizedWeight = (entry.weight - minWeight + weightPadding) / (weightRange + weightPadding * 2);
      const y = padding + innerHeight - (normalizedWeight * innerHeight);
      return { x, y, weight: entry.weight };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  const handleLogWeight = () => {
    const weight = parseFloat(logWeight);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight.');
      return;
    }

    const newEntry: WeightEntry = {
      date: logDate,
      weight: weight,
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
        {/* Weight Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
              {averageWeight.toFixed(1)} kg
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Average</Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={styles.changeContainer}>
              <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
                {weightChange >= 0 ? '+' : ''}{weightChange.toFixed(1)}kg
              </Text>
              {weightChange < 0 && (
                <Feather name="trending-down" size={16} color="#10B981" style={styles.trendIcon} />
              )}
            </View>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Drop</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
              {targetWeight} kg
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Target</Text>
          </View>
        </View>

        {/* Graph Section */}
        <View style={styles.graphContainer}>
            <View style={[styles.graphCard, { backgroundColor: theme.colors.card }]}>
              {/* Y-axis labels */}
              <View style={styles.yAxisContainer}>
                {[64.0, 63.5, 63.0, 62.5, 62.0, 61.5].map((value, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.yAxisLabel,
                      {
                        color: theme.colors.textTertiary,
                        top: padding + (index / 5) * innerHeight - 8,
                      },
                    ]}
                  >
                    {value.toFixed(1)}
                  </Text>
                ))}
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
                    d={generatePath()}
                    fill="none"
                    stroke="#14B8A6"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data points */}
                  {graphData.map((entry, index) => {
                    const x = padding + (index / (graphData.length - 1 || 1)) * innerWidth;
                    const normalizedWeight = (entry.weight - minWeight + weightPadding) / (weightRange + weightPadding * 2);
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

              {/* Right Y-axis labels (BMI or secondary metric) */}
              <View style={styles.yAxisRightContainer}>
                {[29.5, 29.0, 28.5, 28.0, 27.5, 27.0].map((value, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.yAxisLabel,
                      {
                        color: theme.colors.textTertiary,
                        top: padding + (index / 5) * innerHeight - 8,
                      },
                    ]}
                  >
                    {value.toFixed(1)}
                  </Text>
                ))}
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
                placeholder="Enter weight (kg)"
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


