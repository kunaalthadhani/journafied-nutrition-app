import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { MacroData } from '../types';
import { useTheme } from '../constants/theme';
import { NumberTicker } from './NumberTicker';

interface Macros2CardProps {
  data?: MacroData;
  dailyCalories?: number;
  calorieBankActive?: boolean;
  calorieBankBalance?: number;
  todayCaloriesEaten?: number;
  adjustedDailyTarget?: number;
  dailyCapAmount?: number;
}

export const Macros2Card: React.FC<Macros2CardProps> = ({
  data = {
    carbs: { current: 0, target: 132, unit: 'g' },
    protein: { current: 0, target: 150, unit: 'g' },
    fat: { current: 0, target: 42, unit: 'g' }
  },
  dailyCalories = 1500,
  calorieBankActive = false,
  calorieBankBalance = 0,
  todayCaloriesEaten = 0,
  adjustedDailyTarget = 0,
  dailyCapAmount = 0,
}) => {
  const theme = useTheme();
  const remainingVal = data.fat.current;
  const remainingColor = remainingVal <= 0 ? '#EF4444' : remainingVal < dailyCalories * 0.2 ? '#F59E0B' : '#10B981';

  // Bank mode: calculate today's banked/surplus live
  const todayDiff = calorieBankActive ? adjustedDailyTarget - todayCaloriesEaten : 0;
  const todayBanked = calorieBankActive && todayDiff > 0 ? Math.round(todayDiff) : 0;
  const todaySurplus = calorieBankActive && todayDiff < 0 ? Math.round(Math.abs(todayDiff)) : 0;

  if (calorieBankActive) {
    // 4-column layout: Food | Banked | Surplus | Remaining
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Feather name="pie-chart" size={18} color={theme.colors.textPrimary} />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Calories</Text>
          <View style={{ marginLeft: 8, backgroundColor: '#22C55E20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#22C55E' }}>BANK ON</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statColumn}>
            <NumberTicker
              value={data.carbs.current}
              duration={800}
              style={StyleSheet.flatten([styles.fractionText, { color: theme.colors.textPrimary }])}
            />
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Food</Text>
          </View>

          <View style={[styles.statColumn, { borderLeftWidth: 1, borderLeftColor: Colors.lightBorder, paddingHorizontal: 4 }]}>
            <NumberTicker
              value={todayBanked}
              duration={800}
              style={StyleSheet.flatten([styles.fractionText, { color: todayBanked > 0 ? '#22C55E' : theme.colors.textTertiary }])}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Banked</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => Alert.alert(
                  'Banked Calories',
                  `Banked calories are the calories you haven't used today. They get transferred to the remaining days of your week, slightly increasing each day's target.\n\nThe maximum you can bank per day is ${Math.round(dailyCapAmount)} kcal. You can change this cap in Settings under Calorie Bank.`
                )}
              >
                <Feather name="info" size={10} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.statColumn, { borderLeftWidth: 1, borderLeftColor: Colors.lightBorder, paddingHorizontal: 4 }]}>
            <NumberTicker
              value={todaySurplus}
              duration={800}
              style={StyleSheet.flatten([styles.fractionText, { color: todaySurplus > 0 ? '#EF4444' : theme.colors.textTertiary }])}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Surplus</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => Alert.alert(
                  'Surplus Calories',
                  `Surplus calories are the amount you've eaten over your daily target. These get deducted from the remaining days of your week, slightly reducing each day's target.\n\nThe maximum counted per day is ${Math.round(dailyCapAmount)} kcal. You can change this cap in Settings under Calorie Bank.`
                )}
              >
                <Feather name="info" size={10} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.statColumn, { borderLeftWidth: 1, borderLeftColor: Colors.lightBorder, paddingHorizontal: 4 }]}>
            <NumberTicker
              value={data.fat.current}
              duration={800}
              style={[styles.fractionText, { color: remainingColor }]}
            />
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Remaining</Text>
          </View>
        </View>
      </View>
    );
  }

  // Default 3-column layout: Food | Exercise | Remaining
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="pie-chart" size={18} color={theme.colors.textPrimary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Calories</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statColumn}>
          <NumberTicker
            value={data.carbs.current}
            duration={800}
            style={StyleSheet.flatten([styles.fractionText, { color: theme.colors.textPrimary }])}
          />
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Food</Text>
        </View>

        <View style={[styles.statColumn, styles.middleColumn]}>
          <NumberTicker
            value={data.protein.current}
            duration={800}
            style={[styles.fractionText, { color: theme.colors.textPrimary }]}
          />
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Exercise</Text>
        </View>

        <View style={styles.statColumn}>
          <NumberTicker
            value={data.fat.current}
            duration={800}
            style={[styles.fractionText, { color: remainingColor }]}
          />
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Remaining</Text>
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
