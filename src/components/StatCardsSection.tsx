import React from 'react';
import { SwipeableCards } from './SwipeableCards';
import { MacroData } from '../types';

interface StatCardsSectionProps {
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

export const StatCardsSection: React.FC<StatCardsSectionProps> = ({
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
  return (
    <SwipeableCards
      macrosData={macrosData}
      macros2Data={macros2Data}
      dailyCalories={dailyCalories}
      onScrollEnable={onScrollEnable}
      calorieBankActive={calorieBankActive}
      calorieBankBalance={calorieBankBalance}
      todayCaloriesEaten={todayCaloriesEaten}
      adjustedDailyTarget={adjustedDailyTarget}
      dailyCapAmount={dailyCapAmount}
      weeklyBudget={weeklyBudget}
      weeklyActual={weeklyActual}
      remainingDays={remainingDays}
      daysInCycle={daysInCycle}
    />
  );
};
