import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { dataStorage, DailySummary } from '../services/dataStorage';
import {
  getMicroTargets,
  MicroTargetSet,
  MicroTarget,
  MicroStatus,
  percentOfTarget,
  statusFor,
} from '../utils/microTargets';

export type MicroTimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y';

interface MicronutrientCardProps {
  summariesByDate: Record<string, DailySummary>;
  timeRange: MicroTimeRange;
}

interface Row {
  key: keyof MicroTargetSet;
  label: string;
  actual: number;
  target: MicroTarget;
  status: MicroStatus;
  pct: number;
}

const STATUS_COLORS: Record<MicroStatus, string> = {
  deficient: '#EF4444',
  low: '#F59E0B',
  on_track: '#10B981',
  over: '#F59E0B',
  way_over: '#EF4444',
};

const ORDER: Array<{ key: keyof MicroTargetSet; label: string; summaryKey: keyof DailySummary }> = [
  // limits
  { key: 'sodium_mg', label: 'Sodium', summaryKey: 'totalSodium' },
  { key: 'added_sugars', label: 'Added sugar', summaryKey: 'totalAddedSugars' },
  { key: 'saturated_fat', label: 'Saturated fat', summaryKey: 'totalSaturatedFat' },
  { key: 'cholesterol_mg', label: 'Cholesterol', summaryKey: 'totalCholesterol' },
  // minerals
  { key: 'calcium_mg', label: 'Calcium', summaryKey: 'totalCalcium' },
  { key: 'iron_mg', label: 'Iron', summaryKey: 'totalIron' },
  { key: 'magnesium_mg', label: 'Magnesium', summaryKey: 'totalMagnesium' },
  { key: 'zinc_mg', label: 'Zinc', summaryKey: 'totalZinc' },
  { key: 'potassium_mg', label: 'Potassium', summaryKey: 'totalPotassium' },
  // fiber + omega
  { key: 'dietary_fiber', label: 'Fiber', summaryKey: 'totalFiber' },
  { key: 'omega_3_g', label: 'Omega-3', summaryKey: 'totalOmega3' },
  // vitamins
  { key: 'vitamin_a_mcg', label: 'Vitamin A', summaryKey: 'totalVitaminA' },
  { key: 'vitamin_c_mg', label: 'Vitamin C', summaryKey: 'totalVitaminC' },
  { key: 'vitamin_d_mcg', label: 'Vitamin D', summaryKey: 'totalVitaminD' },
  { key: 'vitamin_b12_mcg', label: 'Vitamin B12', summaryKey: 'totalVitaminB12' },
];

const RANGE_DAYS: Record<MicroTimeRange, number> = {
  '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730,
};

const RANGE_LABEL: Record<MicroTimeRange, string> = {
  '1D': 'today',
  '1W': 'past 7 days',
  '1M': 'past 30 days',
  '3M': 'past 90 days',
  '6M': 'past 6 months',
  '1Y': 'past year',
  '2Y': 'past 2 years',
};

function formatValue(value: number, unit: MicroTarget['unit']): string {
  if (unit === 'g') return value < 10 ? value.toFixed(1) : Math.round(value).toString();
  return Math.round(value).toString();
}

