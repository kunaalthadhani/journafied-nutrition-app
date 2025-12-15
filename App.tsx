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

export default function App() {
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
}

const styles = StyleSheet.create({
  // Global styles can be added here if needed
});
