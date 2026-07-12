import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Acid } from '../constants/acid';
import { CalorieBankDayData } from '../utils/calorieBankEngine';
import { AnimatedFill } from './AnimatedFill';

interface CalorieBankWeeklyCardProps {
  weeklyBudget: number;
  weeklyActual: number;
  bankBalance: number;
  remainingDays: number;
  daysInCycle: number;
  perDayData?: CalorieBankDayData[];
}

// The board's calorie bank: a week of columns. Each day is a vertical bar
// filled by how much of its adjusted target was eaten — lime on or under
// target, amber over but covered by the bank, error past the spending cap.
// Unlogged past days stay hollow; future days are faint stubs.
export const CalorieBankWeeklyCard: React.FC<CalorieBankWeeklyCardProps> = ({
  weeklyBudget,
  weeklyActual,
  bankBalance,
  remainingDays,
  daysInCycle,
  perDayData,
}) => {
  const weeklyLeft = Math.max(0, Math.round(weeklyBudget - weeklyActual));
  const dayNumber = Math.max(1, daysInCycle - remainingDays + 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>THE WEEK</Text>
        <Text style={styles.headerLabel}>DAY {dayNumber} OF {daysInCycle}</Text>
      </View>

      {perDayData && perDayData.length > 0 && (
        <View style={styles.columnsRow}>
          {perDayData.map(day => {
            const ratio = day.adjustedTarget > 0 ? day.actual / day.adjustedTarget : 0;
            const fill = Math.min(1, Math.max(0.04, ratio));
            let color: string = Acid.hair2;
            if (day.logged) {
              if (day.spendCapHit) color = Acid.error;
              else if (day.actual > day.adjustedTarget) color = Acid.carbs;
              else color = Acid.lime;
            } else if (day.isFuture || day.isToday) {
              color = Acid.hair;
            }
            const dayLetter = new Date(day.date + 'T12:00:00')
              .toLocaleDateString('en-US', { weekday: 'narrow' });
            return (
              <View key={day.date} style={styles.column}>
                <View style={styles.columnTrack}>
                  <AnimatedFill
                    axis="y"
                    pct={(day.logged ? fill : 0.04) * 100}
                    color={color}
                    style={styles.columnFill}
                    glowAlways={day.isToday && day.logged}
                  />
                </View>
                <Text style={[styles.columnLabel, day.isToday ? { color: Acid.lime } : null]}>
                  {dayLetter}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(weeklyActual).toLocaleString()}</Text>
          <Text style={styles.statLabel}>USED</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, bankBalance > 0 ? { color: Acid.lime } : null]}>
            {Math.round(bankBalance).toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>IN BANK</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{weeklyLeft.toLocaleString()}</Text>
          <Text style={styles.statLabel}>LEFT THIS WEEK</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: Acid.hair,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: Acid.tx3,
  },
  columnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  columnTrack: {
    width: 14,
    height: 56,
    borderRadius: 7,
    backgroundColor: Acid.hair + '55',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  columnFill: {
    width: '100%',
    borderRadius: 7,
  },
  columnLabel: {
    fontSize: 9,
    letterSpacing: 1,
    color: Acid.tx3,
  },
  statsRow: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontFamily: Acid.serif,
    fontSize: 20,
    color: Acid.tx,
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: Acid.tx3,
    marginTop: 2,
  },
});
