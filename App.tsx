import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-gesture-handler';
import { HomeScreen } from './src/screens/HomeScreen';
import { Colors } from './src/constants/colors';
import { ThemeProvider } from './src/constants/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
      <NavigationContainer>
        <HomeScreen />
        <StatusBar style="dark" backgroundColor={Colors.white} />
      </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Global styles can be added here if needed
});
