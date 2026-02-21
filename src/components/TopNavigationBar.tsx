import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

import { Menu, TrendingUp, BarChart3, Calendar } from 'lucide-react-native';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TopNavigationBarProps {
  onMenuPress?: () => void;
  onCalendarPress?: () => void;
  onWeightTrackerPress?: () => void;
  onNutritionAnalysisPress?: () => void;
  userName?: string;
  // selectedDate is no longer needed for display in header, but kept in props if needed elsewhere or legacy, 
  // though we will remove it from display logic.
  selectedDate?: string;
  streak?: number;
  frozen?: boolean;
}

export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  onMenuPress,
  onCalendarPress,
  onWeightTrackerPress,
  onNutritionAnalysisPress,
  userName = "Guest",
  streak = 0,
  frozen = false,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.container, { borderBottomColor: theme.colors.border }]}>
        {/* Left Section: Menu + Greeting */}
        <View style={styles.leftSection}>
          <TouchableOpacity
            style={styles.iconContainer}
            onPress={onMenuPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Menu color={theme.colors.textPrimary} size={20} strokeWidth={2} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.greetingText, { color: theme.colors.textPrimary }]}>
              Hi {userName},
            </Text>
            {streak > 0 && (() => {
              const g = frozen ? '14,165,233' : '249,115,22';
              return (
                <View style={styles.streakGlow}>
                  <View style={[styles.glowRing, styles.glow7, { backgroundColor: `rgba(${g},0.02)` }]} />
                  <View style={[styles.glowRing, styles.glow6, { backgroundColor: `rgba(${g},0.03)` }]} />
                  <View style={[styles.glowRing, styles.glow5, { backgroundColor: `rgba(${g},0.04)` }]} />
                  <View style={[styles.glowRing, styles.glow4, { backgroundColor: `rgba(${g},0.06)` }]} />
                  <View style={[styles.glowRing, styles.glow3, { backgroundColor: `rgba(${g},0.08)` }]} />
                  <View style={[styles.glowRing, styles.glow2, { backgroundColor: `rgba(${g},0.10)` }]} />
                  <View style={[styles.glowRing, styles.glow1, { backgroundColor: `rgba(${g},0.13)` }]} />
                  <View style={[
                    styles.streakContainer,
                    frozen
                      ? styles.streakFrozen
                      : styles.streakActive,
                  ]}>
                    <Text style={[styles.streakText, frozen ? styles.streakTextFrozen : styles.streakTextActive]}>
                      {frozen ? '❄️' : '🔥'} x{streak}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>

        {/* Right: Icons */}
        <View style={styles.rightIconsContainer}>
          {/* Calendar Icon */}
          <TouchableOpacity
            style={styles.iconContainer}
            onPress={onCalendarPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Calendar color={theme.colors.textPrimary} size={20} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconContainer}
            onPress={onWeightTrackerPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <TrendingUp color={theme.colors.textPrimary} size={20} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconContainer}
            onPress={onNutritionAnalysisPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BarChart3 color={theme.colors.textPrimary} size={20} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    // Background set via props
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  greetingText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    // No extra margin needed if we want it tight next to the icon container space
    marginLeft: 0,
  },
  streakGlow: {
    marginLeft: 8,
  },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
  },
  glow7: { borderRadius: 24, transform: [{ scaleX: 2.2 }, { scaleY: 2.6 }] },
  glow6: { borderRadius: 22, transform: [{ scaleX: 2.0 }, { scaleY: 2.3 }] },
  glow5: { borderRadius: 21, transform: [{ scaleX: 1.8 }, { scaleY: 2.0 }] },
  glow4: { borderRadius: 20, transform: [{ scaleX: 1.6 }, { scaleY: 1.8 }] },
  glow3: { borderRadius: 18, transform: [{ scaleX: 1.45 }, { scaleY: 1.6 }] },
  glow2: { borderRadius: 16, transform: [{ scaleX: 1.3 }, { scaleY: 1.4 }] },
  glow1: { borderRadius: 14, transform: [{ scaleX: 1.15 }, { scaleY: 1.2 }] },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  streakActive: {
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  streakFrozen: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.4)',
  },
  streakText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  streakTextActive: {
    color: '#EA580C',
  },
  streakTextFrozen: {
    color: '#0EA5E9',
  },
});
