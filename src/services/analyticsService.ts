import AsyncStorage from '@react-native-async-storage/async-storage';
import { dataStorage } from './dataStorage';
import { mixpanelService } from './mixpanelService';

const ANALYTICS_KEY = '@trackkal:analytics';

export interface AnalyticsData {
  // App usage
  totalAppOpens: number;
  lastOpenTimestamp: string | null;
  firstOpenTimestamp: string | null;
  sessionCount: number;
  totalSessionDuration: number; // in milliseconds
  currentSessionStart: string | null;

  // Push notifications
  pushNotificationSentCount: number;
  pushNotificationClickedCount: number;
  lastNotificationClickTimestamp: string | null;
  lastNotificationSentTimestamp: string | null;

  // Feature usage counts (meaningful ones only)
  weightTrackerOpens: number;
  nutritionAnalysisOpens: number;
  voiceRecordings: number;
  cameraUsage: number;
  photoLibraryUsage: number;
  mealPromptEdits: number;
  foodItemRemovals: number;
  setGoalsOpens: number;
  subscriptionScreenOpens: number;

  // Interaction patterns
  mealLogsByDayOfWeek: Record<string, number>;
  mealLogsByHour: Record<string, number>;
  weightEntriesByDayOfWeek: Record<string, number>;
  longestStreak: number;
  currentStreak: number;
  lastActivityDate: string | null;

  // Daily stats
  daysWithMealLogs: number; // actual days user logged food
  averageMealsPerDay: number;
  averageWeightEntriesPerWeek: number;
  totalMealsLogged: number;
  totalExercisesLogged: number;
  totalWeightEntries: number;
  savedPromptsSaved: number;
  savedPromptsReused: number;

  // Smart reminders
  smartRemindersScheduled: number;
  smartRemindersOpened: number;
  smartRemindersEffective: number;

  // Referral tracking
  referralCodesGenerated: number;
  referralCodesShared: number;
  referralCodesSharedByMethod: {
    share: number;
    copy: number;
    link: number;
  };
  referralCodesRedeemed: number;
  referralRewardsEarned: number;
  referralRewardsEarnedAsReferrer: number;
  referralRewardsEarnedAsReferee: number;
  referralCodeClicks: number;

  // Onboarding funnel
  onboardingStarted: boolean;
  onboardingGoalSet: boolean;
  onboardingFirstMealLogged: boolean;
  onboardingCompleted: boolean;
  onboardingStartedTimestamp: string | null;
  onboardingCompletedTimestamp: string | null;
}

const defaultAnalytics: AnalyticsData = {
  totalAppOpens: 0,
  lastOpenTimestamp: null,
  firstOpenTimestamp: null,
  sessionCount: 0,
  totalSessionDuration: 0,
  currentSessionStart: null,
  pushNotificationSentCount: 0,
  pushNotificationClickedCount: 0,
  lastNotificationClickTimestamp: null,
  lastNotificationSentTimestamp: null,
  weightTrackerOpens: 0,
  nutritionAnalysisOpens: 0,
  voiceRecordings: 0,
  cameraUsage: 0,
  photoLibraryUsage: 0,
  mealPromptEdits: 0,
  foodItemRemovals: 0,
  setGoalsOpens: 0,
  subscriptionScreenOpens: 0,
  mealLogsByDayOfWeek: {},
  mealLogsByHour: {},
  weightEntriesByDayOfWeek: {},
  longestStreak: 0,
  currentStreak: 0,
  lastActivityDate: null,
  daysWithMealLogs: 0,
  averageMealsPerDay: 0,
  averageWeightEntriesPerWeek: 0,
  totalMealsLogged: 0,
  totalExercisesLogged: 0,
  totalWeightEntries: 0,
  savedPromptsSaved: 0,
  savedPromptsReused: 0,
  smartRemindersScheduled: 0,
  smartRemindersOpened: 0,
  smartRemindersEffective: 0,
  referralCodesGenerated: 0,
  referralCodesShared: 0,
  referralCodesSharedByMethod: { share: 0, copy: 0, link: 0 },
  referralCodesRedeemed: 0,
  referralRewardsEarned: 0,
  referralRewardsEarnedAsReferrer: 0,
  referralRewardsEarnedAsReferee: 0,
  referralCodeClicks: 0,
  onboardingStarted: false,
  onboardingGoalSet: false,
  onboardingFirstMealLogged: false,
  onboardingCompleted: false,
  onboardingStartedTimestamp: null,
  onboardingCompletedTimestamp: null,
};

