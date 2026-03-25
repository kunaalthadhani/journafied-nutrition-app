import React, { useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, TextInput, Animated, Easing, ScrollView, TouchableWithoutFeedback, ActivityIndicator, Dimensions, PanResponder } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BookmarkPlus, BookmarkCheck } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { ParsedFood } from '../utils/foodNutrition';
import { useTheme } from '../constants/theme';
import { MealEntry } from '../services/dataStorage';
import { SavedPrompt } from '../services/dataStorage';

export interface Meal extends MealEntry { }

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

const PARSING_MESSAGES = [
  'Crunching the numbers on those calories...',
  'Doing some nutritional wizardry...',
  'Consulting the macro oracle...',
  'Deconstructing your deliciousness...',
  'Counting every last crumb...',
  'Summoning the calorie spirits...',
  'Running flavor diagnostics...',
  'Interrogating your ingredients...',
  'Calibrating the nutrition-o-meter...',
  'Teaching AI what you just ate...',
  'Reverse-engineering your plate...',
  'Weighing the vibes of your meal...',
  'Translating food into numbers...',
  'Performing snack analysis...',
  'Inspecting every morsel...',
];

const getParsingMessage = () => PARSING_MESSAGES[Math.floor(Math.random() * PARSING_MESSAGES.length)];

const LOADING_TITLES = [
  'Crunching the meal...',
  'Analyzing your plate...',
  'Decoding the flavors...',
  'Breaking it down...',
  'Reading the ingredients...',
  'Doing the math...',
];

