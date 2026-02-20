import { Platform } from 'react-native';

// Use dynamic require to prevent crashes in Expo Go or environments where native modules aren't linked.
let AppleHealthKit: any;
let HealthConnect: any;

try {
    AppleHealthKit = require('react-native-health').default;
} catch (e) {
    console.log('AppleHealthKit native module not found');
}

try {
    HealthConnect = require('react-native-health-connect');
} catch (e) {
    console.log('HealthConnect native module not found');
}

import type { HealthKitPermissions } from 'react-native-health';
// Import type only if possible, if not found (because package might not be installed in all envs), usage below acts as any
// But since we installed the package, types should be available.

export interface HealthData {
    steps: number;
    calories: number;
    distance: number; // in meters
}

class HealthService {
    private isInitialized = false;

    async init(): Promise<boolean> {
        if (Platform.OS === 'ios') {
            return this.initAppleHealth();
        } else if (Platform.OS === 'android') {
            return this.initAndroidHealthConnect();
        }
        return false;
    }

    isModuleAvailable(): boolean {
        if (Platform.OS === 'ios') {
            return !!AppleHealthKit;
        } else if (Platform.OS === 'android') {
            return !!HealthConnect;
        }
        return false;
    }

    // --- iOS: Apple HealthKit ---

    private initAppleHealth(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!AppleHealthKit) {
                console.log('AppleHealthKit module missing');
                resolve(false);
                return;
            }

            const permissions = {
                permissions: {
                    read: [
                        AppleHealthKit.Constants.Permissions.Steps,
                        AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
                        AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
                    ],
                    write: [],
                },
            };

            AppleHealthKit.initHealthKit(permissions, (error: string) => {
                if (error) {
                    console.log('[Health] Apple HealthKit Init Error:', error);
                    resolve(false);
                    return;
                }
                this.isInitialized = true;
                resolve(true);
            });
        });
    }

    // --- Android: Health Connect ---

    private async initAndroidHealthConnect(): Promise<boolean> {
        try {
            if (!HealthConnect) {
                console.log('HealthConnect module missing');
                return false;
            }

            // 1. Check availability
            const status = await HealthConnect.getSdkStatus();
            if (status !== 2) { // 2 = SDK_AVAILABLE
                console.log('[Health] Health Connect SDK not available');
                return false;
            }

            // 2. Initialize
            const isInitialized = await HealthConnect.initialize();
            if (!isInitialized) return false;

            // 3. Request permissions
            const granted = await HealthConnect.requestPermission([
                { accessType: 'read', recordType: 'Steps' },
                { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
                { accessType: 'read', recordType: 'Distance' },
            ]);

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.log('[Health] Android Health Connect Error:', error);
            return false;
        }
    }

    // --- Data Fetching ---

    async getData(date: Date = new Date()): Promise<HealthData> {
        const defaultData = { steps: 0, calories: 0, distance: 0 };

        if (Platform.OS === 'ios' && AppleHealthKit) {
            return this.getAppleHealthData(date);
        } else if (Platform.OS === 'android' && HealthConnect) {
            return this.getAndroidHealthData(date);
        }

        return defaultData;
    }

    private getAppleHealthData(date: Date): Promise<HealthData> {
        return new Promise((resolve) => {
            if (!AppleHealthKit) return resolve({ steps: 0, calories: 0, distance: 0 });

            const options = {
                date: date.toISOString(),
                includeManuallyAdded: false,
            };

            let steps = 0;
            let calories = 0;
            let distance = 0;

            // Simplified chaining
            AppleHealthKit.getStepCount(options, (err: any, results: any) => {
                if (!err && results) steps = results.value;

                AppleHealthKit.getActiveEnergyBurned(options, (err: any, results: any) => {
                    if (!err && results) calories = results.value;

                    AppleHealthKit.getDistanceWalkingRunning(options, (err: any, results: any) => {
                        if (!err && results) distance = results.value;
                        resolve({ steps, calories, distance });
                    });
                });
            });
        });
    }

    private async getAndroidHealthData(date: Date): Promise<HealthData> {
        if (!HealthConnect) return { steps: 0, calories: 0, distance: 0 };

        try {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            const timeRangeFilter = {
                operator: 'between',
                startTime: start.toISOString(),
                endTime: end.toISOString(),
            };

            let steps = 0;
            let calories = 0;
            let distance = 0;

            // Steps
            try {
                const stepsResult = await HealthConnect.readRecords('Steps', { timeRangeFilter });
                for (const record of (stepsResult?.records ?? [])) {
                    steps += record.count ?? 0;
                }
            } catch (e) {
                console.log('[Health] Error reading steps:', e);
            }

            // Active Calories Burned
            try {
                const calResult = await HealthConnect.readRecords('ActiveCaloriesBurned', { timeRangeFilter });
                for (const record of (calResult?.records ?? [])) {
                    calories += record.energy?.inKilocalories ?? 0;
                }
            } catch (e) {
                console.log('[Health] Error reading calories:', e);
            }

            // Distance
            try {
                const distResult = await HealthConnect.readRecords('Distance', { timeRangeFilter });
                for (const record of (distResult?.records ?? [])) {
                    distance += record.distance?.inMeters ?? 0;
                }
            } catch (e) {
                console.log('[Health] Error reading distance:', e);
            }

            return { steps: Math.round(steps), calories: Math.round(calories), distance: Math.round(distance) };
        } catch (err) {
            console.log('[Health] Android Health Connect read error:', err);
            return { steps: 0, calories: 0, distance: 0 };
        }
    }
}

export const healthService = new HealthService();
