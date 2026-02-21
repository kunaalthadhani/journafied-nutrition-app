import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { usePreferences } from '../contexts/PreferencesContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Public interface ────────────────────────────────────────────────
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
  proteinPercentage?: number;
  carbsPercentage?: number;
  fatPercentage?: number;
}

interface CalorieCalculatorScreenProps {
  onBack: () => void;
  onCalculated: (result: CalorieCalculationResult) => void;
  initialData?: CalorieCalculationResult | any;
}

type Goal = 'lose' | 'maintain' | 'gain';
type Gender = 'male' | 'female' | 'prefer_not_to_say';
type HeightUnit = 'cm' | 'ft';
type WeightUnit = 'kg' | 'lbs';
type StepId = 'goal' | 'sex' | 'age_height' | 'weight' | 'pace' | 'activity';

const STEP_ACCENT: Record<StepId, string> = {
  goal: '#3B82F6', sex: '#8B5CF6', age_height: '#10B981',
  weight: '#F59E0B', pace: '#EC4899', activity: '#06B6D4',
};

const MACRO_COLORS = { protein: '#3B82F6', carbs: '#F59E0B', fat: '#8B5CF6' };

const buildSteps = (goal: Goal | null): StepId[] => {
  const s: StepId[] = ['goal', 'sex', 'age_height', 'weight'];
  if (goal !== 'maintain') s.push('pace');
  s.push('activity');
  return s;
};

const macroGrams = (cal: number, pct: number, perGram: number) => Math.round((cal * pct / 100) / perGram);

