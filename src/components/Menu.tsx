import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme, useThemeMode } from '../constants/theme';

interface MenuProps {
  visible: boolean;
  onClose: () => void;
  onSetGoals: () => void;
}

export const Menu: React.FC<MenuProps> = ({
  visible,
  onClose,
  onSetGoals
}) => {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const handleSetGoals = () => {
    onSetGoals();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        onPress={onClose}
        activeOpacity={1}
      >
        <View style={[styles.menuContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleSetGoals}
            activeOpacity={0.7}
          >
            <Feather name="target" size={20} color="#10B981" />
            <Text style={[styles.menuText, { color: theme.colors.textPrimary }]}>Set Goals</Text>
            <Feather name="chevron-right" size={16} color="#10B981" />
          </TouchableOpacity>

          {/* Theme selector */}
          <View style={styles.sectionHeader}> 
            <Text style={[styles.sectionHeaderText, { color: theme.colors.textSecondary }]}>Theme</Text>
          </View>
          <View style={styles.themeRow}>
            <TouchableOpacity
              style={[styles.themeChip, { borderColor: theme.colors.border, backgroundColor: mode === 'light' ? theme.colors.accentBg : theme.colors.input }]}
              onPress={() => setMode('light')}
              activeOpacity={0.8}
            >
              <Text style={{ color: mode === 'light' ? theme.colors.accent : theme.colors.textSecondary }}>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeChip, { borderColor: theme.colors.border, backgroundColor: mode === 'dark' ? theme.colors.accentBg : theme.colors.input }]}
              onPress={() => setMode('dark')}
              activeOpacity={0.8}
            >
              <Text style={{ color: mode === 'dark' ? theme.colors.accent : theme.colors.textSecondary }}>Dark</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeChip, { borderColor: theme.colors.border, backgroundColor: mode === 'system' ? theme.colors.accentBg : theme.colors.input }]}
              onPress={() => setMode('system')}
              activeOpacity={0.8}
            >
              <Text style={{ color: mode === 'system' ? theme.colors.accent : theme.colors.textSecondary }}>System</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    paddingTop: 60, // Position below the navigation bar
  },
  menuContainer: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    // Shadow for iOS
    shadowColor: Colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    // Shadow for Android
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
  },
  menuText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    marginLeft: 12,
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionHeaderText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  themeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
});
