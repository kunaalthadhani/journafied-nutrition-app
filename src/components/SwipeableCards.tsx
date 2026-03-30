import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, Animated, Easing } from 'react-native';
import { MacrosCard } from './MacrosCard';
import { Macros2Card } from './Macros2Card';
import { CalorieBankWeeklyCard } from './CalorieBankWeeklyCard';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { MacroData } from '../types';
import { useTheme } from '../constants/theme';

interface SwipeableCardsProps {
  macrosData?: MacroData;
  macros2Data?: MacroData;
  dailyCalories?: number;
  onScrollEnable?: (enabled: boolean) => void;
  calorieBankActive?: boolean;
  calorieBankBalance?: number;
  todayCaloriesEaten?: number;
  adjustedDailyTarget?: number;
  dailyCapAmount?: number;
  weeklyBudget?: number;
  weeklyActual?: number;
  remainingDays?: number;
  daysInCycle?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 30;
const CARD_HEIGHT = 120;

type CardType = 'macros' | 'macros2' | 'weekly';

export const SwipeableCards: React.FC<SwipeableCardsProps> = ({
  macrosData,
  macros2Data,
  dailyCalories,
  onScrollEnable,
  calorieBankActive,
  calorieBankBalance,
  todayCaloriesEaten,
  adjustedDailyTarget,
  dailyCapAmount,
  weeklyBudget,
  weeklyActual,
  remainingDays,
  daysInCycle,
}) => {
  const theme = useTheme();
  const [currentCard, setCurrentCard] = useState<CardType>('macros2');

  // Card order depends on whether bank is active
  const cardOrder: CardType[] = calorieBankActive
    ? ['macros2', 'weekly', 'macros']
    : ['macros2', 'macros'];

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const getNextCard = (current: CardType): CardType => {
    const idx = cardOrder.indexOf(current);
    return cardOrder[(idx + 1) % cardOrder.length];
  };

  const getPreviousCard = (current: CardType): CardType => {
    const idx = cardOrder.indexOf(current);
    return cardOrder[(idx - 1 + cardOrder.length) % cardOrder.length];
  };

  const animateSwitch = (direction: 'up' | 'down') => {
    const nextCard = direction === 'up' ? getNextCard(currentCard) : getPreviousCard(currentCard);
    const slideOutTo = direction === 'up' ? -50 : 50;
    const slideInFrom = direction === 'up' ? 50 : -50;

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
      setCurrentCard(nextCard);
      slideAnim.setValue(slideInFrom);

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
          animateSwitch('up');
        } else if (dy > 0) {
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
          {currentCard === 'macros2' && (
            <Macros2Card
              data={macros2Data}
              dailyCalories={dailyCalories}
              calorieBankActive={calorieBankActive}
              calorieBankBalance={calorieBankBalance}
              todayCaloriesEaten={todayCaloriesEaten}
              adjustedDailyTarget={adjustedDailyTarget}
              dailyCapAmount={dailyCapAmount}
            />
          )}
          {currentCard === 'weekly' && calorieBankActive && (
            <CalorieBankWeeklyCard
              weeklyBudget={weeklyBudget || 0}
              weeklyActual={weeklyActual || 0}
              bankBalance={calorieBankBalance || 0}
              remainingDays={remainingDays || 0}
              daysInCycle={daysInCycle || 7}
            />
          )}
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
