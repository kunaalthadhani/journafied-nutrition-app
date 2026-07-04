import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dataStorage } from '../services/dataStorage';

export type WeightUnit = 'kg' | 'lbs';

interface PreferencesContextType {
  weightUnit: WeightUnit;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  convertWeightToDisplay: (weightKg: number) => number;
  convertWeightFromDisplay: (weight: number, unit: WeightUnit) => number;
  getWeightUnitLabel: () => string;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const WEIGHT_UNIT_KEY = '@trackkal:weightUnit';

export const PreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('kg');

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const savedUnit = await AsyncStorage.getItem(WEIGHT_UNIT_KEY);
      if (savedUnit === 'kg' || savedUnit === 'lbs') {
        setWeightUnitState(savedUnit);
        return;
      }
      // No local key (fresh device or evicted cache): fall back to the synced
      // preferences blob so the unit follows the user across devices.
      const prefs = await dataStorage.loadPreferences();
      // The fetch can take seconds. If the user picked a unit meanwhile, that
      // choice wins; do not clobber it with the fetched (possibly default) value.
      const nowSet = await AsyncStorage.getItem(WEIGHT_UNIT_KEY);
      if (nowSet === 'kg' || nowSet === 'lbs') return;
      if (prefs?.weightUnit === 'kg' || prefs?.weightUnit === 'lbs') {
        setWeightUnitState(prefs.weightUnit);
        await AsyncStorage.setItem(WEIGHT_UNIT_KEY, prefs.weightUnit);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const setWeightUnit = async (unit: WeightUnit) => {
    try {
      await AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit);
      setWeightUnitState(unit);
      // Mirror into the synced preferences blob so the unit reaches the cloud.
      // The fast local key above stays the render-path source of truth.
      dataStorage.savePreferences({ weightUnit: unit }).catch(() => {});
    } catch (error) {
      console.error('Error saving weight unit:', error);
    }
  };

  // Convert weight from kg to display unit
  const convertWeightToDisplay = (weightKg: number): number => {
    if (weightUnit === 'lbs') {
      return weightKg * 2.20462; // Convert kg to lbs
    }
    return weightKg;
  };

  // Convert weight from display unit to kg
  const convertWeightFromDisplay = (weight: number, unit: WeightUnit): number => {
    if (unit === 'lbs') {
      return weight * 0.453592; // Convert lbs to kg
    }
    return weight;
  };

  const getWeightUnitLabel = (): string => {
    return weightUnit === 'kg' ? 'kg' : 'lbs';
  };

  return (
    <PreferencesContext.Provider
      value={{
        weightUnit,
        setWeightUnit,
        convertWeightToDisplay,
        convertWeightFromDisplay,
        getWeightUnitLabel,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};

