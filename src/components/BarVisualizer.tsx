import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../constants/theme';

export type AgentState = 'connecting' | 'initializing' | 'listening' | 'speaking' | 'thinking';

interface BarVisualizerProps {
  state?: AgentState;
  barCount?: number;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  demo?: boolean;
}

export const BarVisualizer: React.FC<BarVisualizerProps> = ({
  state = 'listening',
  barCount = 20,
  minHeight = 15,
  maxHeight = 90,
  demo = false,
}) => {
  const theme = useTheme();
  const bars = useRef(
    Array.from({ length: barCount }, () => ({
      height: new Animated.Value(minHeight),
      animation: null as Animated.CompositeAnimation | null,
    }))
  ).current;

  // Color based on state
  const getBarColor = () => {
    switch (state) {
      case 'connecting':
        return '#F59E0B'; // amber
      case 'initializing':
        return '#3B82F6'; // blue
      case 'listening':
        return '#10B981'; // green (teal)
      case 'speaking':
        return '#10B981'; // emerald
      case 'thinking':
        return '#8B5CF6'; // purple
      default:
        return '#10B981';
    }
  };

  const barColor = getBarColor();

  useEffect(() => {
    // Start animations for all bars
    bars.forEach((bar, index) => {
      // Cancel existing animation
      if (bar.animation) {
        bar.animation.stop();
        bar.animation = null;
      }

      // Create new animation with slight delay for each bar
      const delay = index * 30; // Stagger the animations
      const duration = 400 + Math.random() * 300; // Random duration between 400-700ms
      const targetHeight1 = minHeight + Math.random() * (maxHeight - minHeight);
      const targetHeight2 = minHeight + Math.random() * (maxHeight - minHeight);

      const createAnimation = () => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(bar.height, {
              toValue: targetHeight1,
              duration: duration,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(bar.height, {
              toValue: targetHeight2,
              duration: duration,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(bar.height, {
              toValue: minHeight + Math.random() * (maxHeight - minHeight),
              duration: duration,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ])
        );
      };

      bar.animation = createAnimation();
      bar.animation.start();
    });

    // Cleanup
    return () => {
      bars.forEach((bar) => {
        if (bar.animation) {
          bar.animation.stop();
          bar.animation = null;
        }
      });
    };
  }, [state, barCount, minHeight, maxHeight]);

  return (
    <View style={[styles.container, { height: maxHeight + 20 }]}>
      <View style={styles.barsContainer}>
        {bars.map((bar, index) => (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height: bar.height,
                backgroundColor: barColor,
                opacity: 0.7 + (index % 3) * 0.1, // Vary opacity slightly
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    height: '100%',
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 15,
  },
});


