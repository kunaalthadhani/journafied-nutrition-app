import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { ParsedExercise } from '../utils/exerciseParser';
import { Terminal } from './Terminal';
import { TypingAnimation } from './TypingAnimation';
import { useTheme } from '../constants/theme';

export interface ExerciseEntry {
  id: string;
  prompt: string;
  exercises: ParsedExercise[];
  timestamp: number;
}

interface ExerciseLogSectionProps {
  entries: ExerciseEntry[];
  onDeleteEntry?: (entryId: string) => void;
}

export const ExerciseLogSection: React.FC<ExerciseLogSectionProps> = ({
  entries,
  onDeleteEntry,
}) => {
  const theme = useTheme();

  if (!entries.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      {entries.map((entry, entryIndex) => (
        <Terminal key={entry.id} style={styles.terminal}>
          <View style={styles.promptRow}>
            <TypingAnimation
              speed={22}
              style={[styles.promptText, { color: theme.colors.textSecondary }]}
            >
              {`> ${entry.prompt}`}
            </TypingAnimation>
            {onDeleteEntry && (
              <TouchableOpacity
                style={styles.deleteButton}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => onDeleteEntry(entry.id)}
              >
                <Feather name="trash-2" size={14} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>

          {entry.exercises.map((exercise, exerciseIndex) => {
            const delay = 400 + entryIndex * 600 + exerciseIndex * 200;
            return (
              <View key={exercise.id} style={styles.exerciseRow}>
                <TypingAnimation
                  speed={24}
                  delay={delay}
                  style={[styles.exerciseName, { color: '#10B981' }]}
                >
                  {exercise.name}
                </TypingAnimation>
                <Text style={[styles.exerciseMeta, { color: theme.colors.textSecondary }]}>
                  {`${exercise.duration_minutes} min • ${String(exercise.intensity).toUpperCase()}`}
                </Text>
                <Text style={[styles.exerciseCalories, { color: theme.colors.textPrimary }]}>
                  {`${exercise.calories} kcal burned`}
                </Text>
              </View>
            );
          })}
        </Terminal>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  terminal: {
    marginBottom: Spacing.md,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  promptText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
  },
  deleteButton: {
    padding: 4,
  },
  exerciseRow: {
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: Colors.cardBackground,
  },
  exerciseName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  exerciseMeta: {
    marginTop: 4,
    fontSize: Typography.fontSize.sm,
  },
  exerciseCalories: {
    marginTop: 4,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
});

