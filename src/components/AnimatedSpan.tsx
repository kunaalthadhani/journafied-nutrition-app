import React, { useEffect, useRef } from 'react';
import { Animated, Text, TextStyle, TextProps } from 'react-native';
import { Acid } from '../constants/acid';

interface AnimatedSpanProps {
  children: React.ReactNode;
  style?: TextStyle;
  className?: string; // For NativeWind compatibility
  delay?: number; // milliseconds delay before animation
  numberOfLines?: number;
  ellipsizeMode?: TextProps['ellipsizeMode'];
}

export const AnimatedSpan: React.FC<AnimatedSpanProps> = ({
  children,
  style,
  className,
  delay = 0,
  numberOfLines,
  ellipsizeMode,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [opacity, translateY, delay]);

  return (
    <Animated.Text
      style={[
        {
          color: Acid.tx,
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
    >
      {children}
    </Animated.Text>
  );
};

