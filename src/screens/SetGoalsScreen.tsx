import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { CalorieCalculatorModal, CalorieCalculationResult } from '../components/CalorieCalculatorModal';

interface SetGoalsScreenProps {
  onBack: () => void;
  onSave: (goals: GoalData) => void;
  initialGoals?: GoalData;
}

interface GoalData {
  calories: number;
  proteinPercentage: number;
  carbsPercentage: number;
  fatPercentage: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  age?: number;
  gender?: 'male' | 'female';
  heightCm?: number;
  heightFeet?: number;
  heightInches?: number;
  goal?: 'lose' | 'maintain' | 'gain';
  activityRate?: number;
}

export const SetGoalsScreen: React.FC<SetGoalsScreenProps> = ({
  onBack,
  onSave,
  initialGoals
}) => {
  const theme = useTheme();
  const [calories, setCalories] = useState(initialGoals?.calories || 1500);
  const [proteinPercentage, setProteinPercentage] = useState(initialGoals?.proteinPercentage || 30);
  const [carbsPercentage, setCarbsPercentage] = useState(initialGoals?.carbsPercentage || 45);
  const [fatPercentage, setFatPercentage] = useState(initialGoals?.fatPercentage || 25);
  const [showCalculator, setShowCalculator] = useState(false);
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(initialGoals?.currentWeightKg ?? null);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(initialGoals?.targetWeightKg ?? null);
  const [age, setAge] = useState<number | undefined>(initialGoals?.age);
  const [gender, setGender] = useState<'male' | 'female' | undefined>(initialGoals?.gender);
  const [heightCm, setHeightCm] = useState<number | undefined>(initialGoals?.heightCm);
  const [heightFeet, setHeightFeet] = useState<number | undefined>(initialGoals?.heightFeet);
  const [heightInches, setHeightInches] = useState<number | undefined>(initialGoals?.heightInches);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain' | undefined>(initialGoals?.goal);
  const [activityRate, setActivityRate] = useState<number | undefined>(initialGoals?.activityRate);

  // Calculate grams based on calories per gram
  const calculateMacros = () => {
    const proteinCalories = (calories * proteinPercentage) / 100;
    const carbsCalories = (calories * carbsPercentage) / 100;
    const fatCalories = (calories * fatPercentage) / 100;

    return {
      proteinGrams: Math.round(proteinCalories / 4), // 4 cal/g
      carbsGrams: Math.round(carbsCalories / 4), // 4 cal/g
      fatGrams: Math.round(fatCalories / 9), // 9 cal/g
    };
  };

  const { proteinGrams, carbsGrams, fatGrams } = calculateMacros();
  const totalPercentage = proteinPercentage + carbsPercentage + fatPercentage;

  const handleCalculatedCalories = (result: CalorieCalculationResult) => {
    setCalories(result.calories);
    if (typeof result.currentWeightKg === 'number' && !isNaN(result.currentWeightKg)) {
      setCurrentWeightKg(result.currentWeightKg);
    }
    if (typeof result.targetWeightKg === 'number' && !isNaN(result.targetWeightKg)) {
      setTargetWeightKg(result.targetWeightKg);
    }
    if (result.age !== undefined) setAge(result.age);
    if (result.gender !== undefined) setGender(result.gender);
    if (result.heightCm !== undefined) setHeightCm(result.heightCm);
    if (result.heightFeet !== undefined) setHeightFeet(result.heightFeet);
    if (result.heightInches !== undefined) setHeightInches(result.heightInches);
    if (result.goal !== undefined) setGoal(result.goal);
    if (result.activityRate !== undefined) setActivityRate(result.activityRate);
    setShowCalculator(false);
  };

  const handleProteinChange = (value: number) => {
    const newProtein = Math.max(0, Math.min(100, Math.round(value)));
    setProteinPercentage(newProtein);
  };

  const handleCarbsChange = (value: number) => {
    const newCarbs = Math.max(0, Math.min(100, Math.round(value)));
    setCarbsPercentage(newCarbs);
  };

  const handleFatChange = (value: number) => {
    const newFat = Math.max(0, Math.min(100, Math.round(value)));
    setFatPercentage(newFat);
  };

  const handleSave = () => {
    if (totalPercentage !== 100) {
      Alert.alert(
        "Invalid Percentages",
        `The total percentage is ${totalPercentage}%. Please adjust your macronutrient percentages to equal 100%.`,
        [{ text: "OK" }]
      );
      return;
    }

    const goalData: GoalData = {
      calories,
      proteinPercentage,
      carbsPercentage,
      fatPercentage,
      proteinGrams,
      carbsGrams,
      fatGrams,
      currentWeightKg,
      targetWeightKg,
      age,
      gender,
      heightCm,
      heightFeet,
      heightInches,
      goal,
      activityRate,
    };
    onSave(goalData);
    onBack();
  };


  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#14B8A6" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]} pointerEvents="none">
          Set Goals
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      >
        {/* Daily Calories */}
        <View style={styles.caloriesSection}>
          <TouchableOpacity 
            style={[styles.calorieBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => setShowCalculator(true)}
            activeOpacity={0.7}
          >
            <View style={styles.calorieContent}>
              <Text style={[styles.calorieNumber, { color: theme.colors.textPrimary }]}>
                {calories === 0 ? 'Tap to calculate' : calories}
              </Text>
              {calories > 0 && (
                <Text style={[styles.calorieLabel, { color: theme.colors.textPrimary }]}>
                  calories
                </Text>
              )}
            </View>
            <Feather 
              name="grid" 
              size={18} 
              color="#14B8A6" 
              style={styles.calculatorIcon}
            />
          </TouchableOpacity>
          <Text style={[styles.calorieHelperText, { color: theme.colors.textSecondary }]}>
            Tap to calculate your daily calories
          </Text>
        </View>

        {/* Macros Section */}
        <View style={styles.macrosSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Macronutrient Distribution
          </Text>
          
          {/* Total Percentage Indicator */}
          <View style={[
            styles.totalContainer,
            { backgroundColor: totalPercentage === 100 ? '#E6F7F5' : '#FFE5E5' }
          ]}>
            <Text style={[styles.totalText, { color: theme.colors.textPrimary }]}>
              Total: {totalPercentage}% {totalPercentage === 100 ? '✓' : '⚠️'}
            </Text>
          </View>

          {/* Protein Card */}
          <View style={[styles.macroCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.macroCardHeader}>
              <Text style={[styles.macroCardTitle, { color: theme.colors.textPrimary }]}>
                Protein
              </Text>
              <Text style={[styles.macroCardValue, { color: theme.colors.textSecondary }]}>
                {proteinGrams}g ({proteinPercentage}%)
              </Text>
            </View>
            <View style={styles.macroCardContent}>
              <View style={styles.macroPercentageRow}>
                <Text style={[styles.macroCardPercentage, { color: theme.colors.textPrimary }]}>
                  {proteinPercentage}%
                </Text>
                <View style={styles.macroCardControls}>
                  <TouchableOpacity 
                    style={[styles.controlButton, { marginRight: 8 }]}
                    onPress={() => handleProteinChange(Math.max(0, proteinPercentage - 5))}
                  >
                    <Feather name="minus" size={16} color="#14B8A6" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.controlButton}
                    onPress={() => handleProteinChange(Math.min(100, proteinPercentage + 5))}
                  >
                    <Feather name="plus" size={16} color="#14B8A6" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
                  <View style={[styles.progressFill, { 
                    width: `${proteinPercentage}%`,
                    backgroundColor: '#14B8A6'
                  }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Carbs Card */}
          <View style={[styles.macroCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.macroCardHeader}>
              <Text style={[styles.macroCardTitle, { color: theme.colors.textPrimary }]}>
                Carbohydrates
              </Text>
              <Text style={[styles.macroCardValue, { color: theme.colors.textSecondary }]}>
                {carbsGrams}g ({carbsPercentage}%)
              </Text>
            </View>
            <View style={styles.macroCardContent}>
              <View style={styles.macroPercentageRow}>
                <Text style={[styles.macroCardPercentage, { color: theme.colors.textPrimary }]}>
                  {carbsPercentage}%
                </Text>
                <View style={styles.macroCardControls}>
                  <TouchableOpacity 
                    style={[styles.controlButton, { marginRight: 8 }]}
                    onPress={() => handleCarbsChange(Math.max(0, carbsPercentage - 5))}
                  >
                    <Feather name="minus" size={16} color="#14B8A6" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.controlButton}
                    onPress={() => handleCarbsChange(Math.min(100, carbsPercentage + 5))}
                  >
                    <Feather name="plus" size={16} color="#14B8A6" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
                  <View style={[styles.progressFill, { 
                    width: `${carbsPercentage}%`,
                    backgroundColor: '#FF7E67'
                  }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Fat Card */}
          <View style={[styles.macroCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.macroCardHeader}>
              <Text style={[styles.macroCardTitle, { color: theme.colors.textPrimary }]}>
                Fat
              </Text>
              <Text style={[styles.macroCardValue, { color: theme.colors.textSecondary }]}>
                {fatGrams}g ({fatPercentage}%)
              </Text>
            </View>
            <View style={styles.macroCardContent}>
              <View style={styles.macroPercentageRow}>
                <Text style={[styles.macroCardPercentage, { color: theme.colors.textPrimary }]}>
                  {fatPercentage}%
                </Text>
                <View style={styles.macroCardControls}>
                  <TouchableOpacity 
                    style={[styles.controlButton, { marginRight: 8 }]}
                    onPress={() => handleFatChange(Math.max(0, fatPercentage - 5))}
                  >
                    <Feather name="minus" size={16} color="#14B8A6" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.controlButton}
                    onPress={() => handleFatChange(Math.min(100, fatPercentage + 5))}
                  >
                    <Feather name="plus" size={16} color="#14B8A6" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
                  <View style={[styles.progressFill, { 
                    width: `${fatPercentage}%`,
                    backgroundColor: '#40514E'
                  }]} />
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Save Goals Button */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[styles.saveGoalsButton, { backgroundColor: '#14B8A6' }]}
          onPress={handleSave}
        >
          <Text style={styles.saveGoalsText}>Save Goals</Text>
        </TouchableOpacity>
      </View>

      <CalorieCalculatorModal
        visible={showCalculator}
        onClose={() => setShowCalculator(false)}
        onCalculated={handleCalculatedCalories}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  caloriesSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  calorieBox: {
    borderRadius: 8,
    padding: 16,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  calorieContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieNumber: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 2,
  },
  calorieLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.normal,
  },
  calculatorIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    opacity: 0.6,
  },
  calorieHelperText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.normal,
    marginTop: 8,
    textAlign: 'center',
  },
  macrosSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 16,
  },
  totalContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  totalText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  macroCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  macroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  macroCardTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  macroCardValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  macroCardContent: {
    marginBottom: 0,
  },
  macroPercentageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  macroCardPercentage: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  macroCardControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  progressBarContainer: {
    width: '100%',
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  controlButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    backgroundColor: 'transparent',
  },
  saveGoalsButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveGoalsText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
});