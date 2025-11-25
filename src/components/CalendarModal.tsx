import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { format, isSameMonth, isSameDay, addMonths, subMonths, getDaysInMonth } from 'date-fns';
import { Meal } from './FoodLogSection';
import { calculateTotalNutrition } from '../utils/foodNutrition';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  mealsByDate: Record<string, Meal[]>;
  dailyCalorieTarget: number;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  selectedDate,
  onDateSelect,
  mealsByDate,
  dailyCalorieTarget,
}) => {
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(-400)).current;
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Calculate calories for a specific date
  const getDateCalories = (date: Date): number => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const meals = mealsByDate[dateKey] || [];
    const allFoods = meals.flatMap(meal => meal.foods);
    const nutrition = calculateTotalNutrition(allFoods);
    return nutrition.totalCalories;
  };

  // Determine date status: 'exceeded' | 'within' | 'no-data'
  const getDateStatus = (date: Date): 'exceeded' | 'within' | 'no-data' => {
    const calories = getDateCalories(date);
    if (calories === 0) return 'no-data';
    // Guard against invalid dailyCalorieTarget
    if (!dailyCalorieTarget || dailyCalorieTarget <= 0) {
      // If no target set, consider any calories as "within" (can't exceed undefined target)
      return calories > 0 ? 'within' : 'no-data';
    }
    return calories > dailyCalorieTarget ? 'exceeded' : 'within';
  };

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month, getDaysInMonth(currentMonth));
    
    // Get first day of week (0 = Sunday, 6 = Saturday)
    const startDay = firstDay.getDay();
    
    // Create array of all days in month
    const days: Array<{ date: Date; status: 'exceeded' | 'within' | 'no-data' }> = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push({ date: new Date(year, month, -startDay + i + 1), status: 'no-data' });
    }
    
    // Add all days in month
    for (let day = 1; day <= getDaysInMonth(currentMonth); day++) {
      const date = new Date(year, month, day);
      days.push({ date, status: getDateStatus(date) });
    }
    
    return days;
  }, [currentMonth, mealsByDate, dailyCalorieTarget]);

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const closeWithAnimation = () => {
    Animated.timing(slideAnim, {
      toValue: -400,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  };

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(-400);
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 18,
        stiffness: 160,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(-400);
    }
  }, [visible, slideAnim]);

  const handleDatePress = (date: Date) => {
    onDateSelect(date);
    closeWithAnimation();
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={closeWithAnimation}
    >
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeWithAnimation} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              shadowColor: theme.colors.shadow,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
              {format(currentMonth, 'MMMM yyyy')}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handlePreviousMonth} style={styles.monthButton}>
                <ChevronLeft color={theme.colors.textSecondary} size={18} strokeWidth={2.4} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNextMonth} style={styles.monthButton}>
                <ChevronRight color={theme.colors.textSecondary} size={18} strokeWidth={2.4} />
              </TouchableOpacity>
              <TouchableOpacity onPress={closeWithAnimation} style={styles.monthButton}>
                <X color={theme.colors.textSecondary} size={18} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
          >
            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#D1FAE5' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Within</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FEE2E2' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Exceeded</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.input }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>No data</Text>
              </View>
            </View>

            {/* Calendar Grid */}
            <View style={[styles.calendarCard, { backgroundColor: theme.colors.background }]}>
              {/* Week day headers */}
              <View style={styles.weekHeader}>
                {weekDays.map((day) => (
                  <View key={day} style={styles.weekDayHeader}>
                    <Text style={[styles.weekDayText, { color: theme.colors.textSecondary }]}>
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Calendar days */}
              <View style={styles.calendarGrid}>
                {calendarDays.map((dayData, index) => {
                  const isCurrentMonth = isSameMonth(dayData.date, currentMonth);
                  const isSelected = isSameDay(dayData.date, selectedDate);
                  const isToday = isSameDay(dayData.date, new Date());

                  let dateColor = theme.colors.textTertiary;
                  let backgroundColor = 'transparent';
                  let borderWidth = 0;

                  if (isCurrentMonth) {
                    if (dayData.status === 'exceeded') {
                      backgroundColor = '#FEE2E2';
                      dateColor = theme.colors.textPrimary;
                    } else if (dayData.status === 'within') {
                      backgroundColor = '#D1FAE5';
                      dateColor = theme.colors.textPrimary;
                    } else {
                      backgroundColor = theme.colors.input;
                      dateColor = theme.colors.textSecondary;
                    }
                  }

                  if (isSelected) {
                    borderWidth = 2;
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.calendarDay,
                        {
                          backgroundColor,
                          borderColor: '#10B981',
                          borderWidth,
                        },
                        !isCurrentMonth && styles.calendarDayDisabled,
                      ]}
                      onPress={() => isCurrentMonth && handleDatePress(dayData.date)}
                      disabled={!isCurrentMonth}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          { color: dateColor },
                          isToday && styles.todayText,
                        ]}
                      >
                        {format(dayData.date, 'd')}
                      </Text>
                      {isToday && (
                        <View style={[styles.todayIndicator, { backgroundColor: '#10B981' }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    width: '100%',
    alignSelf: 'center',
    maxHeight: '80%',
    minHeight: 360,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendText: {
    fontSize: Typography.fontSize.sm,
  },
  calendarCard: {
    borderRadius: 16,
    paddingBottom: 8,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    margin: 1.5,
  },
  calendarDayDisabled: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  todayText: {
    fontWeight: Typography.fontWeight.bold,
  },
  todayIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});


