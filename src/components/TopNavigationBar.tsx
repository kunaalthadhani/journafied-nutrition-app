import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { Menu, TrendingUp, BarChart3, Calendar } from 'lucide-react-native';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TopNavigationBarProps {
  onMenuPress?: () => void;
  onCalendarPress?: () => void;
  onWeightTrackerPress?: () => void;
  onNutritionAnalysisPress?: () => void;
  userName?: string;
  // selectedDate is no longer needed for display in header, but kept in props if needed elsewhere or legacy, 
  // though we will remove it from display logic.
  selectedDate?: string;
}

export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  onMenuPress,
  onCalendarPress,
  onWeightTrackerPress,
  onNutritionAnalysisPress,
  userName = "Guest"
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.container, { borderBottomColor: theme.colors.border }]}>
        {/* Left Section: Menu + Greeting */}
        <View style={styles.leftSection}>
          <TouchableOpacity
            style={styles.iconContainer}
            onPress={onMenuPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Menu color={theme.colors.textPrimary} size={20} strokeWidth={2} />
          </TouchableOpacity>

          <Text style={[styles.greetingText, { color: theme.colors.textPrimary }]}>
            Hi {userName},
          </Text>
        </View>

        {/* Right: Icons */}
        <View style={styles.rightIconsContainer}>
          {/* Calendar Icon */}
          <TouchableOpacity
            style={styles.iconContainer}
            onPress={onCalendarPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Calendar color={theme.colors.textPrimary} size={20} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconContainer}
            onPress={onWeightTrackerPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <TrendingUp color={theme.colors.textPrimary} size={20} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconContainer}
            onPress={onNutritionAnalysisPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BarChart3 color={theme.colors.textPrimary} size={20} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    // Background set via props
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  greetingText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    // No extra margin needed if we want it tight next to the icon container space
    marginLeft: 0,
  },
});
