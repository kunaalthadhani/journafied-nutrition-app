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
  weeklyBudget?: number;
  weeklyActual?: number;
  remainingDays?: number;
  daysInCycle?: number;
  loading?: boolean;
}

export const StatCardsSection: React.FC<StatCardsSectionProps> = ({
  macrosData,
  macros2Data,
  dailyCalories,
  onScrollEnable,
  calorieBankActive,
  calorieBankBalance,
  weeklyBudget,
  weeklyActual,
  remainingDays,
  daysInCycle,
  loading,
}) => {
  return (
    <SwipeableCards
      macrosData={macrosData}
      macros2Data={macros2Data}
      dailyCalories={dailyCalories}
      onScrollEnable={onScrollEnable}
      calorieBankActive={calorieBankActive}
      calorieBankBalance={calorieBankBalance}
      weeklyBudget={weeklyBudget}
      weeklyActual={weeklyActual}
      remainingDays={remainingDays}
      daysInCycle={daysInCycle}
      loading={loading}
    />
  );
};
