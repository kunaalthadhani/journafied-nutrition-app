import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BarVisualizer, AgentState } from './BarVisualizer';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';

export const BarVisualizerDemo: React.FC = () => {
  const theme = useTheme();
  const [state, setState] = useState<AgentState>('listening');

  const states: AgentState[] = ['connecting', 'initializing', 'listening', 'speaking', 'thinking'];

  const getStateLabel = (s: AgentState): string => {
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Audio Frequency Visualizer
        </Text>
        <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
          Real-time frequency band visualization with animated state transitions
        </Text>
      </View>

      <View style={styles.content}>
        <BarVisualizer
          state={state}
          demo={true}
          barCount={20}
          minHeight={15}
          maxHeight={90}
        />

        <View style={styles.buttonContainer}>
          {states.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.button,
                {
                  backgroundColor: state === s ? '#10B981' : theme.colors.input,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => setState(s)}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: state === s ? Colors.white : theme.colors.textSecondary,
                  },
                ]}
              >
                {getStateLabel(s)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  description: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  content: {
    gap: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
});











