import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';

export type AcidTabId = 'home' | 'insights' | 'coach' | 'body' | 'profile';

interface AcidTabBarProps {
  active: AcidTabId;
  onPress: (tab: AcidTabId) => void;
}

const TABS: { id: AcidTabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'insights', label: 'Insights', icon: 'bar-chart-2' },
  { id: 'coach', label: 'Coach', icon: 'message-circle' },
  { id: 'body', label: 'Body', icon: 'activity' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

// Phase 1 of the board's bottom navigation: the bar lives on Home and the
// other tabs open the existing full-screen surfaces. It never shows an active
// state other than Home because the destinations are modals for now.
export const AcidTabBar: React.FC<AcidTabBarProps> = ({ active, onPress }) => {
  return (
    <View style={styles.bar}>
      {TABS.map(tab => {
        const isActive = tab.id === active;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onPress(tab.id)}
            activeOpacity={0.7}
          >
            <Feather name={tab.icon as any} size={20} color={isActive ? Acid.lime : Acid.tx3} />
            <Text style={[styles.label, { color: isActive ? Acid.lime : Acid.tx3 }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Acid.hair,
    backgroundColor: Acid.moss,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
