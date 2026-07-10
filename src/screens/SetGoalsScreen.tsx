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
import { Typography } from '../constants/typography';
import { Acid } from '../constants/acid';
import { CalorieCalculatorScreen, CalorieCalculationResult } from '../components/CalorieCalculatorModal';
import { QuickSignupScreen } from './QuickSignupScreen';
import { usePreferences } from '../contexts/PreferencesContext';

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
  dob?: string;
  trackingGoal?: string;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'very';
}

const MACRO_COLORS = {
  protein: Acid.protein,
  carbs: Acid.carbs,
  fat: Acid.fat,
};

const macroGrams = (cal: number, pct: number, perGram: number) => Math.round((cal * pct / 100) / perGram);

// The macro editor allows 99-101%. Never persist that: snap to exactly 100 by
// adjusting the largest macro, the same rule handleSave has always used.
const normalizeMacros = (p: number, c: number, f: number) => {
  const diff = p + c + f - 100;
  if (diff !== 0) {
    if (p >= c && p >= f) p -= diff;
    else if (c >= f) c -= diff;
    else f -= diff;
  }
  return { p, c, f };
};

const fmtPace = (kgPerWeek: number, unit: string): string => unit === 'lbs'
  ? `${Math.round(kgPerWeek * 2.20462 * 10) / 10} lbs`
  : `${kgPerWeek} kg`;

