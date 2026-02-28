import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '../utils/uuid';

const MIXPANEL_TOKEN = '73ab67b9f9183ba7c71dae25b256579c';
const MIXPANEL_API = 'https://api-eu.mixpanel.com';
const DISTINCT_ID_KEY = '@trackkcal:mixpanel_distinct_id';
const QUEUE_KEY = '@trackkcal:mixpanel_queue';
const FLUSH_INTERVAL = 30_000; // 30 seconds
const MAX_QUEUE_SIZE = 50;

class MixpanelService {
  private distinctId: string | null = null;
  private userId: string | null = null; // set after identify()
  private queue: Record<string, any>[] = [];
  private initialized = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load or generate anonymous distinct ID
      let stored = await AsyncStorage.getItem(DISTINCT_ID_KEY);
      if (!stored) {
        stored = generateId();
        await AsyncStorage.setItem(DISTINCT_ID_KEY, stored);
      }
      this.distinctId = stored;

      // Load any queued events from previous session
      const queued = await AsyncStorage.getItem(QUEUE_KEY);
      if (queued) {
        try {
          this.queue = JSON.parse(queued);
        } catch {
          this.queue = [];
        }
      }

      this.initialized = true;

      // Start periodic flush
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);

      // Flush any leftover events from last session
      if (this.queue.length > 0) {
        this.flush();
      }
    } catch (error) {
      console.error('Mixpanel init failed:', error);
      this.initialized = true; // don't block the app
    }
  }

  /** Identify user — ties anonymous events to a real user */
  async identify(userId: string, traits?: Record<string, any>): Promise<void> {
    this.userId = userId;

    // Send $identify to link anonymous ID to user ID
    if (this.distinctId && this.distinctId !== userId) {
      this.enqueue({
        event: '$identify',
        properties: {
          $identified_id: userId,
          $anon_id: this.distinctId,
          token: MIXPANEL_TOKEN,
        },
      });
    }

    this.distinctId = userId;
    await AsyncStorage.setItem(DISTINCT_ID_KEY, userId);

    // Set user profile properties
    if (traits && Object.keys(traits).length > 0) {
      this.setUserProperties(traits);
    }
  }

  /** Set user profile properties */
  setUserProperties(properties: Record<string, any>): void {
    if (!this.distinctId) return;

    // People $set uses a different endpoint format
    const payload = {
      $token: MIXPANEL_TOKEN,
      $distinct_id: this.distinctId,
      $set: properties,
    };

    this.sendPeopleUpdate(payload);
  }

  /** Track an event with optional properties */
  track(event: string, properties?: Record<string, any>): void {
    if (!this.distinctId) return;

    this.enqueue({
      event,
      properties: {
        ...properties,
        token: MIXPANEL_TOKEN,
        distinct_id: this.distinctId,
        time: Math.floor(Date.now() / 1000),
        $os: Platform.OS,
        $os_version: String(Platform.Version),
        mp_lib: 'react-native',
      },
    });
  }

  /** Reset on logout */
  async reset(): Promise<void> {
    this.userId = null;
    const newId = generateId();
    this.distinctId = newId;
    await AsyncStorage.setItem(DISTINCT_ID_KEY, newId);
  }

  /** Flush queued events to Mixpanel */
  flush(): void {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    // Fire and forget — don't block the app
    this.sendBatch(batch).catch(() => {
      // On failure, re-queue events (up to max)
      this.queue = [...batch, ...this.queue].slice(0, MAX_QUEUE_SIZE);
      this.persistQueue();
    });

    this.persistQueue();
  }

  // ── Internal ──

  private enqueue(event: Record<string, any>): void {
    this.queue.push(event);

    // Auto-flush if queue is getting large
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.flush();
    }
  }

  private async sendBatch(events: Record<string, any>[]): Promise<void> {
    try {
      const encoded = btoa(JSON.stringify(events));
      const res = await fetch(`${MIXPANEL_API}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encoded}`,
      });
      if (!res.ok) {
        console.error('Mixpanel batch failed:', res.status);
      }
    } catch (error) {
      console.error('Mixpanel send failed:', error);
      throw error; // re-throw so flush() can re-queue
    }
  }

  private async sendPeopleUpdate(payload: Record<string, any>): Promise<void> {
    try {
      const encoded = btoa(JSON.stringify([payload]));
      await fetch(`${MIXPANEL_API}/engage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encoded}`,
      });
    } catch (error) {
      console.error('Mixpanel people update failed:', error);
    }
  }

  private async persistQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // non-critical
    }
  }
}

export const mixpanelService = new MixpanelService();