export const MicronutrientCard: React.FC<MicronutrientCardProps> = ({ summariesByDate, timeRange }) => {
  const theme = useTheme();
  const [targets, setTargets] = useState<MicroTargetSet | null>(null);

  useEffect(() => {
    let cancelled = false;
    dataStorage.loadGoals().then(goals => {
      if (cancelled) return;
      setTargets(
        getMicroTargets({
          age: goals?.age,
          sex: goals?.gender,
          proteinGramsOverride: goals?.proteinGrams,
        }),
      );
    });
    return () => { cancelled = true; };
  }, []);

  const { rows, loggedDaysInRange } = useMemo<{ rows: Row[]; loggedDaysInRange: number }>(() => {
    if (!targets) return { rows: [], loggedDaysInRange: 0 };

    const today = new Date();
    const todayKey = today.toISOString().split('T')[0];
    const rangeDays = RANGE_DAYS[timeRange];

    const values: Partial<Record<keyof DailySummary, number>> = {};
    let daysCounted = 0;

    if (timeRange === '1D') {
      const s = summariesByDate[todayKey];
      const hasData = !!s && (s.entryCount || 0) > 0;
      daysCounted = hasData ? 1 : 0;
      ORDER.forEach(o => {
        values[o.summaryKey] = (s?.[o.summaryKey] as number) || 0;
      });
    } else {
      const dates: string[] = [];
      for (let i = 0; i < rangeDays; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
      const daysWithData = dates.filter(k => summariesByDate[k] && (summariesByDate[k].entryCount || 0) > 0);
      daysCounted = daysWithData.length;
      const denom = Math.max(1, daysWithData.length);

      ORDER.forEach(o => {
        const sum = daysWithData.reduce(
          (acc, k) => acc + ((summariesByDate[k]?.[o.summaryKey] as number) || 0),
          0,
        );
        values[o.summaryKey] = sum / denom;
      });
    }

    const computedRows = ORDER.map(o => {
      const actual = values[o.summaryKey] || 0;
      const target = targets[o.key];
      const status = statusFor(actual, target);
      const pct = percentOfTarget(actual, target);
      return { key: o.key, label: o.label, actual, target, status, pct };
    });

    return { rows: computedRows, loggedDaysInRange: daysCounted };
  }, [targets, summariesByDate, timeRange]);

  const handleInfo = () => {
    Alert.alert(
      'Micronutrients',
      'Tracks vitamins, minerals, fiber, and omega-3 from your food logs against personalized daily targets based on your age and sex.\n\nGreen means you are on track. Yellow means you are trending off. Red means deficient or way over a limit.\n\nThe range follows the filter at the top of the screen. For 1D, this shows today\'s intake. For longer ranges, it shows your daily average across the logged days in that window.\n\nThese are estimates from AI analysis of your meals. For medical concerns, see a doctor.',
    );
  };

  if (!targets) return null;

  // Subtitle copy that reflects the actual time window and data availability.
  const expectedDays = RANGE_DAYS[timeRange];
  const sparse = timeRange !== '1D' && loggedDaysInRange > 0 && loggedDaysInRange < expectedDays;
  let subtitle = '';
  if (timeRange === '1D') {
    subtitle = "Today's intake vs your targets";
  } else if (loggedDaysInRange === 0) {
    subtitle = `No food logged in the ${RANGE_LABEL[timeRange]} yet`;
  } else if (sparse) {
    subtitle = `Daily average across your ${loggedDaysInRange} logged ${loggedDaysInRange === 1 ? 'day' : 'days'} in the ${RANGE_LABEL[timeRange]}`;
  } else {
    subtitle = `Daily average across the ${RANGE_LABEL[timeRange]}`;
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Micronutrients</Text>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={handleInfo}>
          <Feather name="info" size={13} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 16 }}>
        {subtitle}
      </Text>

      <View style={{ gap: 10 }}>
        {rows.map(row => {
          const barColor = STATUS_COLORS[row.status];
          const barWidth = Math.min(100, row.pct);
          const limitOver = row.target.kind === 'limit' && row.pct > 100;

          return (
            <View key={row.key} style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>{row.label}</Text>

              <View style={{ flex: 1, paddingHorizontal: 10 }}>
                <View style={[styles.barTrack, { backgroundColor: theme.colors.input }]}>
                  <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
                </View>
              </View>

              <View style={styles.rowValue}>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                  {formatValue(row.actual, row.target.unit)} / {formatValue(row.target.value, row.target.unit)}{row.target.unit}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: barColor }}>
                  {limitOver ? `${row.pct}% of limit` : `${row.pct}%`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={[styles.disclaimer, { color: theme.colors.textTertiary }]}>
        Estimates from your food log. For medical concerns, talk to a doctor.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    width: 100,
    fontSize: 13,
    fontWeight: '500',
  },
  rowValue: {
    width: 90,
    alignItems: 'flex-end',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  disclaimer: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 14,
    textAlign: 'center',
  },
});
