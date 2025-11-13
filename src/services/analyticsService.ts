import AsyncStorage from '@react-native-async-storage/async-storage';

const ANALYTICS_KEY = '@journafied:analytics';

export interface AnalyticsData {
  // App usage
  totalAppOpens: number;
  lastOpenTimestamp: string | null;
  firstOpenTimestamp: string | null;
  sessionCount: number;
  totalSessionDuration: number; // in milliseconds
  currentSessionStart: string | null;
  sessions: Array<{
    start: string;
    end: string | null;
    duration: number; // in milliseconds
  }>;

  // Push notifications
  pushNotificationSentCount: number;
  pushNotificationClickedCount: number;
  lastNotificationClickTimestamp: string | null;
  lastNotificationSentTimestamp: string | null;

  // Feature usage counts
  weightTrackerOpens: number;
  nutritionAnalysisOpens: number;
  settingsOpens: number;
  voiceRecordings: number;
  cameraUsage: number;
  photoLibraryUsage: number;
  mealPromptEdits: number;
  foodItemRemovals: number;
  dateSelectorChanges: number;
  timeRangeFilterChanges: number;
  setGoalsOpens: number;
  accountScreenOpens: number;
  aboutScreenOpens: number;
  subscriptionScreenOpens: number;

  // Interaction patterns
  mealLogsByDayOfWeek: Record<string, number>; // 'Monday', 'Tuesday', etc.
  mealLogsByHour: Record<string, number>; // '0' to '23'
  weightEntriesByDayOfWeek: Record<string, number>;
  longestStreak: number; // consecutive days with activity
  currentStreak: number;
  lastActivityDate: string | null;

  // Daily stats
  averageMealsPerDay: number;
  averageWeightEntriesPerWeek: number;
  totalMealsLogged: number;
  totalWeightEntries: number;
}

const defaultAnalytics: AnalyticsData = {
  totalAppOpens: 0,
  lastOpenTimestamp: null,
  firstOpenTimestamp: null,
  sessionCount: 0,
  totalSessionDuration: 0,
  currentSessionStart: null,
  sessions: [],
  pushNotificationSentCount: 0,
  pushNotificationClickedCount: 0,
  lastNotificationClickTimestamp: null,
  lastNotificationSentTimestamp: null,
  weightTrackerOpens: 0,
  nutritionAnalysisOpens: 0,
  settingsOpens: 0,
  voiceRecordings: 0,
  cameraUsage: 0,
  photoLibraryUsage: 0,
  mealPromptEdits: 0,
  foodItemRemovals: 0,
  dateSelectorChanges: 0,
  timeRangeFilterChanges: 0,
  setGoalsOpens: 0,
  accountScreenOpens: 0,
  aboutScreenOpens: 0,
  subscriptionScreenOpens: 0,
  mealLogsByDayOfWeek: {},
  mealLogsByHour: {},
  weightEntriesByDayOfWeek: {},
  longestStreak: 0,
  currentStreak: 0,
  lastActivityDate: null,
  averageMealsPerDay: 0,
  averageWeightEntriesPerWeek: 0,
  totalMealsLogged: 0,
  totalWeightEntries: 0,
};

class AnalyticsService {
  private analytics: AnalyticsData = defaultAnalytics;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const data = await AsyncStorage.getItem(ANALYTICS_KEY);
      if (data) {
        this.analytics = { ...defaultAnalytics, ...JSON.parse(data) };
      } else {
        this.analytics = { ...defaultAnalytics };
      }

