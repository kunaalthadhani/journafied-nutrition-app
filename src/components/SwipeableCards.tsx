import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, Animated, Easing } from 'react-native';
import { MacrosCard } from './MacrosCard';
import { Macros2Card } from './Macros2Card';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { MacroData } from '../types';
import { useTheme } from '../constants/theme';

interface SwipeableCardsProps {
  macrosData?: MacroData;
  macros2Data?: MacroData;
  dailyCalories?: number;
  onScrollEnable?: (enabled: boolean) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 30; // Minimum distance to trigger swipe
const CARD_HEIGHT = 120; // Match height

type CardType = 'macros' | 'macros2';

export const SwipeableCards: React.FC<SwipeableCardsProps> = ({
  macrosData,
  macros2Data,
  dailyCalories,
  onScrollEnable
}) => {
  const theme = useTheme();
  const [currentCard, setCurrentCard] = useState<CardType>('macros2');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Helper functions for two-card navigation
  const getNextCard = (current: CardType): CardType => {
    return current === 'macros' ? 'macros2' : 'macros';
  };

  const getPreviousCard = (current: CardType): CardType => {
    return current === 'macros2' ? 'macros' : 'macros2';
  };

  const animateSwitch = (direction: 'up' | 'down') => {
    const nextCard = direction === 'up' ? getNextCard(currentCard) : getPreviousCard(currentCard);
    const slideOutTo = direction === 'up' ? -50 : 50;
    const slideInFrom = direction === 'up' ? 50 : -50;

    // Animate OUT
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
      Animated.timing(slideAnim, {
        toValue: slideOutTo,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
    ]).start(() => {
      // Switch Content
      setCurrentCard(nextCard);
      // Construct IN state
      slideAnim.setValue(slideInFrom);

      // Animate IN
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]).start();
    });
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > 10;
    },
    onPanResponderTerminationRequest: () => false,

    onPanResponderGrant: () => {
      onScrollEnable?.(false);
    },

    onPanResponderRelease: (_, gestureState) => {
      const { dy } = gestureState;

      if (Math.abs(dy) > SWIPE_THRESHOLD) {
        if (dy < 0) {
          // Swipe up
          animateSwitch('up');
        } else if (dy > 0) {
          // Swipe down
          animateSwitch('down');
        }
      }

      onScrollEnable?.(true);
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.cardWrapper}>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
          {...panResponder.panHandlers}
        >
          {currentCard === 'macros' && <MacrosCard data={macrosData} />}
          {currentCard === 'macros2' && <Macros2Card data={macros2Data} dailyCalories={dailyCalories} />}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: -8,
    paddingBottom: 0,
  },
  cardWrapper: {
    position: 'relative',
    paddingHorizontal: 16,
  },
  cardContainer: {
    minHeight: CARD_HEIGHT,
  },
});
