import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  InteractionManager,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
  KeyboardAvoidingView,
  BackHandler,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format, isSameDay } from 'date-fns';
import { TopNavigationBar } from '../components/TopNavigationBar';
import { DateSelector } from '../components/DateSelector';
import { CalendarModal } from '../components/CalendarModal';
import { StatCardsSection } from '../components/StatCardsSection';
import { BottomInputBar } from '../components/BottomInputBar';
import { SidebarMenu } from '../components/SidebarMenu';
import { SetGoalsScreen } from './SetGoalsScreen';
import { WeightTrackerScreen } from './WeightTrackerScreen';
import { NutritionAnalysisScreen } from './NutritionAnalysisScreen';
import { SettingsScreen } from './SettingsScreen';
import { SubscriptionScreen } from './SubscriptionScreen';
import { AccountScreen } from './AccountScreen';
import { AboutScreen } from './AboutScreen';
import { AdminPushScreen } from './AdminPushScreen';
import { ReferralScreen } from './ReferralScreen';
import { FreeEntriesScreen } from './FreeEntriesScreen';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { MacroData } from '../types';
import { FoodLogSection, Meal } from '../components/FoodLogSection';
import { ExerciseLogSection, ExerciseEntry } from '../components/ExerciseLogSection';
import { PhotoOptionsModal } from '../components/PhotoOptionsModal';
import { ImageUploadStatus } from '../components/ImageUploadStatus';
import { calculateTotalNutrition, ParsedFood } from '../utils/foodNutrition';
import { analyzeFoodWithChatGPT, analyzeFoodFromImage, analyzeExerciseWithChatGPT } from '../services/openaiService';
import { ParsedExercise, calculateExerciseCalories } from '../utils/exerciseParser';
import { voiceService } from '../services/voiceService';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dataStorage, ExtendedGoalData, SavedPrompt, AccountInfo, EntryTasksStatus } from '../services/dataStorage';
import { analyticsService } from '../services/analyticsService';
import { notificationService } from '../services/notificationService';
import { referralService } from '../services/referralService';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, AppState } from 'react-native';
import { generateId } from '../utils/uuid';

