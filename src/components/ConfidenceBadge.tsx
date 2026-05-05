import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { generateConfidenceHint, ConfidenceHint } from '../services/openaiService';

type Confidence = 'low' | 'medium' | 'high';

interface ConfidenceBadgeProps {
  confidence?: Confidence;
  confidenceReason?: string;
  foodName: string;
}

const COLORS: Record<Confidence, { dot: string; bg: string; label: string }> = {
  high: { dot: '#10B981', bg: '#10B98115', label: 'High' },
  medium: { dot: '#F59E0B', bg: '#F59E0B15', label: 'Medium' },
  low: { dot: '#EF4444', bg: '#EF444415', label: 'Low' },
};

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence, confidenceReason, foodName }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<ConfidenceHint | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  if (!confidence) return null;
  const c = COLORS[confidence];

  const handleOpen = async () => {
    setOpen(true);
    if (confidence === 'high') return;
    if (hint) return;
    setHintLoading(true);
    try {
      const result = await generateConfidenceHint(foodName, confidence);
      setHint(result);
    } finally {
      setHintLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.badge, { backgroundColor: c.bg }]}
        activeOpacity={0.7}
      >
        <View style={[styles.dot, { backgroundColor: c.dot }]} />
        <Text style={[styles.badgeLabel, { color: c.dot }]}>{c.label}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.dotLarge, { backgroundColor: c.dot }]} />
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                {c.label} confidence
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={18} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.foodNameLabel, { color: theme.colors.textTertiary }]}>{foodName}</Text>

              {confidenceReason ? (
                <Text style={[styles.body, { color: theme.colors.textPrimary }]}>{confidenceReason}</Text>
              ) : null}

              {confidence !== 'high' && (
                <View style={[styles.hintBox, { backgroundColor: theme.colors.input }]}>
                  <Text style={[styles.hintHeader, { color: theme.colors.textSecondary }]}>
                    To raise confidence next time
                  </Text>

                  {hintLoading && (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                        Thinking…
                      </Text>
                    </View>
                  )}

                  {!hintLoading && hint && (
                    <>
                      <Text style={[styles.body, { color: theme.colors.textPrimary }]}>{hint.what_to_add}</Text>
                      <Text style={[styles.exampleHeader, { color: theme.colors.textTertiary }]}>Example</Text>
                      <Text style={[styles.exampleText, { color: theme.colors.textSecondary }]}>{hint.example}</Text>
                    </>
                  )}

                  {!hintLoading && !hint && (
                    <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                      Add the portion size, preparation method, and any add-ons to your next log.
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  foodNameLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  hintBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  hintHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 13,
  },
  exampleHeader: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
