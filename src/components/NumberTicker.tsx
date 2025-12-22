import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

interface NumberTickerProps {
  value: number;
  duration?: number; // milliseconds
  style?: StyleProp<TextStyle>;
  decimalPlaces?: number;
}

export const NumberTicker: React.FC<NumberTickerProps> = ({
  value,
  duration = 800,
  style,
  decimalPlaces = 0,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef<number>(value);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;

    // If values are the same, just set it
    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    // Start animation
    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (easeOutCubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      // Calculate current value
      const currentValue = startValue + (endValue - startValue) * easeProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = endValue;
        startTimeRef.current = undefined;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      startTimeRef.current = undefined;
    };
  }, [value, duration]);

  return (
    <Text style={style}>
      {decimalPlaces > 0 ? displayValue.toFixed(decimalPlaces) : Math.round(displayValue)}
    </Text>
  );
};
