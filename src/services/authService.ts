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
    return supabase!.auth.signInWithOtp({
      email,
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

  async signOut() {
    ensureClient();
    return supabase!.auth.signOut();
  },
};

