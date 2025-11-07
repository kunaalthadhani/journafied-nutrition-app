import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native';
import { useTheme } from '../constants/theme';

interface BorderBeamProps {
  duration?: number; // seconds
  thickness?: number; // beam thickness (match border width)
  style?: ViewStyle;
}

// A simple RN approximation of MagicUI's BorderBeam.
// Renders a soft circular beam that orbits the container's border.
export const BorderBeam: React.FC<BorderBeamProps> = ({ duration = 8, thickness = 1, style }) => {
  const theme = useTheme();
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const progress = useRef(new Animated.Value(0)).current; // 0..perimeter

  useEffect(() => {
    if (!dims) return;
    progress.setValue(0);
    const perimeter = 2 * (dims.w + dims.h);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: perimeter,
        duration: Math.max(1000, duration * 1000),
        easing: Easing.linear,
        useNativeDriver: false, // we animate left/top
      })
    );
    loop.start();
    return () => loop.stop();
  }, [duration, progress, dims]);

  // Build interpolations after we know size
  let leftAnim: any = 0;
  let topAnim: any = 0;
  const offset = -thickness / 2 + 0.5; // center thin beam on the border
  if (dims) {
    const w = dims.w;
    const h = dims.h;
    const p = 2 * (w + h);
    // Distance breakpoints along perimeter
    // 0..w: top edge (left to right)
    // w..w+h: right edge (top to bottom)
    // w+h..w+h+w: bottom edge (right to left)
    // w+h+w..p: left edge (bottom to top)
    leftAnim = progress.interpolate({
      inputRange: [0, w, w + h, w + h + w, p],
      outputRange: [0 + offset, w + offset, w + offset, 0 + offset, 0 + offset],
      extrapolate: 'clamp',
    });
    topAnim = progress.interpolate({
      inputRange: [0, w, w + h, w + h + w, p],
      outputRange: [0 + offset, 0 + offset, h + offset, h + offset, 0 + offset],
      extrapolate: 'clamp',
    });
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height) setDims({ w: width, h: height });
  };

  // Convert normalized perimeter coords to container bounds using percent translate.
  // Parent must be relative; we position the beam using absolute fill.
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          // Container that the beam moves inside
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
        },
        style,
      ]}
      onLayout={onLayout}
    >
      {dims && (
        <>
          {/* Core pink beam */}
          <Animated.View
            style={{
              position: 'absolute',
              width: thickness,
              height: thickness,
              borderRadius: thickness / 2,
              backgroundColor: '#EC4899', // pink-500
              opacity: 0.9,
              left: leftAnim,
              top: topAnim,
              // subtle pink glow
              shadowColor: '#EC4899',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 6,
            }}
          />
          {/* Purple outer glow to simulate gradient mix */}
          <Animated.View
            style={{
              position: 'absolute',
              width: thickness * 6,
              height: thickness * 6,
              borderRadius: (thickness * 6) / 2,
              backgroundColor: 'transparent',
              left: Animated.subtract(leftAnim, (thickness * 6 - thickness) / 2),
              top: Animated.subtract(topAnim, (thickness * 6 - thickness) / 2),
              shadowColor: '#A855F7', // purple-500
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 10,
            }}
          />
        </>
      )}
    </Animated.View>
  );
};


