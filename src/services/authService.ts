import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';

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

    // 1. Try to create the user first (if they don't exist).
    // We don't rely on this to send any email; we just want a user record.
    try {
      await supabase!.auth.signUp({
        email: normalizedEmail,
        // Dummy password to satisfy Supabase; UX remains passwordless.
        password: 'TEMP_PASSWORD_DO_NOT_USE_123!',
        options: {
          emailRedirectTo: undefined,
        },
      });
    } catch (error: any) {
      const msg = error?.message?.toString().toLowerCase() ?? '';
      // Ignore "already registered" / "user already exists" errors.
      if (!msg.includes('already') || !msg.includes('registered')) {
        throw error;
      }
    }

    // 2. Now send a CODE-ONLY OTP email.
    // shouldCreateUser: false => always send token, no magic link flow.
    return supabase!.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: undefined,
      },
    });
  },

  async sendSignupOtp(email: string) {
    ensureClient();
    const normalizedEmail = email.trim().toLowerCase();
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
      email,
      password,
    });
  },

  async signOut() {
    ensureClient();
    return supabase!.auth.signOut();
  },
};