class AnalyticsService {
  private analytics: AnalyticsData = defaultAnalytics;
  private initialized = false;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMealLogDate: string | null = null; // tracks unique days for daysWithMealLogs

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Mixpanel in parallel with local storage
      mixpanelService.initialize().catch(() => {});

      const data = await AsyncStorage.getItem(ANALYTICS_KEY);
      if (data) {
        this.analytics = { ...defaultAnalytics, ...JSON.parse(data) };
      } else {
        this.analytics = { ...defaultAnalytics };
      }

      if (!this.analytics.firstOpenTimestamp) {
        this.analytics.firstOpenTimestamp = new Date().toISOString();
        await this.flushNow();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing analytics:', error);
      this.analytics = { ...defaultAnalytics };
      this.initialized = true;
    }
  }

  // ── Batched save system ──
  // Instead of writing to AsyncStorage on every single track call,
  // we mark the state as dirty and flush once after 1 second of inactivity.
  // This turns 10+ writes per session into 1-2 writes.

  private markDirty(): void {
    if (this.dirty) return;
    this.dirty = true;
    this.flushTimer = setTimeout(() => this.flushNow(), 1000);
  }

  private async flushNow(): Promise<void> {
    this.dirty = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    try {
      await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(this.analytics));
    } catch (error) {
      console.error('Error saving analytics:', error);
    }
  }

  // ── App lifecycle ──

  async trackAppOpen(): Promise<void> {
    await this.initialize();
    const now = new Date().toISOString();
    this.analytics.totalAppOpens++;
    this.analytics.lastOpenTimestamp = now;
    this.analytics.currentSessionStart = now;
    this.analytics.sessionCount++;
    this.markDirty();

    mixpanelService.track('app_open', { session_number: this.analytics.sessionCount });
    dataStorage.logAnalyticsEvent('app_open', { timestamp: now });
  }

  async trackAppClose(): Promise<void> {
    await this.initialize();
    if (this.analytics.currentSessionStart) {
      const start = new Date(this.analytics.currentSessionStart);
      const end = new Date();
      const duration = end.getTime() - start.getTime();

      this.analytics.totalSessionDuration += duration;
      this.analytics.currentSessionStart = null;

      mixpanelService.track('app_close', { session_duration_ms: duration });
      mixpanelService.flush();

      // Force immediate write on close — app may be killed after this
      await this.flushNow();
    }
  }

  // ── User identification (Mixpanel) ──

  identifyUser(userId: string, traits?: { name?: string; email?: string; plan?: string }): void {
    mixpanelService.identify(userId, {
      ...(traits?.name && { $name: traits.name }),
      ...(traits?.email && { $email: traits.email }),
      ...(traits?.plan && { plan: traits.plan }),
    });
  }

  // ── Feature usage ──

  async trackWeightTrackerOpen(): Promise<void> {
    await this.initialize();
    this.analytics.weightTrackerOpens++;
    this.markDirty();
    mixpanelService.track('weight_tracker_open');
  }

  async trackNutritionAnalysisOpen(): Promise<void> {
    await this.initialize();
    this.analytics.nutritionAnalysisOpens++;
    this.markDirty();
    mixpanelService.track('nutrition_analysis_open');
  }

  async trackVoiceRecording(): Promise<void> {
    await this.initialize();
    this.analytics.voiceRecordings++;
    this.markDirty();
    mixpanelService.track('voice_recording');
  }

  async trackCameraUsage(): Promise<void> {
    await this.initialize();
    this.analytics.cameraUsage++;
    this.markDirty();
    mixpanelService.track('camera_usage');
  }

  async trackPhotoLibraryUsage(): Promise<void> {
    await this.initialize();
    this.analytics.photoLibraryUsage++;
    this.markDirty();
    mixpanelService.track('photo_library_usage');
  }

  async trackMealPromptEdit(): Promise<void> {
    await this.initialize();
    this.analytics.mealPromptEdits++;
    this.markDirty();
    mixpanelService.track('meal_prompt_edit');
  }

  async trackFoodItemRemoval(): Promise<void> {
    await this.initialize();
    this.analytics.foodItemRemovals++;
    this.markDirty();
    mixpanelService.track('food_item_removal');
  }

  async trackSetGoalsOpen(): Promise<void> {
    await this.initialize();
    this.analytics.setGoalsOpens++;
    this.markDirty();
    mixpanelService.track('set_goals_open');
  }

  async trackSubscriptionScreenOpen(): Promise<void> {
    await this.initialize();
    this.analytics.subscriptionScreenOpens++;
    this.markDirty();
    mixpanelService.track('subscription_screen_open');
  }

  async trackSavedPromptAdded(): Promise<void> {
    await this.initialize();
    this.analytics.savedPromptsSaved++;
    this.markDirty();
    mixpanelService.track('saved_prompt_added');
  }

  async trackSavedPromptReused(): Promise<void> {
    await this.initialize();
    this.analytics.savedPromptsReused++;
    this.markDirty();
    mixpanelService.track('saved_prompt_reused');
  }

  // ── Push notifications ──

  async trackPushNotificationSent(): Promise<void> {
    await this.initialize();
    this.analytics.pushNotificationSentCount++;
    this.analytics.lastNotificationSentTimestamp = new Date().toISOString();
    this.markDirty();
    mixpanelService.track('push_notification_sent');
  }

  async trackPushNotificationClicked(): Promise<void> {
    await this.initialize();
    this.analytics.pushNotificationClickedCount++;
    this.analytics.lastNotificationClickTimestamp = new Date().toISOString();
    this.markDirty();
    mixpanelService.track('push_notification_clicked');
  }

  // ── Activity tracking ──

  async trackMealLogged(date?: Date): Promise<void> {
    await this.initialize();
    const logDate = date || new Date();
    const dayOfWeek = logDate.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = logDate.getHours().toString();
    const dateKey = logDate.toISOString().slice(0, 10); // "2026-03-01"

    this.analytics.totalMealsLogged++;
    this.analytics.mealLogsByDayOfWeek[dayOfWeek] = (this.analytics.mealLogsByDayOfWeek[dayOfWeek] || 0) + 1;
    this.analytics.mealLogsByHour[hour] = (this.analytics.mealLogsByHour[hour] || 0) + 1;

    // Track unique days with meal logs for accurate average
    if (this.lastMealLogDate !== dateKey) {
      this.lastMealLogDate = dateKey;
      this.analytics.daysWithMealLogs = (this.analytics.daysWithMealLogs || 0) + 1;
    }

    // Check if this is the first meal ever logged (onboarding)
    if (this.analytics.totalMealsLogged === 1 && !this.analytics.onboardingFirstMealLogged) {
      this.analytics.onboardingFirstMealLogged = true;
      this.checkOnboardingComplete();
    }

    this.updateStreak(logDate);
    this.updateAverages();
    this.markDirty();

    mixpanelService.track('meal_logged', {
      day_of_week: dayOfWeek,
      hour: parseInt(hour),
      total_meals: this.analytics.totalMealsLogged,
    });
  }

  async trackExerciseLogged(date?: Date): Promise<void> {
    await this.initialize();
    const logDate = date || new Date();
    this.analytics.totalExercisesLogged++;
    this.updateStreak(logDate);
    this.markDirty();
    mixpanelService.track('exercise_logged', { total_exercises: this.analytics.totalExercisesLogged });
  }

  async trackWeightEntryLogged(date?: Date): Promise<void> {
    await this.initialize();
    const logDate = date || new Date();
    const dayOfWeek = logDate.toLocaleDateString('en-US', { weekday: 'long' });

    this.analytics.totalWeightEntries++;
    this.analytics.weightEntriesByDayOfWeek[dayOfWeek] = (this.analytics.weightEntriesByDayOfWeek[dayOfWeek] || 0) + 1;

    this.updateStreak(logDate);
    this.updateAverages();
    this.markDirty();
    mixpanelService.track('weight_entry_logged', { total_entries: this.analytics.totalWeightEntries });
  }

  private updateStreak(activityDate: Date): void {
    const activity = new Date(activityDate);
    activity.setHours(0, 0, 0, 0);

    const lastActivity = this.analytics.lastActivityDate
      ? new Date(this.analytics.lastActivityDate)
      : null;

    if (lastActivity) {
      lastActivity.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((activity.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        return; // Same day
      } else if (daysDiff === 1) {
        this.analytics.currentStreak++;
      } else if (daysDiff === -1) {
        // Backdated entry for yesterday — don't break streak
        return;
      } else {
        if (this.analytics.currentStreak > this.analytics.longestStreak) {
          this.analytics.longestStreak = this.analytics.currentStreak;
        }
        this.analytics.currentStreak = 1;
      }
    } else {
      this.analytics.currentStreak = 1;
    }

    // Only update lastActivityDate if this is the most recent activity
    if (!lastActivity || activity.getTime() >= lastActivity.getTime()) {
      this.analytics.lastActivityDate = activity.toISOString();
    }
  }

  private updateAverages(): void {
    // Use actual days with data, not days since install
    const activeDays = Math.max(1, this.analytics.daysWithMealLogs || 1);
    this.analytics.averageMealsPerDay = this.analytics.totalMealsLogged / activeDays;

    if (this.analytics.firstOpenTimestamp) {
      const firstOpen = new Date(this.analytics.firstOpenTimestamp);
      const now = new Date();
      const daysSinceFirstUse = Math.max(1, Math.floor((now.getTime() - firstOpen.getTime()) / (1000 * 60 * 60 * 24)));
      const weeksSinceFirstUse = Math.max(1, daysSinceFirstUse / 7);
      this.analytics.averageWeightEntriesPerWeek = this.analytics.totalWeightEntries / weeksSinceFirstUse;
    }
  }

  // ── Getters ──

  async getAnalytics(): Promise<AnalyticsData> {
    await this.initialize();
    this.updateAverages();
    return { ...this.analytics };
  }

  getAverageSessionDuration(): number {
    if (this.analytics.sessionCount === 0) return 0;
    return (this.analytics.totalSessionDuration / this.analytics.sessionCount) / (1000 * 60);
  }

  getDaysSinceFirstUse(): number {
    if (!this.analytics.firstOpenTimestamp) return 0;
    const firstOpen = new Date(this.analytics.firstOpenTimestamp);
    const now = new Date();
    return Math.floor((now.getTime() - firstOpen.getTime()) / (1000 * 60 * 60 * 24));
  }

  // ── Smart reminders ──

  async trackSmartReminderScheduled(count: number = 1): Promise<void> {
    await this.initialize();
    this.analytics.smartRemindersScheduled += count;
    this.markDirty();
    mixpanelService.track('smart_reminder_scheduled', { count });
  }

  async trackSmartReminderOpened(): Promise<void> {
    await this.initialize();
    this.analytics.smartRemindersOpened++;
    this.markDirty();
    mixpanelService.track('smart_reminder_opened');
  }

  async trackSmartReminderEffective(): Promise<void> {
    await this.initialize();
    this.analytics.smartRemindersEffective++;
    this.markDirty();
    mixpanelService.track('smart_reminder_effective');
  }

  // ── Referral tracking ──

  async trackReferralCodeGenerated(userId: string): Promise<void> {
    await this.initialize();
    this.analytics.referralCodesGenerated += 1;
    this.markDirty();
    mixpanelService.track('referral_code_generated');
  }

  async trackReferralCodeShared(userId: string, method: 'share' | 'copy' | 'link'): Promise<void> {
    await this.initialize();
    this.analytics.referralCodesShared += 1;
    this.analytics.referralCodesSharedByMethod[method] += 1;
    this.markDirty();

    mixpanelService.track('referral_shared', { method });
    dataStorage.logAnalyticsEvent('referral_shared', { userId, method });
  }

  async trackReferralCodeRedeemed(referralCode: string, refereeEmail: string): Promise<void> {
    await this.initialize();
    this.analytics.referralCodesRedeemed += 1;
    this.markDirty();
    mixpanelService.track('referral_redeemed');
  }

  async trackReferralRewardEarned(
    userId: string,
    entriesAwarded: number,
    type: 'referrer' | 'referee'
  ): Promise<void> {
    await this.initialize();
    this.analytics.referralRewardsEarned += 1;
    if (type === 'referrer') {
      this.analytics.referralRewardsEarnedAsReferrer += 1;
    } else {
      this.analytics.referralRewardsEarnedAsReferee += 1;
    }
    this.markDirty();
    mixpanelService.track('referral_reward_earned', { type, entries_awarded: entriesAwarded });
  }

  async trackReferralCodeClick(referralCode: string): Promise<void> {
    await this.initialize();
    this.analytics.referralCodeClicks += 1;
    this.markDirty();
    mixpanelService.track('referral_code_click');
  }

  // ── Onboarding funnel ──

  async trackOnboardingStarted(): Promise<void> {
    await this.initialize();
    if (this.analytics.onboardingStarted) return; // only track once
    this.analytics.onboardingStarted = true;
    this.analytics.onboardingStartedTimestamp = new Date().toISOString();
    this.markDirty();
    mixpanelService.track('onboarding_started');
  }

  async trackOnboardingGoalSet(): Promise<void> {
    await this.initialize();
    if (this.analytics.onboardingGoalSet) return;
    this.analytics.onboardingGoalSet = true;
    this.checkOnboardingComplete();
    this.markDirty();
    mixpanelService.track('onboarding_goal_set');
  }

  async trackOnboardingFirstMealLogged(): Promise<void> {
    await this.initialize();
    if (this.analytics.onboardingFirstMealLogged) return;
    this.analytics.onboardingFirstMealLogged = true;
    this.checkOnboardingComplete();
    this.markDirty();
    mixpanelService.track('onboarding_first_meal_logged');
  }

  private checkOnboardingComplete(): void {
    if (
      this.analytics.onboardingStarted &&
      this.analytics.onboardingGoalSet &&
      this.analytics.onboardingFirstMealLogged &&
      !this.analytics.onboardingCompleted
    ) {
      this.analytics.onboardingCompleted = true;
      this.analytics.onboardingCompletedTimestamp = new Date().toISOString();
      mixpanelService.track('onboarding_completed');
    }
  }

  async getOnboardingStatus(): Promise<{
    started: boolean;
    goalSet: boolean;
    firstMealLogged: boolean;
    completed: boolean;
  }> {
    await this.initialize();
    return {
      started: this.analytics.onboardingStarted,
      goalSet: this.analytics.onboardingGoalSet,
      firstMealLogged: this.analytics.onboardingFirstMealLogged,
      completed: this.analytics.onboardingCompleted,
    };
  }

  // ── Generic event tracking ──

  async trackEvent(eventName: string, properties?: any): Promise<void> {
    mixpanelService.track(eventName, properties);
    await dataStorage.logAnalyticsEvent(eventName, properties);
  }
}

export const analyticsService = new AnalyticsService();
