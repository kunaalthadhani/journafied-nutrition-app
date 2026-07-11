import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Acid } from '../constants/acid';
import { MacroData } from '../types';
import { NumberTicker } from './NumberTicker';

interface Macros2CardProps {
  data?: MacroData;
  dailyCalories?: number;
  calorieBankActive?: boolean;
}

// The home hero: eaten calories huge in the serif, the rest of the story in
// one micro line. Data mapping is historical: carbs=Food, protein=Exercise,
// fat=Remaining.
export const Macros2Card: React.FC<Macros2CardProps> = ({
  data = {
    carbs: { current: 0, target: 132, unit: 'g' },
    protein: { current: 0, target: 150, unit: 'g' },
    fat: { current: 0, target: 42, unit: 'g' }
  },
  dailyCalories = 1500,
  calorieBankActive = false,
}) => {
  const remainingVal = data.fat.current;
  const remainingColor = remainingVal <= 0 ? Acid.error : remainingVal < dailyCalories * 0.2 ? Acid.carbs : Acid.good;
  const exercise = Math.round(data.protein.current);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`${Math.round(data.carbs.current)} calories eaten, ${Math.round(remainingVal)} remaining${exercise > 0 ? `, ${exercise} burned` : ''}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <NumberTicker
          value={data.carbs.current}
          duration={800}
          style={styles.heroNumber}
        />
        <Text style={styles.heroUnit}>kcal</Text>
        {calorieBankActive && (
          <Text style={styles.bankTag}>  BANK ON</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        <Text style={styles.subLine}>
          OF {Math.round(dailyCalories).toLocaleString()}
          {exercise > 0 ? `  ·  ${exercise} BURNED` : ''}
          {'  ·  '}
        </Text>
        <Text style={[styles.subLine, { color: remainingColor }]}>
          {remainingVal <= 0 ? `${Math.abs(Math.round(remainingVal))} OVER` : `${Math.round(remainingVal)} LEFT`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    minHeight: 120,
    justifyContent: 'center',
  },
  heroNumber: {
    fontFamily: Acid.serif,
    fontSize: 54,
    lineHeight: 60,
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
    fontSize: 11,
    letterSpacing: 1.2,
    color: Acid.tx2,
  },
});