      // Set first open timestamp if not set
      if (!this.analytics.firstOpenTimestamp) {
        this.analytics.firstOpenTimestamp = new Date().toISOString();
        await this.save();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing analytics:', error);
      this.analytics = { ...defaultAnalytics };
      this.initialized = true;
    }
  }

  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(this.analytics));
    } catch (error) {
      console.error('Error saving analytics:', error);
    }
  }

  // App lifecycle
  async trackAppOpen(): Promise<void> {
    await this.initialize();
    const now = new Date().toISOString();
    this.analytics.totalAppOpens++;
    this.analytics.lastOpenTimestamp = now;
    this.analytics.currentSessionStart = now;
    this.analytics.sessionCount++;
    await this.save();
  }

  async trackAppClose(): Promise<void> {
    await this.initialize();
    if (this.analytics.currentSessionStart) {
      const start = new Date(this.analytics.currentSessionStart);
      const end = new Date();
      const duration = end.getTime() - start.getTime();

      this.analytics.totalSessionDuration += duration;
      this.analytics.sessions.push({
        start: this.analytics.currentSessionStart,
        end: end.toISOString(),
        duration,
      });

      // Keep only last 100 sessions
      if (this.analytics.sessions.length > 100) {
        this.analytics.sessions = this.analytics.sessions.slice(-100);
      }

      this.analytics.currentSessionStart = null;
      await this.save();
    }
  }

  // Feature usage
  async trackWeightTrackerOpen(): Promise<void> {
    await this.initialize();
    this.analytics.weightTrackerOpens++;
    await this.save();
  }

  async trackNutritionAnalysisOpen(): Promise<void> {
    await this.initialize();
    this.analytics.nutritionAnalysisOpens++;
    await this.save();
  }

  async trackSettingsOpen(): Promise<void> {
    await this.initialize();
    this.analytics.settingsOpens++;
    await this.save();
  }

  async trackVoiceRecording(): Promise<void> {
    await this.initialize();
    this.analytics.voiceRecordings++;
    await this.save();
  }

  async trackCameraUsage(): Promise<void> {
    await this.initialize();
    this.analytics.cameraUsage++;
    await this.save();
  }

  async trackPhotoLibraryUsage(): Promise<void> {
    await this.initialize();
    this.analytics.photoLibraryUsage++;
    await this.save();
  }

  async trackMealPromptEdit(): Promise<void> {
    await this.initialize();
    this.analytics.mealPromptEdits++;
    await this.save();
  }

  async trackFoodItemRemoval(): Promise<void> {
    await this.initialize();
    this.analytics.foodItemRemovals++;
    await this.save();
  }

  async trackDateSelectorChange(): Promise<void> {
    await this.initialize();
    this.analytics.dateSelectorChanges++;
    await this.save();
  }

  async trackTimeRangeFilterChange(): Promise<void> {
    await this.initialize();
    this.analytics.timeRangeFilterChanges++;
    await this.save();
  }

  async trackSetGoalsOpen(): Promise<void> {
    await this.initialize();
    this.analytics.setGoalsOpens++;
    await this.save();
  }

  async trackAccountScreenOpen(): Promise<void> {
    await this.initialize();
    this.analytics.accountScreenOpens++;
    await this.save();
  }

  async trackAboutScreenOpen(): Promise<void> {
    await this.initialize();
    this.analytics.aboutScreenOpens++;
    await this.save();
  }

  async trackSubscriptionScreenOpen(): Promise<void> {
    await this.initialize();
    this.analytics.subscriptionScreenOpens++;
    await this.save();
  }

  // Push notifications
  async trackPushNotificationSent(): Promise<void> {
    await this.initialize();
    this.analytics.pushNotificationSentCount++;
    this.analytics.lastNotificationSentTimestamp = new Date().toISOString();
    await this.save();
  }

  async trackPushNotificationClicked(): Promise<void> {
    await this.initialize();
    this.analytics.pushNotificationClickedCount++;
    this.analytics.lastNotificationClickTimestamp = new Date().toISOString();
    await this.save();
  }

  // Activity tracking
  async trackMealLogged(date?: Date): Promise<void> {
    await this.initialize();
    const logDate = date || new Date();
    const dayOfWeek = logDate.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = logDate.getHours().toString();

    this.analytics.totalMealsLogged++;
    this.analytics.mealLogsByDayOfWeek[dayOfWeek] = (this.analytics.mealLogsByDayOfWeek[dayOfWeek] || 0) + 1;
    this.analytics.mealLogsByHour[hour] = (this.analytics.mealLogsByHour[hour] || 0) + 1;

    await this.updateStreak(logDate);
    await this.updateAverages();
    await this.save();
  }

  async trackWeightEntryLogged(date?: Date): Promise<void> {
    await this.initialize();
    const logDate = date || new Date();
    const dayOfWeek = logDate.toLocaleDateString('en-US', { weekday: 'long' });

    this.analytics.totalWeightEntries++;
    this.analytics.weightEntriesByDayOfWeek[dayOfWeek] = (this.analytics.weightEntriesByDayOfWeek[dayOfWeek] || 0) + 1;

    await this.updateStreak(logDate);
    await this.updateAverages();
    await this.save();
  }

  private async updateStreak(activityDate: Date): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activity = new Date(activityDate);
    activity.setHours(0, 0, 0, 0);

    const lastActivity = this.analytics.lastActivityDate
      ? new Date(this.analytics.lastActivityDate)
      : null;

    if (lastActivity) {
      lastActivity.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((activity.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        // Same day, no change
        return;
      } else if (daysDiff === 1) {
        // Consecutive day
        this.analytics.currentStreak++;
      } else {
        // Streak broken
        if (this.analytics.currentStreak > this.analytics.longestStreak) {
          this.analytics.longestStreak = this.analytics.currentStreak;
        }
        this.analytics.currentStreak = 1;
      }
    } else {
      // First activity
      this.analytics.currentStreak = 1;
    }

    this.analytics.lastActivityDate = activity.toISOString();
  }

  private async updateAverages(): Promise<void> {
    if (!this.analytics.firstOpenTimestamp) return;

    const firstOpen = new Date(this.analytics.firstOpenTimestamp);
    const now = new Date();
    const daysSinceFirstUse = Math.max(1, Math.floor((now.getTime() - firstOpen.getTime()) / (1000 * 60 * 60 * 24)));

    this.analytics.averageMealsPerDay = this.analytics.totalMealsLogged / daysSinceFirstUse;

    const weeksSinceFirstUse = Math.max(1, daysSinceFirstUse / 7);
    this.analytics.averageWeightEntriesPerWeek = this.analytics.totalWeightEntries / weeksSinceFirstUse;
  }

  // Get analytics data
  async getAnalytics(): Promise<AnalyticsData> {
    await this.initialize();
    await this.updateAverages();
    return { ...this.analytics };
  }

  // Get average session duration in minutes
  getAverageSessionDuration(): number {
    if (this.analytics.sessionCount === 0) return 0;
    return (this.analytics.totalSessionDuration / this.analytics.sessionCount) / (1000 * 60);
  }

  // Get days since first use
  getDaysSinceFirstUse(): number {
    if (!this.analytics.firstOpenTimestamp) return 0;
    const firstOpen = new Date(this.analytics.firstOpenTimestamp);
    const now = new Date();
    return Math.floor((now.getTime() - firstOpen.getTime()) / (1000 * 60 * 60 * 24));
  }
}

export const analyticsService = new AnalyticsService();



