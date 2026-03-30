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
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  dob?: string;
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
type StepId = 'name' | 'goal' | 'sex' | 'dob' | 'height' | 'weight' | 'pace' | 'activity';

const STEP_ACCENT: Record<StepId, string> = {
  name: '#3B82F6', goal: '#3B82F6', sex: '#8B5CF6', dob: '#10B981',
  height: '#10B981', weight: '#F59E0B', pace: '#EC4899', activity: '#06B6D4',
};

const MACRO_COLORS = { protein: '#3B82F6', carbs: '#F59E0B', fat: '#8B5CF6' };

const buildSteps = (goal: Goal | null, hasName?: boolean): StepId[] => {
  const s: StepId[] = hasName ? ['goal', 'sex', 'dob', 'height', 'weight'] : ['name', 'goal', 'sex', 'dob', 'height', 'weight'];
  if (goal !== 'maintain') s.push('pace');
  s.push('activity');
  return s;
};

const macroGrams = (cal: number, pct: number, perGram: number) => Math.round((cal * pct / 100) / perGram);

// ── Scroll Picker ───────────────────────────────────────────────────
const PICKER_ITEM_HEIGHT = 48;
const PICKER_VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ITEMS;

interface ScrollPickerProps {
  items: { label: string; value: number | string }[];
  selectedValue: number | string;
  onValueChange: (value: number | string) => void;
  width?: number;
  accent?: string;
}