const RotatingTitle: React.FC<{ style: any }> = ({ style }) => {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * LOADING_TITLES.length));
  React.useEffect(() => {
    const timer = setInterval(() => {
      setIdx(prev => (prev + 1) % LOADING_TITLES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);
  return <Text style={style} numberOfLines={2}>{LOADING_TITLES[idx]}</Text>;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Macro colors from design system
const MACRO_COLORS = { protein: '#3B82F6', carbs: '#F59E0B', fat: '#8B5CF6' };

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
  const [modalVisible, setModalVisible] = useState(false);

  // Slide-up animation
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const openFoodModal = () => {
    setModalVisible(true);
    slideAnim.setValue(SCREEN_HEIGHT);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 90,
      overshootClamping: true,
    }).start();
  };

  const closeFoodModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setSelectedFood(null);
      setBaseFood(null);
      setSelectedMealId(null);
    });
  };

  const foodPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) slideAnim.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          closeFoodModal();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  const savedPromptLookup = useMemo(() => {
    const map = new Map<string, string>();
    savedPrompts.forEach(prompt => {
      map.set(prompt.text.trim().toLowerCase(), prompt.id);
    });
    return map;
  }, [savedPrompts]);

  const handleFoodPress = (mealId: string, food: ParsedFood) => {
    setSelectedFood({ ...food });
    setBaseFood({ ...food });
    setSelectedMealId(mealId);
    openFoodModal();
  };

  const handleCloseModal = () => {
    closeFoodModal();
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

  // Macro bar percentages
  const macroTotal = selectedFood ? (selectedFood.protein || 0) * 4 + (selectedFood.carbs || 0) * 4 + (selectedFood.fat || 0) * 9 : 0;
  const proteinPct = macroTotal > 0 ? ((selectedFood?.protein || 0) * 4 / macroTotal) * 100 : 33;
  const carbsPct = macroTotal > 0 ? ((selectedFood?.carbs || 0) * 4 / macroTotal) * 100 : 34;
  const fatPct = macroTotal > 0 ? ((selectedFood?.fat || 0) * 9 / macroTotal) * 100 : 33;

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
                      {meal.isLoading ? (
                        <RotatingTitle style={[styles.promptText, { color: theme.colors.textSecondary, fontStyle: 'italic' }]} />
                      ) : (
                        <Text
                          style={[styles.promptText, { color: theme.colors.textPrimary, fontStyle: 'italic' }]}
                          numberOfLines={2}
                        >
                          {meal.summary || meal.prompt || "Food from image"}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.promptRow}>
                    {editingMealId === meal.id ? (
                      <View style={styles.editContainer}>
                        <TextInput
                          style={[styles.promptInput, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
                          value={editedPrompt}
                          onChangeText={setEditedPrompt}
                          autoFocus
                          onSubmitEditing={handleSavePrompt}
                          returnKeyType="done"
                        />
                        <TouchableOpacity onPress={handleSavePrompt} style={styles.iconButton}>
                          <Feather name="check" size={16} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleCancelEditPrompt} style={styles.iconButton}>
                          <Feather name="x" size={16} color={theme.colors.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.promptDisplay}>
                        <Text
                          style={[styles.promptText, { color: theme.colors.textPrimary, fontStyle: 'italic' }]}
                          numberOfLines={2}
                        >
                          {meal.isLoading ? '' : (meal.summary || meal.prompt)}
                        </Text>
                        {!meal.isLoading && (
                          <View style={styles.promptActions}>
                            {onToggleSavePrompt && (
                              <AnimatedBookmarkButton
                                isSaved={savedPromptLookup.has((meal.prompt || '').trim().toLowerCase())}
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
                        )}
                      </View>
                    )}
                  </View>
                )}
                {onDeleteMeal && !meal.isLoading && (
                  <TouchableOpacity
                    onPress={() => onDeleteMeal(meal.id)}
                    style={styles.deleteMealButton}
                  >
                    <Feather name="trash-2" size={14} color={theme.colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Foods */}
              {meal.isLoading ? (
                <View style={{ padding: 16, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: '60%', height: 12, borderRadius: 6, backgroundColor: theme.colors.border, opacity: 0.5 }} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                      {getParsingMessage()}
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
                        { borderBottomWidth: 1, borderBottomColor: theme.colors.lightBorder }
                      ]}
                      onPress={() => handleFoodPress(meal.id, food)}
                    >
                      <View style={styles.foodInfo}>
                        <Text style={[styles.foodName, { color: theme.colors.textPrimary }]}>
                          {food.name}
                          <Text style={[styles.foodWeight, { color: theme.colors.textSecondary }]}> · {food.weight_g}g</Text>
                        </Text>
                        <Text style={[styles.foodMacros, { color: theme.colors.textSecondary }]}>
                          {Math.round(food.calories)} kcal ·{' '}
                          <Text style={{ color: MACRO_COLORS.protein }}>P:{Math.round(food.protein)}</Text>{' '}
                          <Text style={{ color: MACRO_COLORS.carbs }}>C:{Math.round(food.carbs)}</Text>{' '}
                          <Text style={{ color: MACRO_COLORS.fat }}>F:{Math.round(food.fat)}</Text>
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={14} color={theme.colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                  {/* Meal totals */}
                  {meal.foods.length > 0 && (() => {
                    const totCal = Math.round(meal.foods.reduce((s, f) => s + (f.calories || 0), 0));
                    const totP = Math.round(meal.foods.reduce((s, f) => s + (f.protein || 0), 0));
                    const totC = Math.round(meal.foods.reduce((s, f) => s + (f.carbs || 0), 0));
                    const totF = Math.round(meal.foods.reduce((s, f) => s + (f.fat || 0), 0));
                    return (
                      <View style={[styles.mealTotalRow, { backgroundColor: theme.colors.secondaryBg }]}>
                        <Text style={[styles.mealTotalCal, { color: theme.colors.textPrimary }]}>{totCal} kcal</Text>
                        <Text style={[styles.mealTotalMacros, { color: theme.colors.textSecondary }]}>
                          <Text style={{ color: MACRO_COLORS.protein }}>P:{totP}</Text>{' '}
                          <Text style={{ color: MACRO_COLORS.carbs }}>C:{totC}</Text>{' '}
                          <Text style={{ color: MACRO_COLORS.fat }}>F:{totF}</Text>
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ── Food Detail Slide-Up Modal ── */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={handleCloseModal}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          {/* Tappable backdrop */}
          <TouchableOpacity style={{ height: SCREEN_HEIGHT * 0.05 }} activeOpacity={1} onPress={handleCloseModal} />

          <Animated.View
            style={{
              height: SCREEN_HEIGHT * 0.95,
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Drag handle */}
            <View
              style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}
              {...foodPanResponder.panHandlers}
            >
              <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: theme.colors.border }} />
            </View>

            {selectedFood && (
              <>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary }}>{selectedFood.name}</Text>
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 }}>{selectedFood.weight_g}g serving</Text>
                  </View>
                  <TouchableOpacity onPress={handleCloseModal} style={{ padding: 4 }}>
                    <Feather name="x" size={22} color={theme.colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Calorie hero */}
                  <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Text style={{ fontSize: 48, fontWeight: '800', color: theme.colors.textPrimary }}>{Math.round(selectedFood.calories)}</Text>
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: -2 }}>calories</Text>
                  </View>

                  {/* Macro bar */}
                  <View style={{ height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden', marginBottom: 16 }}>
                    <View style={{ width: `${proteinPct}%`, backgroundColor: MACRO_COLORS.protein }} />
                    <View style={{ width: `${carbsPct}%`, backgroundColor: MACRO_COLORS.carbs }} />
                    <View style={{ width: `${fatPct}%`, backgroundColor: MACRO_COLORS.fat }} />
                  </View>

                  {/* Macro pills */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
                    {[
                      { label: 'Protein', value: selectedFood.protein, color: MACRO_COLORS.protein },
                      { label: 'Carbs', value: selectedFood.carbs, color: MACRO_COLORS.carbs },
                      { label: 'Fat', value: selectedFood.fat, color: MACRO_COLORS.fat },
                    ].map((m) => (
                      <View key={m.label} style={{
                        flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
                        backgroundColor: m.color + '10',
                      }}>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: m.color }}>{Math.round(m.value)}g</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{m.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Edit Macros */}
                  <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 12 }}>Edit Macros</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                    {/* Calories */}
                    <View style={{ width: '47%' }}>
                      <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 4 }}>Calories</Text>
                      <TextInput
                        style={{
                          borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10,
                          paddingVertical: 10, paddingHorizontal: 12, fontSize: 16,
                          color: theme.colors.textPrimary, backgroundColor: theme.colors.card,
                        }}
                        keyboardType="numeric"
                        value={String(Math.round(selectedFood.calories))}
                        onChangeText={(text) => {
                          const newCalories = Number(text) || 0;
                          const oldCalories = baseFood?.calories || 1;
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
                    {/* Protein, Carbs, Fat */}
                    {[
                      { label: 'Protein', key: 'protein' as keyof ParsedFood, color: MACRO_COLORS.protein },
                      { label: 'Carbs', key: 'carbs' as keyof ParsedFood, color: MACRO_COLORS.carbs },
                      { label: 'Fat', key: 'fat' as keyof ParsedFood, color: MACRO_COLORS.fat },
                    ].map((item) => (
                      <View key={item.label} style={{ width: '47%' }}>
                        <Text style={{ fontSize: 12, color: item.color, marginBottom: 4 }}>{item.label} (g)</Text>
                        <TextInput
                          style={{
                            borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10,
                            paddingVertical: 10, paddingHorizontal: 12, fontSize: 16,
                            color: theme.colors.textPrimary, backgroundColor: theme.colors.card,
                          }}
                          keyboardType="numeric"
                          value={String(selectedFood[item.key] ?? '')}
                          onChangeText={(text) => {
                            const newVal = Number(text) || 0;
                            const updatedFood = { ...selectedFood, [item.key]: newVal };
                            const p = Number(item.key === 'protein' ? newVal : updatedFood.protein || 0);
                            const c = Number(item.key === 'carbs' ? newVal : updatedFood.carbs || 0);
                            const f = Number(item.key === 'fat' ? newVal : updatedFood.fat || 0);
                            updatedFood.calories = Math.round(p * 4 + c * 4 + f * 9);
                            setSelectedFood(updatedFood);
                          }}
                        />
                      </View>
                    ))}
                  </View>

                  {/* Nutrition Facts */}
                  <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 12 }}>Nutrition Facts</Text>

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
                    ].map((item) => (
                      <View key={item.key} style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        paddingVertical: 8, paddingLeft: (item.indent || 0) * 16,
                        borderBottomWidth: item.indent ? 0 : StyleSheet.hairlineWidth,
                        borderBottomColor: theme.colors.border,
                      }}>
                        <Text style={{
                          fontSize: 13, flex: 1,
                          color: theme.colors.textSecondary,
                          fontWeight: item.isHeader ? '600' : '400',
                        }}>
                          {item.indent ? `${item.label}` : item.label}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', width: 100, justifyContent: 'flex-end' }}>
                          <TextInput
                            style={{ fontSize: 13, textAlign: 'right', padding: 0, minWidth: 40, marginRight: 4, color: theme.colors.textPrimary }}
                            keyboardType="numeric"
                            placeholder="-"
                            placeholderTextColor={theme.colors.textTertiary}
                            value={selectedFood[item.key as keyof ParsedFood] !== undefined ? String(selectedFood[item.key as keyof ParsedFood]) : ''}
                            onChangeText={(text) => {
                              const val = text === '' ? undefined : Number(text);
                              const updated = { ...selectedFood, [item.key]: val };
                              if (['protein', 'carbs', 'fat'].includes(item.key)) {
                                const p = Number(updated.protein || 0);
                                const c = Number(updated.carbs || 0);
                                const f = Number(updated.fat || 0);
                                updated.calories = Math.round(p * 4 + c * 4 + f * 9);
                              }
                              setSelectedFood(updated);
                            }}
                          />
                          <Text style={{ fontSize: 11, color: theme.colors.textTertiary, width: 28, textAlign: 'right' }}>{item.unit}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {/* Save / Cancel */}
                {onUpdateFood && selectedMealId && (
                  <View style={{
                    flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16,
                    borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background,
                  }}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}
                      onPress={handleCloseModal}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center' }}
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
                      <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.primaryForeground }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </Animated.View>
        </View>
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
    backgroundColor: 'rgba(0,0,0,0.02)',
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
  mealTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  mealTotalCal: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700' as const,
  },
  mealTotalMacros: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600' as const,
  },
});
