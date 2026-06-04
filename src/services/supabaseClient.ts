import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Remote syncing and auth will be disabled.'
  );
} else {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // On web we must consume the recovery/auth token Supabase puts in the URL
      // after a password-reset redirect. On native there is no URL to parse.
      detectSessionInUrl: Platform.OS === 'web',
      storage: AsyncStorage as any,
    },
  });
}

export const supabase = client;

export const isSupabaseConfigured = (): boolean => Boolean(client);

