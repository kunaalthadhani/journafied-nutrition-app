import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface AnimatedFillProps {
  pct: number; // 0-100
  color: string;
  axis?: 'x' | 'y';
  duration?: number;
  style?: StyleProp<ViewStyle>;
  glowAlways?: boolean;
}

// A bar fill that eases to its new size instead of jumping, and glows while
// it moves. Layout props cannot ride the native driver, so this animates on
// the JS thread; fills are small and infrequent, which keeps that cheap.
export const AnimatedFill: React.FC<AnimatedFillProps> = ({
  pct,
  color,
  axis = 'x',
  duration = 700,
  style,
  glowAlways = false,
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    setMoving(true);
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(100, pct)),
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setMoving(false);
    });
  }, [pct, duration, anim]);

  const size = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const glow = glowAlways || moving
    ? {
        shadowColor: color,
        shadowOpacity: 0.85,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 0 },
        elevation: 5,
      }
    : null;

  return (
    <Animated.View
      style={[
        style,
        { backgroundColor: color },
        axis === 'x' ? { width: size } : { height: size },
        glow,
      ]}
    />
  );
};
