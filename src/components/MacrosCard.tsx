import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Acid } from '../constants/acid';
import { MacroData } from '../types';
import { NumberTicker } from './NumberTicker';

const MACRO_COLORS = { protein: Acid.protein, carbs: Acid.carbs, fat: Acid.fat };

interface MacrosCardProps {
  data?: MacroData;
}

const MacroColumn = ({ label, color, current, target }: { label: string; color: string; current: number; target: number }) => {
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  return (
    <View style={styles.statColumn}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <NumberTicker
          value={current}
          duration={800}
          decimalPlaces={0}
          style={styles.currentText}
        />
        <Text style={styles.targetText}>/{target}g</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
};

export const MacrosCard: React.FC<MacrosCardProps> = ({
  data = {
    carbs: { current: 0, target: 132, unit: 'g' },
    protein: { current: 0, target: 150, unit: 'g' },
    fat: { current: 0, target: 42, unit: 'g' }
  }
}) => {
  return (
    <View style={styles.container}>
      <MacroColumn label="PROTEIN" color={MACRO_COLORS.protein} current={data.protein.current} target={data.protein.target} />
      <MacroColumn label="CARBS" color={MACRO_COLORS.carbs} current={data.carbs.current} target={data.carbs.target} />
      <MacroColumn label="FAT" color={MACRO_COLORS.fat} current={data.fat.current} target={data.fat.target} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 14,
    minHeight: 120,
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  currentText: {
    fontFamily: Acid.serif,
    fontSize: 24,
    color: Acid.tx,
  },
  targetText: {
    fontSize: 11,
    color: Acid.tx3,
    marginLeft: 3,
  },
  barTrack: {
    width: 56,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Acid.hair,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
  },
});
