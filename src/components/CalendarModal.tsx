import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDaysInMonth } from 'date-fns';
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

  const handleDatePress = (date: Date) => {
    onDateSelect(date);
    onClose();
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#14B8A6" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            {format(currentMonth, 'MMMM yyyy')}
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handlePreviousMonth} style={styles.monthButton}>
              <Feather name="chevron-left" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNextMonth} style={styles.monthButton}>
              <Feather name="chevron-right" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Legend */}
          <View style={[styles.legendCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.legendTitle, { color: theme.colors.textPrimary }]}>Legend</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                  Within calorie range
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                  Exceeded calories
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.input }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                  No data
                </Text>
              </View>
            </View>
          </View>

          {/* Calendar Grid */}
          <View style={[styles.calendarCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
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
                let borderColor = 'transparent';

                if (isCurrentMonth) {
                  if (dayData.status === 'exceeded') {
                    backgroundColor = '#EF4444';
                    dateColor = Colors.white;
                  } else if (dayData.status === 'within') {
                    backgroundColor = '#22C55E';
                    dateColor = Colors.white;
                  } else {
                    backgroundColor = theme.colors.input;
                    dateColor = theme.colors.textSecondary;
                  }

                  if (isSelected) {
                    borderColor = '#14B8A6';
                  }
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarDay,
                      {
                        backgroundColor,
                        borderColor,
                        borderWidth: isSelected ? 2 : 0,
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
                      <View style={[styles.todayIndicator, { backgroundColor: '#14B8A6' }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  legendCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  legendTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 12,
  },
  legendRow: {
    gap: 12,
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
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 32,
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
    borderRadius: 8,
    margin: 2,
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

