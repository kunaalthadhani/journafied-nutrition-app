import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AccountInfo, AdjustmentRecord, dataStorage, ExtendedGoalData, MealEntry, StreakFreezeData } from '../services/dataStorage';
import { checkMissedDaysAndFreeze } from '../utils/streakLogic';
import { format } from 'date-fns';

interface UserContextType {
    // Data
    goals: ExtendedGoalData | null;
    meals: Record<string, MealEntry[]>; // keyed by YYYY-MM-DD
    weightEntries: { date: Date; weight: number }[];
    adjustmentAvailable: AdjustmentRecord | null;
    currentStreak: number;
    streakFreeze: StreakFreezeData | null;
    accountInfo: AccountInfo | null;
    isLoading: boolean;
    lastRefresh: number; // Timestamp to force re-renders if needed

    // Actions
    loadAllData: () => Promise<void>;
    saveMeal: (date: string, meal: MealEntry) => Promise<void>;
    updateGoals: (newGoals: ExtendedGoalData) => Promise<void>;
    applyAdjustment: (record: AdjustmentRecord) => Promise<void>;
    dismissAdjustment: (record: AdjustmentRecord) => Promise<void>;
    refreshStreak: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [goals, setGoals] = useState<ExtendedGoalData | null>(null);
    const [meals, setMeals] = useState<Record<string, MealEntry[]>>({});
    const [weightEntries, setWeightEntries] = useState<{ date: Date; weight: number }[]>([]);
    const [adjustmentAvailable, setAdjustmentAvailable] = useState<AdjustmentRecord | null>(null);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [streakFreeze, setStreakFreeze] = useState<StreakFreezeData | null>(null);
    const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(Date.now());

    const loadAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Parallel fetch for speed
            const [
                loadedGoals,
                loadedMeals,
                loadedWeights,
                loadedAccount,
                loadedStreak,
                loadedFreeze,
            ] = await Promise.all([
                dataStorage.loadGoals(),
                dataStorage.loadMeals(),
                dataStorage.loadWeightEntries(),
                dataStorage.getAccountInfo(),
                dataStorage.getStreak(),
                dataStorage.loadStreakFreeze(),
            ]);

            setGoals(loadedGoals);
            setMeals(loadedMeals);
            setWeightEntries(loadedWeights);
            setAccountInfo(loadedAccount);
            setCurrentStreak(loadedStreak);

            // Freeze Logic Management
            const currentMonthStart = format(new Date(), 'yyyy-MM-01');
            let currentFreeze = loadedFreeze;

            // Auto-reset freeze allowance monthly
            if (!currentFreeze || currentFreeze.lastResetDate !== currentMonthStart) {
                currentFreeze = {
                    freezesAvailable: 2,
                    lastResetDate: currentMonthStart,
                    usedOnDates: currentFreeze ? currentFreeze.usedOnDates : []
                };
                await dataStorage.saveStreakFreeze(currentFreeze);
            }

            // Check for retroactive freezes logic
            const updatedFreeze = await checkMissedDaysAndFreeze(loadedMeals, currentFreeze, loadedGoals);
            setStreakFreeze(updatedFreeze);

            // Smart Adjustment Check
            // We do this AFTER goals/weights are loaded
            const adjustment = await dataStorage.checkAndGenerateAdjustment();
            if (adjustment && adjustment.status === 'pending') {
                setAdjustmentAvailable(adjustment);
            } else {
                setAdjustmentAvailable(null);
            }

            setLastRefresh(Date.now());
        } catch (e) {
            console.error('UserContext: Failed to load data', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    // Actions
    const saveMeal = async (date: string, meal: MealEntry) => {
        // Optimistic Update
        setMeals(prev => {
            const dayMeals = prev[date] || [];
            return { ...prev, [date]: [...dayMeals, meal] };
        });

        // Persist
        await dataStorage.saveMeal(date, meal);

        // Silent Refresh (for streaks etc)
        // await loadAllData(); // Or just let optimistic UI handle it? 
        // Usually safer to reload streak calculations
        const s = await dataStorage.getStreak();
        setCurrentStreak(s);
    };

    const updateGoals = async (newGoals: ExtendedGoalData) => {
        setGoals(newGoals);
        await dataStorage.saveGoals(newGoals);
    };

    const applyAdjustment = async (record: AdjustmentRecord) => {
        setAdjustmentAvailable(null); // Clear banner immediately
        await dataStorage.applyAdjustment(record);
        // Reload to get new calories/macros into state
        await loadAllData();
    };

    const dismissAdjustment = async (record: AdjustmentRecord) => {
        setAdjustmentAvailable(null);
        await dataStorage.dismissAdjustment(record);
    }

    const refreshStreak = async () => {
        const s = await dataStorage.getStreak();
        setCurrentStreak(s);
    }

    return (
        <UserContext.Provider value={{
            goals,
            meals,
            weightEntries,
            adjustmentAvailable,
            currentStreak,
            streakFreeze,
            accountInfo,
            isLoading,
            lastRefresh,
            loadAllData,
            saveMeal,
            updateGoals,
            applyAdjustment,
            dismissAdjustment,
            refreshStreak
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
