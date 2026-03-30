import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
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
  const theme = useTheme();

  const weeklyRemaining = Math.max(0, weeklyBudget - weeklyActual);
  const dayOfCycle = daysInCycle - remainingDays + 1;
  const progressPct = weeklyBudget > 0 ? Math.min(100, (weeklyActual / weeklyBudget) * 100) : 0;
  const isOver = weeklyActual > weeklyBudget;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="calendar" size={18} color={theme.colors.textPrimary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Weekly</Text>
        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginLeft: 'auto' }}>
          Day {dayOfCycle} of {daysInCycle}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.colors.input, overflow: 'hidden', marginBottom: 10 }}>
        <View style={{ height: '100%', borderRadius: 2, width: `${progressPct}%`, backgroundColor: '#22C55E' }} />
      </View>

      {/* Three-column stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statColumn}>
          <NumberTicker
            value={Math.round(weeklyActual)}
            duration={800}
            style={StyleSheet.flatten([styles.fractionText, { color: theme.colors.textPrimary }])}
          />
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Used</Text>
        </View>

        <View style={[styles.statColumn, styles.middleColumn]}>
          <NumberTicker
            value={Math.round(bankBalance)}
            duration={800}
            style={StyleSheet.flatten([styles.fractionText, { color: bankBalance > 0 ? '#22C55E' : theme.colors.textTertiary }])}
          />
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>In Bank</Text>
        </View>

        <View style={styles.statColumn}>
          <NumberTicker
            value={Math.round(weeklyRemaining)}
            duration={800}
            style={StyleSheet.flatten([styles.fractionText, { color: isOver ? '#EF4444' : '#10B981' }])}
          />
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Left</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: Platform.OS === 'android' ? 8 : 12,
    marginHorizontal: -16,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
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
    color: Colors.primaryText,
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
    borderLeftColor: Colors.lightBorder,
    borderRightColor: Colors.lightBorder,
    paddingHorizontal: 8,
  },
  fractionText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primaryText,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.normal,
    color: Colors.secondaryText,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.tight * Typography.fontSize.xs,
  },
});
