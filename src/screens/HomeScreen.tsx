import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { TopNavigationBar } from '../components/TopNavigationBar';
import { DateSelector } from '../components/DateSelector';
import { StatCardsSection } from '../components/StatCardsSection';
import { BottomInputBar } from '../components/BottomInputBar';
import { Menu } from '../components/Menu';
import { SetGoalsScreen } from './SetGoalsScreen';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { MacroData } from '../types';
import { FoodLogSection } from '../components/FoodLogSection';
import { parseFoodInput, calculateTotalNutrition, ParsedFood } from '../utils/foodNutrition';
import { analyzeFoodWithChatGPT } from '../services/openaiService';

export const HomeScreen: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showSetGoals, setShowSetGoals] = useState(false);
  const [dailyCalories, setDailyCalories] = useState(1500);
  const [savedGoals, setSavedGoals] = useState({
    calories: 1500,
    proteinPercentage: 30,
    carbsPercentage: 45,
    fatPercentage: 25,
    proteinGrams: 113, // (1500 * 30%) / 4 cal/g = 112.5 ≈ 113
    carbsGrams: 169,   // (1500 * 45%) / 4 cal/g = 168.75 ≈ 169
    fatGrams: 42,      // (1500 * 25%) / 9 cal/g = 41.67 ≈ 42
  });
  const [loggedFoods, setLoggedFoods] = useState<ParsedFood[]>([]);
  const [isAnalyzingFood, setIsAnalyzingFood] = useState(false);
  // Calculate current nutrition from logged foods
  const currentNutrition = calculateTotalNutrition(loggedFoods);
  
  // Generate macro data from saved goals with current values
  const macrosData: MacroData = {
    carbs: { current: currentNutrition.totalCarbs, target: savedGoals.carbsGrams, unit: 'g' },
    protein: { current: currentNutrition.totalProtein, target: savedGoals.proteinGrams, unit: 'g' },
    fat: { current: currentNutrition.totalFat, target: savedGoals.fatGrams, unit: 'g' }
  };
  // Calories card data (Food, Exercise, Remaining)
  const macros2Data: MacroData = {
    carbs: { current: currentNutrition.totalCalories, target: 0, unit: 'cal' }, // Food calories
    protein: { current: 0, target: 0, unit: 'cal' }, // Exercise calories
    fat: { current: dailyCalories - currentNutrition.totalCalories, target: 0, unit: 'cal' } // Remaining calories
  };

  const handleMenuPress = () => {
    setMenuVisible(true);
  };

  const handleSetGoals = () => {
    setShowSetGoals(true);
  };

  const handleGoalsBack = () => {
    setShowSetGoals(false);
  };

  const handleGoalsSave = (goals: any) => {
    console.log('Goals saved:', goals);
    setDailyCalories(goals.calories);
    setSavedGoals(goals);
    // TODO: Update app state with new goals
  };

  const handleCalendarPress = () => {
    console.log('Calendar pressed');
    // TODO: Implement calendar functionality
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    console.log('Date selected:', format(date, 'yyyy-MM-dd'));
  };

  const handleInputSubmit = async (text: string) => {
    console.log('Input submitted:', text);
    
    if (!text.trim()) return;
    
    setIsAnalyzingFood(true);
    
    try {
      // Use ChatGPT for real-time food analysis
      const parsedFoods = await analyzeFoodWithChatGPT(text);
      
      if (parsedFoods.length > 0) {
        // Add parsed foods to the log
        setLoggedFoods(prevFoods => [...prevFoods, ...parsedFoods]);
        console.log('ChatGPT parsed foods:', parsedFoods);
      } else {
        console.log('No foods recognized by ChatGPT:', text);
        // TODO: Show message to user that no foods were recognized
      }
    } catch (error) {
      console.error('Error processing food input:', error);
      // TODO: Show error message to user
    } finally {
      setIsAnalyzingFood(false);
    }
  };

  const handleRemoveFood = (foodId: string) => {
    setLoggedFoods(prevFoods => prevFoods.filter(food => food.id !== foodId));
  };

  const handlePlusPress = () => {
    console.log('Plus pressed');
    // TODO: Open add item modal
  };

  const formattedDate = format(selectedDate, 'MMMM d, yyyy');

  if (showSetGoals) {
    return (
      <SetGoalsScreen 
        onBack={handleGoalsBack}
        onSave={handleGoalsSave}
        initialGoals={savedGoals}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Fixed Top Navigation */}
        <TopNavigationBar
          selectedDate={formattedDate}
          onMenuPress={handleMenuPress}
          onCalendarPress={handleCalendarPress}
        />

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          {/* Date Selector */}
          <DateSelector
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />

          {/* Stat Cards */}
          <StatCardsSection
            macrosData={macrosData}
            macros2Data={macros2Data}
            dailyCalories={dailyCalories}
            onScrollEnable={setScrollEnabled}
          />

          {/* Food Log Section */}
          <FoodLogSection 
            foods={loggedFoods}
            onRemoveFood={handleRemoveFood}
          />

          {/* Motivational Text - only show if no foods logged */}
          {loggedFoods.length === 0 && (
            <View style={styles.motivationalTextContainer}>
              <Text style={styles.motivationalText}>
                Tell me what you had today and I will calculate the nutritional value for it
              </Text>
            </View>
          )}

          {/* Bottom spacing to account for fixed input bar */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Fixed Bottom Input Bar */}
        <BottomInputBar
          onSubmit={handleInputSubmit}
          onPlusPress={handlePlusPress}
          isLoading={isAnalyzingFood}
          placeholder={isAnalyzingFood ? "Analyzing your food..." : "What did you eat or exercise?"}
        />

        <Menu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onSetGoals={handleSetGoals}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  motivationalTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    minHeight: 200,
  },
  motivationalText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.secondaryText,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.lg,
  },
  bottomSpacer: {
    height: 120, // Space for bottom input bar + safe area
  },
});