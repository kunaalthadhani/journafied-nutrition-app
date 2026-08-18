import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { format, startOfWeek } from 'date-fns';
import { dataStorage } from './dataStorage';

const READ_KEY = '@weekly_review_last_read';

export const WEEKLY_REVIEW_NOTIFICATION_ID = 'weekly-review-sunday';

// Sunday evening, after the week is done and before the next one starts.
const REVIEW_WEEKDAY = 1; // expo counts 1 as Sunday
const REVIEW_HOUR = 18;
const REVIEW_MINUTE = 0;

/**
 * The review always covers the week that just ended, so its key rolls over on
 * Sunday no matter which day the calorie bank cycle starts on. The push, the
 * banner and the card all have to be talking about the same week.
 */
export const reviewWeekKey = (now: Date = new Date()): string =>
  format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd');

export const weeklyReviewService = {
  /**
   * A Sunday 18:00 local repeat. Local rather than server sent, so it fires
   * offline and costs nothing. The review itself is still written on demand
   * when the user opens the card, which keeps the AI call off the phones of
   * people who never read it.
   */
  async scheduleSundayReminder(): Promise<void> {
    try {
      const prefs = await dataStorage.loadPreferences();
      if (prefs?.notificationsEnabled === false) {
        await this.cancelSundayReminder();
        return;
      }

      const permission = await Notifications.getPermissionsAsync();
      if (permission.status !== 'granted') return;

      // Rescheduling the same identifier replaces it, so copy edits ship
      // without stacking duplicates.
      await Notifications.scheduleNotificationAsync({
        identifier: WEEKLY_REVIEW_NOTIFICATION_ID,
        content: {
          title: 'Your week is in',
          body: 'Your nutrition review for the week is ready. See what changed.',
          sound: 'default',
          data: { type: 'weekly_review' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: REVIEW_WEEKDAY,
          hour: REVIEW_HOUR,
          minute: REVIEW_MINUTE,
        },
      });
    } catch (err) {
      console.log('[weeklyReview] Could not schedule Sunday reminder', err);
    }
  },

  async cancelSundayReminder(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(WEEKLY_REVIEW_NOTIFICATION_ID);
    } catch {
      // Never scheduled, or already gone
    }
  },

  /**
   * True when this week's review has not been opened yet. Rolls over on its
   * own every Sunday because the key does.
   */
  async isUnread(now: Date = new Date()): Promise<boolean> {
    try {
      const lastRead = await AsyncStorage.getItem(READ_KEY);
      return lastRead !== reviewWeekKey(now);
    } catch {
      return false;
    }
  },

  async markRead(now: Date = new Date()): Promise<void> {
    try {
      await AsyncStorage.setItem(READ_KEY, reviewWeekKey(now));
    } catch {
      // A missed mark just means the banner shows once more
    }
  },
};
