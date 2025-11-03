import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, PanResponder, Animated } from 'react-native';
import { format, addDays, startOfWeek, isSameDay, subDays } from 'date-fns';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { DayData } from '../types';

interface DateSelectorProps {
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  onDateSelect,
  selectedDate = new Date()
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(selectedDate, { weekStartsOn: 1 }));
  const [weekDates, setWeekDates] = useState<DayData[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    generateWeekDates();
  }, [selectedDate, currentWeekStart]);

  const generateWeekDates = () => {
    const dates: DayData[] = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(currentWeekStart, i);
      dates.push({
        date: currentDate,
        dayName: format(currentDate, 'EEE'), // Mon, Tue, etc.
        dayNumber: parseInt(format(currentDate, 'd')), // Day number
        isActive: isSameDay(currentDate, selectedDate),
      });
    }
    
    setWeekDates(dates);
  };

  const animateWeekChange = (direction: 'left' | 'right', callback: () => void) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    const slideDistance = direction === 'left' ? -300 : 300;
    
    // Slide out current week
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: slideDistance,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Update the week data
      callback();
      
      // Reset position for slide in
      translateX.setValue(-slideDistance);
      
      // Slide in new week
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsAnimating(false);
      });
    });
  };

  const goToPreviousWeek = () => {
    animateWeekChange('right', () => {
      setCurrentWeekStart(prevStart => subDays(prevStart, 7));
    });
  };

  const goToNextWeek = () => {
    animateWeekChange('left', () => {
      setCurrentWeekStart(prevStart => addDays(prevStart, 7));
    });
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !isAnimating,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Don't respond if already animating
      if (isAnimating) return false;
      // Respond to horizontal swipes
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
    },
    onPanResponderTerminationRequest: () => false,
    
    onPanResponderGrant: () => {
      // Reset any ongoing animations
      translateX.stopAnimation();
      opacity.stopAnimation();
    },

    onPanResponderMove: (_, gestureState) => {
      // Provide visual feedback during swipe
      const { dx } = gestureState;
      const maxDrag = 100;
      const clampedDx = Math.max(-maxDrag, Math.min(maxDrag, dx));
      
      translateX.setValue(clampedDx * 0.3); // Subtle movement
      
      // Slight opacity change during drag
      const opacityValue = Math.max(0.7, 1 - Math.abs(clampedDx) / 200);
      opacity.setValue(opacityValue);
    },

    onPanResponderRelease: (_, gestureState) => {
      const { dx } = gestureState;
      const swipeThreshold = 50;
      
      if (Math.abs(dx) > swipeThreshold && !isAnimating) {
        if (dx > 0) {
          // Swipe right - go to previous week
          goToPreviousWeek();
        } else {
          // Swipe left - go to next week
          goToNextWeek();
        }
      } else {
        // Animate back to original position
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          })
        ]).start();
      }
    },
  });

  const handleDatePress = (dateData: DayData) => {
    if (onDateSelect) {
      onDateSelect(dateData.date);
    }
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={[
          styles.scrollView,
          {
            transform: [{ translateX }],
            opacity,
          }
        ]}
        scrollEnabled={false} // Disable native scroll to use our swipe navigation
      >
        {weekDates.map((dateData, index) => (
          <TouchableOpacity
            key={`${format(dateData.date, 'yyyy-MM-dd')}-${index}`} // Better key for date changes
            style={[
              styles.dayBlock,
              dateData.isActive && styles.activeDayBlock,
            ]}
            onPress={() => handleDatePress(dateData)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.dayName,
              dateData.isActive && styles.activeDayName,
            ]}>
              {dateData.dayName}
            </Text>
            <Text style={[
              styles.dayNumber,
              dateData.isActive && styles.activeDayNumber,
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