import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { format, isSameDay, subDays, startOfDay } from 'date-fns';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { DayData } from '../types';
import { DailySummary } from '../services/dataStorage';

interface DateSelectorProps {
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
  summariesByDate?: Record<string, DailySummary>;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  onDateSelect,
  selectedDate = new Date(),
  summariesByDate = {},
}) => {
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
    <View style={styles.container}>
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
          const dateKey = format(dateData.date, 'yyyy-MM-dd');
          const summary = summariesByDate[dateKey];
          const hasLog = summary && summary.entryCount > 0;
          const isToday = isSameDay(dateData.date, today);
          const isPast = startOfDay(dateData.date) < startOfDay(today);
          const isMissed = isPast && !hasLog;
          return (
            <TouchableOpacity
              key={dateKey}
              style={[
                styles.dayBlock,
              ]}
              onPress={() => handleDatePress(dateData.date)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayName,
                { color: Acid.tx3 },
                isActive && { color: Acid.tx, fontWeight: Typography.fontWeight.semiBold },
              ]}>
                {dateData.dayName}
              </Text>
              <View style={[
                styles.dayNumberContainer,
                isActive && [styles.activeBg, { backgroundColor: Acid.lime }],
              ]}>
                <Text style={[
                  styles.dayNumber,
                  { color: Acid.tx3 },
                  isActive && { color: Acid.moss, fontWeight: Typography.fontWeight.bold },
                ]}>
                  {dateData.dayNumber}
                </Text>
              </View>
              {/* Log status bar */}
              <View style={{
                width: 18,
                height: 3,
                borderRadius: 1.5,
                marginTop: 3,
                backgroundColor: hasLog ? Acid.good : (isMissed ? Acid.error + '99' : 'transparent'),
              }} />
            </TouchableOpacity>
          )
        })}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Acid.moss,
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
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  dayName: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Acid.tx3,
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
    color: Acid.tx3,
  },
});
