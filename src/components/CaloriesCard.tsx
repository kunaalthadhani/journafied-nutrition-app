import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
      {/* Header with icon and title */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.flameIcon}>🔥</Text>
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Calories</Text>
      </View>

      {/* Three-column layout */}
      <View style={styles.statsContainer}>
        <View style={styles.statColumn}>
          <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{data.food}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Food</Text>
        </View>

        <View style={[styles.statColumn, styles.middleColumn]}>
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
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
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
    marginBottom: 12, // Reduced from 16
  },
  iconContainer: {
    marginRight: 8,
  },
  flameIcon: {
    fontSize: 20,
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
    minHeight: 50, // Ensure consistent height
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start', // Ensure top alignment
  },
  middleColumn: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: Colors.lightBorder,
    borderRightColor: Colors.lightBorder,
    paddingHorizontal: 8,
  },
  statValue: {
    fontSize: Typography.fontSize.md, // Changed from lg to match MacrosCard
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primaryText,
    marginBottom: 6, // Changed from 4 to match MacrosCard
  },
  statLabel: {
    fontSize: Typography.fontSize.xs, // Changed from sm to match MacrosCard
    fontWeight: Typography.fontWeight.normal,
    color: Colors.secondaryText, // Match MacrosCard
    textAlign: 'center',
    lineHeight: Typography.lineHeight.tight * Typography.fontSize.xs, // Add line height to match
  },
});