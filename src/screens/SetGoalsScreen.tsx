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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { CalorieCalculatorScreen, CalorieCalculationResult } from '../components/CalorieCalculatorModal';

interface SetGoalsScreenProps {
  onBack: () => void;
  onSave: (goals: GoalData) => void;
  initialGoals?: GoalData;
  onStartCustomPlan?: () => void;
  onCustomPlanCompleted?: () => void;
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
  gender?: 'male' | 'female' | 'prefer_not_to_say';
  heightCm?: number;
  heightFeet?: number;
  heightInches?: number;
  goal?: 'lose' | 'maintain' | 'gain';
  activityRate?: number;
  name?: string;
  trackingGoal?: string;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'very';
}

const MACRO_COLORS = {
  protein: '#3b82f6', // Blue 500
  carbs: '#f59e0b',   // Amber 500
  fat: '#ec4899',     // Pink 500
};

export const SetGoalsScreen: React.FC<SetGoalsScreenProps> = ({
  onBack,
  onSave,
  initialGoals,
  onStartCustomPlan,
  onCustomPlanCompleted,
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
  const [gender, setGender] = useState<'male' | 'female' | 'prefer_not_to_say' | undefined>(initialGoals?.gender);
  const [heightCm, setHeightCm] = useState<number | undefined>(initialGoals?.heightCm);
  const [heightFeet, setHeightFeet] = useState<number | undefined>(initialGoals?.heightFeet);
  const [heightInches, setHeightInches] = useState<number | undefined>(initialGoals?.heightInches);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain' | undefined>(initialGoals?.goal);
  const [activityRate, setActivityRate] = useState<number | undefined>(initialGoals?.activityRate);
  const [name, setName] = useState<string | undefined>(initialGoals?.name);
  const [trackingGoal, setTrackingGoal] = useState<string | undefined>(initialGoals?.trackingGoal);
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'very' | undefined>(initialGoals?.activityLevel);

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

  const handleStartCustomPlan = () => {
    setShowCalculator(true);
    onStartCustomPlan?.();
  };

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
    if (result.name !== undefined) setName(result.name);
    if (result.trackingGoal !== undefined) setTrackingGoal(result.trackingGoal);
    if (result.activityLevel !== undefined) setActivityLevel(result.activityLevel);
    setShowCalculator(false);
    onCustomPlanCompleted?.();
  };

  const handleCalculatorBack = () => {
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
      name,
      trackingGoal,
      activityLevel,
    };
    onSave(goalData);
    onBack();
  };


  if (showCalculator) {
    return (
      <CalorieCalculatorScreen
        onBack={handleCalculatorBack}
        onCalculated={handleCalculatedCalories}
        initialData={{
          name,
          trackingGoal,
          currentWeightKg,
          targetWeightKg,
          age,
          gender,
          heightCm,
          heightFeet,
          heightInches,
          goal,
          activityRate,
          activityLevel
        }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          Nutrition Goals
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Custom Plan Hero Card */}
        {/* Custom Plan Button (Simplified) */}
        <TouchableOpacity
          onPress={handleStartCustomPlan}
          activeOpacity={0.7}
          style={[styles.customPlanButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
        >
          <View style={styles.customPlanContent}>
            <View style={[styles.iconBox, { backgroundColor: theme.colors.secondaryBg }]}>
              <Feather name="zap" size={20} color={theme.colors.textPrimary} />
            </View>
            <View style={styles.customPlanTextContainer}>
              <Text style={[styles.customPlanTitle, { color: theme.colors.textPrimary }]}>
                Create Custom Plan
              </Text>
              <Text style={[styles.customPlanSubtitle, { color: theme.colors.textSecondary }]}>
                AI-powered macro calculation
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {/* Daily Calories Section */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>DAILY TARGET</Text>
          <View style={[
            styles.caloriesCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              shadowColor: theme.colors.shadow,
            }
          ]}>
            <View style={styles.caloriesHeader}>
              <Text style={[styles.caloriesValue, { color: theme.colors.textPrimary }]}>
                {calories}
              </Text>
              <Text style={[styles.caloriesUnit, { color: theme.colors.textSecondary }]}>kcal</Text>
            </View>
            <TouchableOpacity
              style={[styles.editCaloriesButton, { backgroundColor: theme.colors.secondaryBg }]}
              // For now, custom plan is the primary way, but maybe visual "touch" implies editability
              onPress={handleStartCustomPlan}
            >
              <Text style={[styles.editCaloriesText, { color: theme.colors.textSecondary }]}>Recalculate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Macros Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.macroHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>MACRO DISTRIBUTION</Text>
            <View style={[
              styles.totalBadge,
              { backgroundColor: totalPercentage === 100 ? theme.colors.successBg : theme.colors.error + '15' }
            ]}>
              <Text style={[
                styles.totalBadgeText,
                { color: totalPercentage === 100 ? theme.colors.success : theme.colors.error }
              ]}>
                {totalPercentage}% Total
              </Text>
            </View>
          </View>

          {/* Protein Card */}
          <MacroCard
            label="Protein"
            color={MACRO_COLORS.protein}
            percentage={proteinPercentage}
            gramValue={proteinGrams}
            onChange={handleProteinChange}
            theme={theme}
          />

          {/* Carbs Card */}
          <MacroCard
            label="Carbs"
            color={MACRO_COLORS.carbs}
            percentage={carbsPercentage}
            gramValue={carbsGrams}
            onChange={handleCarbsChange}
            theme={theme}
          />

          {/* Fat Card */}
          <MacroCard
            label="Fat"
            color={MACRO_COLORS.fat}
            percentage={fatPercentage}
            gramValue={fatGrams}
            onChange={handleFatChange}
            theme={theme}
          />
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)' }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={[styles.saveButtonText, { color: theme.colors.primaryForeground }]}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// Subcomponent for Macro Card to reduce repetition
interface MacroCardProps {
  label: string;
  color: string;
  percentage: number;
  gramValue: number;
  onChange: (val: number) => void;
  theme: any;
}

const MacroCard: React.FC<MacroCardProps> = ({ label, color, percentage, gramValue, onChange, theme }) => {
  return (
    <View style={[styles.macroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.macroTopRow}>
        <View style={styles.macroLabelContainer}>
          <View style={[styles.macroDot, { backgroundColor: color }]} />
          <Text style={[styles.macroLabel, { color: theme.colors.textPrimary }]}>{label}</Text>
        </View>
        <Text style={[styles.macroGrams, { color: theme.colors.textSecondary }]}>{gramValue}g</Text>
      </View>

      <View style={styles.sliderContainer}>
        <TouchableOpacity
          style={[styles.adjustButton, { borderColor: theme.colors.border }]}
          onPress={() => onChange(percentage - 5)}
        >
          <Feather name="minus" size={16} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.progressSection}>
          <View style={[styles.progressBarBg, { backgroundColor: theme.colors.secondaryBg }]}>
            <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
          </View>
          <Text style={[styles.percentageText, { color: theme.colors.textPrimary }]}>{percentage}%</Text>
        </View>

        <TouchableOpacity
          style={[styles.adjustButton, { borderColor: theme.colors.border }]}
          onPress={() => onChange(percentage + 5)}
        >
          <Feather name="plus" size={16} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  backButton: {
    padding: 4,
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  customPlanButton: {
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customPlanContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customPlanTextContainer: {
    flex: 1,
  },
  customPlanTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 2,
  },
  customPlanSubtitle: {
    fontSize: Typography.fontSize.sm,
  },
  sectionContainer: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  caloriesCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caloriesHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  caloriesValue: {
    fontSize: 48,
    fontWeight: '800', // heavy weight
    letterSpacing: -1,
  },
  caloriesUnit: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    marginLeft: 6,
  },
  editCaloriesButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  editCaloriesText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  macroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  totalBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  macroCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  macroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  macroLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  macroGrams: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    flex: 1,
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  percentageText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: 'transparent', // using shadow/blur usually, but keep simple
  },
  saveButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
});
