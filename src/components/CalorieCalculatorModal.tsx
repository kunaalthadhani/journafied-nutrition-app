import React, { useState } from 'react';
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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface CalorieCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  onCalculated: (calories: number) => void;
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
  const [currentStep, setCurrentStep] = useState(1);
  const [goal, setGoal] = useState<Goal | null>(null);
  
  // Gender question state
  const [gender, setGender] = useState<Gender | null>(null);
  
  // Height question state
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [heightCm, setHeightCm] = useState('');
  const [heightFeetInput, setHeightFeetInput] = useState('');
  const [heightInchesInput, setHeightInchesInput] = useState('');
  
  // Weight question state
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [weight, setWeight] = useState('');
  
  // Age question state
  const [age, setAge] = useState('');
  
  // Target weight question state
  const [targetWeightUnit, setTargetWeightUnit] = useState<WeightUnit>('kg');
  const [targetWeight, setTargetWeight] = useState('');
  
  // Rate question state
  const [selectedRate, setSelectedRate] = useState<number | null>(null);
  
  // Calculated calories state
  const [calculatedCalories, setCalculatedCalories] = useState<number | null>(null);

  const totalSteps = 7;
  const progress = (currentStep / totalSteps) * 100;

  // Helper functions for calculations
  const convertWeightToKg = (weight: string, unit: WeightUnit): number => {
    const weightNum = parseFloat(weight);
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
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
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
      onCalculated(calculatedCalories);
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
            <Text style={styles.questionText}>What's your goal?</Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[styles.optionButton, goal === 'lose' && styles.selectedOption]}
                onPress={() => handleGoalSelect('lose')}
              >
                <Text style={[styles.optionText, goal === 'lose' && styles.selectedOptionText]}>
                  Lose Weight
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.optionButton, goal === 'maintain' && styles.selectedOption]}
                onPress={() => handleGoalSelect('maintain')}
              >
                <Text style={[styles.optionText, goal === 'maintain' && styles.selectedOptionText]}>
                  Maintain Weight
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.optionButton, goal === 'gain' && styles.selectedOption]}
                onPress={() => handleGoalSelect('gain')}
              >
                <Text style={[styles.optionText, goal === 'gain' && styles.selectedOptionText]}>
                  Gain Weight
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>What's your gender?</Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[styles.optionButton, gender === 'male' && styles.selectedOption]}
                onPress={() => handleGenderSelect('male')}
              >
                <Text style={[styles.optionText, gender === 'male' && styles.selectedOptionText]}>
                  Male
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.optionButton, gender === 'female' && styles.selectedOption]}
                onPress={() => handleGenderSelect('female')}
              >
                <Text style={[styles.optionText, gender === 'female' && styles.selectedOptionText]}>
                  Female
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>What's your height?</Text>
            
            {/* Unit Selector */}
            <View style={styles.unitSelectorContainer}>
              <TouchableOpacity
                style={[styles.unitButton, heightUnit === 'cm' && styles.selectedUnitButton]}
                onPress={() => setHeightUnit('cm')}
              >
                <Text style={[styles.unitText, heightUnit === 'cm' && styles.selectedUnitText]}>cm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitButton, heightUnit === 'ft' && styles.selectedUnitButton]}
                onPress={() => setHeightUnit('ft')}
              >
                <Text style={[styles.unitText, heightUnit === 'ft' && styles.selectedUnitText]}>ft</Text>
              </TouchableOpacity>
            </View>

            {/* Height Input */}
            <View style={styles.heightInputContainer}>
              {heightUnit === 'cm' ? (
                <TextInput
                  style={styles.heightInput}
                  value={heightCm}
                  onChangeText={setHeightCm}
                  placeholder="170"
                  keyboardType="numeric"
                  maxLength={3}
                />
              ) : (
                <View style={styles.feetInputContainer}>
                  <View style={styles.feetTextInputContainer}>
                    <Text style={styles.inputLabel}>Feet</Text>
                    <TextInput
                      style={styles.feetTextInput}
                      value={heightFeetInput}
                      onChangeText={setHeightFeetInput}
                      placeholder="5"
                      keyboardType="numeric"
                      maxLength={1}
                    />
                  </View>
                  
                  <View style={styles.inchesTextInputContainer}>
                    <Text style={styles.inputLabel}>Inches</Text>
                    <TextInput
                      style={styles.inchesTextInput}
                      value={heightInchesInput}
                      onChangeText={setHeightInchesInput}
                      placeholder="6"
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
            <Text style={styles.questionText}>What's your weight?</Text>
            
            {/* Unit Selector */}
            <View style={styles.unitSelectorContainer}>
              <TouchableOpacity
                style={[styles.unitButton, weightUnit === 'kg' && styles.selectedUnitButton]}
                onPress={() => setWeightUnit('kg')}
              >
                <Text style={[styles.unitText, weightUnit === 'kg' && styles.selectedUnitText]}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitButton, weightUnit === 'lbs' && styles.selectedUnitButton]}
                onPress={() => setWeightUnit('lbs')}
              >
                <Text style={[styles.unitText, weightUnit === 'lbs' && styles.selectedUnitText]}>lbs</Text>
              </TouchableOpacity>
            </View>

            {/* Weight Input */}
            <View style={styles.heightInputContainer}>
              <TextInput
                style={styles.heightInput}
                value={weight}
                onChangeText={setWeight}
                placeholder={weightUnit === 'kg' ? '70' : '154'}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>
        );
      case 5:
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>What is your age?</Text>
            
            {/* Age Input */}
            <View style={styles.heightInputContainer}>
              <TextInput
                style={styles.heightInput}
                value={age}
                onChangeText={setAge}
                placeholder="25"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>
        );
      case 6:
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>What's your target weight?</Text>
            
            {/* Unit Selector */}
            <View style={styles.unitSelectorContainer}>
              <TouchableOpacity
                style={[styles.unitButton, targetWeightUnit === 'kg' && styles.selectedUnitButton]}
                onPress={() => setTargetWeightUnit('kg')}
              >
                <Text style={[styles.unitText, targetWeightUnit === 'kg' && styles.selectedUnitText]}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitButton, targetWeightUnit === 'lbs' && styles.selectedUnitButton]}
                onPress={() => setTargetWeightUnit('lbs')}
              >
                <Text style={[styles.unitText, targetWeightUnit === 'lbs' && styles.selectedUnitText]}>lbs</Text>
              </TouchableOpacity>
            </View>

            {/* Target Weight Input */}
            <View style={styles.heightInputContainer}>
              <TextInput
                style={styles.heightInput}
                value={targetWeight}
                onChangeText={setTargetWeight}
                placeholder={targetWeightUnit === 'kg' ? '65' : '143'}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>
        );
      case 7:
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>
              {goal === 'lose' && 'How fast do you want to lose weight?'}
              {goal === 'gain' && 'How fast do you want to gain weight?'}
              {goal === 'maintain' && 'Weight maintenance goal'}
            </Text>
            
            <View style={styles.optionsContainer}>
              {getRateOptions().map((option) => (
                <TouchableOpacity
                  key={option.rate}
                  style={[styles.rateOptionButton, selectedRate === option.rate && styles.selectedOption]}
                  onPress={() => handleRateSelect(option.rate)}
                >
                  <Text style={[styles.rateOptionTitle, selectedRate === option.rate && styles.selectedOptionText]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.rateOptionSubtitle, selectedRate === option.rate && styles.selectedRateSubtitle]}>
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
            <Text style={styles.questionText}>Your Daily Calorie Goal</Text>
            
            <View style={styles.calorieResultContainer}>
              <Text style={styles.calorieResultNumber}>{calculatedCalories}</Text>
              <Text style={styles.calorieResultLabel}>calories per day</Text>
            </View>
            
            <Text style={styles.calorieResultDescription}>
              Based on your profile and {goal === 'lose' ? 'weight loss' : goal === 'gain' ? 'weight gain' : 'maintenance'} goal, 
              this is your recommended daily calorie intake.
            </Text>
            
            <View style={styles.completionButtonsContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelCalories}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveCalories}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  const renderNavigationButtons = () => {
    // Step 1 - only goal selection, no previous button
    if (currentStep === 1) {
      return null; // No navigation buttons for step 1
    }
    
    // Step 2 - Gender question
    if (currentStep === 2) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
            <Text style={styles.previousButtonText}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.nextButton, !gender && styles.disabledButton]}
            onPress={() => gender && setCurrentStep(currentStep + 1)}
            disabled={!gender}
          >
            <Text style={[styles.nextButtonText, !gender && styles.disabledButtonText]}>Next</Text>
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
          <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
            <Text style={styles.previousButtonText}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.nextButton, !isValid && styles.disabledButton]}
            onPress={handleHeightNext}
            disabled={!isValid}
          >
            <Text style={[styles.nextButtonText, !isValid && styles.disabledButtonText]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 4 - Weight question
    if (currentStep === 4) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
            <Text style={styles.previousButtonText}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.nextButton, weight.trim() === '' && styles.disabledButton]}
            onPress={handleWeightNext}
            disabled={weight.trim() === ''}
          >
            <Text style={[styles.nextButtonText, weight.trim() === '' && styles.disabledButtonText]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 5 - Age question
    if (currentStep === 5) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
            <Text style={styles.previousButtonText}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.nextButton, age.trim() === '' && styles.disabledButton]}
            onPress={handleAgeNext}
            disabled={age.trim() === ''}
          >
            <Text style={[styles.nextButtonText, age.trim() === '' && styles.disabledButtonText]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 6 - Target weight question
    if (currentStep === 6) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
            <Text style={styles.previousButtonText}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.nextButton, targetWeight.trim() === '' && styles.disabledButton]}
            onPress={handleTargetWeightNext}
            disabled={targetWeight.trim() === ''}
          >
            <Text style={[styles.nextButtonText, targetWeight.trim() === '' && styles.disabledButtonText]}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Step 7 - Rate question
    if (currentStep === 7) {
      return (
        <View style={styles.fixedNavigationContainer}>
          <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
            <Text style={styles.previousButtonText}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.nextButton, selectedRate === null && styles.disabledButton]}
            onPress={handleCompleteCalculation}
            disabled={selectedRate === null}
          >
            <Text style={[styles.nextButtonText, selectedRate === null && styles.disabledButtonText]}>Complete</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Header with close button */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={Colors.primaryText} />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{currentStep} of {totalSteps}</Text>
          </View>

          {/* Question Content */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.content}>
              <View style={styles.questionWrapper}>
                {renderQuestion()}
              </View>
            </View>
          </TouchableWithoutFeedback>
          
          {/* Fixed Navigation Buttons */}
          {renderNavigationButtons()}
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightBorder,
  },
  closeButton: {
    padding: 4,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.lightBorder,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.info,
    borderRadius: 2,
  },
  progressText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.secondaryText,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  questionWrapper: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 40,
  },
  questionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    minHeight: 400, // Fixed height to prevent button jumping
  },
  questionText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primaryText,
    textAlign: 'center',
    marginBottom: 40,
  },
  subText: {
    fontSize: Typography.fontSize.md,
    color: Colors.secondaryText,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  optionsContainer: {
    width: '100%',
    gap: 16,
  },
  optionButton: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    backgroundColor: '#E3F2FD',
    borderColor: Colors.info,
  },
  optionText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primaryText,
  },
  selectedOptionText: {
    color: Colors.info,
    fontWeight: Typography.fontWeight.semiBold,
  },
  unitSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.lightBorder,
    borderRadius: 8,
    padding: 2,
    marginBottom: 32,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  selectedUnitButton: {
    backgroundColor: Colors.white,
  },
  unitText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.secondaryText,
  },
  selectedUnitText: {
    color: Colors.primaryText,
    fontWeight: Typography.fontWeight.semiBold,
  },
  heightInputContainer: {
    width: '100%',
    marginBottom: 32,
    alignItems: 'center',
  },
  heightInput: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primaryText,
    textAlign: 'center',
    minWidth: 120,
    borderWidth: 2,
    borderColor: 'transparent',
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
    color: Colors.secondaryText,
    marginBottom: 8,
    fontWeight: Typography.fontWeight.medium,
  },
  feetTextInput: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primaryText,
    textAlign: 'center',
    width: 70,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inchesTextInput: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primaryText,
    textAlign: 'center',
    width: 70,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 16,
  },
  fixedNavigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40, // Extra padding for safe area
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.lightBorder,
    gap: 16,
  },
  previousButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    flex: 1,
  },
  previousButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.secondaryText,
  },
  nextButton: {
    backgroundColor: Colors.info,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    flex: 1,
  },
  disabledButton: {
    backgroundColor: Colors.lightBorder,
  },
  nextButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
  },
  disabledButtonText: {
    color: Colors.secondaryText,
  },
  rateOptionButton: {
    backgroundColor: Colors.cardBackground,
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
    color: Colors.primaryText,
    marginBottom: 4,
  },
  rateOptionSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.secondaryText,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.sm,
  },
  selectedRateSubtitle: {
    color: Colors.info,
  },
  calorieResultContainer: {
    alignItems: 'center',
    marginVertical: 32,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
  },
  calorieResultNumber: {
    fontSize: 48,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.info,
    marginBottom: 8,
  },
  calorieResultLabel: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.secondaryText,
  },
  calorieResultDescription: {
    fontSize: Typography.fontSize.md,
    color: Colors.secondaryText,
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
    borderColor: Colors.lightBorder,
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.secondaryText,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.info,
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
