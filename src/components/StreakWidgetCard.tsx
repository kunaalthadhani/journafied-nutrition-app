import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Flame, Snowflake } from 'lucide-react-native';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { DailySummary } from '../services/dataStorage';
import { format, startOfWeek, addDays } from 'date-fns';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface StreakWidgetCardProps {
  visible: boolean;
  onClose: () => void;
  streak: number;
  frozen: boolean;
  caloriesConsumed: number;
  caloriesTarget: number;
  summariesByDate: Record<string, DailySummary>;
  frozenDates: string[];
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const StreakWidgetCard: React.FC<StreakWidgetCardProps> = ({
  visible,
  onClose,
  streak,
  frozen,
  caloriesConsumed,
  caloriesTarget,
  summariesByDate,
  frozenDates,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;

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

  // Build Mon–Sun for current week
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const dateKey = format(day, 'yyyy-MM-dd');
    const logged = (summariesByDate[dateKey]?.entryCount ?? 0) > 0 || frozenDates.includes(dateKey);
    const isToday = format(today, 'yyyy-MM-dd') === dateKey;
    const isFuture = day > today;
    return { dateKey, logged, isToday, isFuture };
  });

  const progress = caloriesTarget > 0 ? Math.min(1, caloriesConsumed / caloriesTarget) : 0;
  const flameColor = frozen ? '#38BDF8' : '#F97316';
  const flameEmoji = frozen ? '❄️' : '🔥';

  return (
    <Modal visible={visible} transparent onRequestClose={closeWithAnimation} animationType="none">
      <View style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeWithAnimation} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
              paddingTop: insets.top + 8,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Close button */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Your Streak</Text>
            <TouchableOpacity onPress={closeWithAnimation} style={styles.closeButton}>
              <X color={theme.colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>

          {/* Card content */}
          <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {/* Left side — streak */}
            <View style={[styles.left, { borderRightColor: theme.colors.border }]}>
              <Text style={styles.flameIcon}>{flameEmoji}</Text>
              <Text style={[styles.streakCount, { color: flameColor }]}>
                {streak} {streak === 1 ? 'day' : 'days'}
              </Text>
              <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
                Logging streak
              </Text>
            </View>

            {/* Right side — calories + weekly dots */}
            <View style={styles.right}>
              <Text style={[styles.calorieText, { color: theme.colors.textPrimary }]}>
                {Math.round(caloriesConsumed).toLocaleString()}
                <Text style={[styles.calorieTarget, { color: theme.colors.textSecondary }]}>
                  {' '}/ {Math.round(caloriesTarget).toLocaleString()} kcal
                </Text>
              </Text>

              <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(progress * 100)}%`,
                      backgroundColor: progress >= 1 ? theme.colors.warning : theme.colors.success,
                    },
                  ]}
                />
              </View>

              <View style={styles.weekRow}>
                {weekDays.map((day, i) => (
                  <View key={day.dateKey} style={styles.dayColumn}>
                    <View
                      style={[
                        styles.dot,
                        day.logged
                          ? { backgroundColor: theme.colors.success }
                          : day.isFuture
                            ? { backgroundColor: theme.colors.border, opacity: 0.4 }
                            : day.isToday
                              ? { borderWidth: 2, borderColor: theme.colors.success, backgroundColor: 'transparent' }
                              : { backgroundColor: theme.colors.border },
                      ]}
                    />
                    <Text style={[
                      styles.dayLabel,
                      { color: day.isToday ? theme.colors.textPrimary : theme.colors.textSecondary },
                      day.isToday && { fontWeight: Typography.fontWeight.semiBold },
                    ]}>
                      {DAY_LABELS[i]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 1,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    minWidth: 90,
  },
  flameIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  streakCount: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  streakLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  right: {
    flex: 1,
    paddingLeft: 16,
    justifyContent: 'center',
  },
  calorieText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 8,
  },
  calorieTarget: {
    fontWeight: Typography.fontWeight.normal,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  dayLabel: {
    fontSize: 10,
  },
});
