import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Acid } from '../constants/acid';
import { CalorieBankCycle, getDayName } from '../utils/calorieBankEngine';

interface CalorieBankCardProps {
  cycle: CalorieBankCycle;
}

export const CalorieBankCard: React.FC<CalorieBankCardProps> = ({ cycle }) => {
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
    <View style={[styles.card, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: Acid.tx }]}>Calorie Bank</Text>
        <Text style={[styles.dayCounter, { color: Acid.tx2 }]}>
          Day {dayOfCycle} of {daysInCycle}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: Acid.hair }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progressPct}%`,
              backgroundColor: progressPct > 100 ? Acid.error : Acid.lime,
            },
          ]}
        />
      </View>
      <Text style={[styles.progressLabel, { color: Acid.tx2 }]}>
        {Math.round(weeklyActual).toLocaleString()} / {Math.round(weeklyBudget).toLocaleString()} kcal
      </Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: bankBalance > 0 ? Acid.good : Acid.tx }]}>
            +{Math.round(bankBalance)}
          </Text>
          <Text style={[styles.statLabel, { color: Acid.tx3 }]}>{bankedLabel}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: Acid.hair }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Acid.tx }]}>
            {Math.round(adjustedTodayTarget).toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, { color: Acid.tx3 }]}>Today</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: Acid.hair }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Acid.tx }]}>
            {Math.round(remainingBudget).toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, { color: Acid.tx3 }]}>Remaining</Text>
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

          let barColor: string = Acid.hair;
          if (!day.isFuture && day.logged) {
            if (day.actual <= day.adjustedTarget) {
              barColor = Acid.good; // on/under target
            } else {
              barColor = Acid.carbs; // over target but within spending cap
              if (day.spendCapHit) barColor = Acid.error; // over spending cap
            }
          }

          return (
            <View key={day.date} style={styles.weekBarCol}>
              <View style={[styles.weekBarTrack, { backgroundColor: Acid.hair + '40' }]}>
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
                  color: day.isToday ? Acid.tx : Acid.tx3,
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
