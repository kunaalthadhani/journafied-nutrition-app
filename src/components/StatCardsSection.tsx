import React from 'react';
import { SwipeableCards } from './SwipeableCards';
import { MacroData } from '../types';

interface StatCardsSectionProps {
  macrosData?: MacroData;
  macros2Data?: MacroData;
  dailyCalories?: number;
  onScrollEnable?: (enabled: boolean) => void;
}

export const StatCardsSection: React.FC<StatCardsSectionProps> = ({
  macrosData,
  macros2Data,
  dailyCalories,
  onScrollEnable
}) => {
  return (
    <SwipeableCards 
      macrosData={macrosData}
      macros2Data={macros2Data}
      dailyCalories={dailyCalories}
      onScrollEnable={onScrollEnable}
    />
  );
};
