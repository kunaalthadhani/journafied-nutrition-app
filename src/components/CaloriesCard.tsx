import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { CalorieData } from '../types';

interface CaloriesCardProps {
  data?: CalorieData;
}

export const CaloriesCard: React.FC<CaloriesCardProps> = ({
  data = {
    food: 0,
    exercise: 0,
    remaining: 1500,
    target: 1500
  }
}) => {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      {/* Header with icon and title */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Flame size={18} color={theme.colors.textPrimary} fill={theme.colors.textPrimary} strokeWidth={1} />
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Calories</Text>
      </View>

      {/* Three-column layout */}
      <View style={styles.statsContainer}>
        <View style={styles.statColumn}>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{data.food}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Food</Text>
        </View>

        <View style={[styles.statColumn, styles.middleColumn, { borderColor: theme.colors.lightBorder }]}>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{data.exercise}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Exercise</Text>
        </View>

        <View style={styles.statColumn}>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{data.remaining}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Remaining</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    marginRight: 8,
  },
  title: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
  middleColumn: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 8,
  },
  statValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
});