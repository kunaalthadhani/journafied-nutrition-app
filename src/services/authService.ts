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
      const { error } = await supabase!.functions.invoke('ai-proxy', {
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



