import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Acid } from '../constants/acid';
import { dataStorage, DailySummary } from '../services/dataStorage';
import { ChartRange, getRangeWindow, rangeLabel } from '../utils/chartRange';
import {
  getMicroTargets,
  MicroTargetSet,
  MicroTarget,
  MicroStatus,
  percentOfTarget,
  statusFor,
} from '../utils/microTargets';

interface MicronutrientCardProps {
  summariesByDate: Record<string, DailySummary>;
  timeRange: ChartRange;
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
  deficient: Acid.error,
  low: Acid.carbs,
  on_track: Acid.good,
  over: Acid.carbs,
  way_over: Acid.error,
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

function formatValue(value: number, unit: MicroTarget['unit']): string {
  if (unit === 'g') return value < 10 ? value.toFixed(1) : Math.round(value).toString();
  return Math.round(value).toString();
}

export const MicronutrientCard: React.FC<MicronutrientCardProps> = ({ summariesByDate, timeRange }) => {
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

    // Same shared window as every other chart on the screen, with LOCAL day
    // keys. The old UTC keys made "today" resolve to yesterday before 4am in
    // UAE and skewed the averages.
    const window = getRangeWindow(timeRange);
    const dates: string[] = [];
    for (let d = new Date(window.start); d <= window.end; d.setDate(d.getDate() + 1)) {
      dates.push(format(d, 'yyyy-MM-dd'));
    }
    const daysWithData = dates.filter(k => summariesByDate[k] && (summariesByDate[k].entryCount || 0) > 0);
    const daysCounted = daysWithData.length;
    const denom = Math.max(1, daysWithData.length);

    const values: Partial<Record<keyof DailySummary, number>> = {};
    ORDER.forEach(o => {
      const sum = daysWithData.reduce(
        (acc, k) => acc + ((summariesByDate[k]?.[o.summaryKey] as number) || 0),
        0,
      );
      values[o.summaryKey] = sum / denom;
    });

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
      'Tracks vitamins, minerals, fiber, and omega-3 from your food logs against personalized daily targets based on your age and sex.\n\nGreen means you are on track. Yellow means you are trending off. Red means deficient or way over a limit.\n\nThe range follows the filter at the top of the screen and shows your daily average across the logged days in that window.\n\nThese are estimates from AI analysis of your meals. For medical concerns, see a doctor.',
    );
  };

  if (!targets) return null;

  // Subtitle copy that reflects the actual time window and data availability.
  let subtitle = '';
  if (loggedDaysInRange === 0) {
    subtitle = `No food logged in the ${rangeLabel(timeRange)} yet`;
  } else {
    subtitle = `Daily average across your ${loggedDaysInRange} logged ${loggedDaysInRange === 1 ? 'day' : 'days'} in the ${rangeLabel(timeRange)}`;
  }

  return (
    <View style={[styles.card, { backgroundColor: Acid.mossDeep }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: Acid.tx }]}>Micronutrients</Text>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={handleInfo}>
          <Feather name="info" size={13} color={Acid.tx3} />
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 12, color: Acid.tx2, marginBottom: 16 }}>
        {subtitle}
      </Text>

      <View style={{ gap: 10 }}>
        {rows.map(row => {
          const barColor = STATUS_COLORS[row.status];
          const barWidth = Math.min(100, row.pct);
          const limitOver = row.target.kind === 'limit' && row.pct > 100;

          return (
            <View key={row.key} style={styles.row}>
              <Text style={[styles.rowLabel, { color: Acid.tx }]}>{row.label}</Text>

              <View style={{ flex: 1, paddingHorizontal: 10 }}>
                <View style={[styles.barTrack, { backgroundColor: Acid.mossDeep }]}>
                  <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
                </View>
              </View>

              <View style={styles.rowValue}>
                <Text style={{ fontSize: 11, color: Acid.tx2 }}>
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

      <Text style={[styles.disclaimer, { color: Acid.tx3 }]}>
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
