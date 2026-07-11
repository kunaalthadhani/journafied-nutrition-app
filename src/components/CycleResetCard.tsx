import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { CalorieBankCompletedCycle } from '../services/dataStorage';

interface CycleResetCardProps {
  cycle: CalorieBankCompletedCycle;
  onDismiss: () => void;
}

export const CycleResetCard: React.FC<CycleResetCardProps> = ({ cycle, onDismiss }) => {
  const usedPct = cycle.weeklyBudget > 0
    ? Math.round((cycle.weeklyActual / cycle.weeklyBudget) * 100)
    : 0;

  const overUnder = cycle.weeklyActual - cycle.weeklyBudget;
  const isOver = overUnder > 0;

  // One forward-looking line keyed off how the week actually went, so the recap
  // coaches the next cycle instead of only scoring the last one.
  const coachLine = isOver
    ? 'You ran over budget. Plan your heavier days earlier so the bank can absorb them.'
    : cycle.bankUtilization < 30 && cycle.expiredCalories > 200
      ? 'You banked plenty but barely spent it. Use that room next week, the flexibility is the point.'
      : cycle.daysLogged < cycle.daysInCycle
        ? 'A few days went unlogged. Logging every day makes the bank work for you.'
        : 'Balanced week. Keep the rhythm going.';

  return (
    <View style={[styles.card, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: Acid.tx }]}>Weekly Summary</Text>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Feather name="x" size={18} color={Acid.tx3} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.mainStat, { color: Acid.tx }]}>
        You used {Math.round(cycle.weeklyActual).toLocaleString()} of {Math.round(cycle.weeklyBudget).toLocaleString()} kcal
      </Text>

      {cycle.expiredCalories > 0 && (
        <Text style={[styles.subStat, { color: Acid.tx2 }]}>
          {Math.round(cycle.expiredCalories).toLocaleString()} kcal went unused
        </Text>
      )}

      {isOver && (
        <Text style={[styles.subStat, { color: Acid.error }]}>
          {Math.round(overUnder).toLocaleString()} kcal over budget
        </Text>
      )}

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={[styles.detailValue, { color: Acid.tx }]}>{cycle.bankUtilization}%</Text>
          <Text style={[styles.detailLabel, { color: Acid.tx3 }]}>Bank used</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.detailValue, { color: Acid.tx }]}>{cycle.daysLogged}/{cycle.daysInCycle}</Text>
          <Text style={[styles.detailLabel, { color: Acid.tx3 }]}>Days logged</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.detailValue, { color: Acid.tx }]}>{usedPct}%</Text>
          <Text style={[styles.detailLabel, { color: Acid.tx3 }]}>Budget used</Text>
        </View>
      </View>

      <Text style={[styles.coach, { color: Acid.tx }]}>
        {coachLine}
      </Text>

      <Text style={[styles.footer, { color: Acid.tx3 }]}>
        Your new cycle starts today
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  dismissBtn: {
    padding: 4,
  },
  mainStat: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  subStat: {
    fontSize: 13,
    marginBottom: 4,
  },
  detailsRow: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 12,
    gap: 8,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  coach: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 10,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
  },
});
