import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { dataStorage } from './dataStorage';
import { supabaseDataService } from './supabaseDataService';

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

// Mirrors the family project's auth password_min_length. If the client asks for
// less, the user types a password, passes our check, and is refused by the
// server, which reads as a broken app rather than a rule.
export const MIN_PASSWORD_LENGTH = 8;

const ensureClient = () => {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
};

export const authService = {
  async getSession() {
    ensureClient();
    return supabase!.auth.getSession();
  },

  onAuthStateChange(callback: AuthListener) {
    ensureClient();
    return supabase!.auth.onAuthStateChange(callback);
  },

  // Recovery is a six digit code, never a link. A link has to land somewhere,
  // and on a phone that somewhere was a scheme that did not exist, so the user
  // walked out of the app and never walked back in. The code comes to the same
  // inbox and gets typed into the screen she is already on.
  async resetPasswordForEmail(email: string) {
    ensureClient();
    return supabase!.auth.resetPasswordForEmail(email.trim().toLowerCase());
  },

  async verifyRecoveryCode(email: string, token: string) {
    ensureClient();
    return supabase!.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'recovery',
    });
  },

  async signUp(email: string, password: string) {
    ensureClient();
    return supabase!.auth.signUp({
      email,
      password,
    });
  },

  async signIn(email: string, password: string) {
    ensureClient();
    return supabase!.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
  },

  async signOut() {
    ensureClient();
    // Clear only the account identity, NOT the user's data.
    // The user's meals, goals, weight history, plan, and feature state all stay on device.
    // When they sign back in, account info is restored and remote fetches re-merge with local.
    await dataStorage.clearAccountData();
    // scope: 'local' clears the stored session and fires SIGNED_OUT without a
    // network round-trip. The default global revoke can hang or fail on the PWA,
    // and when it does the SIGNED_OUT event never fires, so the UI never updates
    // and the user appears stuck signed in. The local session token is gone
    // either way; the server session just expires on its own.
    try {
      await supabase!.auth.signOut({ scope: 'local' });
    } catch (e) {
      if (__DEV__) console.warn('signOut: local sign-out failed', e);
    }
  },

  async deleteAccount() {
    ensureClient();

    const { data: { session } } = await supabase!.auth.getSession();

    // With a live session the server-side deletes MUST succeed before we wipe the
    // device and tell the user it is gone. Otherwise a silent server failure
    // leaves their email and auth record alive in Supabase while they believe
    // everything was deleted. Required for App Store and GDPR compliance.
    if (session?.user) {
      // 1. Remote app data (food_logs, weights, the app_users row).
      await supabaseDataService.deleteAllUserData({
        supabaseUserId: session.user.id,
        email: session.user.email ?? undefined,
      });

      // 2. Admin delete of the auth.users record via the edge function.
      // functions.invoke resolves with { error } on a 4xx/5xx, it does NOT throw,
      // so we have to check it explicitly.
      // kcal-proxy on the family project: the family's ai-proxy belongs to
      // TrackLifts, kcal's rides beside it under its own name
      const { error } = await supabase!.functions.invoke('kcal-proxy', {
        body: { type: 'delete_user' },
      });
      if (error) {
        throw new Error(
          `Account deletion failed on our servers, so nothing was removed. ${error.message ?? ''}`.trim()
        );
      }
    }

    // Either there was no live session to authenticate a server delete, or the
    // server deletes were confirmed. Now it is safe to clear the device.
    // 3. Clear local data.
    await dataStorage.clearAllData();

    // 4. Sign out (also invalidates any cached session).
    return supabase!.auth.signOut();
  },

  async updatePassword(password: string) {
    ensureClient();
    return supabase!.auth.updateUser({ password });
  }
};