export const SetGoalsScreen: React.FC<SetGoalsScreenProps> = ({
  onBack,
  onSave,
  initialGoals,
}) => {
  const { weightUnit } = usePreferences();
  // Frozen at mount. A background auth event can call setSavedGoals on Home and
  // give initialGoals a goal field mid-flow; deriving this inline would then
  // reroute a first-time user into the returning-user branch and drop the new
  // plan they just entered.
  const [isFirstTime] = useState(() => !initialGoals?.goal);

  const [calories, setCalories] = useState(initialGoals?.calories || 1500);
  const [proteinPercentage, setProteinPercentage] = useState(initialGoals?.proteinPercentage || 30);
  const [carbsPercentage, setCarbsPercentage] = useState(initialGoals?.carbsPercentage || 45);
  const [fatPercentage, setFatPercentage] = useState(initialGoals?.fatPercentage || 25);
  const [showCalculator, setShowCalculator] = useState(isFirstTime);
  // After the first-time calculator finishes, gate the home screen behind a
  // single-tap signup so the user's plan persists across devices. They can
  // skip — local-only mode still works.
  const [showSignup, setShowSignup] = useState(false);
  const pendingGoalDataRef = React.useRef<GoalData | null>(null);
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
  const [dob, setDob] = useState<string | undefined>(initialGoals?.dob);
  const [trackingGoal, setTrackingGoal] = useState<string | undefined>(initialGoals?.trackingGoal);
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'very' | undefined>(initialGoals?.activityLevel);

  const [isEditingMacros, setIsEditingMacros] = useState(false);

  // What was last persisted. Used to catch unsaved macro tweaks on exit.
  const lastSavedRef = React.useRef<string | null>(
    initialGoals ? JSON.stringify([initialGoals.calories, initialGoals.proteinPercentage, initialGoals.carbsPercentage, initialGoals.fatPercentage]) : null
  );

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
    if (result.dob !== undefined) setDob(result.dob);
    if (result.trackingGoal !== undefined) setTrackingGoal(result.trackingGoal);
    if (result.activityLevel !== undefined) setActivityLevel(result.activityLevel);
    // Apply the macro split the user saw, and may have edited, on the calculator
    // result screen. Without this a returning user's macro tweaks were silently
    // dropped: the first-time path below stages them but the recalc path did not.
    // The calculator is seeded with the current macros, so this is a no-op unless
    // they actually changed something.
    if (result.proteinPercentage !== undefined) setProteinPercentage(result.proteinPercentage);
    if (result.carbsPercentage !== undefined) setCarbsPercentage(result.carbsPercentage);
    if (result.fatPercentage !== undefined) setFatPercentage(result.fatPercentage);

    // Build the full goal payload from the calculator result, with the macro
    // split snapped to exactly 100 before it can be persisted anywhere.
    const norm = normalizeMacros(
      result.proteinPercentage ?? proteinPercentage,
      result.carbsPercentage ?? carbsPercentage,
      result.fatPercentage ?? fatPercentage,
    );
    const goalData: GoalData = {
      calories: result.calories,
      proteinPercentage: norm.p,
      carbsPercentage: norm.c,
      fatPercentage: norm.f,
      proteinGrams: macroGrams(result.calories, norm.p, 4),
      carbsGrams: macroGrams(result.calories, norm.c, 4),
      fatGrams: macroGrams(result.calories, norm.f, 9),
      currentWeightKg: result.currentWeightKg || null,
      targetWeightKg: result.targetWeightKg || null,
      age: result.age, gender: result.gender,
      heightCm: result.heightCm, heightFeet: result.heightFeet, heightInches: result.heightInches,
      goal: result.goal, activityRate: result.activityRate,
      activityLevel: result.activityLevel,
      name: result.name,
      dob: result.dob,
      trackingGoal: result.trackingGoal ?? trackingGoal,
    };
    setProteinPercentage(norm.p);
    setCarbsPercentage(norm.c);
    setFatPercentage(norm.f);

    // First-time flow: stage the goal data and show the signup screen. Goals
    // are saved AFTER signup completes (or skip) so we don't write a
    // half-baked profile in case the user abandons mid-flow.
    if (isFirstTime && result.proteinPercentage !== undefined) {
      pendingGoalDataRef.current = goalData;
      setShowCalculator(false);
      setShowSignup(true);
      return;
    }

    // Returning user: persist immediately. The wizard's confirm button is the
    // save. Before this, "Save Plan" only staged into this screen and a back
    // tap here silently threw the recalculated plan away.
    onSave(goalData);
    lastSavedRef.current = JSON.stringify([goalData.calories, goalData.proteinPercentage, goalData.carbsPercentage, goalData.fatPercentage]);
    setShowCalculator(false);
  };

  const handleCalculatorBack = () => {
    // The calculator calls onBack() immediately after onCalculated() to dismiss
    // itself. If we just staged goalData for the QuickSignup step, we must NOT
    // dismiss SetGoalsScreen — the signup screen is about to render. The ref is
    // set synchronously inside handleCalculatedCalories so it's safe to check.
    if (pendingGoalDataRef.current) return;
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
    const { p: normP, c: normC, f: normF } = normalizeMacros(proteinPercentage, carbsPercentage, fatPercentage);
    lastSavedRef.current = JSON.stringify([calories, normP, normC, normF]);
    onSave({
      calories, proteinPercentage: normP, carbsPercentage: normC, fatPercentage: normF,
      proteinGrams: macroGrams(calories, normP, 4),
      carbsGrams: macroGrams(calories, normC, 4),
      fatGrams: macroGrams(calories, normF, 9),
      currentWeightKg, targetWeightKg, age, gender, heightCm, heightFeet, heightInches,
      goal, activityRate, name, dob, trackingGoal, activityLevel,
    });
    onBack();
  };

  // Leaving with unsaved macro tweaks gets a prompt instead of silent loss.
  const handleScreenBack = () => {
    const current = JSON.stringify([calories, proteinPercentage, carbsPercentage, fatPercentage]);
    if (lastSavedRef.current !== null && current !== lastSavedRef.current) {
      Alert.alert('Save your changes?', 'You adjusted your plan but have not saved it.', [
        { text: 'Discard', style: 'destructive', onPress: onBack },
        { text: 'Save', onPress: handleSave },
      ]);
      return;
    }
    onBack();
  };

  if (showCalculator) {
    return (
      <CalorieCalculatorScreen
        onBack={handleCalculatorBack}
        onCalculated={handleCalculatedCalories}
        initialData={{
          name, dob,
          currentWeightKg, targetWeightKg, age, gender,
          heightCm, heightFeet, heightInches,
          goal, activityRate, activityLevel,
          proteinPercentage, carbsPercentage, fatPercentage,
        }}
      />
    );
  }

  if (showSignup) {
    return (
      <QuickSignupScreen
        prefilledName={pendingGoalDataRef.current?.name}
        onComplete={() => {
          const staged = pendingGoalDataRef.current;
          pendingGoalDataRef.current = null;
          setShowSignup(false);
          if (staged) {
            onSave(staged);
          }
          onBack();
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
    <SafeAreaView style={[st.safe, { backgroundColor: Acid.moss }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[st.header, { borderBottomColor: Acid.hair }]}>
        <TouchableOpacity onPress={handleScreenBack} style={st.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={Acid.tx2} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Nutrition Goals</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={st.content} contentContainerStyle={st.contentInner} showsVerticalScrollIndicator={false}>

        {/* Goal headline */}
        <Text style={st.goalTitle}>{goalLabel}</Text>
        <Text style={st.goalSub}>
          {activityLabel}{activityRate ? ` · ${fmtPace(activityRate, weightUnit)}/week` : ''}
        </Text>

        {/* Calorie hero */}
        <View style={st.calCard}>
          <View style={st.calRow}>
            <Text style={st.calNum}>{calories}</Text>
            <Text style={st.calUnit}>kcal/day</Text>
          </View>
          <TouchableOpacity style={st.recalcBtn} onPress={() => setShowCalculator(true)}>
            <Feather name="refresh-cw" size={14} color={Acid.lime} />
            <Text style={st.recalcTxt}>Recalculate</Text>
          </TouchableOpacity>
        </View>

        {/* Macro section */}
        <Text style={st.sectionLabel}>MACRO SPLIT</Text>

        {/* Stacked bar */}
        <View style={st.macroBar}>
          <View style={[st.macroSeg, { flex: proteinPercentage, backgroundColor: MACRO_COLORS.protein }]} />
          <View style={[st.macroSeg, { flex: carbsPercentage, backgroundColor: MACRO_COLORS.carbs }]} />
          <View style={[st.macroSeg, { flex: fatPercentage, backgroundColor: MACRO_COLORS.fat }]} />
        </View>

        {/* Macro rows */}
        <View style={st.macroRows}>
          {macros.map(m => (
            <View key={m.key} style={st.macroRow}>
              <View style={st.macroLblRow}>
                <View style={[st.macroDot, { backgroundColor: m.color }]} />
                <Text style={st.macroName}>{m.label}</Text>
              </View>
              <Text style={st.macroVal}>{m.pct}% · {m.g}g</Text>
            </View>
          ))}
        </View>

        {/* Customize toggle */}
        <TouchableOpacity style={st.customizeBtn} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsEditingMacros(v => !v); }}>
          <Text style={st.customizeTxt}>{isEditingMacros ? 'Done' : 'Customize macros'}</Text>
          <Feather name={isEditingMacros ? 'chevron-up' : 'chevron-down'} size={16} color={Acid.tx2} />
        </TouchableOpacity>

        {/* Editing controls */}
        {isEditingMacros && (
          <View style={st.editSection}>
            {totalPercentage !== 100 && (
              <View style={st.totalBadge}>
                <Text style={[st.totalTxt, { color: (totalPercentage >= 99 && totalPercentage <= 101) ? Acid.good : Acid.error }]}>{totalPercentage}% Total</Text>
              </View>
            )}
            {macros.map(m => (
              <View key={m.key} style={st.editRow}>
                <View style={st.macroLblRow}>
                  <View style={[st.macroDot, { backgroundColor: m.color }]} />
                  <Text style={st.macroName}>{m.label}</Text>
                </View>
                <View style={st.editControls}>
                  <TouchableOpacity style={st.adjBtn} onPress={() => handleMacroChange(m.key, -5)}>
                    <Feather name="minus" size={14} color={Acid.tx} />
                  </TouchableOpacity>
                  <Text style={st.editPct}>{m.pct}%</Text>
                  <TouchableOpacity style={st.adjBtn} onPress={() => handleMacroChange(m.key, 5)}>
                    <Feather name="plus" size={14} color={Acid.tx} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {!isEditingMacros && (
          <Text style={st.helperTxt}>You can adjust this anytime</Text>
        )}
      </ScrollView>

      {/* Save button */}
      <View style={st.footer}>
        <TouchableOpacity style={st.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Text style={st.saveTxt}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontFamily: Acid.serifItalic, fontSize: 20, color: Acid.tx },
  backBtn: { padding: 4 },
  content: { flex: 1 },
  contentInner: { padding: 20, paddingBottom: 120 },

  // Goal headline
  goalTitle: { fontFamily: Acid.serifItalic, fontSize: 28, lineHeight: 36, color: Acid.tx, marginBottom: 4 },
  goalSub: { fontSize: Typography.fontSize.md, color: Acid.tx2, marginBottom: 24 },

  // Calorie hero
  calCard: { alignItems: 'center', paddingVertical: 16, marginBottom: 28 },
  calRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  calNum: { fontFamily: Acid.serif, fontSize: 56, lineHeight: 60, color: Acid.tx },
  calUnit: { fontSize: Typography.fontSize.lg, color: Acid.tx3, marginLeft: 8 },
  recalcBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  recalcTxt: { fontSize: 12, letterSpacing: 1, color: Acid.lime },

  // Macros
  sectionLabel: { fontSize: 10, letterSpacing: 1.5, color: Acid.tx3, marginBottom: 12, textTransform: 'uppercase' },
  macroBar: { width: '100%', height: 4, borderRadius: 2, flexDirection: 'row', overflow: 'hidden', backgroundColor: Acid.hair, marginBottom: 16 },
  macroSeg: { height: '100%' },
  macroRows: { gap: 12, marginBottom: 8 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  macroLblRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroDot: { width: 10, height: 10, borderRadius: 5 },
  macroName: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium, color: Acid.tx },
  macroVal: { fontSize: Typography.fontSize.sm, fontWeight: '500', color: Acid.tx2 },

  customizeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, width: '100%' },
  customizeTxt: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium, color: Acid.tx2 },

  editSection: { gap: 12, marginBottom: 8 },
  totalBadge: { alignSelf: 'flex-end', paddingVertical: 4 },
  totalTxt: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },
  editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Acid.hair },
  editControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  adjBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: Acid.hair2, alignItems: 'center', justifyContent: 'center' },
  editPct: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold, color: Acid.tx, width: 40, textAlign: 'center' },

  helperTxt: { fontSize: Typography.fontSize.xs, color: Acid.tx3, textAlign: 'center', marginTop: -4 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Acid.hair, backgroundColor: Acid.moss },
  saveBtn: {
    height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: Acid.lime,
    shadowColor: Acid.lime, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  saveTxt: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold, color: Acid.moss },
});
