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

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PreferencesProvider>
          <NavigationContainer>
            <HomeScreen />
            <StatusBar style="dark" backgroundColor={Colors.white} />
          </NavigationContainer>
        </PreferencesProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Global styles can be added here if needed
});
