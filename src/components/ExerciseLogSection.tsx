import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { ParsedExercise } from '../utils/exerciseParser';
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
      {entries.map((entry) => (
        <View key={entry.id} style={[styles.entryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[styles.headerRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.promptText, { color: theme.colors.textSecondary }]}>
              {entry.prompt}
            </Text>
            {onDeleteEntry && (
              <TouchableOpacity
                style={styles.deleteButton}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => onDeleteEntry(entry.id)}
              >
                <Feather name="trash-2" size={14} color={theme.colors.error} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.exerciseList}>
            {entry.exercises.map((exercise, idx) => (
              <View
                key={`${exercise.id}-${idx}`}
                style={[
                  styles.exerciseItem,
                  idx < entry.exercises.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.lightBorder }
                ]}
              >
                <View style={styles.exerciseInfo}>
                  <Text style={[styles.exerciseName, { color: theme.colors.textPrimary }]}>
                    {exercise.name}
                  </Text>
                  <Text style={[styles.exerciseMeta, { color: theme.colors.textSecondary }]}>
                    {`${exercise.duration_minutes} min • ${String(exercise.intensity).toUpperCase()}`}
                  </Text>
                </View>
                <Text style={[styles.exerciseCalories, { color: theme.colors.textPrimary }]}>
                  {`${exercise.calories} kcal`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  entryCard: {
    marginBottom: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderBottomWidth: 1,
  },
  promptText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 4,
  },
  exerciseList: {
    paddingVertical: 4,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 16,
  },
  exerciseName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 2,
  },
  exerciseMeta: {
    fontSize: Typography.fontSize.xs,
  },
  exerciseCalories: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
  },
});


