import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { invalidateMealsCache } from './dataStorage';

/**
 * Realtime subscription on food_logs scoped to a single user.
 *
 * When any device upserts or soft-deletes a row for this user, the change fires
 * here. We drop the cache so the next loadMeals re-fetches from remote and
 * surfaces the change immediately. The caller's onChange runs after, typically
 * triggering a setMeals(await loadMeals()) in React state.
 *
 * Self-fired events (this device wrote the row) also fire here. The cache is
 * already invalidated by the local save, so the extra re-fetch is redundant but
 * harmless — it just reconciles whatever the server stored back into local.
 *
 * Requires the food_logs table to be in the supabase_realtime publication on
 * the server. Run once in Supabase SQL editor if not already done:
 *   ALTER PUBLICATION supabase_realtime ADD TABLE public.food_logs;
 */

let activeChannel: RealtimeChannel | null = null;
let activeUserId: string | null = null;

export function subscribeMealsForUser(supabaseUserId: string, onChange: () => void): void {
  if (!supabase || !supabaseUserId) return;

  // Already subscribed for this user — no-op.
  if (activeUserId === supabaseUserId && activeChannel) return;

  // Different user (or stale channel) — tear down before subscribing again.
  unsubscribeMeals();

  activeUserId = supabaseUserId;
  activeChannel = supabase
    .channel(`food_logs:user:${supabaseUserId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'food_logs',
        filter: `user_id=eq.${supabaseUserId}`,
      },
      () => {
        invalidateMealsCache();
        try {
          onChange();
        } catch (e) {
          if (__DEV__) console.error('[realtimeMeals] onChange threw:', e);
        }
      },
    )
    .subscribe((status) => {
      if (__DEV__) console.log(`[realtimeMeals] channel status: ${status}`);
    });
}

export function unsubscribeMeals(): void {
  if (activeChannel && supabase) {
    try {
      supabase.removeChannel(activeChannel);
    } catch (e) {
      if (__DEV__) console.error('[realtimeMeals] removeChannel failed:', e);
    }
  }
  activeChannel = null;
  activeUserId = null;
}
