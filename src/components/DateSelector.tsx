import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { format, isSameDay, subDays } from 'date-fns';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { DayData } from '../types';

interface DateSelectorProps {
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  onDateSelect,
  selectedDate = new Date()
}) => {
  const theme = useTheme();
  const [dateList, setDateList] = useState<DayData[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    // Build a continuous list of days ending today, going back N days
    const today = new Date();
    const rangeDays = 180; // roughly 6 months
    const dates: DayData[] = [];
    for (let i = rangeDays; i >= 0; i--) {
      const d = subDays(today, i);
      dates.push({
        date: d,
        dayName: format(d, 'EEE'),
        dayNumber: parseInt(format(d, 'd')),
        isActive: isSameDay(d, selectedDate),
      });
    }
    setDateList(dates);
  }, [selectedDate]);

  // Scroll to the end (today at rightmost) when list updates
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [dateList.length]);

  const today = new Date();
  const handleDatePress = (dateData: DayData) => {
    if (dateData.date > today) return;
    if (onDateSelect) onDateSelect(dateData.date);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={[styles.scrollView]}
        ref={scrollRef}
        scrollEventThrottle={16}
      >
        {dateList.map((dateData, index) => (
          <TouchableOpacity
            key={`${format(dateData.date, 'yyyy-MM-dd')}-${index}`} // Better key for date changes
            style={[
              styles.dayBlock,
              dateData.isActive && {
                backgroundColor: theme.colors.accentBg,
              },
            ]}
            onPress={() => handleDatePress(dateData)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.dayName,
              { color: theme.colors.textTertiary },
              dateData.isActive && { color: theme.colors.accent, fontWeight: Typography.fontWeight.semiBold },
            ]}>
              {dateData.dayName}
            </Text>
            <Text style={[
              styles.dayNumber,
              { color: theme.colors.textTertiary },
              dateData.isActive && { color: theme.colors.accent, fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold },
            ]}>
              {dateData.dayNumber}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    paddingTop: 0, // Remove top padding completely
    paddingBottom: 8,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  dayBlock: {
    width: 50,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: 'transparent',
    marginTop: -2, // Pull the blocks up slightly
  },
  activeDayBlock: {
    backgroundColor: 'transparent', // Remove green background
    // Remove border completely
  },
  dayName: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.tertiaryText,
    marginBottom: 1, // Reduced from 4
  },
  activeDayName: {
    color: Colors.activeGreenBorder,
    fontWeight: Typography.fontWeight.semiBold,
  },
  dayNumber: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.tertiaryText,
  },
  activeDayNumber: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.activeGreenBorder,
  },
});