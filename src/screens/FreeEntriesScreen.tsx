import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';

export interface FreeEntryTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  onPress: () => void;
}

interface FreeEntriesScreenProps {
  tasks: FreeEntryTask[];
  onBack: () => void;
}

export const FreeEntriesScreen: React.FC<FreeEntriesScreenProps> = ({ tasks, onBack }) => {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#10B981" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Get Free Entries</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      >
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
            Complete actions below to unlock extra entries. These boosts stack on top of your daily limit.
          </Text>
        </View>

        {tasks.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={[
              styles.taskCard,
              {
                borderColor: theme.colors.border,
                backgroundColor: task.completed ? theme.colors.input : theme.colors.card,
              },
            ]}
            onPress={() => !task.completed && task.onPress()}
            activeOpacity={task.completed ? 1 : 0.85}
          >
            <View style={styles.taskInfo}>
              <Text style={[styles.taskTitle, { color: theme.colors.textPrimary }]}>
                {task.title}
              </Text>
              <Text style={[styles.taskDescription, { color: theme.colors.textSecondary }]}>
                {task.description}
              </Text>
            </View>
            <View
              style={[
                styles.taskStatus,
                { backgroundColor: task.completed ? '#DCFCE7' : '#E0F2FE' },
              ]}
            >
              {task.completed ? (
                <>
                  <Feather name="check" size={14} color="#15803D" />
                  <Text style={[styles.taskStatusText, { color: '#15803D' }]}>Done</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.taskStatusText, { color: '#0369A1' }]}>+5</Text>
                  <Feather name="chevron-right" size={16} color="#0369A1" />
                </>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  taskCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  taskInfo: {
    flex: 1,
    marginRight: 12,
    gap: 6,
  },
  taskTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  taskDescription: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  taskStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  taskStatusText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
  },
});

export default FreeEntriesScreen;




