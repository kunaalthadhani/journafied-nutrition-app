import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { usePreferences } from '../contexts/PreferencesContext';

export interface CalorieCalculationResult {
  calories: number;
  name?: string;
  trackingGoal?: string;
  currentWeightKg?: number;
  targetWeightKg?: number;
  age?: number;
  gender?: 'male' | 'female' | 'prefer_not_to_say';
  heightCm?: number;
  heightFeet?: number;
  heightInches?: number;
  goal?: 'lose' | 'maintain' | 'gain';
  activityRate?: number;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'very';
}

interface CalorieCalculatorScreenProps {
  onBack: () => void;
  onCalculated: (result: CalorieCalculationResult) => void;
}

type Goal = 'lose' | 'maintain' | 'gain';
type Gender = 'male' | 'female' | 'prefer_not_to_say';
type HeightUnit = 'cm' | 'ft';
type WeightUnit = 'kg' | 'lbs';

export const CalorieCalculatorScreen: React.FC<CalorieCalculatorScreenProps> = ({
  onBack,
  onCalculated
}) => {
  const theme = useTheme();
  const { weightUnit: preferredWeightUnit } = usePreferences();
  const [currentStep, setCurrentStep] = useState(1);

  // Name question state
  const [name, setName] = useState('');

  // Tracking goal question state
  const [trackingGoal, setTrackingGoal] = useState<string | null>(null);
  const [trackingGoalOther, setTrackingGoalOther] = useState('');

  const [goal, setGoal] = useState<Goal | null>(null);

  // Gender question state
  const [gender, setGender] = useState<Gender | null>(null);

  // Height question state
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [heightCm, setHeightCm] = useState('');
  const [heightFeetInput, setHeightFeetInput] = useState('');
  const [heightInchesInput, setHeightInchesInput] = useState('');

  // Weight question state - use preference as default
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(preferredWeightUnit);
  const [weight, setWeight] = useState('');

  // Age question state
  const [age, setAge] = useState('');

  // Target weight question state - use preference as default
  const [targetWeightUnit, setTargetWeightUnit] = useState<WeightUnit>(preferredWeightUnit);
  const [targetWeight, setTargetWeight] = useState('');

  // Update weight units when preference changes
  useEffect(() => {
    setWeightUnit(preferredWeightUnit);
    setTargetWeightUnit(preferredWeightUnit);
  }, [preferredWeightUnit]);

  // Rate question state
  const [selectedRate, setSelectedRate] = useState<number | null>(null);

  // Activity level question state
  const [activityLevel, setActivityLevel] = useState<string | null>(null);

  // Calculated calories state
  const [calculatedCalories, setCalculatedCalories] = useState<number | null>(null);

  // Screen animation
  const screenOpacity = useRef(new Animated.Value(0)).current;

  const totalSteps = 10;
  const progress = (currentStep / totalSteps) * 100;

  // Animate screen fade in on mount
  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Helper functions for calculations
  const convertWeightToKg = (weight: string, unit: WeightUnit): number => {
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum)) return 0;
    return unit === 'lbs' ? weightNum * 0.453592 : weightNum;
  };

  const calculateWeeksDifference = (): number => {
    if (!weight || !targetWeight) return 0;
    const currentWeightKg = convertWeightToKg(weight, weightUnit);
    const targetWeightKg = convertWeightToKg(targetWeight, targetWeightUnit);
    return Math.abs(currentWeightKg - targetWeightKg);
  };

  const calculateTargetDate = (rateKgPerWeek: number): string => {
    const weightDifference = calculateWeeksDifference();
    const weeks = Math.ceil(weightDifference / rateKgPerWeek);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (weeks * 7));
    return targetDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateDailyCalories = (): number => {
    if (!weight || !age || !selectedRate) return 1500;
    // If gender is 'prefer_not_to_say', default to male for calculations
    const genderForCalc = gender === 'prefer_not_to_say' ? 'male' : gender;
    if (!genderForCalc) return 1500;

    // Convert height to cm
    let heightInCm = 0;
    if (heightUnit === 'cm') {
      heightInCm = parseFloat(heightCm) || 170;
    } else {
      const feet = parseFloat(heightFeetInput) || 5;
      const inches = parseFloat(heightInchesInput) || 6;
      heightInCm = (feet * 12 + inches) * 2.54;
    }

    // Convert weight to kg
    const weightKg = convertWeightToKg(weight, weightUnit);
    const ageNum = parseInt(age) || 25;

    // Calculate BMR using Mifflin-St Jeor Equation
    let bmr = 0;
    if (genderForCalc === 'male') {
      bmr = 88.362 + (13.397 * weightKg) + (4.799 * heightInCm) - (5.677 * ageNum);
    } else {
      bmr = 447.593 + (9.247 * weightKg) + (3.098 * heightInCm) - (4.330 * ageNum);
    }

    // Apply activity factor based on user selection
    let activityMultiplier = 1.4; // Default to moderate
    if (activityLevel === 'sedentary') activityMultiplier = 1.2;
    else if (activityLevel === 'light') activityMultiplier = 1.375;
    else if (activityLevel === 'moderate') activityMultiplier = 1.55;
    else if (activityLevel === 'very') activityMultiplier = 1.725;
    const tdee = bmr * activityMultiplier;

    // Adjust for weight goal
    let calorieAdjustment = 0;
    if (goal === 'lose') {
      // 1 kg fat ≈ 7700 calories, so per week: rate * 7700 / 7 days
      calorieAdjustment = -(selectedRate * 1100); // Negative for deficit
    } else if (goal === 'gain') {
      calorieAdjustment = selectedRate * 1100; // Positive for surplus
    }

    const finalCalories = Math.round(tdee + calorieAdjustment);

    // Ensure minimum safe calories (1200 for women, 1500 for men)
    const minCalories = genderForCalc === 'female' ? 1200 : 1500;
    return Math.max(finalCalories, minCalories);
  };

  const getRateOptions = () => {
    const isLoss = goal === 'lose';
    const isMaintain = goal === 'maintain';

    if (isMaintain) {
      return [
        { rate: 0, label: 'Maintain current weight', sublabel: 'Stay at your current weight' }
      ];
    }

    const baseRates = [
      { rate: 0.25, mild: true },
      { rate: 0.5, normal: true },
      { rate: 1.0, fast: true }
    ];

    return baseRates.map(({ rate, mild, normal, fast }) => {
      const action = isLoss ? 'loss' : 'gain';
      const verb = isLoss ? 'lose' : 'gain';

      let label = '';
      if (mild) label = `Mild weight ${action}`;
      else if (normal) label = `Weight ${action}`;
      else if (fast) label = `Fast weight ${action}`;

      const sublabel = `${verb} ${rate} kg/week • ${calculateTargetDate(rate)}`;

      return { rate, label, sublabel };
    });
  };

  const handleNameNext = () => {
    if (name.trim() !== '' && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleTrackingGoalSelect = (selectedGoal: string) => {
    setTrackingGoal(selectedGoal);
    if (selectedGoal !== 'other') {
      setTrackingGoalOther('');
    }
  };

  const handleGoalSelect = (selectedGoal: Goal) => {
    setGoal(selectedGoal);
  };

  const handleGenderSelect = (selectedGender: Gender) => {
    setGender(selectedGender);
  };

  const handleHeightNext = () => {
    const isValid = heightUnit === 'cm'
      ? heightCm.trim() !== ''
      : (heightFeetInput.trim() !== '' && heightInchesInput.trim() !== '');
    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleWeightNext = () => {
    if (weight.trim() !== '' && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleAgeNext = () => {
    if (age.trim() !== '' && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleTargetWeightNext = () => {
    // Target weight is optional, check only if entered
    // if (targetWeight.trim() !== '' && currentStep < totalSteps) {
    setCurrentStep(currentStep + 1);
    // }
  };

  const handleRateSelect = (rate: number) => {
    setSelectedRate(rate);
  };

  const handleCompleteCalculation = () => {
    if (selectedRate !== null && activityLevel !== null) {
      // Calculate the daily calories based on all inputs
      const dailyCalories = calculateDailyCalories();
      setCalculatedCalories(dailyCalories);
      // Move to completion screen
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSaveCalories = () => {
    if (calculatedCalories) {
      const currentWeightKgValue = weight ? convertWeightToKg(weight, weightUnit) : 0;
      const targetWeightKgValue = targetWeight ? convertWeightToKg(targetWeight, targetWeightUnit) : 0;

      // Calculate height in cm
      let heightCmValue: number | undefined;
      let heightFeetValue: number | undefined;
      let heightInchesValue: number | undefined;

      if (heightUnit === 'cm') {
        heightCmValue = heightCm ? parseFloat(heightCm) : undefined;
      } else {
        const feet = parseFloat(heightFeetInput) || 0;
        const inches = parseFloat(heightInchesInput) || 0;
        heightCmValue = (feet * 12 + inches) * 2.54;
        heightFeetValue = feet || undefined;
        heightInchesValue = inches || undefined;
      }

      const trackingGoalValue = trackingGoal === 'other'
        ? trackingGoalOther.trim()
        : trackingGoal;

      onCalculated({
        calories: calculatedCalories,
        name: name.trim() || undefined,
        trackingGoal: trackingGoalValue || undefined,
        currentWeightKg: currentWeightKgValue || undefined,
        targetWeightKg: targetWeightKgValue || undefined,
        age: age ? parseInt(age) : undefined,
        gender: gender || undefined,
        heightCm: heightCmValue,
        heightFeet: heightFeetValue,
        heightInches: heightInchesValue,
        goal: goal || undefined,
        activityRate: selectedRate !== null ? selectedRate : undefined,
        activityLevel: activityLevel as 'sedentary' | 'light' | 'moderate' | 'very' | undefined,
      });
    }
    handleClose();
  };

  const handleCancelCalories = () => {
    // Go back to Set Goals screen without saving
    onBack();
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setName('');
    setTrackingGoal(null);
    setTrackingGoalOther('');
    setGoal(null);
    setGender(null);
    setHeightUnit('cm');
    setHeightCm('');
    setHeightFeetInput('');
    setHeightInchesInput('');
    setWeightUnit('kg');
    setWeight('');
    setAge('');
    setTargetWeightUnit('kg');
    setTargetWeight('');
    setSelectedRate(null);
    setActivityLevel(null);
    setCalculatedCalories(null);
    onBack();
  };

  const renderQuestion = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              What's your name?
            </Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              We'll use this to personalize your plan.
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.largeInput,
                  {
                    color: theme.colors.textPrimary,
                    borderBottomColor: name ? theme.colors.primary : theme.colors.border
                  }
                ]}
                value={name}
                onChangeText={setName}
                placeholder="Your Name"
                placeholderTextColor={theme.colors.textTertiary}
                autoFocus
                autoCapitalize="words"
              />
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              What's your primary goal?
            </Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              Select the option that best describes your intention.
            </Text>
            <View style={styles.gridContainer}>
              {[
                { id: 'understand', label: 'Analyze Habits', icon: 'bar-chart-2' },
                { id: 'track', label: 'Track Food', icon: 'edit' },
                { id: 'accountable', label: 'Accountability', icon: 'check-circle' },
                { id: 'improve', label: 'Eat Better', icon: 'heart' },
                { id: 'exploring', label: 'Just Curious', icon: 'search' },
                { id: 'other', label: 'Other', icon: 'more-horizontal' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.gridOption,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: trackingGoal === item.id ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={() => handleTrackingGoalSelect(item.id)}
                >
                  <View style={[
                    styles.gridIconContainer,
                    { backgroundColor: trackingGoal === item.id ? theme.colors.primary : 'transparent' }
                  ]}>
                    <Feather
                      name={item.icon as any}
                      size={24}
                      color={trackingGoal === item.id ? theme.colors.primaryForeground : theme.colors.textSecondary}
                    />
                  </View>
                  <Text style={[
                    styles.gridOptionText,
                    { color: trackingGoal === item.id ? theme.colors.primary : theme.colors.textPrimary }
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {trackingGoal === 'other' && (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.largeInput,
                    {
                      color: theme.colors.textPrimary,
                      borderBottomColor: trackingGoalOther ? theme.colors.primary : theme.colors.border
                    }
                  ]}
                  value={trackingGoalOther}
                  onChangeText={setTrackingGoalOther}
                  placeholder="Tell us more..."
                  placeholderTextColor={theme.colors.textTertiary}
                  autoFocus
                />
              </View>
            )}
          </View>
        );
      case 3:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              Biological Sex
            </Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              Used to calculate your metabolic rate accurately.
            </Text>
            <View style={styles.listContainer}>
              {[
                { id: 'male', label: 'Male' },
                { id: 'female', label: 'Female' },
                { id: 'prefer_not_to_say', label: 'Prefer not to say' }
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.listOption,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: gender === item.id ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={() => handleGenderSelect(item.id as Gender)}
                >
                  <Text style={[
                    styles.listOptionText,
                    { color: gender === item.id ? theme.colors.primary : theme.colors.textPrimary }
                  ]}>
                    {item.label}
                  </Text>
                  {gender === item.id && (
                    <Feather name="check" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              How old are you?
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.largeInput,
                  {
                    textAlign: 'center',
                    color: theme.colors.textPrimary,
                    borderBottomColor: age ? theme.colors.primary : theme.colors.border
                  }
                ]}
                value={age}
                onChangeText={setAge}
                placeholder="25"
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="numeric"
                maxLength={3}
                autoFocus
              />
            </View>
          </View>
        );
      case 5:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>Current Goal</Text>
            <View style={styles.listContainer}>
              {[
                { id: 'lose', label: 'Lose Weight', subtitle: 'Burn fat & get lean' },
                { id: 'maintain', label: 'Maintain Weight', subtitle: 'Stay at current weight' },
                { id: 'gain', label: 'Gain Weight', subtitle: 'Build muscle & mass' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.cardOption,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: goal === item.id ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={() => handleGoalSelect(item.id as Goal)}
                >
                  <View>
                    <Text style={[
                      styles.cardOptionTitle,
                      { color: goal === item.id ? theme.colors.primary : theme.colors.textPrimary }
                    ]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.cardOptionSubtitle, { color: theme.colors.textSecondary }]}>
                      {item.subtitle}
                    </Text>
                  </View>
                  {goal === item.id && (
                    <Feather name="check-circle" size={24} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 6:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>Height</Text>

            {/* Unit Toggle */}
            <View style={[styles.toggleContainer, { backgroundColor: theme.colors.input }]}>
              {['cm', 'ft'].map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.toggleButton,
                    heightUnit === u && { backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow, shadowOpacity: 0.1, shadowRadius: 2 }
                  ]}
                  onPress={() => setHeightUnit(u as HeightUnit)}
                >
                  <Text style={[
                    styles.toggleText,
                    { color: heightUnit === u ? theme.colors.textPrimary : theme.colors.textSecondary }
                  ]}>{u.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputWrapper}>
              {heightUnit === 'cm' ? (
                <TextInput
                  style={[
                    styles.largeInput,
                    {
                      textAlign: 'center',
                      color: theme.colors.textPrimary,
                      borderBottomColor: heightCm ? theme.colors.primary : theme.colors.border
                    }
                  ]}
                  value={heightCm}
                  onChangeText={setHeightCm}
                  placeholder="170"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="numeric"
                  maxLength={3}
                  autoFocus
                />
              ) : (
                <View style={styles.multiInputContainer}>
                  <View style={styles.multiInputItem}>
                    <TextInput
                      style={[
                        styles.largeInput,
                        {
                          textAlign: 'center',
                          color: theme.colors.textPrimary,
                          borderBottomColor: heightFeetInput ? theme.colors.primary : theme.colors.border
                        }
                      ]}
                      value={heightFeetInput}
                      onChangeText={setHeightFeetInput}
                      placeholder="5"
                      placeholderTextColor={theme.colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={1}
                      autoFocus
                    />
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>ft</Text>
                  </View>
                  <View style={styles.multiInputItem}>
                    <TextInput
                      style={[
                        styles.largeInput,
                        {
                          textAlign: 'center',
                          color: theme.colors.textPrimary,
                          borderBottomColor: heightInchesInput ? theme.colors.primary : theme.colors.border
                        }
                      ]}
                      value={heightInchesInput}
                      onChangeText={setHeightInchesInput}
                      placeholder="8"
                      placeholderTextColor={theme.colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>in</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      case 7:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>Current Weight</Text>

            <View style={[styles.toggleContainer, { backgroundColor: theme.colors.input }]}>
              {['kg', 'lbs'].map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.toggleButton,
                    weightUnit === u && { backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow, shadowOpacity: 0.1, shadowRadius: 2 }
                  ]}
                  onPress={() => setWeightUnit(u as WeightUnit)}
                >
                  <Text style={[
                    styles.toggleText,
                    { color: weightUnit === u ? theme.colors.textPrimary : theme.colors.textSecondary }
                  ]}>{u.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.largeInput,
                  {
                    textAlign: 'center',
                    color: theme.colors.textPrimary,
                    borderBottomColor: weight ? theme.colors.primary : theme.colors.border
                  }
                ]}
                value={weight}
                onChangeText={setWeight}
                placeholder={weightUnit === 'kg' ? '70' : '150'}
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="numeric"
                maxLength={5}
                autoFocus
              />
            </View>
          </View>
        );
      case 8:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              Target Weight (Optional)
            </Text>

            <View style={[styles.toggleContainer, { backgroundColor: theme.colors.input }]}>
              {['kg', 'lbs'].map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.toggleButton,
                    targetWeightUnit === u && { backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow, shadowOpacity: 0.1, shadowRadius: 2 }
                  ]}
                  onPress={() => setTargetWeightUnit(u as WeightUnit)}
                >
                  <Text style={[
                    styles.toggleText,
                    { color: targetWeightUnit === u ? theme.colors.textPrimary : theme.colors.textSecondary }
                  ]}>{u.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.largeInput,
                  {
                    textAlign: 'center',
                    color: theme.colors.textPrimary,
                    borderBottomColor: targetWeight ? theme.colors.primary : theme.colors.border
                  }
                ]}
                value={targetWeight}
                onChangeText={setTargetWeight}
                placeholder={targetWeightUnit === 'kg' ? '65' : '140'}
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="numeric"
                maxLength={5}
                autoFocus
              />
            </View>
          </View>
        );
      case 9:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              Pace
            </Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              Adjust your weekly target pace.
            </Text>

            <View style={styles.listContainer}>
              {getRateOptions().map((option) => (
                <TouchableOpacity
                  key={option.rate}
                  style={[
                    styles.cardOption,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: selectedRate === option.rate ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={() => handleRateSelect(option.rate)}
                >
                  <View>
                    <Text style={[
                      styles.cardOptionTitle,
                      { color: selectedRate === option.rate ? theme.colors.primary : theme.colors.textPrimary }
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.cardOptionSubtitle, { color: theme.colors.textSecondary }]}>
                      {option.sublabel}
                    </Text>
                  </View>
                  {selectedRate === option.rate && (
                    <Feather name="check-circle" size={24} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 10:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              Activity Level
            </Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              Be honest! This affects your calorie target significantly.
            </Text>
            <View style={styles.listContainer}>
              {[
                { id: 'sedentary', label: 'Sedentary', desc: 'Office job, little exercise' },
                { id: 'light', label: 'Lightly Active', desc: '1-3 days/week exercise' },
                { id: 'moderate', label: 'Moderately Active', desc: '3-5 days/week exercise' },
                { id: 'very', label: 'Very Active', desc: '6-7 days/week hard exercise' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.cardOption,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: activityLevel === item.id ? theme.colors.primary : theme.colors.border
                    }
                  ]}
                  onPress={() => setActivityLevel(item.id as any)}
                >
                  <View>
                    <Text style={[
                      styles.cardOptionTitle,
                      { color: activityLevel === item.id ? theme.colors.primary : theme.colors.textPrimary }
                    ]}>
                      {item.label}
                    </Text>
                    <Text style={[
                      styles.cardOptionSubtitle,
                      { color: theme.colors.textSecondary }
                    ]}>
                      {item.desc}
                    </Text>
                  </View>
                  {activityLevel === item.id && (
                    <Feather name="check-circle" size={24} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      default:
        // Completion screen
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>Your Custom Plan</Text>

            <View style={[styles.resultCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.resultLabel, { color: theme.colors.textSecondary }]}>Daily Target</Text>
              <View style={styles.resultValueContainer}>
                <Text style={[styles.resultNumber, { color: theme.colors.primary }]}>{calculatedCalories}</Text>
                <Text style={[styles.resultUnit, { color: theme.colors.textPrimary }]}>kcal</Text>
              </View>
              <Text style={[styles.resultDescription, { color: theme.colors.textSecondary }]}>
                To {goal} {selectedRate && selectedRate > 0 ? `at ${selectedRate}kg/week` : ''}
              </Text>
            </View>

            <View style={styles.completionButtonsContainer}>
              <TouchableOpacity
                style={[styles.outlineButton, { borderColor: theme.colors.border }]}
                onPress={handleCancelCalories}
              >
                <Text style={[styles.outlineButtonText, { color: theme.colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveCalories}
              >
                <Text style={[styles.primaryButtonText, { color: theme.colors.primaryForeground }]}>Save Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  const renderNavigationButtons = () => {
    // Determine disabled state and next action
    let isDisabled = false;
    let handleNext = () => { };
    let label = 'Next';

    switch (currentStep) {
      case 1:
        isDisabled = name.trim() === '';
        handleNext = handleNameNext;
        break;
      case 2:
        isDisabled = trackingGoal === null || (trackingGoal === 'other' && trackingGoalOther.trim() === '');
        handleNext = () => !isDisabled && setCurrentStep(currentStep + 1);
        break;
      case 3:
        isDisabled = !gender;
        handleNext = () => gender && setCurrentStep(currentStep + 1);
        break;
      case 4:
        isDisabled = age.trim() === '';
        handleNext = handleAgeNext;
        break;
      case 5:
        isDisabled = !goal;
        handleNext = () => goal && setCurrentStep(currentStep + 1);
        break;
      case 6:
        const isHeightValid = heightUnit === 'cm'
          ? heightCm.trim() !== ''
          : (heightFeetInput.trim() !== '' && heightInchesInput.trim() !== '');
        isDisabled = !isHeightValid;
        handleNext = handleHeightNext;
        break;
      case 7:
        isDisabled = weight.trim() === '';
        handleNext = handleWeightNext;
        break;
      case 8:
        isDisabled = false; // Optional
        handleNext = handleTargetWeightNext;
        if (targetWeight.trim() === '') label = 'Skip';
        break;
      case 9:
        isDisabled = selectedRate === null;
        handleNext = () => selectedRate !== null && setCurrentStep(currentStep + 1);
        break;
      case 10:
        isDisabled = activityLevel === null;
        handleNext = handleCompleteCalculation;
        label = 'Calculate';
        break;
      default:
        // Completion screen doesn't use this nav
        return null;
    }

    if (currentStep > totalSteps) return null; // Completion screen

    return (
      <View style={[
        styles.footerContainer,
        {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
        }
      ]}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={[styles.navButton, styles.prevButton, { borderColor: theme.colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.navButtonText, { color: theme.colors.textSecondary }]}>Previous</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.navButton,
            styles.nextButton,
            { backgroundColor: isDisabled ? theme.colors.border : theme.colors.primary },
            currentStep === 1 && { flex: 1 } // Full width for first step
          ]}
          onPress={handleNext}
          disabled={isDisabled}
        >
          <Text style={[
            styles.navButtonText,
            { color: isDisabled ? theme.colors.textSecondary : theme.colors.primaryForeground, fontWeight: '600' }
          ]}>{label}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Feather name="x" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Step {currentStep} of {totalSteps}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Progres Bar */}
        <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
          <Animated.View style={[
            styles.progressFill,
            {
              width: `${progress}%`,
              backgroundColor: theme.colors.primary
            }
          ]} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderQuestion()}
        </ScrollView>

        {/* Footer Navigation */}
        {renderNavigationButtons()}

      </KeyboardAvoidingView>
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
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    letterSpacing: 0.5,
  },
  backButton: {
    padding: 4,
  },
  progressBar: {
    height: 4,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  questionContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  questionText: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: 8,
  },
  subText: {
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.8,
  },
  inputWrapper: {
    width: '100%',
    maxWidth: 300,
  },
  largeInput: {
    fontSize: 28,
    fontWeight: '600',
    paddingVertical: 12,
    borderBottomWidth: 2,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  gridOption: {
    width: '45%', // slightly less than half to fit gap
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  gridIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridOptionText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    textAlign: 'center',
  },
  listContainer: {
    width: '100%',
    gap: 12,
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
  },
  listOptionText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  cardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  cardOptionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 4,
  },
  cardOptionSubtitle: {
    fontSize: Typography.fontSize.sm,
  },
  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 32,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  multiInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 16,
  },
  multiInputItem: {
    flex: 1,
    alignItems: 'center',
  },
  inputLabel: {
    marginTop: 8,
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
  },
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  navButton: {
    flex: 1,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30, // Pill shape
  },
  prevButton: {
    borderWidth: 1,
    flex: 0.5,
  },
  nextButton: {
    flex: 1,
  },
  navButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: '600',
  },
  resultCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    width: '90%',
    marginBottom: 32,
  },
  resultLabel: {
    fontSize: Typography.fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    fontWeight: '600',
  },
  resultValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  resultNumber: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
  },
  resultUnit: {
    fontSize: Typography.fontSize.lg,
    marginLeft: 8,
    fontWeight: '600',
  },
  resultDescription: {
    textAlign: 'center',
    fontSize: Typography.fontSize.md,
    lineHeight: 24,
    opacity: 0.8,
  },
  completionButtonsContainer: {
    width: '100%',
    gap: 16,
  },
  outlineButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 30,
  },
  outlineButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: '600',
  },
  primaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 30,
  },
  primaryButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: '600',
  },
});
