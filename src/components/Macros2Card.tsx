import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { MacroData } from '../types';
import { useTheme } from '../constants/theme';
import { NumberTicker } from './NumberTicker';

interface Macros2CardProps {
  data?: MacroData;
  dailyCalories?: number;
}

export const Macros2Card: React.FC<Macros2CardProps> = ({
  data = {
    carbs: { current: 0, target: 132, unit: 'g' },
    protein: { current: 0, target: 150, unit: 'g' },
    fat: { current: 0, target: 42, unit: 'g' }
  },
  dailyCalories = 1500
}) => {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
      {/* Header with icon and title */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather 
            name="pie-chart" 
            size={18} 
            color="#9C27B0" 
          />
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Calories</Text>
      </View>

      {/* Three-column layout */}
      <View style={styles.statsContainer}>
        <View style={styles.statColumn}>
          <NumberTicker 
            value={data.carbs.current} 
            duration={800}
            style={[styles.fractionText, { color: theme.colors.textPrimary }]}
          />
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Food
          </Text>
        </View>

        <View style={[styles.statColumn, styles.middleColumn]}>
          <NumberTicker 
            value={data.protein.current} 
            duration={800}
            style={[styles.fractionText, { color: theme.colors.textPrimary }]}
          />
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Exercise
          </Text>
        </View>

        <View style={styles.statColumn}>
          <NumberTicker 
            value={data.fat.current} 
            duration={800}
            style={[styles.fractionText, { color: theme.colors.textPrimary }]}
          />
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Remaining
          </Text>
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
    marginBottom: Platform.OS === 'android' ? 8 : 12, // Smaller margin on Android
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
    minHeight: 50, // Match CaloriesCard exactly
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start', // Match CaloriesCard exactly
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