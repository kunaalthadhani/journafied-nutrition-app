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
  const flatListRef = useRef<ScrollView | null>(null);

  // Generate the list of dates only once (or if today changes conceptually)
  const dateList = React.useMemo(() => {
    const today = new Date();
    const rangeDays = 180; // roughly 6 months
    const dates: Omit<DayData, 'isActive'>[] = [];
    for (let i = rangeDays; i >= 0; i--) {
      const d = subDays(today, i);
      dates.push({
        date: d,
        dayName: format(d, 'EEE'),
        dayNumber: parseInt(format(d, 'd')),
      });
    }
    return dates;
  }, []);

  // Scroll to end on mount
  useEffect(() => {
    // Small timeout to ensure layout is measured
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const today = new Date();
  const handleDatePress = (date: Date) => {
    if (date > today) return;
    if (onDateSelect) onDateSelect(date);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={[styles.scrollView]}
        ref={flatListRef}
        scrollEventThrottle={16}
      >
        {dateList.map((dateData, index) => {
          const isActive = isSameDay(dateData.date, selectedDate);
          return (
            <TouchableOpacity
              key={`${format(dateData.date, 'yyyy-MM-dd')}-${index}`}
              style={[
                styles.dayBlock,
              ]}
              onPress={() => handleDatePress(dateData.date)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayName,
                { color: theme.colors.textTertiary },
                isActive && { color: theme.colors.textPrimary, fontWeight: Typography.fontWeight.semiBold },
              ]}>
                {dateData.dayName}
              </Text>
              <View style={[
                styles.dayNumberContainer,
                isActive && [styles.activeBg, { backgroundColor: theme.colors.primary }],
              ]}>
                <Text style={[
                  styles.dayNumber,
                  { color: theme.colors.textTertiary },
                  isActive && { color: theme.colors.primaryForeground, fontWeight: Typography.fontWeight.bold },
                ]}>
                  {dateData.dayNumber}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    paddingTop: 0,
    paddingBottom: 8,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  dayBlock: {
    width: 48,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  dayName: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.tertiaryText,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayNumberContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  dayNumber: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.tertiaryText,
  },
});