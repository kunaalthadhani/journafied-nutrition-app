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
    await dataStorage.clearAllData();
    return supabase!.auth.signOut();
  },

  async deleteAccount() {
    ensureClient();
    try {
      // 1. Delete all remote data for this user
      const { data: { session } } = await supabase!.auth.getSession();
      if (session?.user) {
        const accountInfo = { supabaseUserId: session.user.id, email: session.user.email };
        await supabaseDataService.deleteAllUserData(accountInfo);
      }
    } catch (e) {
      console.error("Error deleting remote data", e);
    }

    // 2. Clear local data
    await dataStorage.clearAllData();

    // 3. Sign out (which effectively invalidates session)
    return supabase!.auth.signOut();
  },

  async updatePassword(password: string) {
    ensureClient();
    return supabase!.auth.updateUser({ password });
  }
};



