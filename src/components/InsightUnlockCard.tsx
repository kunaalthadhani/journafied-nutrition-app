import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { InsightDefinition } from '../utils/insightUnlockEngine';

interface InsightUnlockCardProps {
  definition: InsightDefinition;
  onDismiss: () => void;
  onPress: () => void;
}

export const InsightUnlockCard: React.FC<InsightUnlockCardProps> = ({
  definition,
  onDismiss,
  onPress,
}) => {
  return (
    <View style={[styles.card, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}>
      <TouchableOpacity style={styles.content} activeOpacity={0.7} onPress={onPress}>
        <View style={[styles.iconBox, { backgroundColor: `${Acid.lime}15` }]}>
          <Feather name={definition.icon as any} size={18} color={Acid.lime} />
        </View>
        <View style={styles.textContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.title, { color: Acid.tx }]}>New Insight Unlocked</Text>
            <View style={{ backgroundColor: Acid.good, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF' }}>NEW</Text>
            </View>
          </View>
          <Text style={[styles.name, { color: Acid.tx }]}>{definition.name}</Text>
          <Text style={[styles.description, { color: Acid.tx2 }]}>{definition.description}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={onDismiss}>
        <Feather name="x" size={16} color={Acid.tx3} />
      </TouchableOpacity>
      <View style={[styles.tapHint, { borderTopColor: Acid.hair }]}>
        <Text style={{ fontSize: 11, color: Acid.tx3 }}>Tap to view</Text>
        <Feather name="chevron-right" size={12} color={Acid.tx3} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    padding: 16,
    paddingRight: 40,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
});
