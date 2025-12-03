import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BookmarkPlus, BookmarkCheck } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { Border } from '../constants/border';
import { ParsedFood } from '../utils/foodNutrition';
import { Terminal } from './Terminal';
import { TypingAnimation } from './TypingAnimation';
import { AnimatedSpan } from './AnimatedSpan';
import { useTheme } from '../constants/theme';
import { SavedPrompt } from '../services/dataStorage';

export interface Meal {
  id: string;
  prompt: string;
  foods: ParsedFood[];
  timestamp: number;
  imageUri?: string;
  updatedAt?: string;
}

interface FoodLogSectionProps {
  meals: Meal[];
  onRemoveFood: (foodId: string) => void;
  onEditMealPrompt?: (mealId: string, newPrompt: string) => Promise<void> | void;
  savedPrompts?: SavedPrompt[];
  onToggleSavePrompt?: (meal: Meal) => void;
  onDeleteMeal?: (mealId: string) => void;
  onUpdateFood?: (mealId: string, updatedFood: ParsedFood) => void;
}

export const FoodLogSection: React.FC<FoodLogSectionProps> = ({
  meals,
  onRemoveFood,
  onEditMealPrompt,
  savedPrompts = [],
  onToggleSavePrompt,
  onDeleteMeal,
  onUpdateFood,
}) => {
  const theme = useTheme();
  const [animatedMeals, setAnimatedMeals] = useState<Set<string>>(new Set());
  const [selectedFood, setSelectedFood] = useState<ParsedFood | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [isMealUpdating, setIsMealUpdating] = useState(false);

  const savedPromptLookup = useMemo(() => {
    const map = new Map<string, string>();
    savedPrompts.forEach(prompt => {
      map.set(prompt.text.trim().toLowerCase(), prompt.id);
    });
    return map;
  }, [savedPrompts]);

  const handleFoodPress = (mealId: string, food: ParsedFood) => {
    // Work on a shallow copy so edits don't apply until saved
    setSelectedFood({ ...food });
    setSelectedMealId(mealId);
  };

  const handleCloseModal = () => {
    setSelectedFood(null);
    setSelectedMealId(null);
  };

  const handleStartEditPrompt = (meal: Meal) => {
    setEditingMealId(meal.id);
    setEditedPrompt(meal.prompt);
  };

  const handleSavePrompt = async () => {
    if (!editingMealId || !onEditMealPrompt || isMealUpdating) return;
    const trimmed = editedPrompt.trim();
    if (!trimmed.length) {
      setEditingMealId(null);
      setEditedPrompt('');
      return;
    }
    try {
      setIsMealUpdating(true);
      await Promise.resolve(onEditMealPrompt(editingMealId, trimmed));
    } finally {
      setIsMealUpdating(false);
    }
    setEditingMealId(null);
    setEditedPrompt('');
  };

  const handleCancelEditPrompt = () => {
    setEditingMealId(null);
    setEditedPrompt('');
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
                <View style={styles.promptRow}>
                  {editingMealId === meal.id ? (
                    <>
                      <TextInput
                        value={editedPrompt}
                        onChangeText={setEditedPrompt}
                        style={[
                          styles.promptInput,
                          {
                            color: theme.colors.textPrimary,
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.input,
                          },
                        ]}
                        autoFocus
                        returnKeyType="send"
                        blurOnSubmit
                        enablesReturnKeyAutomatically
                        onSubmitEditing={handleSavePrompt}
                        placeholder="Edit prompt"
                        placeholderTextColor={theme.colors.textTertiary}
                      />
                      <TouchableOpacity
                        onPress={handleCancelEditPrompt}
                        style={styles.promptActionButton}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Feather name="x" size={14} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={styles.promptTextWrapper}>
                        <TypingAnimation 
                          speed={20}
                          style={[styles.promptText, { color: theme.colors.textSecondary }]}
                        >
                          {`> ${meal.prompt}`}
                        </TypingAnimation>
                        <View style={styles.promptActions}>
                          {onToggleSavePrompt && (
                            <TouchableOpacity
                              style={styles.bookmarkButton}
                              onPress={() => onToggleSavePrompt(meal)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              {savedPromptLookup.has(meal.prompt.trim().toLowerCase()) ? (
                                <BookmarkCheck size={16} color="#10B981" strokeWidth={2.6} />
                              ) : (
                                <BookmarkPlus size={16} color={theme.colors.textSecondary} strokeWidth={2.6} />
                              )}
                            </TouchableOpacity>
                          )}
                          {onEditMealPrompt && (
                            <TouchableOpacity
                              style={styles.editIconButton}
                              onPress={() => handleStartEditPrompt(meal)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Feather name="edit-2" size={12} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      {isMealUpdating && editingMealId === meal.id && (
                        <Text style={[styles.updatingText, { color: theme.colors.textTertiary }]}>
                          updating…
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}
              
              {/* Food Items with animated spans */}
              {meal.foods.map((food, foodIndex) => {
                const baseDelay = 500 + (mealIndex * 1000) + (foodIndex * 300);
                const isFirstFood = foodIndex === 0;
        
        return (
          <TouchableOpacity 
                    key={food.id} 
                    style={styles.foodItem}
                    onPress={() => handleFoodPress(meal.id, food)}
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
                      style={{ color: '#10B981', fontSize: 12, flexShrink: 1 }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {`Calories: ${food.calories} | Protein: ${food.protein}g | Carbs: ${food.carbs}g | Fat: ${food.fat}g`}
                    </AnimatedSpan>
          </TouchableOpacity>
                );
              })}

              {/* Footer actions */}
              <View style={styles.mealFooter}>
                {meal.foods.length > 0 && (
                  <TypingAnimation
                    speed={30}
                    style={{ 
                      color: theme.colors.textSecondary, 
                      fontSize: 12 
                    }}
                  >
                    {`Success! Added ${meal.foods.length} food item${meal.foods.length > 1 ? 's' : ''}.`}
                  </TypingAnimation>
                )}
                {onDeleteMeal && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => onDeleteMeal(meal.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather name="trash-2" size={14} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
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
                {/*
                  Derive calories from macros so that when protein/carbs/fat
                  are edited, calories automatically reflect the new values.
                  1g protein = 4 kcal, 1g carbs = 4 kcal, 1g fat = 9 kcal.
                */}
                {(() => {
                  const p = Number(selectedFood.protein || 0);
                  const c = Number(selectedFood.carbs || 0);
                  const f = Number(selectedFood.fat || 0);
                  const derivedCalories = Math.max(0, Math.round(p * 4 + c * 4 + f * 9));
                  if (selectedFood.calories !== derivedCalories) {
                    // Keep local copy in sync so UI always shows the derived value
                    setSelectedFood({ ...selectedFood, calories: derivedCalories });
                  }
                  return null;
                })()}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                    {selectedFood.name}
                  </Text>
                  <TouchableOpacity
                    onPress={handleCloseModal}
                    style={styles.closeButton}
                  >
                    <Feather name="x" size={24} color="#10B981" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalNutrition}>
                  <Text style={[styles.nutritionLabel, { color: theme.colors.textSecondary }]}>
                    Edit nutrition for this food
                  </Text>
                  <View style={styles.nutritionGrid}>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        Calories
                      </Text>
                      <Text style={[styles.nutritionValue, { color: theme.colors.textPrimary }]}>
                        {selectedFood.calories}
                      </Text>
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        kcal
                      </Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        Protein
                      </Text>
                      <TextInput
                        style={[
                          styles.nutritionValueInput,
                          { color: theme.colors.textPrimary, borderColor: theme.colors.border },
                        ]}
                        keyboardType="numeric"
                        value={String(selectedFood.protein ?? '')}
                        onChangeText={(text) =>
                          setSelectedFood(prev =>
                            prev ? { ...prev, protein: Number(text) || 0 } : prev
                          )
                        }
                      />
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        g
                      </Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        Carbs
                      </Text>
                      <TextInput
                        style={[
                          styles.nutritionValueInput,
                          { color: theme.colors.textPrimary, borderColor: theme.colors.border },
                        ]}
                        keyboardType="numeric"
                        value={String(selectedFood.carbs ?? '')}
                        onChangeText={(text) =>
                          setSelectedFood(prev =>
                            prev ? { ...prev, carbs: Number(text) || 0 } : prev
                          )
                        }
                      />
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        g
                      </Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        Fat
                      </Text>
                      <TextInput
                        style={[
                          styles.nutritionValueInput,
                          { color: theme.colors.textPrimary, borderColor: theme.colors.border },
                        ]}
                        keyboardType="numeric"
                        value={String(selectedFood.fat ?? '')}
                        onChangeText={(text) =>
                          setSelectedFood(prev =>
                            prev ? { ...prev, fat: Number(text) || 0 } : prev
                          )
                        }
                      />
                      <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>
                        g
                      </Text>
                    </View>
                  </View>
                </View>

                {onUpdateFood && selectedMealId && (
                  <View
                    style={{
                      marginTop: Spacing.md,
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                      columnGap: 8,
                    }}
                  >
                    <TouchableOpacity
                      style={styles.modalButtonSecondary}
                      onPress={handleCloseModal}
                    >
                      <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalButtonPrimary}
                      onPress={() => {
                        if (selectedFood && onUpdateFood && selectedMealId) {
                          const p = Number(selectedFood.protein || 0);
                          const c = Number(selectedFood.carbs || 0);
                          const f = Number(selectedFood.fat || 0);
                          const derivedCalories = Math.max(0, Math.round(p * 4 + c * 4 + f * 9));
                          onUpdateFood(selectedMealId, {
                            ...selectedFood,
                            calories: derivedCalories,
                          });
                        }
                        handleCloseModal();
                      }}
                    >
                      <Text style={styles.modalButtonPrimaryText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  promptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  promptTextWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  promptText: {
    flex: 1,
    fontSize: 12,
  },
  promptActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
  },
  editIconButton: {
    padding: 4,
  },
  bookmarkButton: {
    padding: 4,
  },
  promptInput: {
    flex: 1,
    fontSize: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 36,
  },
  promptActionButton: {
    padding: 4,
    marginLeft: 6,
  },
  updatingText: {
    marginTop: 4,
    fontSize: 11,
    fontStyle: 'italic',
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
  mealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '94%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  nutritionItem: {
    alignItems: 'flex-start',
    marginVertical: Spacing.xs,
  },
  nutritionValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  nutritionValueInput: {
    minWidth: 60,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: Typography.fontSize.md,
    marginVertical: 4,
  },
  nutritionUnit: {
    fontSize: Typography.fontSize.xs,
  },
  modalButtonPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  modalButtonPrimaryText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
  },
  modalButtonSecondary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    backgroundColor: 'rgba(15, 23, 42, 0.02)',
  },
  modalButtonSecondaryText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.secondaryText,
  },
});

