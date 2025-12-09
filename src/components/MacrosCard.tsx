import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { PieChart } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { MacroData } from '../types';
import { useTheme } from '../constants/theme';
import { NumberTicker } from './NumberTicker';

interface MacrosCardProps {
  data?: MacroData;
}

export const MacrosCard: React.FC<MacrosCardProps> = ({
  data = {
    carbs: { current: 0, target: 132, unit: 'g' },
    protein: { current: 0, target: 150, unit: 'g' },
    fat: { current: 0, target: 42, unit: 'g' }
  }
}) => {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      {/* Header with icon and title */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <PieChart
            size={18}
            color={theme.colors.textPrimary}
            strokeWidth={2}
          />
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Macros</Text>
      </View>

      {/* Three-column layout */}
      <View style={styles.statsContainer}>
        <View style={styles.statColumn}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <NumberTicker
              value={data.carbs.current}
              duration={800}
              decimalPlaces={0}
              style={StyleSheet.flatten([
                styles.currentText,
                { color: theme.colors.textPrimary },
              ])}
            />
            <Text style={[styles.targetText, { color: theme.colors.textTertiary }]}>
              /{data.carbs.target}g
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Carbs
          </Text>
        </View>

        <View style={[styles.statColumn, styles.middleColumn, { borderColor: theme.colors.lightBorder }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <NumberTicker
              value={data.protein.current}
              duration={800}
              decimalPlaces={0}
              style={StyleSheet.flatten([
                styles.currentText,
                { color: theme.colors.textPrimary },
              ])}
            />
            <Text style={[styles.targetText, { color: theme.colors.textTertiary }]}>
              /{data.protein.target}g
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Protein
          </Text>
        </View>

        <View style={styles.statColumn}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <NumberTicker
              value={data.fat.current}
              duration={800}
              decimalPlaces={0}
              style={StyleSheet.flatten([
                styles.currentText,
                { color: theme.colors.textPrimary },
              ])}
            />
            <Text style={[styles.targetText, { color: theme.colors.textTertiary }]}>
              /{data.fat.target}g
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Fat
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
    marginBottom: Platform.OS === 'android' ? 8 : 12,
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
    paddingHorizontal: 8,
  },
  currentText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 6,
  },
  targetText: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.normal,
    marginLeft: 2,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.normal,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.tight * Typography.fontSize.xs,
  },
});