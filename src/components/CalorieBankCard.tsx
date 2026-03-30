import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../constants/theme';
import { CalorieBankCycle, getDayName } from '../utils/calorieBankEngine';

interface CalorieBankCardProps {
  cycle: CalorieBankCycle;
}

export const CalorieBankCard: React.FC<CalorieBankCardProps> = ({ cycle }) => {
  const theme = useTheme();

  const {
    weeklyBudget,
    weeklyActual,
    bankBalance,
    adjustedTodayTarget,
    remainingBudget,
    remainingDays,
    perDayData,
    daysInCycle,
    goalType,
  } = cycle;

  const progressPct = weeklyBudget > 0 ? Math.min(100, (weeklyActual / weeklyBudget) * 100) : 0;
  const dayOfCycle = daysInCycle - remainingDays + 1;

  // Language adapts to goal type
  const bankedLabel = goalType === 'gain' ? 'Surplus' : 'Banked';

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Calorie Bank</Text>
        <Text style={[styles.dayCounter, { color: theme.colors.textSecondary }]}>
          Day {dayOfCycle} of {daysInCycle}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progressPct}%`,
              backgroundColor: progressPct > 100 ? '#EF4444' : theme.colors.primary,
            },
          ]}
        />
      </View>
      <Text style={[styles.progressLabel, { color: theme.colors.textSecondary }]}>
        {Math.round(weeklyActual).toLocaleString()} / {Math.round(weeklyBudget).toLocaleString()} kcal
      </Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: bankBalance > 0 ? '#22C55E' : theme.colors.textPrimary }]}>
            +{Math.round(bankBalance)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textTertiary }]}>{bankedLabel}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
            {Math.round(adjustedTodayTarget).toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textTertiary }]}>Today</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
            {Math.round(remainingBudget).toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textTertiary }]}>Remaining</Text>
        </View>
      </View>

      {/* Mini week bars */}
      <View style={styles.weekBars}>
        {perDayData.map((day, i) => {
          const dayDate = new Date(day.date);
          const dayLabel = getDayName(dayDate.getDay()).charAt(0);
          const barHeight = day.isFuture
            ? 0
            : day.baseTarget > 0
              ? Math.min(1, day.actual / day.baseTarget)
              : 0;

          let barColor = theme.colors.border;
          if (!day.isFuture && day.logged) {
            if (day.actual <= day.adjustedTarget) {
              barColor = '#22C55E'; // on/under target
            } else {
              barColor = '#F59E0B'; // over target but within spending cap
              if (day.spendCapHit) barColor = '#EF4444'; // over spending cap
            }
          }

          return (
            <View key={day.date} style={styles.weekBarCol}>
              <View style={[styles.weekBarTrack, { backgroundColor: theme.colors.border + '40' }]}>
                {!day.isFuture && (
                  <View
                    style={[
                      styles.weekBarFill,
                      {
                        height: `${Math.max(barHeight * 100, day.logged ? 8 : 0)}%`,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                )}
              </View>
              <Text style={[
                styles.weekBarLabel,
                {
                  color: day.isToday ? theme.colors.textPrimary : theme.colors.textTertiary,
                  fontWeight: day.isToday ? '700' : '400',
                },
              ]}>
                {dayLabel}
              </Text>
            </View>
          );
        })}
      </View>
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
  dayCounter: {
    fontSize: 13,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  weekBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekBarTrack: {
    width: '100%',
    height: 32,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  weekBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  weekBarLabel: {
    fontSize: 10,
  },
});
