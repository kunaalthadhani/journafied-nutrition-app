import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Acid } from '../constants/acid';
import { NumberTicker } from './NumberTicker';

interface CalorieBankWeeklyCardProps {
  weeklyBudget: number;
  weeklyActual: number;
  bankBalance: number;
  remainingDays: number;
  daysInCycle: number;
}

export const CalorieBankWeeklyCard: React.FC<CalorieBankWeeklyCardProps> = ({
  weeklyBudget = 14000,
  weeklyActual = 0,
  bankBalance = 0,
  remainingDays = 7,
  daysInCycle = 7,
}) => {
  const weeklyRemaining = Math.max(0, weeklyBudget - weeklyActual);
  const dayOfCycle = daysInCycle - remainingDays + 1;
  const progressPct = weeklyBudget > 0 ? Math.min(100, (weeklyActual / weeklyBudget) * 100) : 0;
  const isOver = weeklyActual > weeklyBudget;

  return (
    <View style={[styles.container, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair, shadowColor: '#000' }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="calendar" size={18} color={Acid.tx} />
        </View>
        <Text style={[styles.title, { color: Acid.tx }]}>Weekly</Text>
        <Text style={{ fontSize: 11, color: Acid.tx3, marginLeft: 'auto' }}>
          Day {dayOfCycle} of {daysInCycle}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={{ height: 4, borderRadius: 2, backgroundColor: Acid.mossDeep, overflow: 'hidden', marginBottom: 10 }}>
        <View style={{ height: '100%', borderRadius: 2, width: `${progressPct}%`, backgroundColor: Acid.good }} />
      </View>

      {/* Three-column stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statColumn} accessible accessibilityLabel={`Used, ${Math.round(weeklyActual)} calories`}>
          <NumberTicker
            value={Math.round(weeklyActual)}
            duration={800}
            style={StyleSheet.flatten([styles.fractionText, { color: Acid.tx }])}
          />
          <Text style={[styles.statLabel, { color: Acid.tx2 }]}>Used</Text>
        </View>

        <View style={[styles.statColumn, styles.middleColumn]} accessible accessibilityLabel={`In bank, ${Math.round(bankBalance)} calories`}>
          <NumberTicker
            value={Math.round(bankBalance)}
            duration={800}
            style={StyleSheet.flatten([styles.fractionText, { color: bankBalance > 0 ? Acid.good : Acid.tx3 }])}
          />
          <Text style={[styles.statLabel, { color: Acid.tx2 }]}>In Bank</Text>
        </View>

        <View
          style={styles.statColumn}
          accessible
          accessibilityLabel={`${isOver ? 'Over budget by' : 'Left'}, ${Math.round(weeklyRemaining)} calories`}
        >
          <NumberTicker
            value={Math.round(weeklyRemaining)}
            duration={800}
            style={StyleSheet.flatten([styles.fractionText, { color: isOver ? Acid.error : Acid.good }])}
          />
          <Text style={[styles.statLabel, { color: Acid.tx2 }]}>Left</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Acid.mossDeep,
    borderRadius: 12,
    padding: Platform.OS === 'android' ? 8 : 12,
    marginHorizontal: -16,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: Acid.hair,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? 8 : 12,
  },
  iconContainer: {
    marginRight: 8,
  },
  title: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Acid.tx,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 50,
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
  middleColumn: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: Acid.hair,
    borderRightColor: Acid.hair,
    paddingHorizontal: 8,
  },
  fractionText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Acid.tx,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.normal,
    color: Acid.tx2,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.tight * Typography.fontSize.xs,
  },
});