const ScrollPicker: React.FC<ScrollPickerProps> = ({ items, selectedValue, onValueChange, width = 80, accent = '#3B82F6' }) => {
  const theme = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const isScrollingRef = useRef(false);
  const selectedIdx = items.findIndex(i => i.value === selectedValue);

  useEffect(() => {
    if (selectedIdx >= 0 && flatListRef.current && !isScrollingRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: selectedIdx * PICKER_ITEM_HEIGHT, animated: false });
      }, 50);
    }
  }, [selectedIdx]);

  const scrollToItem = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    isScrollingRef.current = true;
    flatListRef.current?.scrollToOffset({ offset: clamped * PICKER_ITEM_HEIGHT, animated: true });
    if (items[clamped]) onValueChange(items[clamped].value);
    setTimeout(() => { isScrollingRef.current = false; }, 350);
  }, [items, onValueChange]);

  const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / PICKER_ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    if (items[clamped] && items[clamped].value !== selectedValue) {
      onValueChange(items[clamped].value);
    }
    isScrollingRef.current = false;
  }, [items, selectedValue, onValueChange]);

  const handleScrollBegin = useCallback(() => {
    isScrollingRef.current = true;
  }, []);

  const paddingItems = Math.floor(PICKER_VISIBLE_ITEMS / 2);

  return (
    <View style={[pSt.container, { width, height: PICKER_HEIGHT }]}>
      <View style={[pSt.highlight, { top: PICKER_ITEM_HEIGHT * paddingItems, borderColor: accent + '40', backgroundColor: accent + '08' }]} />
      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item, i) => `${item.value}-${i}`}
        showsVerticalScrollIndicator={false}
        snapToInterval={PICKER_ITEM_HEIGHT}
        decelerationRate="fast"
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: PICKER_ITEM_HEIGHT * paddingItems }}
        getItemLayout={(_, index) => ({ length: PICKER_ITEM_HEIGHT, offset: PICKER_ITEM_HEIGHT * index, index })}
        renderItem={({ item, index }) => {
          const isSelected = item.value === selectedValue;
          return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => scrollToItem(index)} style={[pSt.item, { height: PICKER_ITEM_HEIGHT }]}>
              <Text style={[pSt.itemText, {
                color: isSelected ? theme.colors.textPrimary : theme.colors.textTertiary,
                fontWeight: isSelected ? '700' : '400',
                fontSize: isSelected ? 22 : 16,
              }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const pSt = StyleSheet.create({
  container: { overflow: 'hidden' },
  highlight: { position: 'absolute', left: 0, right: 0, height: PICKER_ITEM_HEIGHT, borderRadius: 12, borderWidth: 1.5, zIndex: 1, pointerEvents: 'none' },
  item: { alignItems: 'center', justifyContent: 'center' },
  itemText: { textAlign: 'center' },
});

// ── Helpers for DOB picker ──────────────────────────────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ITEMS = MONTHS.map((m, i) => ({ label: m.slice(0, 3), value: i + 1 }));
const DAY_ITEMS = Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
const currentYear = new Date().getFullYear();
const YEAR_ITEMS = Array.from({ length: 80 }, (_, i) => {
  const y = currentYear - 14 - i;
  return { label: String(y), value: y };
});

// ── Helpers for Height picker ───────────────────────────────────────
const CM_ITEMS = Array.from({ length: 121 }, (_, i) => {
  const v = 120 + i;
  return { label: String(v), value: v };
});
const FT_ITEMS = Array.from({ length: 5 }, (_, i) => {
  const v = 3 + i;
  return { label: `${v}'`, value: v };
});
const IN_ITEMS = Array.from({ length: 12 }, (_, i) => ({
  label: `${i}"`, value: i,
}));

const ageFromDob = (month: number, day: number, year: number): number => {
  const today = new Date();
  let a = today.getFullYear() - year;
  const m = today.getMonth() + 1;
  if (m < month || (m === month && today.getDate() < day)) a--;
  return a;
};

// ── Component ───────────────────────────────────────────────────────
export const CalorieCalculatorScreen: React.FC<CalorieCalculatorScreenProps> = ({
  onBack, onCalculated, initialData,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { weightUnit: preferredWeightUnit } = usePreferences();

  // ── Form state ──────────────────────────────────────────────────
  const [userName, setUserName] = useState(initialData?.name || '');
  const [goal, setGoal] = useState<Goal | null>(initialData?.goal || null);
  const [gender, setGender] = useState<Gender | null>(initialData?.gender || null);

  // DOB state
  const initDob = initialData?.dob ? new Date(initialData.dob) : null;
  const [dobMonth, setDobMonth] = useState(initDob ? initDob.getMonth() + 1 : 1);
  const [dobDay, setDobDay] = useState(initDob ? initDob.getDate() : 1);
  const [dobYear, setDobYear] = useState(initDob ? initDob.getFullYear() : 2000);

  // Keep age derived from DOB
  const age = String(ageFromDob(dobMonth, dobDay, dobYear));

  const [heightUnit, setHeightUnit] = useState<HeightUnit>(initialData?.heightFeet ? 'ft' : 'cm');
  const [heightCmVal, setHeightCmVal] = useState(initialData?.heightCm ? Math.round(initialData.heightCm) : 170);
  const [heightFtVal, setHeightFtVal] = useState(initialData?.heightFeet || 5);
  const [heightInVal, setHeightInVal] = useState(initialData?.heightInches != null ? initialData.heightInches : 8);

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

  const hasExistingName = !!(initialData?.name && initialData.name.trim().length > 0);
  const steps = buildSteps(goal, hasExistingName);
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

  interface CalcBreakdown {
    bmr: number;
    multiplier: number;
    multiplierLabel: string;
    tdee: number;
    adjustment: number;
    adjustmentLabel: string;
    floor: number;
    final: number;
  }

  const calcCaloriesDetailed = (actOverride?: string): CalcBreakdown => {
    const g = gender === 'prefer_not_to_say' ? 'male' : gender;
    const fallback: CalcBreakdown = { bmr: 0, multiplier: 1.4, multiplierLabel: 'Moderate', tdee: 0, adjustment: 0, adjustmentLabel: '', floor: 1500, final: 1500 };
    if (!weight || !g) return fallback;
    let hCm = 170;
    if (heightUnit === 'cm') hCm = heightCmVal || 170;
    else hCm = (heightFtVal * 12 + heightInVal) * 2.54;
    const wKg = toKg(weight, weightUnit);
    const a = parseInt(age) || 25;
    const bmr = g === 'male' ? 88.362 + 13.397 * wKg + 4.799 * hCm - 5.677 * a : 447.593 + 9.247 * wKg + 3.098 * hCm - 4.330 * a;
    const act = actOverride || activityLevel;
    let m = 1.4; let mLabel = 'Moderate';
    if (act === 'sedentary') { m = 1.2; mLabel = 'Sedentary'; }
    else if (act === 'light') { m = 1.375; mLabel = 'Lightly active'; }
    else if (act === 'moderate') { m = 1.55; mLabel = 'Moderately active'; }
    else if (act === 'very') { m = 1.725; mLabel = 'Very active'; }
    const tdee = bmr * m;
    const rate = goal === 'maintain' ? 0 : (selectedRate || 0);
    let adj = 0; let adjLabel = '';
    if (goal === 'lose') { adj = -(rate * 1100); adjLabel = `−${Math.round(rate * 1100)} deficit`; }
    else if (goal === 'gain') { adj = rate * 1100; adjLabel = `+${Math.round(rate * 1100)} surplus`; }
    const floor = g === 'female' ? 1200 : 1500;
    const final = Math.max(Math.round(tdee + adj), floor);
    return { bmr: Math.round(bmr), multiplier: m, multiplierLabel: mLabel, tdee: Math.round(tdee), adjustment: Math.round(adj), adjustmentLabel: adjLabel, floor, final };
  };

  const calcCalories = (actOverride?: string): number => calcCaloriesDetailed(actOverride).final;

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
    // Validate weight vs target weight on Next
    if (steps[currentIdx] === 'weight' && targetWeight.trim() !== '') {
      const w = parseFloat(weight) || 0;
      const t = parseFloat(targetWeight) || 0;
      if (goal === 'lose' && t >= w) {
        setWeightError('Target should be less than current weight');
        return;
      }
      if (goal === 'gain' && t <= w) {
        setWeightError('Target should be more than current weight');
        return;
      }
    }
    if (currentIdx < steps.length - 1) slide('fwd', () => setCurrentIdx(i => i + 1));
  }, [currentIdx, steps, weight, targetWeight, goal, slide]);

  const goPrev = useCallback(() => {
    if (showResult) slide('back', () => setShowResult(false));
    else if (currentIdx > 0) slide('back', () => setCurrentIdx(i => i - 1));
  }, [currentIdx, showResult, slide]);

  const autoAdv = useCallback(() => { setTimeout(() => goNext(), 280); }, [goNext]);

  const calcRef = useRef(calcCaloriesDetailed);
  calcRef.current = calcCaloriesDetailed;
  const [breakdown, setBreakdown] = useState<CalcBreakdown | null>(null);

  const showResultScreen = useCallback((actOverride?: string) => {
    const bd = calcRef.current(actOverride);
    setCalculatedCalories(bd.final);
    setBreakdown(bd);
    slide('fwd', () => setShowResult(true));
  }, [slide]);

  // ── Save ────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!calculatedCalories) return;
    if (totalPct < 99 || totalPct > 101) return;
    let hCmFinal: number | undefined, hFt: number | undefined, hIn: number | undefined;
    if (heightUnit === 'cm') { hCmFinal = heightCmVal; }
    else { hCmFinal = (heightFtVal * 12 + heightInVal) * 2.54; hFt = heightFtVal || undefined; hIn = heightInVal; }
    const dobStr = `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`;
    onCalculated({
      calories: calculatedCalories,
      name: userName.trim() || undefined,
      dob: dobStr,
      currentWeightKg: weight ? toKg(weight, weightUnit) : undefined,
      targetWeightKg: targetWeight ? toKg(targetWeight, targetWeightUnit) : undefined,
      age: parseInt(age) || undefined, gender: gender || undefined,
      heightCm: hCmFinal, heightFeet: hFt, heightInches: hIn,
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
      case 'name': return userName.trim() === '';
      case 'goal': return !goal;
      case 'sex': return !gender;
      case 'dob': return false; // always has a value
      case 'height': return false; // always has a value
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

    const firstName = userName.trim().split(' ')[0];
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
        {/* Personalized headline */}
        <Text style={[st.resultGoal, { color: theme.colors.textPrimary }]}>
          {firstName ? `Here's your plan, ${firstName}` : goalLabel}
        </Text>
        <Text style={[st.resultGoalSub, { color: theme.colors.textSecondary }]}>{goalSub}</Text>

        {/* Calorie card with count-up */}
        <View style={[st.calCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[st.calLabel, { color: theme.colors.textSecondary }]}>DAILY TARGET</Text>
          <View style={st.calRow}>
            <Text style={[st.calNum, { color: theme.colors.primary }]}>{displayCal}</Text>
            <Text style={[st.calUnit, { color: theme.colors.textPrimary }]}>kcal</Text>
          </View>
        </View>

        {/* How we got this number */}
        {breakdown && (
          <View style={[st.breakdownCard, { backgroundColor: theme.colors.secondaryBg }]}>
            <Text style={[st.breakdownTitle, { color: theme.colors.textSecondary }]}>HOW WE CALCULATED THIS</Text>
            <View style={st.breakdownRow}>
              <Text style={[st.breakdownLabel, { color: theme.colors.textSecondary }]}>Basal Metabolic Rate (BMR)</Text>
              <Text style={[st.breakdownValue, { color: theme.colors.textPrimary }]}>{breakdown.bmr} kcal</Text>
            </View>
            <View style={st.breakdownRow}>
              <Text style={[st.breakdownLabel, { color: theme.colors.textSecondary }]}>Activity ({breakdown.multiplierLabel})</Text>
              <Text style={[st.breakdownValue, { color: theme.colors.textPrimary }]}>× {breakdown.multiplier}</Text>
            </View>
            <View style={[st.breakdownRow, { borderBottomWidth: 0 }]}>
              <Text style={[st.breakdownLabel, { color: theme.colors.textSecondary }]}>Maintenance (TDEE)</Text>
              <Text style={[st.breakdownValue, { color: theme.colors.textPrimary }]}>{breakdown.tdee} kcal</Text>
            </View>
            {breakdown.adjustment !== 0 && (
              <View style={[st.breakdownRow, { borderBottomWidth: 0 }]}>
                <Text style={[st.breakdownLabel, { color: theme.colors.textSecondary }]}>{goal === 'lose' ? 'Deficit' : 'Surplus'}</Text>
                <Text style={[st.breakdownValue, { color: goal === 'lose' ? theme.colors.error : '#10B981' }]}>{breakdown.adjustmentLabel}</Text>
              </View>
            )}
          </View>
        )}

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
  const renderName = () => (
    <View style={st.step}>
      <Text style={[st.title, { color: theme.colors.textPrimary }]}>What should we call you?</Text>
      <Text style={[st.sub, { color: theme.colors.textSecondary }]}>Your first name is enough</Text>
      <View style={st.field}>
        <TextInput
          style={[st.input, { color: theme.colors.textPrimary, borderBottomColor: userName ? STEP_ACCENT.name : theme.colors.border }]}
          value={userName}
          onChangeText={setUserName}
          placeholder="Your name"
          placeholderTextColor={'#A1A1AA'}
          autoFocus
          autoCapitalize="words"
          maxLength={30}
          returnKeyType="next"
          onSubmitEditing={() => { if (userName.trim()) goNext(); }}
        />
      </View>
    </View>
  );

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

  const renderDob = () => {
    const computedAge = ageFromDob(dobMonth, dobDay, dobYear);
    const accent = STEP_ACCENT.dob;
    return (
      <View style={st.step}>
        <Text style={[st.title, { color: theme.colors.textPrimary }]}>Date of birth</Text>
        <Text style={[st.sub, { color: theme.colors.textSecondary }]}>We'll calculate your age automatically</Text>
        <View style={st.pickerRow}>
          <ScrollPicker items={MONTH_ITEMS} selectedValue={dobMonth} onValueChange={v => setDobMonth(v as number)} width={90} accent={accent} />
          <ScrollPicker items={DAY_ITEMS} selectedValue={dobDay} onValueChange={v => setDobDay(v as number)} width={60} accent={accent} />
          <ScrollPicker items={YEAR_ITEMS} selectedValue={dobYear} onValueChange={v => setDobYear(v as number)} width={80} accent={accent} />
        </View>
      </View>
    );
  };

  const renderHeight = () => {
    const accent = STEP_ACCENT.height;
    return (
      <View style={st.step}>
        <Text style={[st.title, { color: theme.colors.textPrimary }]}>Your height</Text>
        <View style={[st.toggle, { backgroundColor: theme.colors.secondaryBg, alignSelf: 'center', marginBottom: 24 }]}>
          {(['cm', 'ft'] as const).map(u => (
            <TouchableOpacity key={u} style={[st.togBtn, heightUnit === u && { backgroundColor: accent + '15', borderWidth: 1.5, borderColor: accent }]} onPress={() => setHeightUnit(u)}>
              <Text style={[st.togTxt, { color: heightUnit === u ? accent : theme.colors.textSecondary }]}>{u.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {heightUnit === 'cm' ? (
          <View style={st.pickerRow}>
            <ScrollPicker items={CM_ITEMS} selectedValue={heightCmVal} onValueChange={v => setHeightCmVal(v as number)} width={100} accent={accent} />
            <Text style={[st.pickerUnit, { color: theme.colors.textSecondary }]}>cm</Text>
          </View>
        ) : (
          <View style={st.pickerRow}>
            <ScrollPicker items={FT_ITEMS} selectedValue={heightFtVal} onValueChange={v => setHeightFtVal(v as number)} width={80} accent={accent} />
            <ScrollPicker items={IN_ITEMS} selectedValue={heightInVal} onValueChange={v => setHeightInVal(v as number)} width={80} accent={accent} />
          </View>
        )}
      </View>
    );
  };

  const [weightError, setWeightError] = useState('');

  const renderWeight = () => {
    return (
      <View style={st.step}>
        <Text style={[st.title, { color: theme.colors.textPrimary }]}>Your weight</Text>
        {/* Unit toggle */}
        <View style={[st.toggle, { backgroundColor: theme.colors.secondaryBg, alignSelf: 'center', marginBottom: 24 }]}>
          {(['kg', 'lbs'] as const).map(u => (
            <TouchableOpacity key={u} style={[st.togBtn, weightUnit === u && { backgroundColor: STEP_ACCENT.weight + '15', borderWidth: 1.5, borderColor: STEP_ACCENT.weight }]} onPress={() => { setWeightUnit(u); setTargetWeightUnit(u); }}>
              <Text style={[st.togTxt, { color: weightUnit === u ? STEP_ACCENT.weight : theme.colors.textSecondary }]}>{u.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={st.field}>
          <Text style={[st.fieldLbl, { color: theme.colors.textSecondary }]}>CURRENT WEIGHT ({weightUnit.toUpperCase()})</Text>
          <TextInput style={[st.input, { color: theme.colors.textPrimary, borderBottomColor: weight ? STEP_ACCENT.weight : theme.colors.border }]}
            value={weight} onChangeText={(v) => { setWeight(v); setWeightError(''); }} placeholder={weightUnit === 'kg' ? '70' : '150'}
            placeholderTextColor={'#A1A1AA'} keyboardType="numeric" maxLength={5} autoFocus />
        </View>
        <View style={st.field}>
          <Text style={[st.fieldLbl, { color: theme.colors.textSecondary }]}>TARGET WEIGHT ({weightUnit.toUpperCase()})<Text style={{ fontWeight: '400' }}>  (optional)</Text></Text>
          <TextInput style={[st.input, { color: theme.colors.textPrimary, borderBottomColor: targetWeight ? STEP_ACCENT.weight : theme.colors.border }]}
            value={targetWeight} onChangeText={(v) => { setTargetWeight(v); setWeightError(''); }} placeholder={targetWeightUnit === 'kg' ? '65' : '140'}
            placeholderTextColor={'#A1A1AA'} keyboardType="numeric" maxLength={5} />
        </View>
        {weightError !== '' && (
          <Text style={[st.weightWarning, { color: theme.colors.error }]}>{weightError}</Text>
        )}
      </View>
    );
  };

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
      case 'name': return renderName();
      case 'goal': return renderGoal(); case 'sex': return renderSex();
      case 'dob': return renderDob(); case 'height': return renderHeight();
      case 'weight': return renderWeight();
      case 'pace': return renderPace(); case 'activity': return renderActivity();
      default: return null;
    }
  };

  const isAutoStep = currentStepId === 'goal' || currentStepId === 'sex' || currentStepId === 'pace' || currentStepId === 'activity';
  const isInputStep = !showResult && (currentStepId === 'name' || currentStepId === 'weight');
  const showFooter = !showResult && !isAutoStep;
  const nextLabel = currentStepId === 'weight' && weight.trim() !== '' && targetWeight.trim() === '' ? 'Skip' : 'Next';
  const stepAccent = currentStepId ? STEP_ACCENT[currentStepId] : theme.colors.primary;

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={[st.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={showResult ? goPrev : (currentIdx > 0 ? goPrev : onBack)} style={st.backBtn}>
            <Feather name={showResult || currentIdx > 0 ? 'arrow-left' : 'x'} size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          {!showResult && renderDots()}
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            isInputStep ? st.scrollInput : showResult ? st.scrollResult : st.scrollCentered,
            !showFooter && { paddingBottom: (isInputStep ? 16 : 24) + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ transform: [{ translateX: slideAnim }, { scale: scaleAnim }], opacity: fadeAnim }}>
            {renderCurrentStep()}
          </Animated.View>
        </ScrollView>

        {showFooter && (
          <View style={[st.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border, paddingBottom: 16 + insets.bottom }]}>
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

  // Weight warning
  weightWarning: { fontSize: Typography.fontSize.sm, textAlign: 'center', marginTop: -12, marginBottom: 8 },

  // Picker
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 },
  pickerUnit: { fontSize: 18, fontWeight: '600', marginLeft: 4 },
  ageBadge: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  ageBadgeText: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semiBold },

  // Breakdown
  breakdownCard: { width: '100%', borderRadius: 14, padding: 16, marginBottom: 20 },
  breakdownTitle: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, letterSpacing: 1, marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  breakdownLabel: { fontSize: Typography.fontSize.sm },
  breakdownValue: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semiBold },

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
