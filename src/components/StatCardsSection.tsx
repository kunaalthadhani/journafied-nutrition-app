import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Acid } from '../constants/acid';
import { MacroData } from '../types';
import { NumberTicker } from './NumberTicker';
import { CalorieBankWeeklyCard } from './CalorieBankWeeklyCard';
import { CalorieBankDayData } from '../utils/calorieBankEngine';
import { StatCardSkeleton } from './StatCardSkeleton';

interface StatCardsSectionProps {
  isToday?: boolean;
  macrosData?: MacroData;
  macros2Data?: MacroData;
  dailyCalories?: number;
  onScrollEnable?: (enabled: boolean) => void;
  calorieBankActive?: boolean;
  calorieBankBalance?: number;
  weeklyBudget?: number;
  weeklyActual?: number;
  remainingDays?: number;
  daysInCycle?: number;
  bankPerDayData?: CalorieBankDayData[];
  loading?: boolean;
}

const MacroRow = ({ label, color, current, target }: { label: string; color: string; current: number; target: number }) => {
  const pct = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;
  return (
    <View style={styles.macroRow}>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroValue}>
        {Math.round(current)}<Text style={styles.macroTarget}> / {Math.round(target)}g</Text>
      </Text>
    </View>
  );
};

// The board's home hero: calories LEFT huge in the serif, the eaten/target
// story in one micro line, and the three macro rows always visible under it.
// Data mapping is historical: macros2Data carbs=Food, protein=Exercise,
// fat=Remaining; macrosData carries the real macro grams.
export const StatCardsSection: React.FC<StatCardsSectionProps> = ({
  isToday = true,
  macrosData,
  macros2Data,
  dailyCalories = 1500,
  calorieBankActive,
  calorieBankBalance,
  weeklyBudget,
  weeklyActual,
  remainingDays,
  daysInCycle,
  bankPerDayData,
  loading,
}) => {
  if (loading) {
    return (
      <View style={styles.wrap}>
        <StatCardSkeleton />
      </View>
    );
  }

  const eaten = Math.round(macros2Data?.carbs?.current || 0);
  const exercise = Math.round(macros2Data?.protein?.current || 0);
  const remaining = Math.round(macros2Data?.fat?.current ?? dailyCalories);
  const isOver = remaining < 0;

  return (
    <View style={styles.wrap}>
      <View
        accessible
        accessibilityLabel={`${Math.abs(remaining)} calories ${isOver ? 'over' : 'left'} today, ${eaten} eaten, target ${Math.round(dailyCalories)}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <NumberTicker value={Math.abs(remaining)} duration={800} style={styles.heroNumber} />
          <Text style={styles.heroUnit}>kcal</Text>
          {calorieBankActive && <Text style={styles.bankTag}>  BANK ON</Text>}
        </View>
        <Text style={styles.subLine}>
          <Text style={{ color: isOver ? Acid.error : Acid.tx2 }}>{isOver ? (isToday ? 'OVER TODAY' : 'OVER') : (isToday ? 'LEFT TODAY' : 'LEFT')}</Text>
          {`  ·  ${eaten.toLocaleString()} EATEN`}
          {exercise > 0 ? `  ·  ${exercise} BURNED` : ''}
          {`  ·  ${Math.round(dailyCalories).toLocaleString()} TARGET`}
        </Text>
      </View>

      {macrosData && (
        <View style={styles.macroBlock}>
          <MacroRow label="PROTEIN" color={Acid.protein} current={macrosData.protein.current} target={macrosData.protein.target} />
          <MacroRow label="CARBS" color={Acid.carbs} current={macrosData.carbs.current} target={macrosData.carbs.target} />
          <MacroRow label="FAT" color={Acid.fat} current={macrosData.fat.current} target={macrosData.fat.target} />
        </View>
      )}

      {calorieBankActive && (
        <View style={{ marginTop: 16 }}>
          <CalorieBankWeeklyCard
            weeklyBudget={weeklyBudget || 0}
            weeklyActual={weeklyActual || 0}
            bankBalance={calorieBankBalance || 0}
            remainingDays={remainingDays || 0}
            daysInCycle={daysInCycle || 7}
            perDayData={bankPerDayData}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
    marginBottom: 16,
  },
  heroNumber: {
    fontFamily: Acid.serif,
    fontSize: 58,
    lineHeight: 64,
    color: Acid.tx,
  },
  heroUnit: {
    fontSize: 18,
    color: Acid.tx3,
    marginLeft: 6,
  },
  bankTag: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: Acid.lime,
  },
  subLine: {
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: Acid.tx2,
    marginTop: 4,
  },
  macroBlock: {
    marginTop: 18,
    gap: 12,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroLabel: {
    width: 66,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Acid.tx3,
  },
  macroTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Acid.hair,
    overflow: 'hidden',
    marginRight: 12,
  },
  macroFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  macroValue: {
    minWidth: 74,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: Acid.tx,
  },
  macroTarget: {
    fontSize: 11,
    fontWeight: '400',
    color: Acid.tx3,
  },
});
