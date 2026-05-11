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

type ViewMode = 'today' | 'weekly';

interface MicronutrientCardProps {
  summariesByDate: Record<string, DailySummary>;
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

function formatValue(value: number, unit: MicroTarget['unit']): string {
  if (unit === 'g') return value < 10 ? value.toFixed(1) : Math.round(value).toString();
  return Math.round(value).toString();
}

export const MicronutrientCard: React.FC<MicronutrientCardProps> = ({ summariesByDate }) => {
  const theme = useTheme();
  const [mode, setMode] = useState<ViewMode>('today');
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

  const rows = useMemo<Row[]>(() => {
    if (!targets) return [];

    const today = new Date();
    const todayKey = today.toISOString().split('T')[0];

    // build the "values" object depending on mode
    const values: Partial<Record<keyof DailySummary, number>> = {};
    if (mode === 'today') {
      const s = summariesByDate[todayKey];
      ORDER.forEach(o => {
        values[o.summaryKey] = (s?.[o.summaryKey] as number) || 0;
      });
    } else {
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
      const daysWithData = dates.filter(k => summariesByDate[k] && (summariesByDate[k].entryCount || 0) > 0);
      const denom = Math.max(1, daysWithData.length);

      ORDER.forEach(o => {
        const sum = daysWithData.reduce(
          (acc, k) => acc + ((summariesByDate[k]?.[o.summaryKey] as number) || 0),
          0,
        );
        values[o.summaryKey] = sum / denom;
      });
    }

    return ORDER.map(o => {
      const actual = values[o.summaryKey] || 0;
      const target = targets[o.key];
      const status = statusFor(actual, target);
      const pct = percentOfTarget(actual, target);
      return { key: o.key, label: o.label, actual, target, status, pct };
    });
  }, [targets, summariesByDate, mode]);

  const handleInfo = () => {
    Alert.alert(
      'Micronutrients',
      'Tracks vitamins, minerals, fiber, and omega-3 from your food logs against personalized daily targets based on your age and sex.\n\nGreen means you are on track. Yellow means you are trending off. Red means deficient or way over a limit.\n\nThese are estimates from AI analysis of your meals. For medical concerns, see a doctor.',
    );
  };

  if (!targets) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Micronutrients</Text>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={handleInfo}>
            <Feather name="info" size={13} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.toggleWrap, { backgroundColor: theme.colors.input }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'today' && { backgroundColor: theme.colors.primary }]}
            onPress={() => setMode('today')}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: mode === 'today' ? theme.colors.primaryForeground : theme.colors.textSecondary }}>
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'weekly' && { backgroundColor: theme.colors.primary }]}
            onPress={() => setMode('weekly')}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: mode === 'weekly' ? theme.colors.primaryForeground : theme.colors.textSecondary }}>
              Daily average
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 16 }}>
        {mode === 'today' ? "Today's intake vs your targets" : 'Your daily average over the past 7 days'}
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
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  toggleWrap: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
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
