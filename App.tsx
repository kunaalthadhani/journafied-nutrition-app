import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-gesture-handler';
import { HomeScreen } from './src/screens/HomeScreen';
import { Colors } from './src/constants/colors';
import { ThemeProvider } from './src/constants/theme';
import { PreferencesProvider } from './src/contexts/PreferencesContext';
import { UserProvider } from './src/contexts/UserContext';
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

export default Sentry.wrap(function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PreferencesProvider>
          <UserProvider>
            <NavigationContainer>
              <HomeScreen />
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
