import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { Menu, Calendar, Flame, Snowflake } from 'lucide-react-native';
import { Acid } from '../constants/acid';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TopNavigationBarProps {
  onMenuPress?: () => void;
  onCalendarPress?: () => void;
  onStreakPress?: () => void;
  userName?: string;
  selectedDate?: string;
  streak?: number;
  frozen?: boolean;
}

// The board's home chrome: wordmark left, streak and calendar right. The
// trend/analysis shortcuts moved to the bottom tab bar.
export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  onMenuPress,
  onCalendarPress,
  onStreakPress,
  streak = 0,
  frozen = false,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: Acid.moss, paddingTop: insets.top }}>
      <View style={styles.container}>
        <View style={styles.leftSection}>
          <TouchableOpacity
            style={styles.iconContainer}
            onPress={onMenuPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Menu color={Acid.tx2} size={20} strokeWidth={2} />
          </TouchableOpacity>

          <Text style={styles.brand}>
            TRACK<Text style={{ color: Acid.lime }}>KCAL</Text>
          </Text>
        </View>

        <View style={styles.rightIconsContainer}>
          {streak > 0 && (
            <TouchableOpacity
              onPress={onStreakPress}
              activeOpacity={0.7}
              style={styles.streakContainer}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {frozen
                ? <Snowflake color={Acid.protein} size={14} strokeWidth={2.2} />
                : <Flame color={Acid.carbs} size={14} strokeWidth={2.2} />}
              <Text style={[styles.streakText, { color: frozen ? Acid.protein : Acid.carbs }]}>{streak}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.iconContainer}
            onPress={onCalendarPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Calendar color={Acid.tx2} size={19} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
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
    gap: 6,
  },
  brand: {
    fontSize: 13,
    letterSpacing: 2.5,
    fontWeight: '700',
    color: Acid.tx,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
