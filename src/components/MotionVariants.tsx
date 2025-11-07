import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MotionVariantsProps {
  items?: number[];
}

export const MotionVariants: React.FC<MotionVariantsProps> = ({ items = [0, 1, 2, 3, 4] }) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<View | null>(null);

  // Animated values
  const radius = useRef(new Animated.Value(30)).current; // start small
  const listOpacities = items.map(() => useRef(new Animated.Value(0)).current);
  const listTranslates = items.map(() => useRef(new Animated.Value(50)).current);

  // Open/close animation
  const toggle = () => setIsOpen((v) => !v);

  useEffect(() => {
    if (isOpen) {
      // Expand circle
      Animated.spring(radius, {
        toValue: 1200, // large enough to cover small screens
        useNativeDriver: false,
        stiffness: 100,
        damping: 18,
        mass: 1,
      }).start();
      // Stagger in list items
      listOpacities.forEach((op, i) => {
        Animated.sequence([
          Animated.delay(200 + i * 70),
          Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start();
      });
      listTranslates.forEach((tr, i) => {
        Animated.sequence([
          Animated.delay(200 + i * 70),
          Animated.spring(tr, { toValue: 0, useNativeDriver: true, stiffness: 1000, damping: 20, mass: 1 }),
        ]).start();
      });
    } else {
      // Collapse list items (reverse order)
      listOpacities
        .slice()
        .reverse()
        .forEach((op, ri) => {
          const i = items.length - 1 - ri;
          Animated.sequence([
            Animated.delay(ri * 50),
            Animated.timing(op, { toValue: 0, duration: 140, useNativeDriver: true }),
          ]).start();
        });
      listTranslates
        .slice()
        .reverse()
        .forEach((tr, ri) => {
          Animated.sequence([
            Animated.delay(ri * 50),
            Animated.spring(tr, { toValue: 50, useNativeDriver: true, stiffness: 1000, damping: 25, mass: 1 }),
          ]).start();
        });
      // Collapse circle after list finishes
      Animated.sequence([
        Animated.delay(200 + items.length * 50),
        Animated.timing(radius, {
          toValue: 30,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isOpen]);

  // Mask element: an expanding circle at (40,40)
  const mask = (
    <Animated.View
      style={[
        styles.maskCircle,
        {
          width: Animated.multiply(radius, 2),
          height: Animated.multiply(radius, 2),
          borderRadius: radius,
          transform: [
            { translateX: Animated.subtract(new Animated.Value(40), radius) },
            { translateY: Animated.subtract(new Animated.Value(40), radius) },
          ],
        },
      ]}
    />
  );

  return (
    <View ref={containerRef} style={styles.container}>
      <MaskedView style={styles.nav} maskElement={mask}>
        <View style={[styles.background, { backgroundColor: theme.colors.card }]}
        />
        <View style={styles.listWrapper}>
          {items.map((i, idx) => (
            <Animated.View
              key={i}
              style={{
                opacity: listOpacities[idx],
                transform: [{ translateY: listTranslates[idx] }],
                marginBottom: 16,
              }}
            >
              <View style={styles.listItem}>
                <View style={[styles.icon, { borderColor: '#9C1AFF' }]} />
                <View style={[styles.text, { borderColor: '#9C1AFF' }]} />
              </View>
            </Animated.View>
          ))}
        </View>
      </MaskedView>

      {/* Toggle always on top */}
      <TouchableOpacity style={styles.toggle} onPress={toggle} activeOpacity={0.8}>
        <Feather name={isOpen ? 'x' : 'menu'} size={22} color={theme.colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: SCREEN_WIDTH,
    alignSelf: 'stretch',
    paddingVertical: 8,
  },
  nav: {
    width: '100%',
    height: 'auto',
    minHeight: 220,
    borderRadius: 16,
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  listWrapper: {
    position: 'relative',
    paddingTop: 80,
    paddingHorizontal: 16,
    width: '100%',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    marginRight: 16,
  },
  text: {
    flex: 1,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
  },
  toggle: {
    position: 'absolute',
    top: 14,
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  maskCircle: {
    backgroundColor: '#000',
  },
});

export default MotionVariants;


