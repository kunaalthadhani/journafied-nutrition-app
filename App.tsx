import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, AppStateStatus, Platform, StyleSheet } from 'react-native';
import './src/utils/webAlertShim';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-gesture-handler';
import { HomeScreen } from './src/screens/HomeScreen';
import { PasswordRecoveryModal } from './src/components/PasswordRecoveryModal';
import { Colors } from './src/constants/colors';
import { ThemeProvider } from './src/constants/theme';
import { PreferencesProvider } from './src/contexts/PreferencesContext';
import { UserProvider } from './src/contexts/UserContext';
import { dataStorage } from './src/services/dataStorage';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://9afa4b08a2fca2fe15f24dab6af720d4@o4511453446012928.ingest.de.sentry.io/4511453482516560',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Flush any queued sync ops whenever the app comes to the foreground (native)
// or the tab becomes visible (web/PWA). Without this, writes made while offline
// or signed-out sit in AsyncStorage and never reach Supabase until the next
// save event triggers processSyncQueue.
function useSyncQueueOnForeground() {
  useEffect(() => {
    const flush = () => {
      dataStorage.flushSyncQueue().catch(() => { /* best effort */ });
    };

    if (Platform.OS === 'web') {
      const onVisibility = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') flush();
      };
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibility);
        flush();
        return () => document.removeEventListener('visibilitychange', onVisibility);
      }
      return;
    }

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') flush();
    };
    const sub = AppState.addEventListener('change', onChange);
    flush();
    return () => sub.remove();
  }, []);
}

export default Sentry.wrap(function App() {
  useSyncQueueOnForeground();
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PreferencesProvider>
          <UserProvider>
            <NavigationContainer>
              <HomeScreen />
              <PasswordRecoveryModal />
              <StatusBar style="dark" backgroundColor={Colors.white} />
            </NavigationContainer>
          </UserProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
});

const styles = StyleSheet.create({
  // Global styles can be added here if needed
});
