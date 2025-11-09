import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { Border } from '../constants/border';
import { ParsedFood } from '../utils/foodNutrition';
import { Terminal } from './Terminal';
import { TypingAnimation } from './TypingAnimation';
import { AnimatedSpan } from './AnimatedSpan';
import { useTheme } from '../constants/theme';

export interface Meal {
  id: string;
  prompt: string;
  foods: ParsedFood[];
  timestamp: number;
  imageUri?: string;
}

interface FoodLogSectionProps {
  meals: Meal[];
  onRemoveFood: (foodId: string) => void;
  dailyCalories?: number;
  savedGoals?: {
    calories: number;
    proteinPercentage: number;
    carbsPercentage: number;
    fatPercentage: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
}

export const FoodLogSection: React.FC<FoodLogSectionProps> = ({ meals, onRemoveFood, dailyCalories = 1500, savedGoals }) => {
  const theme = useTheme();
  const [animatedMeals, setAnimatedMeals] = useState<Set<string>>(new Set());
  const [selectedFood, setSelectedFood] = useState<ParsedFood | null>(null);
  const [viewedFoods, setViewedFoods] = useState<Set<string>>(new Set());

  // Check if food is not the best fit
  const isNotBestFit = (food: ParsedFood): boolean => {
    if (!savedGoals) return false;

    const caloriesPercent = (food.calories / savedGoals.calories) * 100;
    const proteinPercent = (food.protein / savedGoals.proteinGrams) * 100;

    const proteinCal = food.protein * 4;
    const carbsCal = food.carbs * 4;
    const fatCal = food.fat * 9;
    const totalCal = proteinCal + carbsCal + fatCal;
    
    if (totalCal === 0) return false;
    
    const proteinRatio = proteinCal / totalCal;
    const carbsRatio = carbsCal / totalCal;

    // Not the best fit if:
    // - High calories (>=30% of daily) OR
    // - Low protein (<5%) AND high calories (>15%) OR
    // - Very high in carbs (>60% of calories) OR
    // - Low protein (<10%) AND moderate calories (>10%)
    return (
      caloriesPercent >= 30 ||
      (proteinPercent < 5 && caloriesPercent > 15) ||
      carbsRatio > 0.6 ||
      (proteinPercent < 10 && caloriesPercent > 10)
    );
  };

  // Analyze food against user goals and provide detailed explanation
  const analyzeFood = (food: ParsedFood): string => {
    if (!savedGoals) {
      return `This food item contains ${food.calories} calories, ${food.protein}g protein, ${food.carbs}g carbs, and ${food.fat}g fat. It's a decent choice for a balanced meal.`;
    }

    const caloriesPercent = (food.calories / savedGoals.calories) * 100;
    const proteinPercent = (food.protein / savedGoals.proteinGrams) * 100;
    const carbsPercent = (food.carbs / savedGoals.carbsGrams) * 100;
    const fatPercent = (food.fat / savedGoals.fatGrams) * 100;

    const proteinCal = food.protein * 4;
    const carbsCal = food.carbs * 4;
    const fatCal = food.fat * 9;
    const totalCal = proteinCal + carbsCal + fatCal;
    
    if (totalCal === 0) {
      return `${food.name} contains ${food.calories} calories. This item provides minimal nutritional value and may not contribute significantly to your daily goals.`;
    }
    
    const proteinRatio = proteinCal / totalCal;
    const carbsRatio = carbsCal / totalCal;
    const fatRatio = fatCal / totalCal;

    // Build detailed explanation
    let explanation = '';

    // Overall assessment
    if (proteinPercent >= 15 && caloriesPercent <= 20) {
      explanation = `This is an excellent choice for your goals! ${food.name} provides ${proteinPercent.toFixed(0)}% of your daily protein target while using only ${caloriesPercent.toFixed(0)}% of your calorie budget. `;
    } else if (proteinPercent >= 10 && caloriesPercent <= 15) {
      explanation = `This is a good choice. ${food.name} offers a solid protein content (${proteinPercent.toFixed(0)}% of daily goal) at a reasonable calorie cost (${caloriesPercent.toFixed(0)}% of daily budget). `;
    } else if (caloriesPercent >= 30) {
      explanation = `This food is quite calorie-dense, using ${caloriesPercent.toFixed(0)}% of your daily calorie budget. `;
    } else if (proteinPercent < 5 && caloriesPercent > 15) {
      explanation = `This food is relatively low in protein (only ${proteinPercent.toFixed(0)}% of your daily goal) but still takes up ${caloriesPercent.toFixed(0)}% of your calorie budget. `;
    } else {
      explanation = `${food.name} contributes ${caloriesPercent.toFixed(0)}% to your daily calories and ${proteinPercent.toFixed(0)}% to your protein goal. `;
    }

    // Macro balance details
    if (proteinRatio >= 0.25) {
      explanation += `The macro distribution is well-balanced with a good protein ratio. `;
    } else if (carbsRatio > 0.6) {
      explanation += `However, it's very high in carbohydrates (${(carbsRatio * 100).toFixed(0)}% of calories), which may not align with your goals if you're focusing on protein or fat intake. `;
    }

    // Protein-specific advice
    if (proteinPercent >= 15) {
      explanation += `This is particularly beneficial if you're aiming to build or maintain muscle mass.`;
    } else if (proteinPercent < 5 && caloriesPercent > 10) {
      explanation += `Consider pairing this with a protein-rich side to better meet your daily protein target.`;
    } else {
      explanation += `It fits reasonably well within a balanced diet when combined with other nutrient-dense foods.`;
    }

    return explanation;
  };

  const handleFoodPress = (food: ParsedFood) => {
    setSelectedFood(food);
    // Mark as viewed when user opens the modal
    setViewedFoods((prev) => new Set(prev).add(food.id));
  };

  const handleCloseModal = () => {
    setSelectedFood(null);
  };

  // Track which meals have completed their animation
  React.useEffect(() => {
    if (meals.length === 0) return;
    
    const timers: NodeJS.Timeout[] = [];
    
    meals.forEach((meal) => {
      if (!animatedMeals.has(meal.id)) {
        // Mark as animated after a delay (allows animations to complete)
        const timer = setTimeout(() => {
          setAnimatedMeals((prev) => new Set(prev).add(meal.id));
        }, 1000 + meal.foods.length * 400);
        timers.push(timer);
      }
    });
    
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [meals, animatedMeals]);

  if (meals.length === 0) {
    return null;
  }

  return (
    <>
    <View style={styles.container}>
        {meals.map((meal, mealIndex) => {
          return (
            <Terminal key={meal.id} style={styles.terminal}>
              {/* Prompt with typing animation - only show if not an image */}
              {!meal.imageUri && (
                <TypingAnimation 
                  speed={20}
                  style={{ color: theme.colors.textSecondary, marginBottom: 8, fontSize: 12 }}
                >
                  {`> ${meal.prompt}`}
                </TypingAnimation>
              )}
              
              {/* Food Items with animated spans */}
              {meal.foods.map((food, foodIndex) => {
                const baseDelay = 500 + (mealIndex * 1000) + (foodIndex * 300);
                const showWarning = isNotBestFit(food) && !viewedFoods.has(food.id);
                const isFirstFood = foodIndex === 0;
        
        return (
          <TouchableOpacity 
                    key={food.id} 
                    style={styles.foodItem}
                    onPress={() => handleFoodPress(food)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.foodNameRow}>
                      <View style={styles.foodNameContainer}>
                        <AnimatedSpan
                          delay={baseDelay}
                          style={{ color: '#10B981', marginBottom: 4 }}
                        >
                          {`${food.name} (${food.weight_g}g)`}
                        </AnimatedSpan>
                        {showWarning && (
                          <AnimatedSpan
                            delay={baseDelay}
                            style={{ color: '#EF4444', marginLeft: 4, marginBottom: 4, fontSize: 14 }}
                          >
                            ⚠️
                          </AnimatedSpan>
                        )}
                      </View>
                      {isFirstFood && meal.imageUri && (
                        <Image 
                          source={{ uri: meal.imageUri }} 
                          style={[styles.thumbnail, { borderColor: theme.colors.border }]}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                    
                    <AnimatedSpan
                      delay={baseDelay + 100}
                      style={{ color: '#10B981', fontSize: 12 }}
                    >
                      {`  Calories: ${food.calories} | Protein: ${food.protein}g | Carbs: ${food.carbs}g | Fat: ${food.fat}g`}
                    </AnimatedSpan>
          </TouchableOpacity>
                );
              })}

              {/* Success message - once per meal */}
              {meal.foods.length > 0 && (
                <TypingAnimation
                  speed={30}
                  style={{ 
                    color: theme.colors.textSecondary, 
                    marginTop: 8,
                    fontSize: 12 
                  }}
                >
                  {`Success! Added ${meal.foods.length} food item${meal.foods.length > 1 ? 's' : ''}.`}
                </TypingAnimation>
              )}
            </Terminal>
          );
        })}
              </View>
              
      {/* Food Analysis Modal */}
      <Modal
        visible={selectedFood !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseModal}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          >
            {selectedFood && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                    {selectedFood.name}
                  </Text>
                  <TouchableOpacity
                    onPress={handleCloseModal}
                    style={styles.closeButton}
                  >
                    <Feather name="x" size={24} color="#14B8A6" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalNutrition}>
                  <Text style={[styles.nutritionLabel, { color: theme.colors.textSecondary }]}>
                    Nutrition per {selectedFood.weight_g}g
                  </Text>
                  <View style={styles.nutritionGrid}>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionValue, { color: theme.colors.textPrimary }]}>
                        {selectedFood.calories}
                      </Text>
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        Calories
                      </Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionValue, { color: theme.colors.textPrimary }]}>
                        {selectedFood.protein}g
                      </Text>
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        Protein
                      </Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionValue, { color: theme.colors.textPrimary }]}>
                        {selectedFood.carbs}g
                      </Text>
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        Carbs
                      </Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionValue, { color: theme.colors.textPrimary }]}>
                        {selectedFood.fat}g
                      </Text>
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        Fat
                      </Text>
                    </View>
                </View>
                </View>

                <View style={[styles.modalExplanation, { borderTopColor: theme.colors.border }]}>
                  <Text style={[styles.explanationTitle, { color: theme.colors.textPrimary }]}>
                    Analysis
                  </Text>
                  <Text style={[styles.explanationText, { color: theme.colors.textSecondary }]}>
                    {analyzeFood(selectedFood)}
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  terminal: {
    marginBottom: Spacing.md,
    fontFamily: 'monospace',
  },
  foodItem: {
    marginBottom: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  foodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalNutrition: {
    marginBottom: Spacing.md,
  },
  nutritionLabel: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.sm,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  nutritionUnit: {
    fontSize: Typography.fontSize.xs,
  },
  modalExplanation: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  explanationTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: Spacing.sm,
  },
  explanationText: {
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.6,
  },
});
