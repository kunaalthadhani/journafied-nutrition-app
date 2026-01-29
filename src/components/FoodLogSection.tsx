import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, TextInput, Animated, Easing, ScrollView, TouchableWithoutFeedback, InteractionManager, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BookmarkPlus, BookmarkCheck } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { ParsedFood } from '../utils/foodNutrition';
import { useTheme } from '../constants/theme';
import { MealEntry } from '../services/dataStorage';
import { SavedPrompt } from '../services/dataStorage';

export interface Meal extends MealEntry { } // Backwards compatibility if needed, or replace usages.

// Actually, let's just use MealEntry to be clean, merging with local interface if it had extra props?
// Local Meal has: id, prompt, foods, timestamp, imageUri?, updatedAt?
// dataStorage MealEntry has: id, prompt, foods, timestamp, imageUri?, updatedAt?, userId?, date?
// They are compatible. Let's alias it for now to avoid refactoring entire file.

interface FoodLogSectionProps {
  meals: Meal[];
  onRemoveFood: (foodId: string) => void;
  onEditMealPrompt?: (mealId: string, newPrompt: string) => Promise<void> | void;
  savedPrompts?: SavedPrompt[];
  onToggleSavePrompt?: (meal: Meal) => void;
  onDeleteMeal?: (mealId: string) => void;
  onUpdateFood?: (mealId: string, updatedFood: ParsedFood) => void;
}

