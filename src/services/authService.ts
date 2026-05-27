import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { dataStorage } from './dataStorage';
import { supabaseDataService } from './supabaseDataService';

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

const ensureClient = () => {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
};

export const authService = {
  async sendOtp(email: string) {
    ensureClient();
    const normalizedEmail = email.trim().toLowerCase();

    // Single OTP email — creates user if needed, avoids double-email rate limit issue.
    return supabase!.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: undefined,
      },
    });
  },

  async sendSignupOtp(email: string, _password?: string) {
    ensureClient();
    const normalizedEmail = email.trim().toLowerCase();

    // Send a single OTP email. shouldCreateUser: true creates the user if
    // they don't exist yet. Password is set later via updatePassword() after
    // the OTP is verified. This avoids the double-email problem (signUp sends
    // its own confirmation email, burning through the rate limit).
    return supabase!.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: undefined,
      },
    });
  },

  async verifyOtp(email: string, token: string) {
    ensureClient();
    return supabase!.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
  },

  async getSession() {
    ensureClient();
    return supabase!.auth.getSession();
  },

  onAuthStateChange(callback: AuthListener) {
    ensureClient();
    return supabase!.auth.onAuthStateChange(callback);
  },

  async resetPasswordForEmail(email: string) {
    ensureClient();
    return supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: 'io.supabase.trackkcal://reset-callback/', // deep link if needed
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
    return supabase!.auth.signOut();
  },

  async deleteAccount() {
    ensureClient();

    // 1. Delete all remote app data (food_logs, weights, etc) and the app_users row.
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      if (session?.user) {
        const accountInfo = { supabaseUserId: session.user.id, email: session.user.email };
        await supabaseDataService.deleteAllUserData(accountInfo);
      }
    } catch (e) {
      console.error('Error deleting remote app data', e);
    }

    // 2. Server-side admin delete of the auth.users record. Without this, the user's
    // email + auth identifier remain in Supabase Auth even after data is wiped, and
    // signing in with the same email would create a fresh (empty) account. Required
    // for App Store account-deletion compliance.
    try {
      await supabase!.functions.invoke('ai-proxy', { body: { type: 'delete_user' } });
    } catch (e) {
      console.error('Error deleting auth user (will still sign out and clear local):', e);
    }

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