export const HomeScreen: React.FC = () => {
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showSetGoals, setShowSetGoals] = useState(false);
  const [showWeightTracker, setShowWeightTracker] = useState(false);
  const [showNutritionAnalysis, setShowNutritionAnalysis] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [userPlan, setUserPlan] = useState<'free' | 'premium'>('free');
  const [entryCount, setEntryCount] = useState<number>(0);
  const [showAccount, setShowAccount] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showAdminPush, setShowAdminPush] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [totalEarnedEntries, setTotalEarnedEntries] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [dailyCalories, setDailyCalories] = useState(1500);
  const [savedGoals, setSavedGoals] = useState<ExtendedGoalData>({
    calories: 1500,
    proteinPercentage: 30,
    carbsPercentage: 45,
    fatPercentage: 25,
    proteinGrams: 113, // (1500 * 30%) / 4 cal/g = 112.5 ≈ 113
    carbsGrams: 169,   // (1500 * 45%) / 4 cal/g = 168.75 ≈ 169
    fatGrams: 42,      // (1500 * 25%) / 9 cal/g = 41.67 ≈ 42
    currentWeightKg: null,
    targetWeightKg: null,
  });
  // Store meals & exercises by date (YYYY-MM-DD format)
  const [mealsByDate, setMealsByDate] = useState<Record<string, Meal[]>>({});
  const [exercisesByDate, setExercisesByDate] = useState<Record<string, ExerciseEntry[]>>({});
  const [isAnalyzingFood, setIsAnalyzingFood] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [hasUserTyped, setHasUserTyped] = useState(false);
  const [uploadStatusVisible, setUploadStatusVisible] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'completed' | 'failed' | 'analyzing'>('uploading');
  const [uploadStatusMessage, setUploadStatusMessage] = useState<string | null>(null);
  const uploadIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isOpeningCameraRef = React.useRef(false);
  const pendingActionRef = React.useRef<'camera' | 'library' | null>(null);
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const [showAnalyzingOverlay, setShowAnalyzingOverlay] = useState(false);
  const [goalsSet, setGoalsSet] = useState(false);
  const [shouldFocusInput, setShouldFocusInput] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [entryTasks, setEntryTasks] = useState<EntryTasksStatus>({
    customPlanCompleted: false,
    registrationCompleted: false,
  });
  const [taskBonusEntries, setTaskBonusEntries] = useState(0);
  const [showFreeEntries, setShowFreeEntries] = useState(false);

  // Helper to get date key
  const getDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

  // Get meals for current selected date
  const currentDateKey = getDateKey(selectedDate);
  const currentDayMeals = mealsByDate[currentDateKey] || [];
  const currentDayExercises = exercisesByDate[currentDateKey] || [];

  // Calculate all foods from current day's meals for nutrition totals
  const allLoggedFoods = currentDayMeals.flatMap(meal => meal.foods);
  // Calculate current nutrition from current day's foods
  const currentNutrition = calculateTotalNutrition(allLoggedFoods);

  // Generate macro data from saved goals with current values (with null safety)
  const macrosData: MacroData = {
    carbs: { current: currentNutrition.totalCarbs, target: savedGoals?.carbsGrams ?? 0, unit: 'g' },
    protein: { current: currentNutrition.totalProtein, target: savedGoals?.proteinGrams ?? 0, unit: 'g' },
    fat: { current: currentNutrition.totalFat, target: savedGoals?.fatGrams ?? 0, unit: 'g' }
  };
  // Calories card data (Food, Exercise, Remaining)
  const effectiveDailyCalories = dailyCalories && dailyCalories > 0 ? dailyCalories : 1500;
  const totalExerciseCalories = currentDayExercises.reduce(
    (sum, entry) => sum + calculateExerciseCalories(entry.exercises),
    0
  );
  const remainingCalories = Math.max(
    0,
    effectiveDailyCalories - currentNutrition.totalCalories + totalExerciseCalories
  );
  const macros2Data: MacroData = {
    carbs: { current: currentNutrition.totalCalories, target: 0, unit: 'cal' }, // Food calories
    protein: { current: totalExerciseCalories, target: 0, unit: 'cal' }, // Exercise calories
    fat: { current: remainingCalories, target: 0, unit: 'cal' } // Remaining calories
  };
  const handleMenuPress = () => {
    setMenuVisible(true);
  };

  const handleSetGoals = () => {
    analyticsService.trackSetGoalsOpen();
    setShowSetGoals(true);
  };

  const handleGoalsBack = () => {
    setShowSetGoals(false);
  };

  const handleOpenSetGoalsFromWeightTracker = () => {
    setShowWeightTracker(false);
    setShowSetGoals(true);
  };

  const handleOpenSetGoalsFromNutritionAnalysis = () => {
    setShowNutritionAnalysis(false);
    setShowSetGoals(true);
  };

  const handleWeightTracker = () => {
    analyticsService.trackWeightTrackerOpen();
    setShowWeightTracker(true);
  };

  const handleNutritionAnalysis = () => {
    analyticsService.trackNutritionAnalysisOpen();
    setShowNutritionAnalysis(true);
  };

  const handleNutritionAnalysisBack = () => {
    setShowNutritionAnalysis(false);
    setShouldFocusInput(false);
  };

  const handleRequestLogMeal = () => {
    setShowNutritionAnalysis(false);
    setShouldFocusInput(true);
  };

  const handleRequestLogMealForDate = (date: Date) => {
    setSelectedDate(date);
    setShowNutritionAnalysis(false);
    setShouldFocusInput(true);
  };

  const handleSettings = async () => {
    analyticsService.trackSettingsOpen();
    // Reload referral data to ensure it's up to date
    try {
      const accountInfo = await dataStorage.loadAccountInfo();
      setAccountInfo(accountInfo || null);
      if (accountInfo?.email) {
        const code = await dataStorage.getReferralCode(accountInfo.email);
        setReferralCode(code?.code || null);
        const earned = await dataStorage.getTotalEarnedEntriesFromReferrals(accountInfo.email);
        setTotalEarnedEntries(earned);
      }
    } catch (error) {
      if (__DEV__) console.error('Error reloading referral data in settings:', error);
    }
    setShowSettings(true);
  };

  const handleSettingsBack = () => {
    setShowSettings(false);
  };

  const handleOpenSubscription = () => {
    analyticsService.trackSubscriptionScreenOpen();
    setShowSettings(false);
    setShowSubscription(true);
  };
  const handleSubscriptionBack = () => {
    setShowSubscription(false);
  };
  const handleSubscribe = async (plan: 'annual' | 'monthly') => {
    setUserPlan('premium');
    await dataStorage.saveUserPlan('premium');
    setShowSubscription(false);
    setShowSettings(true);
  };

  const handleWeightTrackerBack = () => {
    setShowWeightTracker(false);
  };

  const handleAccount = () => {
    analyticsService.trackAccountScreenOpen();
    setMenuVisible(false);
    setShowAccount(true);
  };
  const handleAccountBack = async () => {
    setShowAccount(false);
    // Reload account data to sync state after potential logout
    try {
      const accountInfo = await dataStorage.loadAccountInfo();
      setAccountInfo(accountInfo || null);
      if (!accountInfo?.email) {
        // Account was cleared - reset entry count and referral data
        setEntryCount(0);
        setReferralCode(null);
        setTotalEarnedEntries(0);
        // Also reload entry count from storage to ensure consistency
        const count = await dataStorage.loadEntryCount();
        setEntryCount(count);
      } else {
        // Reload referral data if account exists
        const code = await dataStorage.getReferralCode(accountInfo.email);
        setReferralCode(code?.code || null);
        const earned = await dataStorage.getTotalEarnedEntriesFromReferrals(accountInfo.email);
        setTotalEarnedEntries(earned);
      }
      await refreshEntryTasks();
    } catch (error) {
      if (__DEV__) console.error('Error reloading account data:', error);
    }
  };

  const handleAbout = () => {
    analyticsService.trackAboutScreenOpen();
    setShowAbout(true);
  };

  const handleAboutBack = () => {
    setShowAbout(false);
  };

  const handleOpenReferral = () => {
    setMenuVisible(false);
    setShowReferral(true);
  };

  const handleReferralBack = async () => {
    setShowReferral(false);
    // Reload referral data
    try {
      const accountInfo = await dataStorage.loadAccountInfo();
      setAccountInfo(accountInfo || null);
      if (accountInfo?.email) {
        const code = await dataStorage.getReferralCode(accountInfo.email);
        setReferralCode(code?.code || null);
        const earned = await dataStorage.getTotalEarnedEntriesFromReferrals(accountInfo.email);
        setTotalEarnedEntries(earned);
      }
    } catch (error) {
      if (__DEV__) console.error('Error reloading referral data:', error);
    }
  };

  const handleOpenFreeEntries = () => {
    setMenuVisible(false);
    setShowFreeEntries(true);
  };

  const handleFreeEntriesBack = () => {
    setShowFreeEntries(false);
  };

  const handleCustomPlanTaskNavigate = () => {
    setShowFreeEntries(false);
    handleSetGoals();
  };

  const handleRegistrationTaskNavigate = () => {
    setShowFreeEntries(false);
    handleAccount();
  };

  const handleAdminPush = () => {
    if (__DEV__) console.log('Opening admin push console');
    setShowAdminPush(true);
  };

  const handleAdminPushBack = () => {
    setShowAdminPush(false);
  };

  const handleNotificationResponse = React.useCallback(
    (response: Notifications.NotificationResponse) => {
      try {
        const data = response.notification.request.content.data || {};
        const broadcastId =
          typeof (data as Record<string, unknown>).broadcastId === 'string'
            ? (data as Record<string, unknown>).broadcastId
            : null;
        if (broadcastId) {
          notificationService.recordPushClick(broadcastId as string);
        }
      } catch (error) {
        if (__DEV__) console.error('Error handling notification response:', error);
      }
    },
    []
  );

  const handleGoalsSave = async (goals: ExtendedGoalData) => {
    if (__DEV__) console.log('Goals saved:', goals);
    setDailyCalories(goals.calories);
    setSavedGoals(goals);
    setGoalsSet(true);
    await dataStorage.saveGoals(goals);
  };

  const handleCalendarPress = () => {
    setShowCalendar(true);
  };

  const handleDateSelect = (date: Date) => {
    analyticsService.trackDateSelectorChange();
    setSelectedDate(date);
    if (__DEV__) console.log('Date selected:', format(date, 'yyyy-MM-dd'));
  };

  // Persist meals whenever mealsByDate changes
  useEffect(() => {
    dataStorage.saveMeals(mealsByDate);
  }, [mealsByDate]);

  useEffect(() => {
    if (Object.keys(exercisesByDate).length > 0) {
      dataStorage.saveExercises(exercisesByDate);
    }
  }, [exercisesByDate]);

  // Entry limit persistence
  const ENTRY_COUNT_KEY = '@trackkal:entryCount';
  const FREE_ENTRY_LIMIT = 20;
  const MAX_SAVED_PROMPTS = 6;
  const TASK_BONUS_PER_ACTION = 5;
  const normalizePromptText = (value: string) => value.trim().toLowerCase();
  const createSavedPrompt = (text: string): SavedPrompt => {
    const timestamp = new Date().toISOString();
    return {
      id: generateId(),
      text,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  };
  const persistSavedPrompts = async (prompts: SavedPrompt[]) => {
    try {
      await dataStorage.saveSavedPrompts(prompts);
    } catch (error) {
      if (__DEV__) console.error('Error persisting saved prompts:', error);
    }
  };
  const calculateTaskBonus = (status: EntryTasksStatus) =>
    (status.customPlanCompleted ? TASK_BONUS_PER_ACTION : 0) +
    (status.registrationCompleted ? TASK_BONUS_PER_ACTION : 0);
  const refreshEntryTasks = async () => {
    const status = await dataStorage.loadEntryTasks();
    setEntryTasks(status);
    setTaskBonusEntries(calculateTaskBonus(status));
  };

  // Initialize analytics and load all data on mount
  useEffect(() => {
    (async () => {
      try {
        // Initialize analytics
        await analyticsService.initialize();
        await analyticsService.trackAppOpen();

        // Load entry count
        const stored = await AsyncStorage.getItem(ENTRY_COUNT_KEY);
        if (stored) setEntryCount(parseInt(stored, 10) || 0);
        else {
          const count = await dataStorage.loadEntryCount();
          setEntryCount(count);
        }

        // Load user plan
        const plan = await dataStorage.loadUserPlan();
        setUserPlan(plan);

        // Load goals
        const savedGoalsData = await dataStorage.loadGoals();
        if (savedGoalsData) {
          setSavedGoals(savedGoalsData);
          setDailyCalories(savedGoalsData.calories);
          setGoalsSet(true);
        }

        // Load meals
        const savedMeals = await dataStorage.loadMeals();
        if (Object.keys(savedMeals).length > 0) {
          setMealsByDate(savedMeals);
        }

        // Load exercises
        const savedExercises = await dataStorage.loadExercises();
        if (Object.keys(savedExercises).length > 0) {
          setExercisesByDate(savedExercises);
        }

        // Validate entry count matches actual log count (always run)
        let actualLogCount = 0;
        Object.values(savedMeals).forEach(meals => {
          actualLogCount += meals.length;
        });
        Object.values(savedExercises).forEach(entries => {
          actualLogCount += entries.length;
        });

        const storedCount = await dataStorage.loadEntryCount();

        if (actualLogCount !== storedCount) {
          if (__DEV__) console.warn(`Entry count mismatch: stored=${storedCount}, actual=${actualLogCount}`);
          // Auto-fix by setting entry count to actual meal count
          await dataStorage.saveEntryCount(actualLogCount);
          await AsyncStorage.setItem(ENTRY_COUNT_KEY, String(actualLogCount));
          setEntryCount(actualLogCount);
        }

        // Load saved prompts (cap to latest 6)
        const storedPrompts = await dataStorage.loadSavedPrompts();
        if (storedPrompts.length > 0) {
          setSavedPrompts(storedPrompts.slice(0, MAX_SAVED_PROMPTS));
        }

        const tasksStatus = await dataStorage.loadEntryTasks();
        setEntryTasks(tasksStatus);
        setTaskBonusEntries(calculateTaskBonus(tasksStatus));

        // Capture and save device info
        const deviceInfo = {
          deviceName: Device.deviceName || 'Unknown',
          modelName: Device.modelName || 'Unknown',
          osName: Device.osName || 'Unknown',
          osVersion: Device.osVersion || 'Unknown',
          platform: Platform.OS,
          appVersion: Constants.expoConfig?.version || '1.0.0',
          timestamp: new Date().toISOString(),
        };
        await dataStorage.saveDeviceInfo(deviceInfo);

        // Load referral code and earned entries
        const accountInfo = await dataStorage.loadAccountInfo();
        setAccountInfo(accountInfo || null);
        if (accountInfo?.email) {
          // Ensure user has a referral code
          let code = await dataStorage.getReferralCode(accountInfo.email);
          if (!code) {
            // Generate if missing
            await referralService.getOrCreateReferralCode(accountInfo.email);
            code = await dataStorage.getReferralCode(accountInfo.email);
          }
          setReferralCode(code?.code || null);

          // Load total earned entries
          const earned = await dataStorage.getTotalEarnedEntriesFromReferrals(accountInfo.email);
          setTotalEarnedEntries(earned);

          // Verify pending redemptions are still valid
          const redemptions = await dataStorage.getReferralRedemptionsForUser(
            accountInfo.email,
            'referee'
          );
          const pending = redemptions.filter((r) => r.status === 'pending');
          // Check if any pending redemptions should be marked as failed (e.g., expired)
          // For now, we'll keep them pending indefinitely, but you could add expiration logic
        } else {
          // Account is cleared/logged out - reset entry count and referral data
          setEntryCount(0);
          setReferralCode(null);
          setTotalEarnedEntries(0);
        }
      } catch (error) {
        if (__DEV__) console.error('Error loading data:', error);
      }
    })();

    // Track app close when component unmounts or app goes to background
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        analyticsService.trackAppClose();
      } else if (nextAppState === 'active') {
        analyticsService.trackAppOpen();
      }
    });

    return () => {
      subscription.remove();
      analyticsService.trackAppClose();
    };
  }, []);

  // Handle Android hardware back button to navigate within the app instead of exiting
  useEffect(() => {
    const onBackPress = () => {
      // Close any open overlay / sub-screen first
      if (photoModalVisible) {
        setPhotoModalVisible(false);
        return true;
      }
      if (showAdminPush) {
        setShowAdminPush(false);
        return true;
      }
      if (showSubscription) {
        setShowSubscription(false);
        return true;
      }
      if (showSettings) {
        setShowSettings(false);
        return true;
      }
      if (showWeightTracker) {
        setShowWeightTracker(false);
        return true;
      }
      if (showNutritionAnalysis) {
        setShowNutritionAnalysis(false);
        return true;
      }
      if (showSetGoals) {
        setShowSetGoals(false);
        return true;
      }
      if (showAccount) {
        setShowAccount(false);
        return true;
      }
      if (showAbout) {
        setShowAbout(false);
        return true;
      }
      if (showReferral) {
        setShowReferral(false);
        return true;
      }
      if (showFreeEntries) {
        setShowFreeEntries(false);
        return true;
      }
      if (showCalendar) {
        setShowCalendar(false);
        return true;
      }
      if (menuVisible) {
        setMenuVisible(false);
        return true;
      }
      // At the true home screen; allow default behavior (exit app)
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [
    photoModalVisible,
    showAdminPush,
    showSubscription,
    showSettings,
    showWeightTracker,
    showNutritionAnalysis,
    showSetGoals,
    showAccount,
    showAbout,
    showReferral,
    showFreeEntries,
    showCalendar,
    menuVisible,
  ]);

  useEffect(() => {
    (async () => {
      const registration = await notificationService.registerDeviceAsync();
      if (registration.status === 'error') {
        if (__DEV__) console.error('Push notification registration failed:', registration.error);
      } else if (registration.status === 'denied') {
        if (__DEV__) console.log('Push notification permission denied by user.');
      } else if (registration.status === 'not_physical') {
        if (__DEV__) console.log('Push notification registration skipped: requires physical device.');
      } else if (registration.status === 'granted') {
        if (__DEV__) console.log('Push token stored for broadcasts.');
      }
    })();
  }, []);

  useEffect(() => {
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    let isMounted = true;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (isMounted && response) {
        handleNotificationResponse(response);
      }
    });

    return () => {
      isMounted = false;
      responseListener.remove();
    };
  }, [handleNotificationResponse]);

  const incrementEntryCount = async () => {
    const next = entryCount + 1;
    setEntryCount(next);
    try {
      await AsyncStorage.setItem(ENTRY_COUNT_KEY, String(next));
      await dataStorage.saveEntryCount(next);
    } catch (error) {
      if (__DEV__) console.error('Error saving entry count:', error);
      // Try to restore previous count on error
      setEntryCount(entryCount);
    }
  };

  const canAddEntry = async () => {
    if (userPlan === 'premium') return true;

    // Get base free limit
    const baseLimit = FREE_ENTRY_LIMIT; // 20

    // Get bonus entries from referrals
    const accountInfo = await dataStorage.loadAccountInfo();
    let bonusEntries = 0;
    if (accountInfo?.email) {
      bonusEntries = await dataStorage.getTotalEarnedEntriesFromReferrals(accountInfo.email);
    }

    // Calculate effective limit
    const effectiveLimit = baseLimit + bonusEntries + taskBonusEntries;

    // Read entry count from storage to avoid stale state
    const currentEntryCount = await dataStorage.loadEntryCount();

    return currentEntryCount < effectiveLimit;
  };

  const handleInputSubmit = async (text: string) => {
    if (__DEV__) console.log('Input submitted:', text);

    const trimmed = text.trim();
    if (!trimmed) return;
    // Enforce free plan entry limit for new prompts
    if (!(await canAddEntry())) {
      Alert.alert(
        'Entry Limit Reached',
        'You have reached your free entry limit. Upgrade to Premium for unlimited entries.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => handleOpenSubscription() },
        ]
      );
      return;
    }

    setIsAnalyzingFood(true);

    try {
      // Use ChatGPT for real-time food analysis
      let parsedFoods: ParsedFood[] = [];
      try {
        parsedFoods = await analyzeFoodWithChatGPT(trimmed);
      } catch (apiError: any) {
        if (apiError?.message === 'OPENAI_API_KEY_NOT_CONFIGURED') {
          Alert.alert(
            'Food Analysis Not Configured',
            'Food analysis is not configured. Please contact support.'
          );
          setIsAnalyzingFood(false);
          return;
        }
        throw apiError; // Re-throw other errors
      }

      if (parsedFoods.length > 0) {
        // Create a new meal entry with the prompt and foods
        const createdAt = Date.now();
        const newMeal: Meal = {
          id: generateId(),
          prompt: trimmed,
          foods: parsedFoods,
          timestamp: createdAt,
          updatedAt: new Date().toISOString(),
        };

        // Add meal to the current selected date
        setMealsByDate((prev) => ({
          ...prev,
          [currentDateKey]: [...(prev[currentDateKey] || []), newMeal],
        }));
        // Count this new prompt as an entry
        await incrementEntryCount();
        // Track meal logged
        await analyticsService.trackMealLogged(selectedDate);
        if (__DEV__) console.log('ChatGPT parsed foods:', parsedFoods);

        // Check referral progress after meal is successfully added
        const accountInfo = await dataStorage.loadAccountInfo();
        if (accountInfo?.email) {
          const referralResult = await referralService.processMealLoggingProgress(accountInfo.email);

          if (referralResult.rewardsAwarded && referralResult.entriesAwarded) {
            // Show success message
            Alert.alert(
              '🎉 Referral Reward Earned!',
              referralResult.message ||
              `You've earned +${referralResult.entriesAwarded} free entries!`,
              [{ text: 'Awesome!', style: 'default' }]
            );

            // Reload total earned entries from referrals (this affects the limit, not the count)
            const earned = await dataStorage.getTotalEarnedEntriesFromReferrals(accountInfo.email);
            setTotalEarnedEntries(earned);

            // Note: We don't reload entryCount here because it was just incremented above
            // The entry count is correct, and the bonus entries increase the limit, not the count
          }
          // Note: Progress messages are optional and can be noisy, so we're not showing them
        }
        return;
      }

      // If no foods were recognized, try interpreting as exercise
      let parsedExercises: ParsedExercise[] = [];
      try {
        parsedExercises = await analyzeExerciseWithChatGPT(trimmed);
      } catch (apiError: any) {
        if (apiError?.message === 'OPENAI_API_KEY_NOT_CONFIGURED') {
          Alert.alert(
            'Exercise Analysis Not Configured',
            'Exercise analysis is not configured. Please contact support.'
          );
          setIsAnalyzingFood(false);
          return;
        }
        throw apiError;
      }

      if (parsedExercises.length > 0) {
        const newExerciseEntry: ExerciseEntry = {
          id: generateId(),
          prompt: trimmed,
          exercises: parsedExercises,
          timestamp: Date.now(),
        };

        setExercisesByDate((prev) => ({
          ...prev,
          [currentDateKey]: [...(prev[currentDateKey] || []), newExerciseEntry],
        }));

        await incrementEntryCount();
        await analyticsService.trackExerciseLogged(selectedDate);
        return;
      }

      if (__DEV__) console.log('No foods or exercises recognized:', trimmed);
      Alert.alert(
        'No Entry Detected',
        'We couldn’t recognize any foods or exercises. Try adding more detail or separate your entries.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      if (__DEV__) console.error('Error processing food input:', error);
      Alert.alert(
        'Error',
        'Something went wrong while processing your log. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsAnalyzingFood(false);
    }
  };

  const handleRemoveFood = (foodId: string) => {
    analyticsService.trackFoodItemRemoval();
    setMealsByDate(prev => {
      const currentMeals = prev[currentDateKey] || [];
      const updatedMeals = currentMeals
        .map(meal => {
          if (!meal.foods.some(food => food.id === foodId)) {
            return meal;
          }
          const filteredFoods = meal.foods.filter(food => food.id !== foodId);
          return {
            ...meal,
            foods: filteredFoods,
            updatedAt: new Date().toISOString(),
          };
        })
        .filter(meal => meal.foods.length > 0); // Remove meals with no foods

      return {
        ...prev,
        [currentDateKey]: updatedMeals
      };
    });
  };

  const handleEditMealPrompt = async (mealId: string, newPrompt: string) => {
    // Enforce free plan entry limit for edits
    if (!(await canAddEntry())) {
      Alert.alert(
        'Entry Limit Reached',
        'You have reached your free entry limit. Upgrade to Premium for unlimited entries.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => handleOpenSubscription() },
        ]
      );
      return;
    }
    try {
      setIsAnalyzingFood(true);
      let parsedFoods;
      try {
        parsedFoods = await analyzeFoodWithChatGPT(newPrompt);
      } catch (apiError: any) {
        if (apiError?.message === 'OPENAI_API_KEY_NOT_CONFIGURED') {
          Alert.alert(
            'Food Analysis Not Configured',
            'Food analysis is not configured. Please contact support.'
          );
          setIsAnalyzingFood(false);
          return;
        }
        throw apiError; // Re-throw other errors
      }

      // Check if foods were detected
      if (parsedFoods.length === 0) {
        Alert.alert(
          'No Food Detected',
          'We couldn\'t recognize any food items in your input. Please try again with a clearer description.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Update meal with new prompt and foods
      setMealsByDate(prev => {
        const currentMeals = prev[currentDateKey] || [];
        const updatedMeals = currentMeals.map(meal =>
          meal.id === mealId
            ? { ...meal, prompt: newPrompt, foods: parsedFoods, updatedAt: new Date().toISOString() }
            : meal
        );
        return {
          ...prev,
          [currentDateKey]: updatedMeals,
        };
      });

      // Count this edit as an entry only after successful update
      await incrementEntryCount();
      // Track meal prompt edit
      analyticsService.trackMealPromptEdit();
    } catch (error) {
      if (__DEV__) console.error('Error re-analyzing edited prompt:', error);
      Alert.alert(
        'Error',
        'Something went wrong while processing your food input. Please try again.',
        [{ text: 'OK' }]
      );
      // Do NOT update meal or increment entry count on error
    } finally {
      setIsAnalyzingFood(false);
    }
  };

  const handleDeleteMeal = (mealId: string) => {
    Alert.alert(
      'Delete Prompt',
      'Are you sure you want to delete this prompt and its foods?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMealsByDate(prev => {
              const currentMeals = prev[currentDateKey] || [];
              const updatedMeals = currentMeals.filter(meal => meal.id !== mealId);
              return {
                ...prev,
                [currentDateKey]: updatedMeals,
              };
            });
          },
        },
      ]
    );
  };

  const handleDeleteExerciseEntry = (entryId: string) => {
    Alert.alert(
      'Delete Exercise Log',
      'Remove this exercise entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setExercisesByDate((prev) => {
              const currentEntries = prev[currentDateKey] || [];
              const updatedEntries = currentEntries.filter((entry) => entry.id !== entryId);
              return {
                ...prev,
                [currentDateKey]: updatedEntries,
              };
            });
          },
        },
      ]
    );
  };

  const handleCustomPlanTaskReward = async () => {
    const result = await dataStorage.completeEntryTask('customPlan');
    if (result.awarded) {
      const bonus = calculateTaskBonus(result.status);
      setEntryTasks(result.status);
      setTaskBonusEntries(bonus);
      Alert.alert('Bonus Unlocked', 'Custom plan created! +5 free entries added to your limit.');
    }
  };

  const handleToggleSavePrompt = async (meal: Meal) => {
    const trimmedPrompt = meal.prompt?.trim();
    if (!trimmedPrompt) return;

    const normalized = normalizePromptText(trimmedPrompt);
    const existing = savedPrompts.find(
      prompt => normalizePromptText(prompt.text) === normalized
    );

    if (existing) {
      const updated = savedPrompts.filter(prompt => prompt.id !== existing.id);
      setSavedPrompts(updated);
      await persistSavedPrompts(updated);
      return;
    }

    const sanitized = savedPrompts.filter(
      prompt => normalizePromptText(prompt.text) !== normalized
    );
    const newPrompt = createSavedPrompt(trimmedPrompt);
    const updated = [newPrompt, ...sanitized].slice(0, MAX_SAVED_PROMPTS);
    setSavedPrompts(updated);
    await persistSavedPrompts(updated);
    await analyticsService.trackSavedPromptAdded();
  };

  const handleSelectSavedPrompt = async (prompt: { text: string }) => {
    setTranscribedText(prompt.text);
    setShouldFocusInput(true);
    setHasUserTyped(true);
    await analyticsService.trackSavedPromptReused();
  };

  const handleRemoveSavedPrompt = async (id: string) => {
    const updated = savedPrompts.filter(prompt => prompt.id !== id);
    setSavedPrompts(updated);
    await persistSavedPrompts(updated);
  };

  const handlePlusPress = () => {
    setPhotoModalVisible(true);
  };

  const handleMicPress = async () => {
    if (isRecording) {
      // Stop recording and transcribe
      setIsRecording(false);
      setIsTranscribing(true);

      try {
        const transcription = await voiceService.stopRecording();
        if (transcription) {
          setTranscribedText(transcription);
          if (__DEV__) console.log('Transcription received:', transcription);
        } else {
          if (__DEV__) console.log('No transcription received');
          alert('No transcription received. Please try again.');
        }
      } catch (error) {
        if (__DEV__) console.error('Error stopping recording:', error);
        alert('Failed to transcribe audio. Please try typing instead.');
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
      try {
        const success = await voiceService.startRecording();
        if (success) {
          setIsRecording(true);
          analyticsService.trackVoiceRecording();
          if (__DEV__) console.log('Recording started successfully');
        } else {
          if (__DEV__) console.log('Failed to start recording');
          alert('Failed to start recording. Please check microphone permissions.');
        }
      } catch (error) {
        if (__DEV__) console.error('Error starting recording:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('permission')) {
          alert('Microphone permission is required. Please enable it in your device settings.');
        } else {
          alert('Failed to start recording. Please try again.');
        }
      }
    }
  };

  const handleTakePhoto = () => {
    if (isOpeningCameraRef.current || pendingActionRef.current) {
      if (__DEV__) console.log('Already processing, ignoring duplicate call');
      return;
    }

    analyticsService.trackCameraUsage();
    if (__DEV__) console.log('handleTakePhoto called - setting pending action');
    pendingActionRef.current = 'camera';
    setPhotoModalVisible(false);
  };

  const handleUploadPhoto = () => {
    if (isOpeningCameraRef.current || pendingActionRef.current) {
      if (__DEV__) console.log('Already processing, ignoring duplicate call');
      return;
    }

    analyticsService.trackPhotoLibraryUsage();
    if (__DEV__) console.log('handleUploadPhoto called - setting pending action');
    pendingActionRef.current = 'library';
    setPhotoModalVisible(false);
  };

  const resetUploadState = () => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }
    setUploadedImage(null);
    setUploadFileName('');
    setUploadProgress(0);
    setUploadStatus('uploading');
    setUploadStatusMessage(null);
    setUploadStatusVisible(false);
  };

  const simulateUpload = async (imageUri: string) => {
    // Clear any existing interval
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
    }

    // Simulate upload progress
    let progress = 0;
    uploadIntervalRef.current = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        setUploadProgress(100);
        setUploadStatus('analyzing');
        setUploadStatusMessage(null);
        setUploadStatusVisible(false);
        setIsAnalyzingFood(true);
        if (uploadIntervalRef.current) {
          clearInterval(uploadIntervalRef.current);
          uploadIntervalRef.current = null;
        }

        // Wait a moment, then start analyzing
        setTimeout(() => {
          analyzeUploadedImage(imageUri);
        }, 300);
      } else {
        setUploadProgress(Math.round(progress));
      }
    }, 300);
  };

  const analyzeUploadedImage = async (imageUri?: string) => {
    const uriToAnalyze = imageUri || uploadedImage;
    if (!uriToAnalyze) {
      if (__DEV__) console.log('No uploaded image to analyze, imageUri:', imageUri, 'uploadedImage:', uploadedImage);
      return;
    }

    try {
      setIsAnalyzingFood(true);
      if (__DEV__) console.log('Starting image analysis for URI:', uriToAnalyze);

      // Add timeout to prevent infinite hanging
      let parsedFoods;
      try {
        const analysisPromise = analyzeFoodFromImage(uriToAnalyze);
        const timeoutPromise = new Promise<ParsedFood[]>((_, reject) =>
          setTimeout(() => reject(new Error('Analysis timeout after 30 seconds')), 30000)
        );

        // Analyze the image using OpenAI Vision API
        parsedFoods = await Promise.race([analysisPromise, timeoutPromise]);
      } catch (apiError: any) {
        if (apiError?.message === 'OPENAI_API_KEY_NOT_CONFIGURED') {
          setUploadStatus('failed');
          setUploadStatusMessage('Food analysis is not configured. Please contact support.');
          setUploadStatusVisible(true);
          setIsAnalyzingFood(false);
          return;
        }
        throw apiError; // Re-throw other errors
      }

      if (__DEV__) console.log('Analysis complete, parsed foods:', parsedFoods);

      if (parsedFoods.length > 0) {
        // Get current date key at the time of analysis
        const dateKey = getDateKey(selectedDate);

        // Create a new meal entry with the image and parsed foods
        const createdAt = Date.now();
        const newMeal: Meal = {
          id: generateId(),
          prompt: `Image`,
          foods: parsedFoods,
          timestamp: createdAt,
          imageUri: uriToAnalyze,
          updatedAt: new Date().toISOString()
        };

        // Add meal to the current selected date
        setMealsByDate(prev => ({
          ...prev,
          [dateKey]: [...(prev[dateKey] || []), newMeal]
        }));
        await analyticsService.trackMealLogged(selectedDate);
        if (__DEV__) console.log('Meal added to date:', dateKey);
        resetUploadState();
      } else {
        if (__DEV__) console.log('No foods recognized in image');
        setUploadStatus('failed');
        setUploadStatusMessage('No food detected');
        setUploadStatusVisible(true);
      }
    } catch (error) {
      if (__DEV__) console.error('Error analyzing image:', error);
      setUploadStatus('failed');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUploadStatusMessage(`Failed to analyze image: ${errorMessage}`);
      setUploadStatusVisible(true);
    } finally {
      setIsAnalyzingFood(false);
    }
  };

  const handleRetryUpload = async () => {
    if (uploadStatus === 'failed' && uploadedImage) {
      // Retry analysis
      setUploadStatus('analyzing');
      setUploadStatusMessage(null);
      setUploadStatusVisible(false);
      setIsAnalyzingFood(true);
      await analyzeUploadedImage(uploadedImage);
    } else if (uploadedImage) {
      // Retry upload
      setUploadProgress(0);
      setUploadStatus('uploading');
      setUploadStatusMessage(null);
      simulateUpload(uploadedImage);
    }
  };

  const handleClosePhotoModal = () => {
    if (__DEV__) console.log('Closing photo modal');
    setPhotoModalVisible(false);
    // Don't reset upload state here - only reset if user explicitly closes
    // resetUploadState();
  };

  // Handle modal dismissal
  const handleModalDismiss = () => {
    if (__DEV__) console.log('Modal dismissed, pending action:', pendingActionRef.current);
    if (pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;

      // Wait a moment to ensure modal is fully unmounted
      setTimeout(() => {
        if (action === 'camera') {
          openCameraAfterModalClose();
        } else if (action === 'library') {
          openLibraryAfterModalClose();
        }
      }, 300);
    }
  };

  // Fallback: Open camera/library after modal closes (if onDismiss doesn't fire)
  React.useEffect(() => {
    if (!photoModalVisible && pendingActionRef.current) {
      // Give onDismiss a chance to fire first
      const timer = setTimeout(() => {
        if (pendingActionRef.current) {
          const action = pendingActionRef.current;
          pendingActionRef.current = null;

          if (__DEV__) console.log('Fallback: Opening after modal close');
          if (action === 'camera') {
            openCameraAfterModalClose();
          } else if (action === 'library') {
            openLibraryAfterModalClose();
          }
        }
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [photoModalVisible]);

  const openCameraAfterModalClose = async () => {
    if (isOpeningCameraRef.current) return;
    isOpeningCameraRef.current = true;

    try {
      if (__DEV__) console.log('Opening camera after modal close...');
      // Check if we already have permissions
      const existingPermission = await ImagePicker.getCameraPermissionsAsync();
      if (__DEV__) console.log('Existing camera permission:', existingPermission);

      let permissionResult;
      if (existingPermission.status === 'granted') {
        permissionResult = existingPermission;
      } else if (existingPermission.status === 'denied' && !existingPermission.canAskAgain) {
        // Permissions permanently denied - show alert
        alert('Camera access is denied. Please enable it in Settings to take photos.');
        isOpeningCameraRef.current = false;
        return;
      } else {
        if (__DEV__) console.log('Requesting camera permissions...');
        // Add timeout to prevent hanging
        const permissionPromise = ImagePicker.requestCameraPermissionsAsync();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Permission request timed out')), 10000)
        );

        try {
          permissionResult = await Promise.race([permissionPromise, timeoutPromise]) as typeof existingPermission;
          if (__DEV__) console.log('Permission result:', permissionResult);
        } catch (timeoutError) {
          if (__DEV__) console.error('Permission request timeout:', timeoutError);
          alert('Permission request timed out. Please try again.');
          isOpeningCameraRef.current = false;
          return;
        }
      }

      if (permissionResult.status !== 'granted') {
        alert('Sorry, we need camera permissions to take a photo!');
        isOpeningCameraRef.current = false;
        return;
      }

      if (__DEV__) console.log('Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (__DEV__) console.log('Camera result:', result);
      isOpeningCameraRef.current = false;

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;

        if (uploadIntervalRef.current) {
          clearInterval(uploadIntervalRef.current);
          uploadIntervalRef.current = null;
        }

        setUploadedImage(asset.uri);
        setUploadFileName(fileName);
        setUploadProgress(0);
        setUploadStatus('uploading');
        setUploadStatusVisible(true);

        // Pass the URI directly to avoid state timing issues
        simulateUpload(asset.uri);
      } else {
        if (__DEV__) console.log('Camera was canceled');
        resetUploadState();
      }
    } catch (error) {
      if (__DEV__) console.error('Error taking photo:', error);
      isOpeningCameraRef.current = false;
      alert(`Failed to take photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
      resetUploadState();
    }
  };

  const openLibraryAfterModalClose = async () => {
    if (isOpeningCameraRef.current) return;
    isOpeningCameraRef.current = true;

    try {
      if (__DEV__) console.log('Opening library after modal close...');
      // Check if we already have permissions
      const existingPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (__DEV__) console.log('Existing library permission:', existingPermission);

      let permissionResult;
      if (existingPermission.status === 'granted') {
        permissionResult = existingPermission;
      } else if (existingPermission.status === 'denied' && !existingPermission.canAskAgain) {
        // Permissions permanently denied - show alert
        alert('Photo library access is denied. Please enable it in Settings to upload photos.');
        isOpeningCameraRef.current = false;
        return;
      } else {
        if (__DEV__) console.log('Requesting media library permissions...');
        // Add timeout to prevent hanging
        const permissionPromise = ImagePicker.requestMediaLibraryPermissionsAsync();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Permission request timed out')), 10000)
        );

        try {
          permissionResult = await Promise.race([permissionPromise, timeoutPromise]) as typeof existingPermission;
          if (__DEV__) console.log('Permission result:', permissionResult);
        } catch (timeoutError) {
          if (__DEV__) console.error('Permission request timeout:', timeoutError);
          alert('Permission request timed out. Please try again.');
          isOpeningCameraRef.current = false;
          return;
        }
      }

      if (permissionResult.status !== 'granted') {
        alert('Sorry, we need media library permissions to upload a photo!');
        isOpeningCameraRef.current = false;
        return;
      }

      if (__DEV__) console.log('Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (__DEV__) console.log('Image picker result:', result);
      isOpeningCameraRef.current = false;

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.fileName || asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;

        if (uploadIntervalRef.current) {
          clearInterval(uploadIntervalRef.current);
          uploadIntervalRef.current = null;
        }

        setUploadedImage(asset.uri);
        setUploadFileName(fileName);
        setUploadProgress(0);
        setUploadStatus('uploading');
        setUploadStatusVisible(true);

        // Pass the URI directly to avoid state timing issues
        simulateUpload(asset.uri);
      } else {
        if (__DEV__) console.log('Image picker was canceled');
        resetUploadState();
      }
    } catch (error) {
      if (__DEV__) console.error('Error uploading photo:', error);
      isOpeningCameraRef.current = false;
      alert(`Failed to upload photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
      resetUploadState();
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (isAnalyzingFood) {
      setShowAnalyzingOverlay(true);
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShowAnalyzingOverlay(false);
        }
      });
    }
  }, [isAnalyzingFood, overlayOpacity]);

  // Removed floating blob animation

  const entryTaskItems = [
    {
      id: 'customPlan',
      title: 'Create a Custom Plan',
      description: '+5 free entries when you finish the questionnaire.',
      completed: entryTasks.customPlanCompleted,
      onPress: handleCustomPlanTaskNavigate,
    },
    {
      id: 'registration',
      title: 'Register your TrackKcal account',
      description: '+5 free entries and sync across devices.',
      completed: entryTasks.registrationCompleted,
      onPress: handleRegistrationTaskNavigate,
    },
  ];

  const formattedDate = format(selectedDate, 'd MMM, yyyy');

  if (showAdminPush) {
    return (
      <AdminPushScreen onBack={handleAdminPushBack} />
    );
  }

  if (showSetGoals) {
    return (
      <SetGoalsScreen
        onBack={handleGoalsBack}
        onSave={handleGoalsSave}
        initialGoals={savedGoals}
        onStartCustomPlan={() => {
          setShowSetGoals(false);
          setShowSetGoals(true);
        }}
        onCustomPlanCompleted={handleCustomPlanTaskReward}
      />
    );
  }

  /* WeightTracker and NutritionAnalysis moved to Modals below to prevent HomeScreen unmount */

  if (showSettings) {
    return (
      <SettingsScreen
        onBack={handleSettingsBack}
        plan={userPlan}
        onOpenSubscription={handleOpenSubscription}
        entryCount={entryCount}
        freeEntryLimit={FREE_ENTRY_LIMIT}
        totalEarnedEntries={totalEarnedEntries}
        taskBonusEntries={taskBonusEntries}
      />
    );
  }

  if (showSubscription) {
    return (
      <SubscriptionScreen onBack={handleSubscriptionBack} onSubscribe={handleSubscribe} />
    );
  }

  if (showAccount) {
    return (
      <AccountScreen onBack={handleAccountBack} />
    );
  }

  if (showAbout) {
    return (
      <AboutScreen onBack={handleAboutBack} />
    );
  }

  if (showFreeEntries) {
    return (
      <FreeEntriesScreen
        tasks={entryTaskItems}
        onBack={handleFreeEntriesBack}
      />
    );
  }

  if (showReferral) {
    const isLoggedIn = !!accountInfo?.email;
    const isPremium = userPlan === 'premium';
    const remaining = isPremium
      ? null
      : Math.max(0, FREE_ENTRY_LIMIT + totalEarnedEntries + taskBonusEntries - entryCount);

    return (
      <ReferralScreen
        isLoggedIn={isLoggedIn}
        userEmail={accountInfo?.email || null}
        referralCode={referralCode}
        totalEarnedEntriesFromReferrals={totalEarnedEntries}
        remainingEntries={remaining}
        onBack={handleReferralBack}
        onLoginPress={handleAccount}
      />
    );
  }


  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Fixed Top Navigation */}
        <TopNavigationBar
          selectedDate={formattedDate}
          userName={accountInfo?.name || "there"}
          onMenuPress={handleMenuPress}
          onCalendarPress={handleCalendarPress}
          onWeightTrackerPress={handleWeightTracker}
          onNutritionAnalysisPress={handleNutritionAnalysis}
        />

        {/* Date Selector (horizontal scroll/pan within the bar only) */}
        <DateSelector
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />

        {/* Stat Cards */}
        <StatCardsSection
          macrosData={macrosData}
          macros2Data={macros2Data}
          dailyCalories={dailyCalories}
          onScrollEnable={setScrollEnabled}
        />

        {/* Main content + input bar move together with the keyboard */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Scrollable Content for logs */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            scrollEnabled={scrollEnabled}
            keyboardShouldPersistTaps="handled"
          >
            {/* Food Log Section */}
            <FoodLogSection
              meals={currentDayMeals}
              onRemoveFood={handleRemoveFood}
              onEditMealPrompt={handleEditMealPrompt}
              savedPrompts={savedPrompts}
              onToggleSavePrompt={handleToggleSavePrompt}
              onDeleteMeal={handleDeleteMeal}
              onUpdateFood={(mealId, updatedFood) => {
                setMealsByDate(prev => {
                  const currentMeals = prev[currentDateKey] || [];
                  const updatedMeals = currentMeals.map(meal => {
                    if (meal.id !== mealId) return meal;
                    const updatedFoods = meal.foods.map(food =>
                      food.id === updatedFood.id ? updatedFood : food
                    );
                    return {
                      ...meal,
                      foods: updatedFoods,
                      updatedAt: new Date().toISOString(),
                    };
                  });
                  return {
                    ...prev,
                    [currentDateKey]: updatedMeals,
                  };
                });
              }}
            />

            <ExerciseLogSection
              entries={currentDayExercises}
              onDeleteEntry={handleDeleteExerciseEntry}
            />

            {/* Motivational Text - only show if no meals logged for current day */}
            {currentDayMeals.length === 0 && currentDayExercises.length === 0 && !hasUserTyped && (
              <View style={styles.motivationalTextContainer}>
                <Text style={[styles.motivationalTitle, { color: theme.colors.textPrimary }]}>
                  Ready when you are!
                </Text>
                <Text style={[styles.motivationalText, { color: theme.colors.textSecondary }]}>
                  Tell me what you ate or how you moved and I’ll handle the rest
                </Text>
              </View>
            )}

            {/* Bottom spacing to account for input bar height */}
            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Bottom Input Bar */}
          <BottomInputBar
            onSubmit={handleInputSubmit}
            onPlusPress={handlePlusPress}
            onMicPress={handleMicPress}
            isLoading={isAnalyzingFood}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            transcribedText={transcribedText}
            onTranscribedTextChange={setTranscribedText}
            onUserTyping={() => {
              setHasUserTyped(true);
              setShouldFocusInput(false);
            }}
            autoFocus={shouldFocusInput}
            quickPrompts={savedPrompts}
            onQuickPromptPress={handleSelectSavedPrompt}
            onQuickPromptRemove={handleRemoveSavedPrompt}
            placeholder={
              isAnalyzingFood ? "Analyzing your entry..." :
                isRecording ? "Recording..." :
                  isTranscribing ? "Transcribing..." :
                    "What did you eat or exercise?"
            }
          />
        </KeyboardAvoidingView>

        <SidebarMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onSetGoals={handleSetGoals}
          onWeightTracker={handleWeightTracker}
          onNutritionAnalysis={handleNutritionAnalysis}
          onSettings={handleSettings}
          onLogin={handleAccount}
          onAbout={handleAbout}
          onAdminPush={handleAdminPush}
          onReferral={handleOpenReferral}
          onFreeEntries={handleOpenFreeEntries}
        />

        <PhotoOptionsModal
          visible={photoModalVisible}
          onClose={handleClosePhotoModal}
          onTakePhoto={handleTakePhoto}
          onUploadPhoto={handleUploadPhoto}
          onModalDismiss={handleModalDismiss}
        />

        <ImageUploadStatus
          visible={uploadStatusVisible}
          imageUri={uploadedImage}
          fileName={uploadFileName}
          progress={uploadProgress}
          status={uploadStatus}
          statusMessage={uploadStatusMessage}
          onClose={() => {
            setUploadStatusVisible(false);
            resetUploadState();
          }}
          onRetry={handleRetryUpload}
        />

        {showAnalyzingOverlay && (
          <Animated.View
            style={[styles.analyzingOverlay, { opacity: overlayOpacity }]}
            pointerEvents={isAnalyzingFood ? 'auto' : 'none'}
          >
            <BlurView intensity={20} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={[
              styles.analyzingCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.shadow,
              }
            ]}>
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 16 }} />
              <Text style={[styles.analyzingTitle, { color: theme.colors.textPrimary }]}>
                Analyzing
              </Text>
              <Text style={[styles.analyzingSubtitle, { color: theme.colors.textSecondary }]}>
                Identifying food and macros...
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Full Screen Modals for heavy screens to prevent unmounting HomeScreen */}
        <Modal
          visible={showWeightTracker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleWeightTrackerBack}
        >
          <WeightTrackerScreen
            onBack={handleWeightTrackerBack}
            initialCurrentWeightKg={savedGoals.currentWeightKg ?? undefined}
            targetWeightKg={savedGoals.targetWeightKg ?? undefined}
            onRequestSetGoals={handleOpenSetGoalsFromWeightTracker}
          />
        </Modal>

        <Modal
          visible={showNutritionAnalysis}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleNutritionAnalysisBack}
        >
          <NutritionAnalysisScreen
            onBack={handleNutritionAnalysisBack}
            onRequestLogMeal={handleRequestLogMeal}
            onRequestLogMealForDate={handleRequestLogMealForDate}
            onRequestSetGoals={handleOpenSetGoalsFromNutritionAnalysis}
            mealsByDate={mealsByDate}
            targetCalories={goalsSet ? savedGoals.calories : undefined}
            targetProtein={goalsSet ? savedGoals.proteinGrams : undefined}
            targetCarbs={goalsSet ? savedGoals.carbsGrams : undefined}
            targetFat={goalsSet ? savedGoals.fatGrams : undefined}
          />
        </Modal>

        <CalendarModal
          visible={showCalendar}
          onClose={() => setShowCalendar(false)}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          mealsByDate={mealsByDate}
          dailyCalorieTarget={dailyCalories}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  motivationalTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    minHeight: 200,
  },
  motivationalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  motivationalText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.normal,
    color: Colors.secondaryText,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.md,
  },
  bottomSpacer: {
    height: 160, // Space for bottom input bar + chips + safe area
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  analyzingCard: {
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 200,
  },
  analyzingTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  analyzingSubtitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.normal,
  },
});
