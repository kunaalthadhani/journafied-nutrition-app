import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { CalorieBankCompletedCycle } from '../services/dataStorage';

interface CycleResetCardProps {
  cycle: CalorieBankCompletedCycle;
  onDismiss: () => void;
}

export const CycleResetCard: React.FC<CycleResetCardProps> = ({ cycle, onDismiss }) => {
  const theme = useTheme();

  const usedPct = cycle.weeklyBudget > 0
    ? Math.round((cycle.weeklyActual / cycle.weeklyBudget) * 100)
    : 0;

  const overUnder = cycle.weeklyActual - cycle.weeklyBudget;
  const isOver = overUnder > 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Weekly Summary</Text>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Feather name="x" size={18} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.mainStat, { color: theme.colors.textPrimary }]}>
        You used {Math.round(cycle.weeklyActual).toLocaleString()} of {Math.round(cycle.weeklyBudget).toLocaleString()} kcal
      </Text>

      {cycle.expiredCalories > 0 && (
        <Text style={[styles.subStat, { color: theme.colors.textSecondary }]}>
          {Math.round(cycle.expiredCalories).toLocaleString()} kcal expired unused
        </Text>
      )}

      {isOver && (
        <Text style={[styles.subStat, { color: '#EF4444' }]}>
          {Math.round(overUnder).toLocaleString()} kcal over budget
        </Text>
      )}

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={[styles.detailValue, { color: theme.colors.textPrimary }]}>{cycle.bankUtilization}%</Text>
          <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>Bank used</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.detailValue, { color: theme.colors.textPrimary }]}>{cycle.daysLogged}/{cycle.daysInCycle}</Text>
          <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>Days logged</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.detailValue, { color: theme.colors.textPrimary }]}>{usedPct}%</Text>
          <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>Budget used</Text>
        </View>
      </View>

      <Text style={[styles.footer, { color: theme.colors.textTertiary }]}>
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
  footer: {
    fontSize: 12,
    textAlign: 'center',
  },
});