// ── Component ───────────────────────────────────────────────────────
export const CalorieCalculatorScreen: React.FC<CalorieCalculatorScreenProps> = ({
  onBack, onCalculated, initialData,
}) => {
  const theme = useTheme();
  const { weightUnit: preferredWeightUnit } = usePreferences();

  // ── Form state ──────────────────────────────────────────────────
  const [goal, setGoal] = useState<Goal | null>(initialData?.goal || null);
  const [gender, setGender] = useState<Gender | null>(initialData?.gender || null);
  const [age, setAge] = useState(initialData?.age ? String(initialData.age) : '');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(initialData?.heightFeet ? 'ft' : 'cm');
  const [heightCm, setHeightCm] = useState(initialData?.heightCm ? String(initialData.heightCm) : '');
  const [heightFeetInput, setHeightFeetInput] = useState(initialData?.heightFeet ? String(initialData.heightFeet) : '');
  const [heightInchesInput, setHeightInchesInput] = useState(initialData?.heightInches ? String(initialData.heightInches) : '');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(preferredWeightUnit);
  const [weight, setWeight] = useState(initialData?.currentWeightKg ? String(initialData.currentWeightKg) : '');
  const [targetWeightUnit, setTargetWeightUnit] = useState<WeightUnit>(preferredWeightUnit);
  const [targetWeight, setTargetWeight] = useState(initialData?.targetWeightKg ? String(initialData.targetWeightKg) : '');
  const [selectedRate, setSelectedRate] = useState<number | null>(null);
  const [activityLevel, setActivityLevel] = useState<string | null>(null);

  // ── Macro state ─────────────────────────────────────────────────
  const [proteinPct, setProteinPct] = useState(initialData?.proteinPercentage || 30);
  const [carbsPct, setCarbsPct] = useState(initialData?.carbsPercentage || 45);
  const [fatPct, setFatPct] = useState(initialData?.fatPercentage || 25);
  const [editingMacros, setEditingMacros] = useState(false);
  const totalPct = proteinPct + carbsPct + fatPct;

  // ── Navigation ──────────────────────────────────────────────────
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [calculatedCalories, setCalculatedCalories] = useState<number | null>(null);
  const [displayCal, setDisplayCal] = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const steps = buildSteps(goal);
  const currentStepId = steps[currentIdx];

  useEffect(() => { setWeightUnit(preferredWeightUnit); setTargetWeightUnit(preferredWeightUnit); }, [preferredWeightUnit]);
  useEffect(() => { if (goal === 'maintain') setSelectedRate(0); }, [goal]);
  useEffect(() => { if (currentIdx >= steps.length) setCurrentIdx(steps.length - 1); }, [steps.length]);

  // ── Calorie count-up ───────────────────────────────────────────
  useEffect(() => {
    if (!showResult || !calculatedCalories) return;
    setDisplayCal(0);
    const target = calculatedCalories;
    const frames = 32;
    const inc = target / frames;
    let cur = 0;
    const timer = setInterval(() => {
      cur += inc;
      if (cur >= target) { setDisplayCal(target); clearInterval(timer); }
      else setDisplayCal(Math.round(cur));
    }, 25);
    return () => clearInterval(timer);
  }, [showResult, calculatedCalories]);

  // ── Calculation helpers ─────────────────────────────────────────
  const toKg = (v: string, u: WeightUnit) => { const n = parseFloat(v); return isNaN(n) ? 0 : u === 'lbs' ? n * 0.453592 : n; };

  const targetDate = (rate: number): string => {
    if (!weight || !targetWeight) return '';
    const diff = Math.abs(toKg(weight, weightUnit) - toKg(targetWeight, targetWeightUnit));
    const d = new Date(); d.setDate(d.getDate() + Math.ceil(diff / rate) * 7);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const calcCalories = (actOverride?: string): number => {
    if (!weight || !age) return 1500;
    const g = gender === 'prefer_not_to_say' ? 'male' : gender;
    if (!g) return 1500;
    let hCm = 170;
    if (heightUnit === 'cm') hCm = parseFloat(heightCm) || 170;
    else hCm = ((parseFloat(heightFeetInput) || 5) * 12 + (parseFloat(heightInchesInput) || 6)) * 2.54;
    const wKg = toKg(weight, weightUnit);
    const a = parseInt(age) || 25;
    const bmr = g === 'male' ? 88.362 + 13.397 * wKg + 4.799 * hCm - 5.677 * a : 447.593 + 9.247 * wKg + 3.098 * hCm - 4.330 * a;
    const act = actOverride || activityLevel;
    let m = 1.4;
    if (act === 'sedentary') m = 1.2; else if (act === 'light') m = 1.375; else if (act === 'moderate') m = 1.55; else if (act === 'very') m = 1.725;
    const rate = goal === 'maintain' ? 0 : (selectedRate || 0);
    let adj = 0;
    if (goal === 'lose') adj = -(rate * 1100); else if (goal === 'gain') adj = rate * 1100;
    return Math.max(Math.round(bmr * m + adj), g === 'female' ? 1200 : 1500);
  };

  const getRateOptions = () => {
    const loss = goal === 'lose';
    const act = loss ? 'loss' : 'gain'; const verb = loss ? 'lose' : 'gain';
    return [
      { rate: 0.25, label: `Mild weight ${act}`, sub: `${verb} 0.25 kg/week${targetWeight ? ' · ' + targetDate(0.25) : ''}` },
      { rate: 0.5, label: `Weight ${act}`, sub: `${verb} 0.5 kg/week${targetWeight ? ' · ' + targetDate(0.5) : ''}` },
      { rate: 1.0, label: `Fast weight ${act}`, sub: `${verb} 1.0 kg/week${targetWeight ? ' · ' + targetDate(1.0) : ''}` },
    ];
  };

  // ── Slide animation ─────────────────────────────────────────────
  const slide = useCallback((dir: 'fwd' | 'back', cb: () => void) => {
    const out = dir === 'fwd' ? -SCREEN_WIDTH * 0.25 : SCREEN_WIDTH * 0.25;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: out, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      cb();
      slideAnim.setValue(dir === 'fwd' ? SCREEN_WIDTH * 0.25 : -SCREEN_WIDTH * 0.25);
      scaleAnim.setValue(0.92);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      ]).start();
    });
  }, [slideAnim, fadeAnim, scaleAnim]);

  const goNext = useCallback(() => {
    if (currentIdx < steps.length - 1) slide('fwd', () => setCurrentIdx(i => i + 1));
  }, [currentIdx, steps.length, slide]);

  const goPrev = useCallback(() => {
    if (showResult) slide('back', () => setShowResult(false));
    else if (currentIdx > 0) slide('back', () => setCurrentIdx(i => i - 1));
  }, [currentIdx, showResult, slide]);

  const autoAdv = useCallback(() => { setTimeout(() => goNext(), 280); }, [goNext]);

  const showResultScreen = useCallback((actOverride?: string) => {
    const cal = calcCalories(actOverride);
    setCalculatedCalories(cal);
    slide('fwd', () => setShowResult(true));
  }, [slide]);

  // ── Save ────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!calculatedCalories) return;
    if (totalPct < 99 || totalPct > 101) return; // guard
    let hCmVal: number | undefined, hFt: number | undefined, hIn: number | undefined;
    if (heightUnit === 'cm') { hCmVal = heightCm ? parseFloat(heightCm) : undefined; }
    else { const ft = parseFloat(heightFeetInput) || 0; const inc = parseFloat(heightInchesInput) || 0; hCmVal = (ft * 12 + inc) * 2.54; hFt = ft || undefined; hIn = inc || undefined; }
    onCalculated({
      calories: calculatedCalories,
      currentWeightKg: weight ? toKg(weight, weightUnit) : undefined,
      targetWeightKg: targetWeight ? toKg(targetWeight, targetWeightUnit) : undefined,
      age: age ? parseInt(age) : undefined, gender: gender || undefined,
      heightCm: hCmVal, heightFeet: hFt, heightInches: hIn,
      goal: goal || undefined,
      activityRate: selectedRate !== null ? selectedRate : undefined,
      activityLevel: activityLevel as CalorieCalculationResult['activityLevel'],
      proteinPercentage: proteinPct, carbsPercentage: carbsPct, fatPercentage: fatPct,
    });
    onBack();
  };

  // ── Disabled check ──────────────────────────────────────────────
  const isDisabled = (): boolean => {
    switch (currentStepId) {
      case 'goal': return !goal;
      case 'sex': return !gender;
      case 'age_height': {
        const hasH = heightUnit === 'cm' ? heightCm.trim() !== '' : (heightFeetInput.trim() !== '' && heightInchesInput.trim() !== '');
        return age.trim() === '' || !hasH;
      }
      case 'weight': return weight.trim() === '';
      case 'pace': return selectedRate === null;
      case 'activity': return !activityLevel;
      default: return false;
    }
  };

  // ── Macro handlers ──────────────────────────────────────────────
  const setMacro = (which: 'p' | 'c' | 'f', delta: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (which === 'p') setProteinPct((v: number) => Math.max(5, Math.min(80, v + delta)));
    else if (which === 'c') setCarbsPct((v: number) => Math.max(5, Math.min(80, v + delta)));
    else setFatPct((v: number) => Math.max(5, Math.min(80, v + delta)));
  };

  // ── Progress dots ───────────────────────────────────────────────
  const renderDots = () => {
    const accent = STEP_ACCENT[currentStepId] || theme.colors.primary;
    return (
      <View style={st.dotsRow}>
        {steps.map((stepId, i) => (
          <View key={i} style={[st.dot, {
            backgroundColor: i === currentIdx ? accent : i < currentIdx ? accent + '50' : theme.colors.border,
            width: i === currentIdx ? 20 : 8,
          }]} />
        ))}
      </View>
    );
  };

  // ── Result screen ───────────────────────────────────────────────
  const renderResult = () => {
    const goalLabel = goal === 'lose' ? 'Lose weight' : goal === 'gain' ? 'Gain weight' : 'Maintain weight';
    const goalSub = goal === 'maintain' ? 'Stay at your current weight'
      : `${selectedRate} kg/week · ${activityLevel === 'sedentary' ? 'Sedentary' : activityLevel === 'light' ? 'Light' : activityLevel === 'moderate' ? 'Moderate' : 'Very active'}`;

    const cal = calculatedCalories || 0;
    const pG = macroGrams(cal, proteinPct, 4);
    const cG = macroGrams(cal, carbsPct, 4);
    const fG = macroGrams(cal, fatPct, 9);

    const chips: { label: string; value: string; icon: string }[] = [
      { label: 'Goal', value: goalLabel, icon: 'target' },
      { label: 'Activity', value: activityLevel === 'sedentary' ? 'Sedentary' : activityLevel === 'light' ? 'Lightly active' : activityLevel === 'moderate' ? 'Moderately active' : 'Very active', icon: 'activity' },
    ];
    if (goal !== 'maintain' && selectedRate) chips.push({ label: 'Pace', value: `${selectedRate} kg/wk`, icon: 'trending-up' });
    chips.push({ label: 'Age', value: age, icon: 'user' });

    const macros = [
      { key: 'p' as const, label: 'Protein', color: MACRO_COLORS.protein, pct: proteinPct, g: pG },
      { key: 'c' as const, label: 'Carbs', color: MACRO_COLORS.carbs, pct: carbsPct, g: cG },
      { key: 'f' as const, label: 'Fat', color: MACRO_COLORS.fat, pct: fatPct, g: fG },
    ];

    return (
      <View style={st.resultWrap}>
        {/* Goal headline */}
        <Text style={[st.resultGoal, { color: theme.colors.textPrimary }]}>{goalLabel}</Text>
        <Text style={[st.resultGoalSub, { color: theme.colors.textSecondary }]}>{goalSub}</Text>

        {/* Calorie card with count-up */}
        <View style={[st.calCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[st.calLabel, { color: theme.colors.textSecondary }]}>DAILY TARGET</Text>
          <View style={st.calRow}>
            <Text style={[st.calNum, { color: theme.colors.primary }]}>{displayCal}</Text>
            <Text style={[st.calUnit, { color: theme.colors.textPrimary }]}>kcal</Text>
          </View>
        </View>

        {/* Summary chips */}
        <View style={st.chipGrid}>
          {chips.map((c, i) => (
            <View key={i} style={[st.chip, { backgroundColor: theme.colors.secondaryBg }]}>
              <Feather name={c.icon as any} size={14} color={theme.colors.textSecondary} />
              <View>
                <Text style={[st.chipLbl, { color: theme.colors.textSecondary }]}>{c.label}</Text>
                <Text style={[st.chipVal, { color: theme.colors.textPrimary }]}>{c.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Macro section ─────────────────────────────────────── */}
        <Text style={[st.macroTitle, { color: theme.colors.textSecondary }]}>MACRO SPLIT</Text>

        {/* Stacked bar */}
        <View style={[st.macroBar, { backgroundColor: theme.colors.border }]}>
          <View style={[st.macroSeg, { flex: proteinPct, backgroundColor: MACRO_COLORS.protein, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
          <View style={[st.macroSeg, { flex: carbsPct, backgroundColor: MACRO_COLORS.carbs }]} />
          <View style={[st.macroSeg, { flex: fatPct, backgroundColor: MACRO_COLORS.fat, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
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
        <TouchableOpacity style={st.customizeBtn} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setEditingMacros(v => !v); }}>
          <Text style={[st.customizeTxt, { color: theme.colors.textSecondary }]}>{editingMacros ? 'Done' : 'Customize macros'}</Text>
          <Feather name={editingMacros ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {/* Editing controls */}
        {editingMacros && (
          <View style={st.editSection}>
            {totalPct !== 100 && (
              <View style={[st.totalBadge, { backgroundColor: (totalPct >= 99 && totalPct <= 101) ? theme.colors.successBg : theme.colors.error + '15' }]}>
                <Text style={[st.totalTxt, { color: (totalPct >= 99 && totalPct <= 101) ? theme.colors.success : theme.colors.error }]}>{totalPct}% Total</Text>
              </View>
            )}
            {macros.map(m => (
              <View key={m.key} style={[st.editRow, { borderColor: theme.colors.border }]}>
                <View style={st.macroLblRow}>
                  <View style={[st.macroDot, { backgroundColor: m.color }]} />
                  <Text style={[st.macroName, { color: theme.colors.textPrimary }]}>{m.label}</Text>
                </View>
                <View style={st.editControls}>
                  <TouchableOpacity style={[st.adjBtn, { borderColor: theme.colors.border }]} onPress={() => setMacro(m.key, -5)}>
                    <Feather name="minus" size={14} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[st.editPct, { color: theme.colors.textPrimary }]}>{m.pct}%</Text>
                  <TouchableOpacity style={[st.adjBtn, { borderColor: theme.colors.border }]} onPress={() => setMacro(m.key, 5)}>
                    <Feather name="plus" size={14} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Save button */}
        <TouchableOpacity
          style={[st.savBtn, { backgroundColor: (totalPct >= 99 && totalPct <= 101) ? theme.colors.primary : theme.colors.border }]}
          onPress={handleSave}
          disabled={totalPct < 99 || totalPct > 101}>
          <Text style={[st.savTxt, { color: (totalPct >= 99 && totalPct <= 101) ? theme.colors.primaryForeground : theme.colors.textSecondary }]}>Start Tracking</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Step renderers ──────────────────────────────────────────────
  const renderGoal = () => (
    <View style={st.step}>
      <Text style={[st.title, { color: theme.colors.textPrimary }]}>What's your goal?</Text>
      <Text style={[st.sub, { color: theme.colors.textSecondary }]}>This shapes your entire plan</Text>
      <View style={st.opts}>
        {([
          { id: 'lose' as Goal, label: 'Lose Weight', desc: 'Burn fat & get lean', icon: 'trending-down' },
          { id: 'maintain' as Goal, label: 'Maintain Weight', desc: 'Stay at your current weight', icon: 'minus' },
          { id: 'gain' as Goal, label: 'Gain Weight', desc: 'Build muscle & mass', icon: 'trending-up' },
        ]).map(o => (
          <TouchableOpacity key={o.id} style={[st.optCard, { backgroundColor: theme.colors.card, borderColor: goal === o.id ? STEP_ACCENT.goal : theme.colors.border }]}
            onPress={() => { setGoal(o.id); if (o.id === 'maintain') setSelectedRate(0); autoAdv(); }}>
            <View style={[st.optIcon, { backgroundColor: goal === o.id ? STEP_ACCENT.goal + '15' : theme.colors.secondaryBg }]}>
              <Feather name={o.icon as any} size={20} color={goal === o.id ? STEP_ACCENT.goal : theme.colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.optTitle, { color: goal === o.id ? STEP_ACCENT.goal : theme.colors.textPrimary }]}>{o.label}</Text>
              <Text style={[st.optSub, { color: theme.colors.textSecondary }]}>{o.desc}</Text>
            </View>
            {goal === o.id && <Feather name="check" size={20} color={STEP_ACCENT.goal} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSex = () => {
    const accent = STEP_ACCENT.sex;
    return (
      <View style={st.step}>
        <Text style={[st.title, { color: theme.colors.textPrimary }]}>Biological sex</Text>
        <Text style={[st.sub, { color: theme.colors.textSecondary }]}>Used to calculate your metabolic rate</Text>
        <View style={st.opts}>
          {([
            { id: 'male' as Gender, label: 'Male' },
            { id: 'female' as Gender, label: 'Female' },
            { id: 'prefer_not_to_say' as Gender, label: 'Prefer not to say' },
          ]).map(o => (
            <TouchableOpacity key={o.id} style={[st.selOpt, { backgroundColor: theme.colors.card, borderColor: gender === o.id ? accent : theme.colors.border }]}
              onPress={() => { setGender(o.id); autoAdv(); }}>
              <Text style={[st.selTxt, { color: gender === o.id ? accent : theme.colors.textPrimary }]}>{o.label}</Text>
              {gender === o.id && <Feather name="check" size={20} color={accent} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderAgeHeight = () => (
    <View style={st.step}>
      <Text style={[st.title, { color: theme.colors.textPrimary }]}>About you</Text>
      <Text style={[st.sub, { color: theme.colors.textSecondary }]}>Age and height for accurate calculations</Text>
      <View style={st.field}>
        <Text style={[st.fieldLbl, { color: theme.colors.textSecondary }]}>AGE</Text>
        <TextInput style={[st.input, { color: theme.colors.textPrimary, borderBottomColor: age ? STEP_ACCENT.age_height : theme.colors.border }]}
          value={age} onChangeText={setAge} placeholder="25" placeholderTextColor={theme.colors.textTertiary}
          keyboardType="numeric" maxLength={3} autoFocus />
      </View>
      <View style={st.field}>
        <View style={st.fieldRow}>
          <Text style={[st.fieldLbl, { color: theme.colors.textSecondary }]}>HEIGHT</Text>
          <View style={[st.toggle, { backgroundColor: theme.colors.secondaryBg }]}>
            {(['cm', 'ft'] as const).map(u => (
              <TouchableOpacity key={u} style={[st.togBtn, heightUnit === u && { backgroundColor: theme.colors.card }]} onPress={() => setHeightUnit(u)}>
                <Text style={[st.togTxt, { color: heightUnit === u ? theme.colors.textPrimary : theme.colors.textSecondary }]}>{u.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {heightUnit === 'cm' ? (
          <TextInput style={[st.input, { color: theme.colors.textPrimary, borderBottomColor: heightCm ? STEP_ACCENT.age_height : theme.colors.border }]}
            value={heightCm} onChangeText={setHeightCm} placeholder="170" placeholderTextColor={theme.colors.textTertiary} keyboardType="numeric" maxLength={3} />
        ) : (
          <View style={st.dual}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <TextInput style={[st.input, { color: theme.colors.textPrimary, borderBottomColor: heightFeetInput ? STEP_ACCENT.age_height : theme.colors.border }]}
                value={heightFeetInput} onChangeText={setHeightFeetInput} placeholder="5" placeholderTextColor={theme.colors.textTertiary} keyboardType="numeric" maxLength={1} />
              <Text style={[st.unitLbl, { color: theme.colors.textSecondary }]}>ft</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <TextInput style={[st.input, { color: theme.colors.textPrimary, borderBottomColor: heightInchesInput ? STEP_ACCENT.age_height : theme.colors.border }]}
                value={heightInchesInput} onChangeText={setHeightInchesInput} placeholder="8" placeholderTextColor={theme.colors.textTertiary} keyboardType="numeric" maxLength={2} />
              <Text style={[st.unitLbl, { color: theme.colors.textSecondary }]}>in</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderWeight = () => (
    <View style={st.step}>
      <Text style={[st.title, { color: theme.colors.textPrimary }]}>Your weight</Text>
      <View style={st.field}>
        <View style={st.fieldRow}>
          <Text style={[st.fieldLbl, { color: theme.colors.textSecondary }]}>CURRENT WEIGHT</Text>
          <View style={[st.toggle, { backgroundColor: theme.colors.secondaryBg }]}>
            {(['kg', 'lbs'] as const).map(u => (
              <TouchableOpacity key={u} style={[st.togBtn, weightUnit === u && { backgroundColor: theme.colors.card }]} onPress={() => setWeightUnit(u)}>
                <Text style={[st.togTxt, { color: weightUnit === u ? theme.colors.textPrimary : theme.colors.textSecondary }]}>{u.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TextInput style={[st.input, { color: theme.colors.textPrimary, borderBottomColor: weight ? STEP_ACCENT.weight : theme.colors.border }]}
          value={weight} onChangeText={setWeight} placeholder={weightUnit === 'kg' ? '70' : '150'}
          placeholderTextColor={theme.colors.textTertiary} keyboardType="numeric" maxLength={5} autoFocus />
      </View>
      <View style={st.field}>
        <View style={st.fieldRow}>
          <Text style={[st.fieldLbl, { color: theme.colors.textSecondary }]}>TARGET WEIGHT<Text style={{ fontWeight: '400' }}>  (optional)</Text></Text>
          <View style={[st.toggle, { backgroundColor: theme.colors.secondaryBg }]}>
            {(['kg', 'lbs'] as const).map(u => (
              <TouchableOpacity key={u} style={[st.togBtn, targetWeightUnit === u && { backgroundColor: theme.colors.card }]} onPress={() => setTargetWeightUnit(u)}>
                <Text style={[st.togTxt, { color: targetWeightUnit === u ? theme.colors.textPrimary : theme.colors.textSecondary }]}>{u.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TextInput style={[st.input, { color: theme.colors.textPrimary, borderBottomColor: targetWeight ? STEP_ACCENT.weight : theme.colors.border }]}
          value={targetWeight} onChangeText={setTargetWeight} placeholder={targetWeightUnit === 'kg' ? '65' : '140'}
          placeholderTextColor={theme.colors.textTertiary} keyboardType="numeric" maxLength={5} />
      </View>
    </View>
  );

  const renderPace = () => {
    const accent = STEP_ACCENT.pace;
    return (
      <View style={st.step}>
        <Text style={[st.title, { color: theme.colors.textPrimary }]}>Your pace</Text>
        <Text style={[st.sub, { color: theme.colors.textSecondary }]}>How fast do you want to reach your goal?</Text>
        <View style={st.opts}>
          {getRateOptions().map(o => (
            <TouchableOpacity key={o.rate} style={[st.optCard, { backgroundColor: theme.colors.card, borderColor: selectedRate === o.rate ? accent : theme.colors.border }]}
              onPress={() => { setSelectedRate(o.rate); autoAdv(); }}>
              <View style={{ flex: 1 }}>
                <Text style={[st.optTitle, { color: selectedRate === o.rate ? accent : theme.colors.textPrimary }]}>{o.label}</Text>
                <Text style={[st.optSub, { color: theme.colors.textSecondary }]}>{o.sub}</Text>
              </View>
              {selectedRate === o.rate && <Feather name="check" size={20} color={accent} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderActivity = () => {
    const accent = STEP_ACCENT.activity;
    return (
      <View style={st.step}>
        <Text style={[st.title, { color: theme.colors.textPrimary }]}>Activity level</Text>
        <Text style={[st.sub, { color: theme.colors.textSecondary }]}>Be honest — this affects your target significantly</Text>
        <View style={st.opts}>
          {[
            { id: 'sedentary', label: 'Sedentary', desc: 'Office job, little exercise' },
            { id: 'light', label: 'Lightly Active', desc: '1-3 days/week exercise' },
            { id: 'moderate', label: 'Moderately Active', desc: '3-5 days/week exercise' },
            { id: 'very', label: 'Very Active', desc: '6-7 days/week hard exercise' },
          ].map(o => (
            <TouchableOpacity key={o.id} style={[st.optCard, { backgroundColor: theme.colors.card, borderColor: activityLevel === o.id ? accent : theme.colors.border }]}
              onPress={() => { setActivityLevel(o.id); setTimeout(() => showResultScreen(o.id), 280); }}>
              <View style={{ flex: 1 }}>
                <Text style={[st.optTitle, { color: activityLevel === o.id ? accent : theme.colors.textPrimary }]}>{o.label}</Text>
                <Text style={[st.optSub, { color: theme.colors.textSecondary }]}>{o.desc}</Text>
              </View>
              {activityLevel === o.id && <Feather name="check" size={20} color={accent} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderCurrentStep = () => {
    if (showResult) return renderResult();
    switch (currentStepId) {
      case 'goal': return renderGoal(); case 'sex': return renderSex();
      case 'age_height': return renderAgeHeight(); case 'weight': return renderWeight();
      case 'pace': return renderPace(); case 'activity': return renderActivity();
      default: return null;
    }
  };

  const isAutoStep = currentStepId === 'goal' || currentStepId === 'sex' || currentStepId === 'pace' || currentStepId === 'activity';
  const isInputStep = !showResult && (currentStepId === 'age_height' || currentStepId === 'weight');
  const showFooter = !showResult && !isAutoStep;
  const nextLabel = currentStepId === 'weight' && weight.trim() !== '' && targetWeight.trim() === '' ? 'Skip' : 'Next';
  const stepAccent = currentStepId ? STEP_ACCENT[currentStepId] : theme.colors.primary;

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[st.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={showResult ? goPrev : (currentIdx > 0 ? goPrev : onBack)} style={st.backBtn}>
            <Feather name={showResult || currentIdx > 0 ? 'arrow-left' : 'x'} size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          {!showResult && renderDots()}
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={isInputStep ? st.scrollInput : showResult ? st.scrollResult : st.scrollCentered}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ transform: [{ translateX: slideAnim }, { scale: scaleAnim }], opacity: fadeAnim }}>
            {renderCurrentStep()}
          </Animated.View>
        </ScrollView>

        {showFooter && (
          <View style={[st.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
            {currentIdx > 0 && (
              <TouchableOpacity style={[st.navBtn, st.prevBtn, { borderColor: theme.colors.border }]} onPress={goPrev} activeOpacity={0.7}>
                <Text style={[st.navTxt, { color: theme.colors.textSecondary }]}>Previous</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[st.navBtn, st.nextBtn, { backgroundColor: isDisabled() ? theme.colors.border : stepAccent }, currentIdx === 0 && { flex: 1 }]}
              onPress={goNext} disabled={currentStepId === 'weight' ? weight.trim() === '' : isDisabled()}
              activeOpacity={0.7}>
              <Text style={[st.navTxt, { color: isDisabled() ? theme.colors.textSecondary : '#fff', fontWeight: '600' }]}>{nextLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Styles ──────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  scrollCentered: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  scrollInput: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  scrollResult: { padding: 24 },
  footer: { padding: 16, borderTopWidth: 1, flexDirection: 'row', gap: 12 },
  navBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  prevBtn: { borderWidth: 1, flex: 0.5 },
  nextBtn: { flex: 1 },
  navTxt: { fontSize: Typography.fontSize.md },

  step: { width: '100%', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: Typography.fontSize.xxl, fontWeight: Typography.fontWeight.bold, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: Typography.fontSize.md, textAlign: 'center', marginBottom: 28, opacity: 0.8 },

  opts: { width: '100%', gap: 12 },
  optCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, borderWidth: 2, gap: 14 },
  optIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold, marginBottom: 2 },
  optSub: { fontSize: Typography.fontSize.sm },

  selOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderRadius: 12, borderWidth: 2 },
  selTxt: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium },

  field: { width: '100%', marginBottom: 28 },
  fieldLbl: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, letterSpacing: 1, marginBottom: 12 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  input: { fontSize: 28, fontWeight: '600', paddingVertical: 10, borderBottomWidth: 2, textAlign: 'center', width: '100%' },
  dual: { flexDirection: 'row', gap: 24 },
  unitLbl: { marginTop: 6, fontSize: Typography.fontSize.sm, fontWeight: '500' },

  toggle: { flexDirection: 'row', padding: 3, borderRadius: 10 },
  togBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  togTxt: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },

  // Result
  resultWrap: { width: '100%', alignItems: 'center' },
  resultGoal: { fontSize: 26, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  resultGoalSub: { fontSize: Typography.fontSize.md, marginBottom: 24, textAlign: 'center' },
  calCard: { alignItems: 'center', padding: 24, borderRadius: 20, borderWidth: 1, width: '100%', marginBottom: 20 },
  calLabel: { fontSize: Typography.fontSize.xs, fontWeight: '600', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  calRow: { flexDirection: 'row', alignItems: 'baseline' },
  calNum: { fontSize: 52, fontWeight: '800', lineHeight: 56 },
  calUnit: { fontSize: Typography.fontSize.lg, fontWeight: '600', marginLeft: 8 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginBottom: 28 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, minWidth: '45%' },
  chipLbl: { fontSize: Typography.fontSize.xs, marginBottom: 1 },
  chipVal: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semiBold },

  // Macros
  macroTitle: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, letterSpacing: 1, marginBottom: 12, alignSelf: 'flex-start' },
  macroBar: { width: '100%', height: 14, borderRadius: 7, flexDirection: 'row', overflow: 'hidden', marginBottom: 16 },
  macroSeg: { height: '100%' },
  macroRows: { width: '100%', gap: 10, marginBottom: 8 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  macroLblRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroDot: { width: 10, height: 10, borderRadius: 5 },
  macroName: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium },
  macroVal: { fontSize: Typography.fontSize.sm, fontWeight: '500' },
  customizeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, width: '100%' },
  customizeTxt: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },

  editSection: { width: '100%', gap: 12, marginBottom: 8 },
  totalBadge: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  totalTxt: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },
  editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  editControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  adjBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editPct: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold, width: 40, textAlign: 'center' },

  savBtn: { width: '100%', height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  savTxt: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold },
});
