import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { CalorieCalculatorScreen, CalorieCalculationResult } from '../components/CalorieCalculatorModal';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

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
  protein: '#3B82F6',
  carbs: '#F59E0B',
  fat: '#8B5CF6',
};

const macroGrams = (cal: number, pct: number, perGram: number) => Math.round((cal * pct / 100) / perGram);

export const SetGoalsScreen: React.FC<SetGoalsScreenProps> = ({
  onBack,
  onSave,
  initialGoals,
}) => {
  const theme = useTheme();
  const isFirstTime = !initialGoals?.goal;

  const [calories, setCalories] = useState(initialGoals?.calories || 1500);
  const [proteinPercentage, setProteinPercentage] = useState(initialGoals?.proteinPercentage || 30);
  const [carbsPercentage, setCarbsPercentage] = useState(initialGoals?.carbsPercentage || 45);
  const [fatPercentage, setFatPercentage] = useState(initialGoals?.fatPercentage || 25);
  const [showCalculator, setShowCalculator] = useState(isFirstTime);
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

  const [isEditingMacros, setIsEditingMacros] = useState(false);

  const proteinGrams = macroGrams(calories, proteinPercentage, 4);
  const carbsGrams = macroGrams(calories, carbsPercentage, 4);
  const fatGrams = macroGrams(calories, fatPercentage, 9);
  const totalPercentage = proteinPercentage + carbsPercentage + fatPercentage;

  const goalLabel = goal === 'lose' ? 'Lose weight' : goal === 'gain' ? 'Gain weight' : 'Maintain weight';
  const activityLabel = activityLevel === 'sedentary' ? 'Sedentary'
    : activityLevel === 'light' ? 'Lightly active'
    : activityLevel === 'moderate' ? 'Moderately active'
    : activityLevel === 'very' ? 'Very active' : '';

  const handleCalculatedCalories = (result: CalorieCalculationResult) => {
    // Update all state from result
    setCalories(result.calories);
    if (typeof result.currentWeightKg === 'number' && !isNaN(result.currentWeightKg)) setCurrentWeightKg(result.currentWeightKg);
    if (typeof result.targetWeightKg === 'number' && !isNaN(result.targetWeightKg)) setTargetWeightKg(result.targetWeightKg);
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

    // First-time flow: calculator includes macros → auto-save and close
    if (isFirstTime && result.proteinPercentage !== undefined) {
      const pPct = result.proteinPercentage;
      const cPct = result.carbsPercentage ?? 45;
      const fPct = result.fatPercentage ?? 25;
      const goalData: GoalData = {
        calories: result.calories,
        proteinPercentage: pPct,
        carbsPercentage: cPct,
        fatPercentage: fPct,
        proteinGrams: macroGrams(result.calories, pPct, 4),
        carbsGrams: macroGrams(result.calories, cPct, 4),
        fatGrams: macroGrams(result.calories, fPct, 9),
        currentWeightKg: result.currentWeightKg || null,
        targetWeightKg: result.targetWeightKg || null,
        age: result.age, gender: result.gender,
        heightCm: result.heightCm, heightFeet: result.heightFeet, heightInches: result.heightInches,
        goal: result.goal, activityRate: result.activityRate,
        activityLevel: result.activityLevel,
      };
      onSave(goalData);
      onBack();
      return;
    }

    // Returning user: just update calories, keep existing macros
    setShowCalculator(false);
  };

  const handleCalculatorBack = () => {
    if (isFirstTime) { onBack(); return; } // first-time user closes calculator = cancel
    setShowCalculator(false);
  };

  const handleMacroChange = (which: 'p' | 'c' | 'f', delta: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (which === 'p') setProteinPercentage(v => Math.max(5, Math.min(80, Math.round(v + delta))));
    else if (which === 'c') setCarbsPercentage(v => Math.max(5, Math.min(80, Math.round(v + delta))));
    else setFatPercentage(v => Math.max(5, Math.min(80, Math.round(v + delta))));
  };

  const handleSave = () => {
    if (totalPercentage < 99 || totalPercentage > 101) {
      Alert.alert("Invalid Percentages", `Total is ${totalPercentage}%. Adjust macros to be within 99-101%.`, [{ text: "OK" }]);
      return;
    }
    let normP = proteinPercentage, normC = carbsPercentage, normF = fatPercentage;
    const diff = totalPercentage - 100;
    if (diff !== 0) {
      if (normP >= normC && normP >= normF) normP -= diff;
      else if (normC >= normF) normC -= diff;
      else normF -= diff;
    }
    onSave({
      calories, proteinPercentage: normP, carbsPercentage: normC, fatPercentage: normF,
      proteinGrams, carbsGrams, fatGrams,
      currentWeightKg, targetWeightKg, age, gender, heightCm, heightFeet, heightInches,
      goal, activityRate, name, trackingGoal, activityLevel,
    });
    onBack();
  };

  if (showCalculator) {
    return (
      <CalorieCalculatorScreen
        onBack={handleCalculatorBack}
        onCalculated={handleCalculatedCalories}
        initialData={{
          currentWeightKg, targetWeightKg, age, gender,
          heightCm, heightFeet, heightInches,
          goal, activityRate, activityLevel,
          proteinPercentage, carbsPercentage, fatPercentage,
        }}
      />
    );
  }

  const macros = [
    { key: 'p' as const, label: 'Protein', color: MACRO_COLORS.protein, pct: proteinPercentage, g: proteinGrams },
    { key: 'c' as const, label: 'Carbs', color: MACRO_COLORS.carbs, pct: carbsPercentage, g: carbsGrams },
    { key: 'f' as const, label: 'Fat', color: MACRO_COLORS.fat, pct: fatPercentage, g: fatGrams },
  ];

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[st.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: theme.colors.textPrimary }]}>Nutrition Goals</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={st.content} contentContainerStyle={st.contentInner} showsVerticalScrollIndicator={false}>

        {/* Goal headline */}
        <Text style={[st.goalTitle, { color: theme.colors.textPrimary }]}>{goalLabel}</Text>
        <Text style={[st.goalSub, { color: theme.colors.textSecondary }]}>
          {activityLabel}{activityRate ? ` · ${activityRate} kg/week` : ''}
        </Text>

        {/* Calorie card */}
        <View style={[st.calCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={st.calRow}>
            <Text style={[st.calNum, { color: theme.colors.textPrimary }]}>{calories}</Text>
            <Text style={[st.calUnit, { color: theme.colors.textSecondary }]}>kcal/day</Text>
          </View>
          <TouchableOpacity style={[st.recalcBtn, { backgroundColor: theme.colors.secondaryBg }]} onPress={() => setShowCalculator(true)}>
            <Feather name="refresh-cw" size={14} color={theme.colors.textSecondary} />
            <Text style={[st.recalcTxt, { color: theme.colors.textSecondary }]}>Recalculate</Text>
          </TouchableOpacity>
        </View>

        {/* Macro section */}
        <Text style={[st.sectionLabel, { color: theme.colors.textSecondary }]}>MACRO SPLIT</Text>

        {/* Stacked bar */}
        <View style={[st.macroBar, { backgroundColor: theme.colors.border }]}>
          <View style={[st.macroSeg, { flex: proteinPercentage, backgroundColor: MACRO_COLORS.protein, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
          <View style={[st.macroSeg, { flex: carbsPercentage, backgroundColor: MACRO_COLORS.carbs }]} />
          <View style={[st.macroSeg, { flex: fatPercentage, backgroundColor: MACRO_COLORS.fat, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
        </View>

        {/* Macro rows */}
        <View style={st.macroRows}>
          {macros.map(m => (
            <View key={m.key} style={st.macroRow}>
              <View style={st.macroLblRow}>
                <View style={[st.macroDot, { backgroundColor: m.color }]} />
                <Text style={[st.macroName, { color: theme.colors.textPrimary }]}>{m.label}</Text>
              </View>
              <Text style={[st.macroVal, { color: theme.colors.textSecondary }]}>{m.pct}% · {m.g}g</Text>
            </View>
          ))}
        </View>

        {/* Customize toggle */}
        <TouchableOpacity style={st.customizeBtn} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsEditingMacros(v => !v); }}>
          <Text style={[st.customizeTxt, { color: theme.colors.textSecondary }]}>{isEditingMacros ? 'Done' : 'Customize macros'}</Text>
          <Feather name={isEditingMacros ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {/* Editing controls */}
        {isEditingMacros && (
          <View style={st.editSection}>
            {totalPercentage !== 100 && (
              <View style={[st.totalBadge, { backgroundColor: (totalPercentage >= 99 && totalPercentage <= 101) ? theme.colors.successBg : theme.colors.error + '15' }]}>
                <Text style={[st.totalTxt, { color: (totalPercentage >= 99 && totalPercentage <= 101) ? theme.colors.success : theme.colors.error }]}>{totalPercentage}% Total</Text>
              </View>
            )}
            {macros.map(m => (
              <View key={m.key} style={[st.editRow, { borderColor: theme.colors.border }]}>
                <View style={st.macroLblRow}>
                  <View style={[st.macroDot, { backgroundColor: m.color }]} />
                  <Text style={[st.macroName, { color: theme.colors.textPrimary }]}>{m.label}</Text>
                </View>
                <View style={st.editControls}>
                  <TouchableOpacity style={[st.adjBtn, { borderColor: theme.colors.border }]} onPress={() => handleMacroChange(m.key, -5)}>
                    <Feather name="minus" size={14} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[st.editPct, { color: theme.colors.textPrimary }]}>{m.pct}%</Text>
                  <TouchableOpacity style={[st.adjBtn, { borderColor: theme.colors.border }]} onPress={() => handleMacroChange(m.key, 5)}>
                    <Feather name="plus" size={14} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {!isEditingMacros && (
          <Text style={[st.helperTxt, { color: theme.colors.textSecondary }]}>You can adjust this anytime</Text>
        )}
      </ScrollView>

      {/* Save button */}
      <View style={[st.footer, { backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)' }]}>
        <TouchableOpacity style={[st.saveBtn, { backgroundColor: theme.colors.primary }]} onPress={handleSave} activeOpacity={0.8}>
          <Text style={[st.saveTxt, { color: theme.colors.primaryForeground }]}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semiBold },
  backBtn: { padding: 4 },
  content: { flex: 1 },
  contentInner: { padding: 20, paddingBottom: 100 },

  // Goal headline
  goalTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  goalSub: { fontSize: Typography.fontSize.md, marginBottom: 24 },

  // Calorie card
  calCard: { borderRadius: 16, padding: 20, borderWidth: 1, alignItems: 'center', marginBottom: 28 },
  calRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  calNum: { fontSize: 44, fontWeight: '800', letterSpacing: -1 },
  calUnit: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.medium, marginLeft: 6 },
  recalcBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  recalcTxt: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },

  // Macros
  sectionLabel: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  macroBar: { width: '100%', height: 14, borderRadius: 7, flexDirection: 'row', overflow: 'hidden', marginBottom: 16 },
  macroSeg: { height: '100%' },
  macroRows: { gap: 12, marginBottom: 8 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  macroLblRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroDot: { width: 10, height: 10, borderRadius: 5 },
  macroName: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium },
  macroVal: { fontSize: Typography.fontSize.sm, fontWeight: '500' },

  customizeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, width: '100%' },
  customizeTxt: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },

  editSection: { gap: 12, marginBottom: 8 },
  totalBadge: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  totalTxt: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },
  editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  editControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  adjBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editPct: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold, width: 40, textAlign: 'center' },

  helperTxt: { fontSize: Typography.fontSize.xs, textAlign: 'center', marginTop: -4 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: 'transparent' },
  saveBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  saveTxt: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold },
});
