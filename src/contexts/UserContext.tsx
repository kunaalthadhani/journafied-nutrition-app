import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AccountInfo, AdjustmentRecord, dataStorage, ExtendedGoalData, MealEntry, StreakFreezeData, isPremiumEntitled } from '../services/dataStorage';
import { checkMissedDaysAndFreeze } from '../utils/streakLogic';
import { subscribeMealsForUser, unsubscribeMeals } from '../services/realtimeMealsService';
import { supabaseDataService } from '../services/supabaseDataService';
import { authService } from '../services/authService';
import { smartReminderService } from '../services/smartReminderService';
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

    const loadInFlightRef = useRef<Promise<void> | null>(null);
    const loadAllData = useCallback(async () => {
        // Collapse concurrent loads. On startup both the initial-load effect and
        // the INITIAL_SESSION auth event call loadAllData; without this they run
        // twice and race each other's setState.
        if (loadInFlightRef.current) return loadInFlightRef.current;
        const run = (async () => {
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

            // Check for retroactive freezes logic. Premium-gated on the real
            // entitlement: streak freezes are a premium feature and the engine
            // must not spend tokens for signed-out or free users.
            const updatedFreeze = isPremiumEntitled(loadedAccount)
                ? await checkMissedDaysAndFreeze(loadedMeals, currentFreeze, loadedGoals)
                : currentFreeze;
            setStreakFreeze(updatedFreeze);

            // Smart Adjustment Check
            // We do this AFTER goals/weights are loaded. Gate on premium so the
            // engine never runs on a stale flag for a free or signed-out user.
            const adjustment = await dataStorage.checkAndGenerateAdjustment(isPremiumEntitled(loadedAccount));
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
        })();
        loadInFlightRef.current = run;
        try { await run; } finally { loadInFlightRef.current = null; }
    }, []);

    // Initial Load
    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    // Auth state listener: when the user signs in or out (anywhere in the app),
    // refresh accountInfo AND re-pull meals + weights + goals from Supabase.
    // Without the full reload, signing in after the initial load leaves the UI
    // showing an empty state because UserContext.meals is still the unauthenticated
    // snapshot. Symptom: Nutrition Analysis + Weight Tracker say "log your first meal"
    // even though Supabase has the user's data.
    useEffect(() => {
        const { data: sub } = authService.onAuthStateChange(async (event) => {
            try {
                let fresh = await dataStorage.getAccountInfo();

                // Rehydrate AccountInfo from Supabase session if the local cache
                // was wiped (iOS Safari ITP eviction is the common cause). Without
                // this, every consumer that reads dataStorage.loadAccountInfo()
                // sees null even though the session is valid — Settings shows
                // "Sign in", premium gates fail, etc.
                // INITIAL_SESSION fires once when the listener attaches and the
                // app has a stored session. Treat it the same as SIGNED_IN so a
                // page refresh on the PWA recovers the signed-in state.
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                    if (!fresh?.email || !fresh?.supabaseUserId) {
                        try {
                            const { data } = await authService.getSession();
                            const sessionUser = data?.session?.user;
                            if (sessionUser?.email) {
                                const rebuilt = {
                                    ...(fresh || {}),
                                    email: sessionUser.email,
                                    supabaseUserId: sessionUser.id,
                                };
                                await dataStorage.saveAccountInfo(rebuilt as any);
                                // Enrich with remote display_name from app_users
                                // so the greeting shows "Hi {Name}" not "Hi there"
                                // after an ITP-induced cache wipe.
                                try {
                                    const enriched = await dataStorage.loadAccountInfo();
                                    fresh = (enriched || rebuilt) as any;
                                } catch {
                                    fresh = rebuilt as any;
                                }
                            }
                        } catch (e) {
                            if (__DEV__) console.warn('AccountInfo rehydrate failed', e);
                        }
                    }
                }

                setAccountInfo(fresh || null);

                // Background push/pull. These can be slow; do not block the UI
                // by awaiting. The auth listener returning fast also matters
                // because some screens re-mount on accountInfo change and would
                // otherwise wait on these.
                // Shared-device guard on EVERY signed-in entry point, not just a
                // fresh sign-in. A returning user arrives via INITIAL_SESSION, so if
                // ownership were only claimed on SIGNED_IN the marker would never be
                // set and the NEXT account switch would go undetected and bleed. This
                // wipes local content if a different account now owns the device, or
                // just claims ownership otherwise. Awaited so any push below sees the
                // wiped state.
                if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
                    await dataStorage.wipeLocalContentIfAccountChanged(fresh);
                }

                if (event === 'SIGNED_IN') {
                    // First sign-in of a session: backfill local data up once, then pull.
                    void dataStorage.pushDerivedToSupabase().catch(() => { /* */ });
                    void dataStorage.pullDerivedFromSupabase().catch(() => { /* */ });
                    await loadAllData();
                } else if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
                    // Returning user on cold open or a token refresh: just pull. No
                    // backfill push, which previously ran on every single launch.
                    void dataStorage.pullDerivedFromSupabase().catch(() => { /* */ });
                    await loadAllData();
                } else if (event === 'SIGNED_OUT') {
                    await loadAllData();
                    // Entitlement just dropped. Rebuild reminders so premium ones
                    // (smart timing, macro pacing) stop firing for a signed-out user.
                    smartReminderService.scheduleAllReminders().catch(() => {});
                }
            } catch (e) {
                if (__DEV__) console.error('UserContext: auth refresh failed', e);
            }
        });
        return () => {
            try { sub?.subscription?.unsubscribe?.(); } catch { /* noop */ }
        };
    }, [loadAllData]);

    // Realtime: when another device upserts/deletes a meal for this user, drop the
    // cache and pull fresh. Self-fired writes also fire here — that's fine, the local
    // copy is already correct and the re-fetch just reconciles whatever is stored.
    // Debounce slightly because realtime can deliver bursts (e.g. batch insert).
    const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        let cancelled = false;
        const onChange = () => {
            if (reloadTimer.current) clearTimeout(reloadTimer.current);
            reloadTimer.current = setTimeout(async () => {
                try {
                    const fresh = await dataStorage.loadMeals();
                    setMeals(fresh);
                    setLastRefresh(Date.now());
                } catch (e) {
                    if (__DEV__) console.error('UserContext: realtime reload failed', e);
                }
            }, 400);
        };

        (async () => {
            // food_logs.user_id holds the app_users row id, not the auth uid, so the
            // realtime filter must use appUserId. If it is not cached yet, resolve
            // it from the email so realtime still works on this device.
            let appUserId = accountInfo?.appUserId;
            if (!appUserId && accountInfo?.email) {
                try {
                    const remote = await supabaseDataService.fetchAccountByEmail(accountInfo.email);
                    appUserId = remote?.id;
                } catch { /* best effort */ }
            }
            if (cancelled) return;
            if (!appUserId) { unsubscribeMeals(); return; }
            subscribeMealsForUser(appUserId, onChange);
        })();

        return () => {
            cancelled = true;
            if (reloadTimer.current) clearTimeout(reloadTimer.current);
            unsubscribeMeals();
        };
    }, [accountInfo?.appUserId, accountInfo?.email]);

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
