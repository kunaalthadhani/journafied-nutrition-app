import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { dataStorage, PushBroadcastRecord } from './dataStorage';

// Configure how notifications behave when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

interface RegistrationResult {
  status: 'granted' | 'denied' | 'not_physical' | 'error';
  token?: string;
  error?: string;
}

interface BroadcastResult {
  id: string;
  successCount: number;
  failureCount: number;
  targetCount: number;
  errors: Array<{ token: string; error: string }>;
}

const generateBroadcastId = () =>
  `broadcast_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const notificationService = {
  /**
   * Request permissions and register the device for push notifications.
   * Saves the Expo push token locally via dataStorage so it can be used for broadcasts.
   */
  async registerDeviceAsync(): Promise<RegistrationResult> {
    try {
      if (!Device.isDevice) {
        console.warn('[notifications] Push notifications require a physical device.');
        return { status: 'not_physical', error: 'Requires physical device' };
      }

      const existingPermission = await Notifications.getPermissionsAsync();
      let finalStatus = existingPermission.status;

      if (existingPermission.status !== 'granted') {
        const permissionRequest = await Notifications.requestPermissionsAsync();
        finalStatus = permissionRequest.status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[notifications] Permission not granted:', finalStatus);
        return { status: 'denied' };
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId ??
        (Constants as any)?.manifest?.extra?.eas?.projectId ??
        (Constants as any)?.manifest2?.extra?.eas?.projectId;

      if (!projectId) {
        console.warn(
          '[notifications] Registration error: No "projectId" found in Expo config. ' +
          'If you are running a bare or custom dev client, set EAS projectId or EXPO_PUBLIC_EAS_PROJECT_ID. ' +
          'Skipping push token registration for now.'
        );
        return { status: 'error', error: 'Missing projectId in Expo config' };
      }

      const expoTokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });

      const token = expoTokenResponse.data;
      if (!token) {
        console.warn('[notifications] Failed to obtain Expo push token.');
        return { status: 'error', error: 'Missing Expo token' };
      }

      await dataStorage.addPushToken(token);
      console.log('[notifications] Registered Expo token:', token);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00FFEC',
        });
      }

      return { status: 'granted', token };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[notifications] Registration error:', message);
      return { status: 'error', error: message };
    }
  },

  /**
   * Helper to fetch the latest push tokens stored locally.
   */
  async getStoredPushTokens(): Promise<string[]> {
    return dataStorage.loadPushTokens();
  },

  async getBroadcastHistory(): Promise<PushBroadcastRecord[]> {
    return dataStorage.loadPushHistory();
  },

  /**
   * Send a push notification to every stored token via the Expo push API.
   * Returns a breakdown of successes / failures for diagnostics.
   */
  async sendBroadcastPush(title: string, body: string): Promise<BroadcastResult> {
    const tokens = await this.getStoredPushTokens();
    if (tokens.length === 0) {
      Alert.alert('No Registered Devices', 'No Expo push tokens are stored yet.');
      return {
        id: '',
        successCount: 0,
        failureCount: 0,
        targetCount: 0,
        errors: [],
      };
    }

    const broadcastId = generateBroadcastId();
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ token: string; error: string }> = [];

    for (const token of tokens) {
      try {
        await this.sendPushToToken(token, title, body, broadcastId);
        successCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[notifications] Failed push:', token, message);
        failureCount += 1;
        errors.push({ token, error: message });
      }
    }

    const record: PushBroadcastRecord = {
      id: broadcastId,
      title,
      message: body,
      timestamp: new Date().toISOString(),
      targetCount: tokens.length,
      successCount,
      failureCount,
      clickCount: 0,
    };
    await dataStorage.addPushHistoryRecord(record);

    if (failureCount > 0) {
      Alert.alert(
        'Push Broadcast Completed',
        `Delivered to ${successCount} device(s). ${failureCount} failed. Check console for details.`
      );
    } else {
      Alert.alert('Push Broadcast Completed', `Delivered to ${successCount} device(s).`);
    }

    return { id: broadcastId, successCount, failureCount, targetCount: tokens.length, errors };
  },

  /**
   * Sends a single push notification payload to the Expo push service.
   */
  async sendPushToToken(token: string, title: string, body: string, broadcastId: string): Promise<void> {
    const payload = {
      to: token,
      sound: 'default',
      title,
      body,
      data: {
        sentAt: new Date().toISOString(),
        broadcastId,
      },
    };

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Expo push API error (${response.status}): ${text}`);
    }

    const json = await response.json();

    // Expo push API errors are reported within the response body
    if (json?.data?.status === 'error') {
      throw new Error(json?.data?.message ?? 'Unknown Expo push API error');
    }

    console.log('[notifications] Push sent:', { token, ticket: json });

    if (json?.data?.id) {
      console.log('[notifications] Expo ticket id:', json.data.id);
    }
  },

  async recordPushClick(broadcastId: string): Promise<void> {
    if (!broadcastId) return;
    await dataStorage.incrementPushHistoryClicks(broadcastId);
  },

  /**
   * Send a push notification to a specific user about a referral reward
   * Note: This is a simplified version. In production, you'd need a backend
   * to map emails to push tokens and send individual notifications.
   */
  async sendReferralRewardNotification(
    userEmail: string,
    refereeName: string
  ): Promise<void> {
    // For now, this is a placeholder
    // In production, you'd:
    // 1. Look up user's push token by email (requires backend)
    // 2. Send notification via Expo Push API

    // For demo purposes, we can schedule a local notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Referral Reward Earned!',
        body: `${refereeName} completed 5 meals! You earned +10 free entries.`,
        data: { type: 'referral_reward' },
      },
      trigger: null, // Show immediately
    });
  },
};

