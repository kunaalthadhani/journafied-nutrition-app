import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Acid } from '../constants/acid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type AcidTabId = 'home' | 'insights' | 'coach' | 'body' | 'profile';

interface AcidTabBarProps {
  active: AcidTabId;
  onPress: (tab: AcidTabId) => void;
  onPlus?: () => void;
}

const TABS: { id: AcidTabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'insights', label: 'Insights', icon: 'bar-chart-2' },
  { id: 'coach', label: 'Coach', icon: 'message-circle' },
  { id: 'body', label: 'Body', icon: 'activity' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

// The floating glass pill: tabs in a blurred capsule with a separate lime
// quick-log button, after the iOS liquid-glass bars Kunaal pointed to. Android
// gets a translucent solid since native blur there is unreliable.
export const AcidTabBar: React.FC<AcidTabBarProps> = ({ active, onPress, onPlus }) => {
  const insets = useSafeAreaInsets();

  const pillInner = (
    <View style={styles.pillRow}>
      {TABS.map(tab => {
        const isActive = tab.id === active;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onPress(tab.id)}
            activeOpacity={0.7}
          >
            <Feather name={tab.icon as any} size={21} color={isActive ? Acid.lime : Acid.tx3} />
            <Text style={[styles.label, { color: isActive ? Acid.lime : Acid.tx3 }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.pill}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,18,13,0.94)' }]} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,18,13,0.45)' }]} />
        {pillInner}
      </View>
      {onPlus && (
        <TouchableOpacity style={styles.plus} onPress={onPlus} activeOpacity={0.85}>
          <Feather name="plus" size={26} color={Acid.moss} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  pill: {
    flex: 1,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  pillRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 9.5,
    letterSpacing: 0.4,
  },
  plus: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Acid.lime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Acid.lime,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
