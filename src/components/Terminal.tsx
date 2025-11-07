import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../constants/theme';

interface TerminalProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Terminal: React.FC<TerminalProps> = ({ children, style }) => {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    // Terminal-like styling
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
});

