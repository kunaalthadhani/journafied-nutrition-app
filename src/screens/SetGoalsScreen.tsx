import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
// Removed slider import
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { CalorieCalculatorModal } from '../components/CalorieCalculatorModal';

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
}

export const SetGoalsScreen: React.FC<SetGoalsScreenProps> = ({
  onBack,
  onSave,
  initialGoals
}) => {
  const [calories, setCalories] = useState(initialGoals?.calories || 1500);
  const [proteinPercentage, setProteinPercentage] = useState(initialGoals?.proteinPercentage || 30);
  const [carbsPercentage, setCarbsPercentage] = useState(initialGoals?.carbsPercentage || 45);
  const [fatPercentage, setFatPercentage] = useState(initialGoals?.fatPercentage || 25);
  const [showCalculator, setShowCalculator] = useState(false);

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

  const handleCalculatedCalories = (calculatedCalories: number) => {
    setCalories(calculatedCalories);
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
    };
    onSave(goalData);
    onBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={Colors.primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set Goals</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

        <ScrollView style={styles.content} scrollEnabled={false}>
        {/* Calories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Calories</Text>
          <View style={styles.caloriesContainer}>
            <TextInput
              style={styles.caloriesInput}
              value={calories === 0 ? '' : calories.toString()}
              onChangeText={(text) => {
                const sanitized = text.replace(/[^0-9]/g, '');
                if (sanitized.length === 0) {
                  setCalories(0);
                } else {
                  const numValue = parseInt(sanitized, 10);
                  setCalories(isNaN(numValue) ? 0 : numValue);
                }
              }}
              keyboardType="number-pad"
              placeholder="1500"
            />
            <Text style={styles.caloriesLabel}>calories</Text>
          </View>
          <View style={styles.calculateContainer}>
            <TouchableOpacity onPress={() => setShowCalculator(true)}>
              <Text style={styles.calculateText}>Calculate Daily Calories</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Macros Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Macronutrient Distribution</Text>
          
          {/* Total Percentage Indicator */}
          <View style={[styles.totalContainer, { 
            backgroundColor: totalPercentage === 100 ? Colors.activeGreen : '#FFE5E5'
          }]}>
            <Text style={styles.totalText}>
              Total: {totalPercentage}% {totalPercentage === 100 ? '✓' : '⚠️'}
            </Text>
          </View>

          {/* Protein */}
          <View style={styles.macroContainer}>
            <View style={styles.macroHeader}>
              <Text style={styles.macroTitle}>Protein</Text>
              <Text style={styles.macroValue}>{proteinGrams}g ({proteinPercentage}%)</Text>
            </View>
            <View style={styles.macroControls}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleProteinChange(Math.max(0, proteinPercentage - 5))}
              >
                <Feather name="minus" size={20} color={Colors.secondaryText} />
              </TouchableOpacity>
              
              <View style={styles.percentageDisplay}>
                <Text style={styles.percentageText}>{proteinPercentage}%</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { 
                    width: `${proteinPercentage}%`
                  }]} />
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleProteinChange(Math.min(100, proteinPercentage + 5))}
              >
                <Feather name="plus" size={20} color={Colors.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Carbs */}
          <View style={styles.macroContainer}>
            <View style={styles.macroHeader}>
              <Text style={styles.macroTitle}>Carbohydrates</Text>
              <Text style={styles.macroValue}>{carbsGrams}g ({carbsPercentage}%)</Text>
            </View>
            <View style={styles.macroControls}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleCarbsChange(Math.max(0, carbsPercentage - 5))}
              >
                <Feather name="minus" size={20} color={Colors.secondaryText} />
              </TouchableOpacity>
              
              <View style={styles.percentageDisplay}>
                <Text style={styles.percentageText}>{carbsPercentage}%</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { 
                    width: `${carbsPercentage}%`
                  }]} />
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleCarbsChange(Math.min(100, carbsPercentage + 5))}
              >
                <Feather name="plus" size={20} color={Colors.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Fat */}
          <View style={styles.macroContainer}>
            <View style={styles.macroHeader}>
              <Text style={styles.macroTitle}>Fat</Text>
              <Text style={styles.macroValue}>{fatGrams}g ({fatPercentage}%)</Text>
            </View>
            <View style={styles.macroControls}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleFatChange(Math.max(0, fatPercentage - 5))}
              >
                <Feather name="minus" size={20} color={Colors.secondaryText} />
              </TouchableOpacity>
              
              <View style={styles.percentageDisplay}>
                <Text style={styles.percentageText}>{fatPercentage}%</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { 
                    width: `${fatPercentage}%`
                  }]} />
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleFatChange(Math.min(100, fatPercentage + 5))}
              >
                <Feather name="plus" size={20} color={Colors.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightBorder,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primaryText,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.info,
    borderRadius: 8,
  },
  saveText: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semiBold,
    fontSize: Typography.fontSize.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primaryText,
    marginBottom: 16,
  },
  caloriesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  caloriesInput: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primaryText,
    flex: 1,
  },
  caloriesLabel: {
    fontSize: Typography.fontSize.md,
    color: Colors.secondaryText,
    marginLeft: 8,
  },
  totalContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  totalText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primaryText,
  },
  macroContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  macroTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primaryText,
  },
  macroValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.secondaryText,
  },
  macroControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  controlButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageDisplay: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  percentageText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primaryText,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Colors.lightBorder,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.secondaryText,
  },
  calculateContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  calculateText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.info,
    textDecorationLine: 'underline',
  },
});