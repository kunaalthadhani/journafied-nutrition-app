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
    const isGain = goal === 'gain';
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
    if (targetWeight.trim() !== '' && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
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
              We'll use this to personalize your plan. What should we call you?
            </Text>
            <View style={styles.heightInputContainer}>
              <TextInput
                style={[
                  styles.heightInput,
                  { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input }
                ]}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
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
              What's your goal with tracking?
            </Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              What brings you here? This helps us tailor your experience.
            </Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: trackingGoal === 'understand' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleTrackingGoalSelect('understand')}
              >
                <Text style={[
                  styles.optionText,
                  { color: trackingGoal === 'understand' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Understand my eating habits
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: trackingGoal === 'track' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleTrackingGoalSelect('track')}
              >
                <Text style={[
                  styles.optionText,
                  { color: trackingGoal === 'track' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Track calories & macros
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: trackingGoal === 'accountable' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleTrackingGoalSelect('accountable')}
              >
                <Text style={[
                  styles.optionText,
                  { color: trackingGoal === 'accountable' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Stay accountable
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: trackingGoal === 'improve' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleTrackingGoalSelect('improve')}
              >
                <Text style={[
                  styles.optionText,
                  { color: trackingGoal === 'improve' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Improve overall eating
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: trackingGoal === 'exploring' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleTrackingGoalSelect('exploring')}
              >
                <Text style={[
                  styles.optionText,
                  { color: trackingGoal === 'exploring' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Just exploring
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: trackingGoal === 'other' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleTrackingGoalSelect('other')}
              >
                <Text style={[
                  styles.optionText,
                  { color: trackingGoal === 'other' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Other
                </Text>
              </TouchableOpacity>
            </View>
            
            {trackingGoal === 'other' && (
              <View style={styles.heightInputContainer}>
                <TextInput
                  style={[
                    styles.heightInput,
                    { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input }
                  ]}
                  value={trackingGoalOther}
                  onChangeText={setTrackingGoalOther}
                  placeholder="Please specify"
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
              What's your gender?
            </Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              Just for accurate nutrition calculations.
            </Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: gender === 'male' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleGenderSelect('male')}
              >
                <Text style={[
                  styles.optionText,
                  { color: gender === 'male' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Male
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: gender === 'female' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleGenderSelect('female')}
              >
                <Text style={[
                  styles.optionText,
                  { color: gender === 'female' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Female
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: gender === 'prefer_not_to_say' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleGenderSelect('prefer_not_to_say')}
              >
                <Text style={[
                  styles.optionText,
                  { color: gender === 'prefer_not_to_say' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Prefer not to say
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              How old are you?
            </Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              Nutrition needs change with age — this helps us personalize your insights.
            </Text>
            <View style={styles.heightInputContainer}>
              <TextInput
                style={[
                  styles.heightInput,
                  { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input }
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
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>What's your body goal?</Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: goal === 'lose' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleGoalSelect('lose')}
              >
                <Text style={[
                  styles.optionText,
                  { color: goal === 'lose' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Lose Weight
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: goal === 'maintain' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleGoalSelect('maintain')}
              >
                <Text style={[
                  styles.optionText,
                  { color: goal === 'maintain' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Maintain Weight
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: goal === 'gain' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => handleGoalSelect('gain')}
              >
                <Text style={[
                  styles.optionText,
                  { color: goal === 'gain' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Gain Weight
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 6:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>What's your height?</Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              This helps with calorie and metabolism estimates.
            </Text>
            
            {/* Unit Selector */}
            <View style={[styles.unitSelectorContainer, { backgroundColor: theme.colors.input, borderColor: '#10B981', borderWidth: 1 }]}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { 
                    backgroundColor: heightUnit === 'cm' ? '#10B981' : 'transparent',
                    borderTopLeftRadius: 8,
                    borderBottomLeftRadius: 8
                  }
                ]}
                onPress={() => setHeightUnit('cm')}
              >
                <Text style={[
                  styles.unitText,
                  { color: heightUnit === 'cm' ? Colors.white : theme.colors.textSecondary }
                ]}>cm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { 
                    backgroundColor: heightUnit === 'ft' ? '#10B981' : 'transparent',
                    borderTopRightRadius: 8,
                    borderBottomRightRadius: 8
                  }
                ]}
                onPress={() => setHeightUnit('ft')}
              >
                <Text style={[
                  styles.unitText,
                  { color: heightUnit === 'ft' ? Colors.white : theme.colors.textSecondary }
                ]}>ft</Text>
              </TouchableOpacity>
            </View>

            {/* Height Input */}
            <View style={styles.heightInputContainer}>
              {heightUnit === 'cm' ? (
                <TextInput
                  style={[
                    styles.heightInput,
                    { color: theme.colors.textPrimary, borderColor: theme.colors.border }
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
                <View style={styles.feetInputContainer}>
                  <View style={styles.feetTextInputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Feet</Text>
                    <TextInput
                      style={[
                        styles.feetTextInput,
                        { color: theme.colors.textPrimary, borderColor: theme.colors.border }
                      ]}
                      value={heightFeetInput}
                      onChangeText={setHeightFeetInput}
                      placeholder="5"
                      placeholderTextColor={theme.colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={1}
                      autoFocus
                    />
                  </View>
                  
                  <View style={styles.inchesTextInputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Inches</Text>
                    <TextInput
                      style={[
                        styles.inchesTextInput,
                        { color: theme.colors.textPrimary, borderColor: theme.colors.border }
                      ]}
                      value={heightInchesInput}
                      onChangeText={setHeightInchesInput}
                      placeholder="6"
                      placeholderTextColor={theme.colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      case 7:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>What's your current weight?</Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              Only for calculation accuracy — we never judge or compare.
            </Text>
            
            {/* Unit Selector */}
            <View style={[styles.unitSelectorContainer, { backgroundColor: theme.colors.input, borderColor: '#10B981', borderWidth: 1 }]}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { 
                    backgroundColor: weightUnit === 'kg' ? '#10B981' : 'transparent',
                    borderTopLeftRadius: 8,
                    borderBottomLeftRadius: 8
                  }
                ]}
                onPress={() => setWeightUnit('kg')}
              >
                <Text style={[
                  styles.unitText,
                  { color: weightUnit === 'kg' ? Colors.white : theme.colors.textSecondary }
                ]}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { 
                    backgroundColor: weightUnit === 'lbs' ? '#10B981' : 'transparent',
                    borderTopRightRadius: 8,
                    borderBottomRightRadius: 8
                  }
                ]}
                onPress={() => setWeightUnit('lbs')}
              >
                <Text style={[
                  styles.unitText,
                  { color: weightUnit === 'lbs' ? Colors.white : theme.colors.textSecondary }
                ]}>lbs</Text>
              </TouchableOpacity>
            </View>

            {/* Weight Input */}
            <View style={styles.heightInputContainer}>
              <TextInput
                style={[
                  styles.heightInput,
                  { color: theme.colors.textPrimary, borderColor: theme.colors.border }
                ]}
                value={weight}
                onChangeText={setWeight}
                placeholder={weightUnit === 'kg' ? '70' : '154'}
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="numeric"
                maxLength={3}
                autoFocus
              />
            </View>
          </View>
        );
      case 8:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              Do you have a target weight? (optional)
            </Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              Share it only if it helps you stay focused — totally optional.
            </Text>
            
            {/* Unit Selector */}
            <View style={[styles.unitSelectorContainer, { backgroundColor: theme.colors.input, borderColor: '#10B981', borderWidth: 1 }]}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { 
                    backgroundColor: targetWeightUnit === 'kg' ? '#10B981' : 'transparent',
                    borderTopLeftRadius: 8,
                    borderBottomLeftRadius: 8
                  }
                ]}
                onPress={() => setTargetWeightUnit('kg')}
              >
                <Text style={[
                  styles.unitText,
                  { color: targetWeightUnit === 'kg' ? Colors.white : theme.colors.textSecondary }
                ]}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { 
                    backgroundColor: targetWeightUnit === 'lbs' ? '#10B981' : 'transparent',
                    borderTopRightRadius: 8,
                    borderBottomRightRadius: 8
                  }
                ]}
                onPress={() => setTargetWeightUnit('lbs')}
              >
                <Text style={[
                  styles.unitText,
                  { color: targetWeightUnit === 'lbs' ? Colors.white : theme.colors.textSecondary }
                ]}>lbs</Text>
              </TouchableOpacity>
            </View>

            {/* Target Weight Input */}
            <View style={styles.heightInputContainer}>
              <TextInput
                style={[
                  styles.heightInput,
                  { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input }
                ]}
                value={targetWeight}
                onChangeText={setTargetWeight}
                placeholder={targetWeightUnit === 'kg' ? '65' : '143'}
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="numeric"
                maxLength={3}
                autoFocus
              />
            </View>
          </View>
        );
      case 9:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              {goal === 'lose' && 'How fast do you want to lose weight?'}
              {goal === 'gain' && 'How fast do you want to gain weight?'}
              {goal === 'maintain' && 'Weight maintenance goal'}
            </Text>
            
            <View style={styles.optionsContainer}>
              {getRateOptions().map((option) => (
                <TouchableOpacity
                  key={option.rate}
                  style={[
                    styles.rateOptionButton,
                    { backgroundColor: theme.colors.card, borderColor: selectedRate === option.rate ? '#10B981' : 'transparent' },
                    selectedRate === option.rate && { borderWidth: 2 }
                  ]}
                  onPress={() => handleRateSelect(option.rate)}
                >
                  <Text style={[
                    styles.rateOptionTitle,
                    { color: selectedRate === option.rate ? '#10B981' : theme.colors.textPrimary },
                    selectedRate === option.rate && styles.selectedOptionText
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={[
                    styles.rateOptionSubtitle,
                    { color: selectedRate === option.rate ? '#10B981' : theme.colors.textSecondary }
                  ]}>
                    {option.sublabel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 10:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>
              What's your typical daily activity level?
            </Text>
            <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
              This helps us estimate your daily calorie burn more accurately.
            </Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: activityLevel === 'sedentary' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => setActivityLevel('sedentary')}
              >
                <Text style={[
                  styles.optionText,
                  { color: activityLevel === 'sedentary' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Mostly sitting
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: activityLevel === 'light' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => setActivityLevel('light')}
              >
                <Text style={[
                  styles.optionText,
                  { color: activityLevel === 'light' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Lightly active
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: activityLevel === 'moderate' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => setActivityLevel('moderate')}
              >
                <Text style={[
                  styles.optionText,
                  { color: activityLevel === 'moderate' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Moderately active
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: activityLevel === 'very' ? '#10B981' : theme.colors.card }
                ]}
                onPress={() => setActivityLevel('very')}
              >
                <Text style={[
                  styles.optionText,
                  { color: activityLevel === 'very' ? Colors.white : theme.colors.textSecondary }
                ]}>
                  Very active
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      default:
        // Completion screen with calculated calories
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>Your Daily Calorie Goal</Text>
            
            <View style={[styles.calorieResultContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.calorieResultNumber, { color: '#10B981' }]}>{calculatedCalories}</Text>
              <Text style={[styles.calorieResultLabel, { color: theme.colors.textSecondary }]}>calories per day</Text>
            </View>
            
            <Text style={[styles.calorieResultDescription, { color: theme.colors.textSecondary }]}>
              Based on your profile and {goal === 'lose' ? 'weight loss' : goal === 'gain' ? 'weight gain' : 'maintenance'} goal, 
              this is your recommended daily calorie intake.
            </Text>
            
            <View style={styles.completionButtonsContainer}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={handleCancelCalories}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: '#10B981' }]}
                onPress={handleSaveCalories}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  const renderNavigationButtons = () => {
    // Step 1 - Name input
    if (currentStep === 1) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: name.trim() === '' ? theme.colors.border : '#10B981' }
            ]}
            onPress={handleNameNext}
            disabled={name.trim() === ''}
          >
            <Text style={[
              styles.nextButtonText,
              { color: name.trim() === '' ? theme.colors.textSecondary : Colors.white }
            ]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 2 - Tracking goal
    if (currentStep === 2) {
      const isValid = trackingGoal !== null && (trackingGoal !== 'other' || trackingGoalOther.trim() !== '');
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity
            style={[styles.previousButton, { borderColor: theme.colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.previousButtonText, { color: theme.colors.textSecondary }]}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: !isValid ? theme.colors.border : '#10B981' }
            ]}
            onPress={() => isValid && setCurrentStep(currentStep + 1)}
            disabled={!isValid}
          >
            <Text style={[
              styles.nextButtonText,
              { color: !isValid ? theme.colors.textSecondary : Colors.white }
            ]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 3 - Gender question
    if (currentStep === 3) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity
            style={[styles.previousButton, { borderColor: theme.colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.previousButtonText, { color: theme.colors.textSecondary }]}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: !gender ? theme.colors.border : '#10B981' }
            ]}
            onPress={() => gender && setCurrentStep(currentStep + 1)}
            disabled={!gender}
          >
            <Text style={[
              styles.nextButtonText,
              { color: !gender ? theme.colors.textSecondary : Colors.white }
            ]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 4 - Age question
    if (currentStep === 4) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity
            style={[styles.previousButton, { borderColor: theme.colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.previousButtonText, { color: theme.colors.textSecondary }]}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: age.trim() === '' ? theme.colors.border : '#10B981' }
            ]}
            onPress={handleAgeNext}
            disabled={age.trim() === ''}
          >
            <Text style={[
              styles.nextButtonText,
              { color: age.trim() === '' ? theme.colors.textSecondary : Colors.white }
            ]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 5 - Goal selection
    if (currentStep === 5) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity
            style={[styles.previousButton, { borderColor: theme.colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.previousButtonText, { color: theme.colors.textSecondary }]}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: !goal ? theme.colors.border : '#10B981' }
            ]}
            onPress={() => goal && setCurrentStep(currentStep + 1)}
            disabled={!goal}
          >
            <Text style={[
              styles.nextButtonText,
              { color: !goal ? theme.colors.textSecondary : Colors.white }
            ]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 6 - Height question
    if (currentStep === 6) {
      const isValid = heightUnit === 'cm' 
        ? heightCm.trim() !== '' 
        : (heightFeetInput.trim() !== '' && heightInchesInput.trim() !== '');
      
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity
            style={[styles.previousButton, { borderColor: theme.colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.previousButtonText, { color: theme.colors.textSecondary }]}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: !isValid ? theme.colors.border : '#10B981' }
            ]}
            onPress={handleHeightNext}
            disabled={!isValid}
          >
            <Text style={[
              styles.nextButtonText,
              { color: !isValid ? theme.colors.textSecondary : Colors.white }
            ]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 7 - Weight question
    if (currentStep === 7) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity
            style={[styles.previousButton, { borderColor: theme.colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.previousButtonText, { color: theme.colors.textSecondary }]}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: weight.trim() === '' ? theme.colors.border : '#10B981' }
            ]}
            onPress={handleWeightNext}
            disabled={weight.trim() === ''}
          >
            <Text style={[
              styles.nextButtonText,
              { color: weight.trim() === '' ? theme.colors.textSecondary : Colors.white }
            ]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 8 - Target weight question (optional)
    if (currentStep === 8) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity
            style={[styles.previousButton, { borderColor: theme.colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.previousButtonText, { color: theme.colors.textSecondary }]}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: '#10B981' }
            ]}
            onPress={handleTargetWeightNext}
          >
            <Text style={[
              styles.nextButtonText,
              { color: Colors.white }
            ]}>
              {targetWeight.trim() === '' ? 'Skip' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 9 - Rate question
    if (currentStep === 9) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity
            style={[styles.previousButton, { borderColor: theme.colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.previousButtonText, { color: theme.colors.textSecondary }]}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: selectedRate === null ? theme.colors.border : '#10B981' }
            ]}
            onPress={() => {
              if (selectedRate !== null && currentStep < totalSteps) {
                setCurrentStep(currentStep + 1);
              }
            }}
            disabled={selectedRate === null}
          >
            <Text style={[
              styles.nextButtonText,
              { color: selectedRate === null ? theme.colors.textSecondary : Colors.white }
            ]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 10 - Activity level question
    if (currentStep === 10) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity
            style={[styles.previousButton, { borderColor: theme.colors.border }]}
            onPress={handlePrevious}
          >
            <Text style={[styles.previousButtonText, { color: theme.colors.textSecondary }]}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: activityLevel === null ? theme.colors.border : '#10B981' }
            ]}
            onPress={handleCompleteCalculation}
            disabled={activityLevel === null}
          >
            <Text style={[
              styles.nextButtonText,
              { color: activityLevel === null ? theme.colors.textSecondary : Colors.white }
            ]}>Complete</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return null;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header with back button */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={handleClose} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#10B981" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
              Create Custom Plan
            </Text>
            <View style={styles.headerRight} />
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: '#10B981' }]} />
            </View>
            <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
              {currentStep} of {totalSteps}
            </Text>
          </View>

          {/* Question Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.questionWrapper}>
                {renderQuestion()}
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
          
          {/* Fixed Navigation Buttons */}
          <View style={[styles.navigationButtonsWrapper, { borderTopColor: theme.colors.border }]}>
            {renderNavigationButtons()}
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
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
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  questionWrapper: {
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  questionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  questionText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
    textAlign: 'center',
    marginBottom: 40,
  },
  subText: {
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  optionsContainer: {
    width: '100%',
    gap: 16,
  },
  optionButton: {
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  selectedOption: {
    borderWidth: 2,
  },
  optionText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  selectedOptionText: {
    fontWeight: Typography.fontWeight.semiBold,
  },
  unitSelectorContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 0,
    marginBottom: 32,
    overflow: 'hidden',
  },
  unitButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 0,
    alignItems: 'center',
  },
  selectedUnitButton: {
    // Handled inline with theme
  },
  unitText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  selectedUnitText: {
    fontWeight: Typography.fontWeight.semiBold,
  },
  heightInputContainer: {
    width: '100%',
    marginBottom: 32,
    alignItems: 'center',
  },
  heightInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    minWidth: 120,
    borderWidth: 1,
  },
  feetInputContainer: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
  },
  feetTextInputContainer: {
    alignItems: 'center',
  },
  inchesTextInputContainer: {
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    marginBottom: 8,
    fontWeight: Typography.fontWeight.medium,
  },
  feetTextInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    width: 70,
    borderWidth: 1,
  },
  inchesTextInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    width: 70,
    borderWidth: 1,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 16,
  },
  navigationButtonsWrapper: {
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    backgroundColor: 'transparent',
  },
  fixedNavigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  previousButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    flex: 1,
  },
  previousButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  nextButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    flex: 1,
  },
  disabledButton: {
    // Handled inline with theme
  },
  nextButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  disabledButtonText: {
    // Handled inline with theme
  },
  rateOptionButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  rateOptionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  rateOptionSubtitle: {
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.sm,
  },
  selectedRateSubtitle: {
    // Handled inline with theme
  },
  calorieResultContainer: {
    alignItems: 'center',
    marginVertical: 32,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderWidth: 1,
  },
  calorieResultNumber: {
    fontSize: 48,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 8,
  },
  calorieResultLabel: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
  },
  calorieResultDescription: {
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.md,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  completionButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
  },
});

