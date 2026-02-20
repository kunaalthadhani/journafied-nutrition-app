// Environment configuration

export const config = {
  // OAuth client IDs (fill these from your Google Cloud Console)
  GOOGLE_OAUTH: {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  }
};

// NOTE: OpenAI API key is now stored as a Supabase Edge Function secret.
// All AI calls are routed through the 'ai-proxy' Edge Function.
// The key never leaves the server.