const AnimatedBookmarkButton = ({ isSaved, onPress, theme }: { isSaved: boolean, onPress: () => void, theme: any }) => {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 150, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true, easing: Easing.in(Easing.ease) })
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.iconButton}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {isSaved ? (
          <BookmarkCheck size={14} color={theme.colors.textPrimary} />
        ) : (
          <BookmarkPlus size={14} color={theme.colors.textSecondary} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

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
  const [selectedFood, setSelectedFood] = useState<ParsedFood | null>(null);
  const [baseFood, setBaseFood] = useState<ParsedFood | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [isMealUpdating, setIsMealUpdating] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);

  const savedPromptLookup = useMemo(() => {
    const map = new Map<string, string>();
    savedPrompts.forEach(prompt => {
      map.set(prompt.text.trim().toLowerCase(), prompt.id);
    });
    return map;
  }, [savedPrompts]);

  const handleFoodPress = (mealId: string, food: ParsedFood) => {
    setSelectedFood({ ...food });
    setBaseFood({ ...food }); // Snapshot for scaling
    setSelectedMealId(mealId);
    setShowDetailedStats(false);

    // Delay rendering detailed stats until after modal animation/interaction
    InteractionManager.runAfterInteractions(() => {
      setShowDetailedStats(true);
    });
  };

  const handleCloseModal = () => {
    setSelectedFood(null);
    setBaseFood(null);
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

  if (meals.length === 0) {
    return null;
  }

  return (
    <>
      <View style={styles.container}>
        {meals.map((meal) => {
          return (
            <View key={meal.id} style={[styles.mealCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              {/* Header with Prompt / Image */}
              <View style={[styles.cardHeader, { borderBottomColor: theme.colors.border }]}>
                {meal.imageUri ? (
                  <View style={styles.imageHeader}>
                    <Image
                      source={{ uri: meal.imageUri }}
                      style={[styles.thumbnail, { borderColor: theme.colors.border }]}
                      resizeMode="cover"
                    />
                    <View style={styles.imageHeaderText}>
                      <Text
                        style={[styles.promptText, { color: theme.colors.textPrimary, fontStyle: 'italic' }]}
                        numberOfLines={2}
                      >
                        {meal.summary || meal.prompt || "Food from image"}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.promptRow}>
                    {editingMealId === meal.id ? (
                      <View style={styles.editContainer}>
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
                          onSubmitEditing={handleSavePrompt}
                        />
                        <TouchableOpacity onPress={handleCancelEditPrompt} style={styles.iconButton}>
                          <Feather name="x" size={14} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.promptDisplay}>
                        <Text style={[styles.promptText, { color: theme.colors.textPrimary }]}>
                          {meal.summary || meal.prompt}
                        </Text>
                        <View style={styles.promptActions}>
                          {onToggleSavePrompt && (
                            <AnimatedBookmarkButton
                              isSaved={savedPromptLookup.has(meal.prompt.trim().toLowerCase())}
                              onPress={() => onToggleSavePrompt(meal)}
                              theme={theme}
                            />
                          )}
                          {onEditMealPrompt && (
                            <TouchableOpacity onPress={() => handleStartEditPrompt(meal)} style={styles.iconButton}>
                              <Feather name="edit-2" size={12} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                )}
                {onDeleteMeal && (
                  <TouchableOpacity
                    style={styles.deleteMealButton}
                    onPress={() => onDeleteMeal(meal.id)}
                  >
                    <Feather name="trash-2" size={14} color={theme.colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Food List or Loading State */}
              {meal.isLoading ? (
                <View style={{ padding: 16, gap: 12 }}>
                  {/* Skeleton Item 1 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.6 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: theme.colors.border }} />
                    <View style={{ gap: 6, flex: 1 }}>
                      <View style={{ width: '60%', height: 12, borderRadius: 6, backgroundColor: theme.colors.border }} />
                      <View style={{ width: '40%', height: 10, borderRadius: 5, backgroundColor: theme.colors.border }} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                      AI is parsing your meal...
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.foodList}>
                  {meal.foods.map((food, idx) => (
                    <TouchableOpacity
                      key={`${food.id}-${idx}`}
                      style={[
                        styles.foodItem,
                        idx < meal.foods.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.lightBorder }
                      ]}
                      onPress={() => handleFoodPress(meal.id, food)}
                    >
                      <View style={styles.foodInfo}>
                        <Text style={[styles.foodName, { color: theme.colors.textPrimary }]}>
                          {food.name}
                          <Text style={[styles.foodWeight, { color: theme.colors.textSecondary }]}> · {food.weight_g}g</Text>
                        </Text>
                        <Text style={[styles.foodMacros, { color: theme.colors.textSecondary }]}>
                          {food.calories} kcal · P:{food.protein} C:{food.carbs} F:{food.fat}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={14} color={theme.colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
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
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, maxHeight: '85%' }]}>
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
                      <Feather name="x" size={20} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.modalNutrition}>
                      <Text style={[styles.nutritionLabel, { color: theme.colors.textSecondary }]}>
                        Edit nutrition
                      </Text>
                      <View style={styles.nutritionGrid}>
                        <View style={styles.nutritionItem}>
                          <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>Calories</Text>
                          <TextInput
                            style={[styles.nutritionValueInput, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                            keyboardType="numeric"
                            value={String(selectedFood.calories)}
                            onChangeText={(text) => {
                              const newCalories = Number(text) || 0;
                              const oldCalories = baseFood?.calories || 1; // avoid div by 0
                              const ratio = newCalories / oldCalories;

                              setSelectedFood({
                                ...selectedFood,
                                calories: newCalories,
                                protein: parseFloat(((baseFood?.protein || 0) * ratio).toFixed(1)),
                                carbs: parseFloat(((baseFood?.carbs || 0) * ratio).toFixed(1)),
                                fat: parseFloat(((baseFood?.fat || 0) * ratio).toFixed(1)),
                                dietary_fiber: baseFood?.dietary_fiber ? parseFloat((baseFood.dietary_fiber * ratio).toFixed(1)) : undefined,
                                sugar: baseFood?.sugar ? parseFloat((baseFood.sugar * ratio).toFixed(1)) : undefined,
                                saturated_fat: baseFood?.saturated_fat ? parseFloat((baseFood.saturated_fat * ratio).toFixed(1)) : undefined,
                                sodium_mg: baseFood?.sodium_mg ? Math.round(baseFood.sodium_mg * ratio) : undefined,
                                potassium_mg: baseFood?.potassium_mg ? Math.round(baseFood.potassium_mg * ratio) : undefined,
                                cholesterol_mg: baseFood?.cholesterol_mg ? Math.round(baseFood.cholesterol_mg * ratio) : undefined,
                              });
                            }}
                          />
                        </View>
                        {['Protein', 'Carbs', 'Fat'].map((label) => {
                          const key = label.toLowerCase() as keyof ParsedFood;
                          return (
                            <View key={label} style={styles.nutritionItem}>
                              <Text style={[styles.nutritionUnit, { color: theme.colors.textTertiary }]}>{label}</Text>
                              <TextInput
                                style={[styles.nutritionValueInput, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                                keyboardType="numeric"
                                value={String(selectedFood[key] ?? '')}
                                onChangeText={(text) => {
                                  const newVal = Number(text) || 0;
                                  const updatedFood = { ...selectedFood, [key]: newVal };
                                  // Auto-update calories if macro changes (Bidirectional convenience)
                                  const p = Number(key === 'protein' ? newVal : updatedFood.protein || 0);
                                  const c = Number(key === 'carbs' ? newVal : updatedFood.carbs || 0);
                                  const f = Number(key === 'fat' ? newVal : updatedFood.fat || 0);
                                  updatedFood.calories = Math.round(p * 4 + c * 4 + f * 9);
                                  setSelectedFood(updatedFood);
                                }}
                              />
                            </View>
                          );
                        })}
                      </View>


                      {/* Detailed Nutrition Facts Label - Render only after interaction */}
                      {showDetailedStats ? (
                        <View style={[styles.nutritionFactsContainer, { borderColor: theme.colors.border }]}>
                          <Text style={[styles.nutritionFactsTitle, { color: theme.colors.textPrimary }]}>Nutrition Facts</Text>
                          <View style={styles.divider} />

                          {[
                            { label: 'Total Carbohydrates', key: 'carbs', unit: 'g', isHeader: true },
                            { label: 'Dietary Fibre', key: 'dietary_fiber', unit: 'g', indent: 1 },
                            { label: 'Sugar', key: 'sugar', unit: 'g', indent: 1 },
                            { label: 'Added Sugars', key: 'added_sugars', unit: 'g', indent: 2 },
                            { label: 'Sugar Alcohols', key: 'sugar_alcohols', unit: 'g', indent: 2 },
                            { label: 'Net Carbs', key: 'net_carbs', unit: 'g', indent: 1 },

                            { label: 'Protein', key: 'protein', unit: 'g', isHeader: true },

                            { label: 'Total Fat', key: 'fat', unit: 'g', isHeader: true },
                            { label: 'Saturated Fat', key: 'saturated_fat', unit: 'g', indent: 1 },
                            { label: 'Trans Fat', key: 'trans_fat', unit: 'g', indent: 1 },
                            { label: 'Polyunsaturated Fat', key: 'polyunsaturated_fat', unit: 'g', indent: 1 },
                            { label: 'Monounsaturated Fat', key: 'monounsaturated_fat', unit: 'g', indent: 1 },

                            { label: 'Cholesterol', key: 'cholesterol_mg', unit: 'mg' },
                            { label: 'Sodium', key: 'sodium_mg', unit: 'mg' },

                            { label: 'Calcium', key: 'calcium_mg', unit: 'mg' },
                            { label: 'Iron', key: 'iron_mg', unit: 'mg' },
                            { label: 'Potassium', key: 'potassium_mg', unit: 'mg' },

                            { label: 'Vitamin A', key: 'vitamin_a_mcg', unit: 'mcg' },
                            { label: 'Vitamin C', key: 'vitamin_c_mg', unit: 'mg' },
                            { label: 'Vitamin D', key: 'vitamin_d_mcg', unit: 'mcg' },
                            { label: 'Vitamin E', key: 'vitamin_e_mg', unit: 'mg' },
                            { label: 'Vitamin K', key: 'vitamin_k_mcg', unit: 'mcg' },
                            { label: 'Vitamin B12', key: 'vitamin_b12_mcg', unit: 'mcg' },
                          ].map((item) => {
                            // We show headers too if they aren't the main 3 managed above (though carbs/fat/protein are above).
                            // User requested specific structure. The structure implies listing them. 
                            // If key is present in main editor, editing here should update main editor too.
                            // Since 'carbs', 'protein', 'fat' are `isHeader`, we can show them as read-only or editable?
                            // User said "Nutrition Facts ... -Total Carbohydrates ...". It's standard to list them.

                            return (
                              <View key={item.key} style={[
                                styles.factRow,
                                {
                                  paddingLeft: (item.indent || 0) * 16,
                                  borderBottomWidth: item.indent ? 0 : StyleSheet.hairlineWidth // Only lines for top level? Or all? Standard is all usually.
                                  // Let's keep all lines for clarity or mimic label.
                                }
                              ]}>
                                <Text style={[
                                  styles.factLabel,
                                  {
                                    color: theme.colors.textSecondary,
                                    fontWeight: item.isHeader ? 'bold' : 'normal'
                                  }
                                ]}>
                                  {item.indent ? `- ${item.label}` : item.label}
                                </Text>
                                <View style={styles.factInputContainer}>
                                  <TextInput
                                    style={[styles.factInput, { color: theme.colors.textPrimary }]}
                                    keyboardType="numeric"
                                    placeholder="-"
                                    placeholderTextColor={theme.colors.textTertiary}
                                    value={selectedFood[item.key as keyof ParsedFood] !== undefined ? String(selectedFood[item.key as keyof ParsedFood]) : ''}
                                    onChangeText={(text) => {
                                      const val = text === '' ? undefined : Number(text);
                                      const updated = { ...selectedFood, [item.key]: val };

                                      // Recalculate calories if main macros change here
                                      if (['protein', 'carbs', 'fat'].includes(item.key)) {
                                        const p = Number(updated.protein || 0);
                                        const c = Number(updated.carbs || 0);
                                        const f = Number(updated.fat || 0);
                                        updated.calories = Math.round(p * 4 + c * 4 + f * 9);
                                      }

                                      setSelectedFood(updated);
                                    }}
                                  />
                                  <Text style={[styles.factUnit, { color: theme.colors.textTertiary }]}>{item.unit}</Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={{ height: 100, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: theme.colors.textTertiary }}>Loading details...</Text>
                        </View>
                      )}
                    </View>
                  </ScrollView>

                  {
                    onUpdateFood && selectedMealId && (
                      <View style={[styles.modalActions, { marginTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 16 }]}>
                        <TouchableOpacity
                          style={[styles.modalButtonSecondary, { borderColor: theme.colors.border }]}
                          onPress={handleCloseModal}
                        >
                          <Text style={[styles.modalButtonSecondaryText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modalButtonPrimary, { backgroundColor: theme.colors.primary }]}
                          onPress={() => {
                            if (selectedFood && onUpdateFood && selectedMealId) {
                              const p = Number(selectedFood.protein || 0);
                              const c = Number(selectedFood.carbs || 0);
                              const f = Number(selectedFood.fat || 0);
                              onUpdateFood(selectedMealId, {
                                ...selectedFood,
                                calories: Math.max(0, Math.round(p * 4 + c * 4 + f * 9)),
                              });
                            }
                            handleCloseModal();
                          }}
                        >
                          <Text style={[styles.modalButtonPrimaryText, { color: theme.colors.primaryForeground }]}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  }
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
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
  mealCard: {
    marginBottom: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.02)', // slight tint for header
    borderBottomWidth: 1,
  },
  imageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  imageHeaderText: {
    marginLeft: 10,
    flex: 1,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
  },
  promptRow: {
    flex: 1,
    marginRight: 8,
  },
  promptDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  promptText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: 20,
  },
  promptActions: {
    flexDirection: 'row',
    marginLeft: 6,
    gap: 6,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  promptInput: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
  },
  iconButton: {
    padding: 2,
  },
  deleteMealButton: {
    padding: 4,
    opacity: 0.7,
  },
  foodList: {
    paddingVertical: 4,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 2,
  },
  foodWeight: {
    fontWeight: Typography.fontWeight.normal,
  },
  foodMacros: {
    fontSize: Typography.fontSize.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalNutrition: {
    marginBottom: 24,
  },
  nutritionLabel: {
    fontSize: Typography.fontSize.sm,
    marginBottom: 12,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  nutritionItem: {
    flex: 1,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginTop: 4,
  },
  nutritionValueInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: Typography.fontSize.md,
    marginTop: 4,
  },
  nutritionUnit: {
    fontSize: Typography.fontSize.xs,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButtonSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  modalButtonSecondaryText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  modalButtonPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalButtonPrimaryText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  nutritionFactsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  nutritionFactsTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0', // Light gray divider, usually handled by border color in view but distinct here
    marginVertical: 4,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  factLabel: {
    fontSize: Typography.fontSize.sm,
    flex: 1,
  },
  factInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    justifyContent: 'flex-end',
  },
  factInput: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'right',
    padding: 0,
    minWidth: 40,
    marginRight: 4,
  },
  factUnit: {
    fontSize: Typography.fontSize.xs,
    width: 30,
    textAlign: 'right',
  },
});

