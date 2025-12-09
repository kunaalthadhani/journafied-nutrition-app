import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3; // 30% of screen width to trigger swipe
const SWIPE_VELOCITY_THRESHOLD = 0.3;

interface DaySwiperProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  children: React.ReactNode;
}

export const DaySwiper: React.FC<DaySwiperProps> = ({
  selectedDate,
  onDateChange,
  children,
}) => {
  const theme = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const [isAnimating, setIsAnimating] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [showTransition, setShowTransition] = useState(false);

  // Reset animation when date changes externally (like from DateSelector)
  useEffect(() => {
    if (!isAnimating) {
      translateX.setValue(0);
    }
  }, [selectedDate, isAnimating]);

  const showDateTransition = (date: Date, callback: () => void) => {
    setShowTransition(true);
    setPendingDate(date);

    // Fade in the overlay
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Execute callback (date change)
      callback();

      // Fade out the overlay
      setTimeout(() => {
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setShowTransition(false);
          setPendingDate(null);
        });
      }, 100);
    });
  };

  const animateToPosition = (
    toValue: number,
    onComplete: () => void,
    duration: number = 300
  ) => {
    setIsAnimating(true);
    Animated.timing(translateX, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsAnimating(false);
      onComplete();
    });
  };

  const snapBack = () => {
    // Reset content opacity
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    animateToPosition(0, () => {
      setPendingDate(null);
    }, 200);
  };

  const snapToNext = () => {
    const nextDate = addDays(selectedDate, 1);

    // Reset content opacity
    contentOpacity.setValue(1);

    animateToPosition(SCREEN_WIDTH, () => {
      showDateTransition(nextDate, () => {
        onDateChange(nextDate);
        translateX.setValue(-SCREEN_WIDTH);
        animateToPosition(0, () => { }, 0);
      });
    });
  };

  const snapToPrevious = () => {
    const prevDate = subDays(selectedDate, 1);

    // Reset content opacity
    contentOpacity.setValue(1);

    animateToPosition(-SCREEN_WIDTH, () => {
      showDateTransition(prevDate, () => {
        onDateChange(prevDate);
        translateX.setValue(SCREEN_WIDTH);
        animateToPosition(0, () => { }, 0);
      });
    });
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !isAnimating,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return !isAnimating && Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 2);
    },

    onPanResponderGrant: () => {
      // Optional: Add haptic feedback here
    },

    onPanResponderMove: (_, gestureState) => {
      if (!isAnimating) {
        const { dx } = gestureState;
        translateX.setValue(dx);

        // Add subtle opacity feedback based on swipe distance
        const progress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
        const opacity = 1 - (progress * 0.3); // Reduce opacity by max 30%
        contentOpacity.setValue(opacity);
      }
    },

    onPanResponderRelease: (_, gestureState) => {
      const { dx, vx } = gestureState;
      const absDx = Math.abs(dx);
      const absVx = Math.abs(vx);

      // Determine if we should swipe or snap back based on distance and velocity
      const shouldSwipe = absDx > SWIPE_THRESHOLD || absVx > SWIPE_VELOCITY_THRESHOLD;

      if (shouldSwipe) {
        if (dx > 0) {
          // Swipe right - go to previous day
          snapToPrevious();
        } else {
          // Swipe left - go to next day  
          snapToNext();
        }
      } else {
        // Snap back to current position
        snapBack();
      }
    },

    onPanResponderTerminate: () => {
      snapBack();
    },
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.contentContainer,
          {
            transform: [{ translateX }],
            opacity: contentOpacity,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>

      {/* Date transition overlay */}
      {showTransition && (
        <Animated.View
          style={[
            styles.transitionOverlay,
            {
              opacity: overlayOpacity,
              backgroundColor: theme.colors.overlay,
            },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.dateTransition, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.transitionDate, { color: theme.colors.textPrimary }]}>
              {format(pendingDate || selectedDate, 'MMM d, yyyy')}
            </Text>
            <Text style={[styles.transitionDay, { color: theme.colors.textSecondary }]}>
              {format(pendingDate || selectedDate, 'EEEE')}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Date indicators */}
      <View style={styles.dateIndicator}>
        <View style={[styles.indicatorDot, { backgroundColor: theme.colors.textTertiary }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
  },
  dateIndicator: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: [{ translateX: -2.5 }],
    alignItems: 'center',
    zIndex: 10,
  },
  indicatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.5,
  },
  transitionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dateTransition: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    // Keep subtle shadow for floating element
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  transitionDate: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
    textAlign: 'center',
  },
  transitionDay: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.normal,
    textAlign: 'center',
    marginTop: 4,
  },
});