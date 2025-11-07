import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';

interface TopNavigationBarProps {
  onMenuPress?: () => void;
  onCalendarPress?: () => void;
  selectedDate?: string;
}

export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  onMenuPress,
  onCalendarPress,
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
          <Feather name="menu" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        {/* Center: Date Picker */}
        <TouchableOpacity style={styles.dateContainer}>
          <Text style={[styles.dateText, { color: theme.colors.textPrimary }]}>
            {selectedDate}
          </Text>
          <Feather 
            name="chevron-down" 
            size={16} 
            color={theme.colors.textSecondary} 
            style={styles.chevronIcon}
          />
        </TouchableOpacity>

        {/* Right: Calendar Icon */}
        <TouchableOpacity 
          style={styles.iconContainer} 
          onPress={onCalendarPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="calendar" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
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