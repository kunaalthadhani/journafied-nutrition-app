import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Acid } from '../constants/acid';

// Shown in place of the calorie card while goals are still hydrating, so the
// user never sees a placeholder number flash to the real one on cold open.
export const StatCardSkeleton: React.FC = () => {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const Box = ({ width, height }: { width: number; height: number }) => (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: 6,
        backgroundColor: '#D4D4D8',
        opacity: pulse,
      }}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair, shadowColor: '#000' }]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="pie-chart" size={18} color={Acid.tx3} />
        </View>
        <Box width={70} height={14} />
      </View>

      <View style={styles.statsContainer}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.statColumn}>
            <Box width={46} height={20} />
            <View style={{ height: 8 }} />
            <Box width={34} height={10} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Acid.mossDeep,
    borderRadius: 12,
    padding: Platform.OS === 'android' ? 8 : 12,
    marginHorizontal: -16,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: Acid.hair,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? 8 : 12,
  },
  iconContainer: {
    marginRight: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 50,
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
});
