import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { usePreferences } from '../contexts/PreferencesContext';

export interface CalorieCalculationResult {
  calories: number;
  currentWeightKg?: number;
  targetWeightKg?: number;
  age?: number;
  gender?: 'male' | 'female';
  heightCm?: number;
  heightFeet?: number;
  heightInches?: number;
  goal?: 'lose' | 'maintain' | 'gain';
  activityRate?: number;
}

interface CalorieCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  onCalculated: (result: CalorieCalculationResult) => void;
}

type Goal = 'lose' | 'maintain' | 'gain';
type Gender = 'male' | 'female';
type HeightUnit = 'cm' | 'ft';
type WeightUnit = 'kg' | 'lbs';

export const CalorieCalculatorModal: React.FC<CalorieCalculatorModalProps> = ({
  visible,
  onClose,
  onCalculated
}) => {
  const theme = useTheme();
  const { weightUnit: preferredWeightUnit } = usePreferences();
  const [currentStep, setCurrentStep] = useState(1);
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
  
  // Calculated calories state
  const [calculatedCalories, setCalculatedCalories] = useState<number | null>(null);

  const totalSteps = 7;
  const progress = (currentStep / totalSteps) * 100;

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
    if (!weight || !age || !gender || !selectedRate) return 1500;

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
    if (gender === 'male') {
      bmr = 88.362 + (13.397 * weightKg) + (4.799 * heightInCm) - (5.677 * ageNum);
    } else {
      bmr = 447.593 + (9.247 * weightKg) + (3.098 * heightInCm) - (4.330 * ageNum);
    }

    // Apply activity factor (assuming sedentary to lightly active)
    const tdee = bmr * 1.4; // Moderate activity level

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
    const minCalories = gender === 'female' ? 1200 : 1500;
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
    if (selectedRate !== null) {
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

      onCalculated({
        calories: calculatedCalories,
        currentWeightKg: currentWeightKgValue || undefined,
        targetWeightKg: targetWeightKgValue || undefined,
        age: age ? parseInt(age) : undefined,
        gender: gender || undefined,
        heightCm: heightCmValue,
        heightFeet: heightFeetValue,
        heightInches: heightInchesValue,
        goal: goal || undefined,
        activityRate: selectedRate !== null ? selectedRate : undefined,
      });
    }
    handleClose();
  };

  const handleCancelCalories = () => {
    // Go back to Set Goals screen without saving
    onClose();
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
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
    setCalculatedCalories(null);
    onClose();
  };

  const renderQuestion = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>What's your goal?</Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: goal === 'lose' ? '#14B8A6' : theme.colors.card }
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
                  { backgroundColor: goal === 'maintain' ? '#14B8A6' : theme.colors.card }
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
                  { backgroundColor: goal === 'gain' ? '#14B8A6' : theme.colors.card }
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
      case 2:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>What's your gender?</Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: gender === 'male' ? '#14B8A6' : theme.colors.card }
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
                  { backgroundColor: gender === 'female' ? '#14B8A6' : theme.colors.card }
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
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>What's your height?</Text>
            
            {/* Unit Selector */}
            <View style={[styles.unitSelectorContainer, { backgroundColor: theme.colors.input, borderColor: '#14B8A6', borderWidth: 1 }]}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { 
                    backgroundColor: heightUnit === 'cm' ? '#14B8A6' : 'transparent',
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
                    backgroundColor: heightUnit === 'ft' ? '#14B8A6' : 'transparent',
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
      case 4:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>What's your weight?</Text>
            
            {/* Unit Selector */}
            <View style={[styles.unitSelectorContainer, { backgroundColor: theme.colors.input, borderColor: '#14B8A6', borderWidth: 1 }]}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { 
                    backgroundColor: weightUnit === 'kg' ? '#14B8A6' : 'transparent',
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
                    backgroundColor: weightUnit === 'lbs' ? '#14B8A6' : 'transparent',
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
      case 5:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>What is your age?</Text>
            
            {/* Age Input */}
            <View style={styles.heightInputContainer}>
              <TextInput
                style={[
                  styles.heightInput,
                  { color: theme.colors.textPrimary, borderColor: theme.colors.border }
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
      case 6:
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>What's your target weight?</Text>
            
            {/* Unit Selector */}
            <View style={[styles.unitSelectorContainer, { backgroundColor: theme.colors.input, borderColor: '#14B8A6', borderWidth: 1 }]}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  { 
                    backgroundColor: targetWeightUnit === 'kg' ? '#14B8A6' : 'transparent',
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
                    backgroundColor: targetWeightUnit === 'lbs' ? '#14B8A6' : 'transparent',
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
                  { color: theme.colors.textPrimary, borderColor: theme.colors.border }
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
      case 7:
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
                    { backgroundColor: theme.colors.card, borderColor: selectedRate === option.rate ? '#14B8A6' : 'transparent' },
                    selectedRate === option.rate && { borderWidth: 2 }
                  ]}
                  onPress={() => handleRateSelect(option.rate)}
                >
                  <Text style={[
                    styles.rateOptionTitle,
                    { color: selectedRate === option.rate ? '#14B8A6' : theme.colors.textPrimary },
                    selectedRate === option.rate && styles.selectedOptionText
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={[
                    styles.rateOptionSubtitle,
                    { color: selectedRate === option.rate ? '#14B8A6' : theme.colors.textSecondary }
                  ]}>
                    {option.sublabel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      default:
        // Completion screen with calculated calories
        return (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: theme.colors.textPrimary }]}>Your Daily Calorie Goal</Text>
            
            <View style={[styles.calorieResultContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.calorieResultNumber, { color: '#14B8A6' }]}>{calculatedCalories}</Text>
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
                style={[styles.saveButton, { backgroundColor: '#14B8A6' }]}
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
    // Step 1 - only goal selection, only Next button
    if (currentStep === 1) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: !goal ? theme.colors.border : '#14B8A6' }
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
    
    // Step 2 - Gender question
    if (currentStep === 2) {
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
              { backgroundColor: !gender ? theme.colors.border : '#14B8A6' }
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
    
    // Step 3 - Height question
    if (currentStep === 3) {
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
              { backgroundColor: !isValid ? theme.colors.border : '#14B8A6' }
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
    
    // Step 4 - Weight question
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
              { backgroundColor: weight.trim() === '' ? theme.colors.border : '#14B8A6' }
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
    
    // Step 5 - Age question
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
              { backgroundColor: age.trim() === '' ? theme.colors.border : '#14B8A6' }
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
    
    // Step 6 - Target weight question
    if (currentStep === 6) {
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
              { backgroundColor: targetWeight.trim() === '' ? theme.colors.border : '#14B8A6' }
            ]}
            onPress={handleTargetWeightNext}
            disabled={targetWeight.trim() === ''}
          >
            <Text style={[
              styles.nextButtonText,
              { color: targetWeight.trim() === '' ? theme.colors.textSecondary : Colors.white }
            ]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 7 - Rate question
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
              { backgroundColor: selectedRate === null ? theme.colors.border : '#14B8A6' }
            ]}
            onPress={handleCompleteCalculation}
            disabled={selectedRate === null}
          >
            <Text style={[
              styles.nextButtonText,
              { color: selectedRate === null ? theme.colors.textSecondary : Colors.white }
            ]}>Complete</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
          {/* Header with close button */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              Calculate Daily Calories
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Feather name="x" size={24} color="#14B8A6" />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: '#14B8A6' }]} />
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 32,
    height: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
  },
  closeButton: {
    padding: 4,
  },
  progressContainer: {
    marginBottom: 24,
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
    paddingHorizontal: 0,
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
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
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
