import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, ChevronDown, TrendingUp, BarChart3 } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';

interface TopNavigationBarProps {
  onMenuPress?: () => void;
  onCalendarPress?: () => void;
  onWeightTrackerPress?: () => void;
  onNutritionAnalysisPress?: () => void;
  selectedDate?: string;
}

export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  onMenuPress,
  onCalendarPress,
  onWeightTrackerPress,
  onNutritionAnalysisPress,
  selectedDate = "October 28, 2025"
}) => {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.card }]} edges={['left', 'right']}>
      <View style={[styles.container, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }] }>
        {/* Left: Hamburger Menu */}
        <TouchableOpacity 
          style={styles.iconContainer} 
          onPress={onMenuPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Menu color="#10B981" size={24} strokeWidth={2.6} />
        </TouchableOpacity>

        {/* Center: Date Picker */}
        <TouchableOpacity 
          style={styles.dateContainer}
          onPress={onCalendarPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.dateText, { color: theme.colors.textPrimary }]}>
            {selectedDate}
          </Text>
          <ChevronDown color="#10B981" size={16} strokeWidth={2.6} style={styles.chevronIcon} />
        </TouchableOpacity>

        {/* Right: Icons */}
        <View style={styles.rightIconsContainer}>
          <TouchableOpacity 
            style={styles.iconContainer} 
            onPress={onWeightTrackerPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <TrendingUp color="#10B981" size={22} strokeWidth={2.6} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconContainer} 
            onPress={onNutritionAnalysisPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BarChart3 color="#10B981" size={22} strokeWidth={2.6} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.white,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 60,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightBorder,
  },
  iconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  dateText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primaryText,
    marginRight: 6,
  },
  chevronIcon: {
    marginTop: 1,
  },
});
