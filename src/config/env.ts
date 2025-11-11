// Environment configuration
// In a real app, you'd use environment variables or a secure key management system

export const config = {
  OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || 'your-openai-api-key-here',
  
  // You can add other API keys or configuration here
  API_ENDPOINTS: {
    OPENAI: 'https://api.openai.com/v1/chat/completions',
  },
  
  // Model configuration
  OPENAI_CONFIG: {
    model: 'gpt-4', // or 'gpt-3.5-turbo' for lower cost
    temperature: 0.3,
    max_tokens: 1000,
  },

  // OAuth client IDs (fill these from your Google Cloud Console)
  GOOGLE_OAUTH: {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  }
};

// Instructions for setting up the API key:
/*
TO SET UP YOUR OPENAI API KEY:

1. Get your API key from: https://platform.openai.com/account/api-keys
2. Create a .env file in your project root with:
   EXPO_PUBLIC_OPENAI_API_KEY=your-actual-api-key-here
3. Make sure .env is in your .gitignore file
4. Restart your expo server after adding the key

For development, you can also temporarily replace the key directly in this file,
but never commit real API keys to version control!
*/