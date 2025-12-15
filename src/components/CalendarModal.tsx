import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Dimensions, // Added for screen height
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { format, isSameMonth, isSameDay, addMonths, subMonths, getDaysInMonth } from 'date-fns';
import { Meal } from './FoodLogSection';
import { calculateTotalNutrition } from '../utils/foodNutrition';
import { AdjustmentRecord } from '../services/dataStorage';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  mealsByDate: Record<string, Meal[]>;
  dailyCalorieTarget: number;
  adjustments?: AdjustmentRecord[];
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  selectedDate,
  onDateSelect,
  mealsByDate,
  dailyCalorieTarget,
  adjustments,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Animation: Start from -SCREEN_HEIGHT (above screen) to 0
  const slideAnim = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;
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
    if (!dailyCalorieTarget || dailyCalorieTarget <= 0) {
      return calories > 0 ? 'within' : 'no-data';
    }
    return calories > dailyCalorieTarget ? 'exceeded' : 'within';
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);

    const startDay = firstDay.getDay(); // 0 = Sunday

    const days: Array<{ date: Date; status: 'exceeded' | 'within' | 'no-data' }> = [];

    // Previous month placeholders
    for (let i = 0; i < startDay; i++) {
      days.push({ date: new Date(year, month, -startDay + i + 1), status: 'no-data' });
    }

    // Current month days
    for (let day = 1; day <= getDaysInMonth(currentMonth); day++) {
      const date = new Date(year, month, day);
      days.push({ date, status: getDateStatus(date) });
    }

    return days;
  }, [currentMonth, mealsByDate, dailyCalorieTarget]);

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const closeWithAnimation = () => {
    Animated.timing(slideAnim, {
      toValue: -SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(-SCREEN_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 25,
        stiffness: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleDatePress = (date: Date) => {
    onDateSelect(date);
    closeWithAnimation();
  };

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <Modal visible={visible} transparent onRequestClose={closeWithAnimation} animationType="none">
      <View style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeWithAnimation} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={{ paddingTop: Math.max(insets.top, 20) }}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
                  {format(currentMonth, 'MMMM yyyy')}
                </Text>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity onPress={handlePreviousMonth} style={styles.navButton}>
                  <ChevronLeft color={theme.colors.textPrimary} size={20} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                  <ChevronRight color={theme.colors.textPrimary} size={20} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Week Headers */}
            <View style={styles.weekHeader}>
              {weekDays.map((day) => (
                <View key={day} style={styles.weekDayHeader}>
                  <Text style={[styles.weekDayText, { color: theme.colors.textTertiary }]}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((dayData, index) => {
                const isCurrentMonth = isSameMonth(dayData.date, currentMonth);
                const isSelected = isSameDay(dayData.date, selectedDate);
                const isToday = isSameDay(dayData.date, new Date());

                // Styles
                const textColor = isCurrentMonth
                  ? (isSelected ? theme.colors.background : theme.colors.textPrimary)
                  : theme.colors.textTertiary;

                const backgroundColor = isSelected ? theme.colors.textPrimary : 'transparent';

                // Simple Indicator: Colored Underline Bar
                let indicatorColor = 'transparent';
                if (isCurrentMonth && !isSelected) {
                  if (dayData.status === 'within') indicatorColor = '#10B981'; // Emerald
                  else if (dayData.status === 'exceeded') indicatorColor = '#EF4444'; // Red
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.calendarDay, { backgroundColor }]}
                    onPress={() => isCurrentMonth && handleDatePress(dayData.date)}
                    disabled={!isCurrentMonth}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      { color: textColor, fontWeight: isToday ? '700' : '400' }
                    ]}>
                      {format(dayData.date, 'd')}
                    </Text>
                    {/* Minimal Bar Indicator */}
                    <View style={[styles.barIndicator, { backgroundColor: indicatorColor }]} />

                    {/* Adjustment Indicator */}
                    {adjustments?.some(a => a.status === 'applied' && isSameDay(new Date(a.date), dayData.date)) && (
                      <View style={{ position: 'absolute', top: 2, right: 2 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary }} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom Handle / Close Hint */}
            <TouchableOpacity onPress={closeWithAnimation} style={styles.bottomHandleContainer}>
              <View style={[styles.bottomHandle, { backgroundColor: theme.colors.border }]} />
            </TouchableOpacity>

          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Backdrop
    justifyContent: 'flex-start', // Top alignment
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    backgroundColor: 'white',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxHeight: '70%', // As requested "until half the page" (approx)
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl, // 20
    fontWeight: Typography.fontWeight.semiBold,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    padding: 8,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: 8,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%', // 100% / 7
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12, // Rounded squares
    marginVertical: 2,
    position: 'relative',
  },
  calendarDayText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.normal,
  },
  barIndicator: {
    position: 'absolute',
    bottom: 6,
    width: 16, // Small dash
    height: 3,
    borderRadius: 1.5,
  },
  bottomHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  bottomHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  }
});
