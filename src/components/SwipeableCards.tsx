import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, PanResponder } from 'react-native';
import { MacrosCard } from './MacrosCard';
import { Macros2Card } from './Macros2Card';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { MacroData } from '../types';

interface SwipeableCardsProps {
  macrosData?: MacroData;
  macros2Data?: MacroData;
  dailyCalories?: number;
  onScrollEnable?: (enabled: boolean) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 30; // Minimum distance to trigger swipe (reduced for more responsiveness)
const CARD_HEIGHT = 120; // Reduced height for more compact design

type CardType = 'macros' | 'macros2';

export const SwipeableCards: React.FC<SwipeableCardsProps> = ({
  macrosData,
  macros2Data,
  dailyCalories,
  onScrollEnable
}) => {
  const [currentCard, setCurrentCard] = useState<CardType>('macros2');

  // Helper functions for two-card navigation
  const getNextCard = (current: CardType): CardType => {
    return current === 'macros' ? 'macros2' : 'macros';
  };

  const getPreviousCard = (current: CardType): CardType => {
    return current === 'macros2' ? 'macros' : 'macros2';
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Respond to any vertical movement to capture gestures early
      return Math.abs(gestureState.dy) > 5;
    },
    onPanResponderTerminationRequest: () => false, // Don't allow other components to take over
    
    onPanResponderGrant: () => {
      // Disable parent scroll when starting gesture
      onScrollEnable?.(false);
    },

    onPanResponderMove: () => {
      // No animations during move (simple snap behavior)
    },

    onPanResponderRelease: (_, gestureState) => {
      const { dy } = gestureState;
      
      // Two-card infinite loop logic
      if (Math.abs(dy) > SWIPE_THRESHOLD) {
        if (dy < 0) {
          // Swipe up - go to next card (loop through both)
          setCurrentCard(getNextCard(currentCard));
        } else if (dy > 0) {
          // Swipe down - go to previous card (loop through both)
          setCurrentCard(getPreviousCard(currentCard));
        }
      }

      // Re-enable parent scroll when gesture ends
      onScrollEnable?.(true);
    },
  });

  return (
    <View style={styles.container}>
      {/* Card with indicators on top */}
      <View style={styles.cardWrapper}>
        <View style={styles.cardContainer} {...panResponder.panHandlers}>
          {currentCard === 'macros' && <MacrosCard data={macrosData} />}
          {currentCard === 'macros2' && <Macros2Card data={macros2Data} dailyCalories={dailyCalories} />}
        </View>

        {/* Indicators positioned on top of the card */}
        <View style={styles.indicatorContainer}>
          <View style={styles.indicatorColumn}>
            <View style={[
              styles.indicator,
              currentCard === 'macros' && styles.activeIndicator
            ]} />
            <View style={[
              styles.indicator,
              currentCard === 'macros2' && styles.activeIndicator
            ]} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    marginTop: -8,
    paddingBottom: 8,
  },
  cardWrapper: {
    position: 'relative',
    paddingHorizontal: 16,
  },
  cardContainer: {
    minHeight: CARD_HEIGHT,
  },
  indicatorContainer: {
    position: 'absolute',
    top: '50%',
    right: 24,
    transform: [{ translateY: -10 }], // Center vertically (half of total height)
    zIndex: 10,
  },
  indicatorColumn: {
    alignItems: 'center',
  },
  indicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.tertiaryText, // Grey when not selected
    marginVertical: 3,
  },
  activeIndicator: {
    backgroundColor: Colors.activeGreenBorder, // Green when selected
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
