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
  Alert,
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
import { Acid } from '../constants/acid';
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

const MACRO_COLORS = { protein: Acid.protein, carbs: Acid.carbs, fat: Acid.fat };

// The name comes LAST, not first: it has no effect on the math, and the first
// question should be about the user's goal, not admin. Asked right before the
// plan reveal it reads as personalization instead of a form.
const buildSteps = (goal: Goal | null, hasName?: boolean): StepId[] => {
  const s: StepId[] = ['goal', 'sex', 'dob', 'height', 'weight'];
  if (goal !== 'maintain') s.push('pace');
  s.push('activity');
  if (!hasName) s.push('name');
  return s;
};

const macroGrams = (cal: number, pct: number, perGram: number) => Math.round((cal * pct / 100) / perGram);

// Pace rate is stored in kg/week. Render it in the unit the user picked so an
// lbs user does not see "kg/week".
const fmtPace = (kgPerWeek: number, unit: WeightUnit): string => unit === 'lbs'
  ? `${Math.round(kgPerWeek * 2.20462 * 10) / 10} lbs`
  : `${kgPerWeek} kg`;

// Weight is always stored in kg. These render it in, and convert between, the
// unit the field is currently showing, so a pre-filled value is never the raw kg
// number under a lbs label (which silently halved a returning lbs user's weight).
const kgToDisplay = (kg: number, u: WeightUnit): string => {
  const v = u === 'lbs' ? Math.round(kg / 0.453592) : Math.round(kg * 10) / 10;
  return String(v);
};
const convertWeightField = (val: string, from: WeightUnit, to: WeightUnit): string => {
  if (from === to) return val;
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  const kg = from === 'lbs' ? n * 0.453592 : n;
  return kgToDisplay(kg, to);
};

// ── Scroll Picker ───────────────────────────────────────────────────
const PICKER_ITEM_HEIGHT = 48;
const PICKER_VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ITEMS;

interface ScrollPickerProps {
  items: { label: string; value: number | string }[];
  selectedValue: number | string;
  onValueChange: (value: number | string) => void;
  width?: number;
}

const ScrollPicker: React.FC<ScrollPickerProps> = ({ items, selectedValue, onValueChange, width = 80 }) => {
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
      <View style={[pSt.highlight, { top: PICKER_ITEM_HEIGHT * paddingItems }]} />
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
              <Text style={[pSt.itemText, isSelected ? {
                fontFamily: Acid.serif,
                color: Acid.tx,
                fontSize: 22,
              } : {
                color: Acid.tx3,
                fontSize: 16,
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
  highlight: {
    position: 'absolute', left: 0, right: 0, height: PICKER_ITEM_HEIGHT,
    borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: Acid.lime + '55',
    backgroundColor: Acid.limeSoft, zIndex: 1, pointerEvents: 'none',
  },
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
  const insets = useSafeAreaInsets();
  const { weightUnit: preferredWeightUnit, setWeightUnit: persistWeightUnit } = usePreferences();

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
  const [weight, setWeight] = useState(initialData?.currentWeightKg ? kgToDisplay(initialData.currentWeightKg, preferredWeightUnit) : '');
  const [targetWeightUnit, setTargetWeightUnit] = useState<WeightUnit>(preferredWeightUnit);
  const [targetWeight, setTargetWeight] = useState(initialData?.targetWeightKg ? kgToDisplay(initialData.targetWeightKg, preferredWeightUnit) : '');
  const [selectedRate, setSelectedRate] = useState<number | null>(initialData?.activityRate ?? null);
  const [activityLevel, setActivityLevel] = useState<string | null>(initialData?.activityLevel ?? null);
  // Force the user to actually set DOB and height instead of silently accepting
  // the picker defaults (year 2000 -> age 26, 170cm), which fed a wrong BMR.
  // Pre-touched when we already have the value (returning user or recalc).
  const [dobTouched, setDobTouched] = useState(!!initialData?.dob);
  const [heightTouched, setHeightTouched] = useState(initialData?.heightCm != null || initialData?.heightFeet != null);

  // ── Macro state ─────────────────────────────────────────────────
  const [proteinPct, setProteinPct] = useState(initialData?.proteinPercentage || 30);
  const [carbsPct, setCarbsPct] = useState(initialData?.carbsPercentage || 45);
  const [fatPct, setFatPct] = useState(initialData?.fatPercentage || 25);
  const [editingMacros, setEditingMacros] = useState(false);
  const totalPct = proteinPct + carbsPct + fatPct;

  // ── Navigation ──────────────────────────────────────────────────
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showResult, setShowResult] = useState(false);
  // Set while the user edits a single step they jumped to from the result
  // screen. Confirming the step returns to the result instead of advancing.
  const [editingFromResult, setEditingFromResult] = useState(false);
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
      { rate: 0.25, label: `Mild weight ${act}`, sub: `${verb} ${fmtPace(0.25, weightUnit)}/week${targetWeight ? ' · ' + targetDate(0.25) : ''}` },
      { rate: 0.5, label: `Weight ${act}`, sub: `${verb} ${fmtPace(0.5, weightUnit)}/week${targetWeight ? ' · ' + targetDate(0.5) : ''}` },
      { rate: 1.0, label: `Fast weight ${act}`, sub: `${verb} ${fmtPace(1.0, weightUnit)}/week${targetWeight ? ' · ' + targetDate(1.0) : ''}` },
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

  const calcRef = useRef(calcCaloriesDetailed);
  calcRef.current = calcCaloriesDetailed;
  const [breakdown, setBreakdown] = useState<CalcBreakdown | null>(null);

  const showResultScreen = useCallback((actOverride?: string) => {
    const bd = calcRef.current(actOverride);
    setCalculatedCalories(bd.final);
    setBreakdown(bd);
    setEditingFromResult(false);
    slide('fwd', () => setShowResult(true));
  }, [slide]);

  const goNext = useCallback(() => {
    // Validate weight vs target weight on Next
    if (steps[currentIdx] === 'weight' && goal !== 'maintain' && targetWeight.trim() !== '') {
      const w = toKg(weight, weightUnit);
      const t = toKg(targetWeight, targetWeightUnit);
      if (goal === 'lose' && t >= w) {
        setWeightError('Target should be less than current weight');
        return;
      }
      if (goal === 'gain' && t <= w) {
        setWeightError('Target should be more than current weight');
        return;
      }
    }
    if (editingFromResult) {
      // Changing the goal away from maintain can leave the pace unanswered.
      // Route through pace before returning to the result.
      if (goal !== 'maintain' && selectedRate === null) {
        const paceIdx = steps.indexOf('pace');
        if (paceIdx >= 0 && paceIdx !== currentIdx) {
          slide('fwd', () => setCurrentIdx(paceIdx));
          return;
        }
      }
      showResultScreen();
      return;
    }
    if (currentIdx === steps.length - 1) {
      showResultScreen();
      return;
    }
    slide('fwd', () => setCurrentIdx(i => i + 1));
  }, [currentIdx, steps, weight, targetWeight, weightUnit, targetWeightUnit, goal, selectedRate, editingFromResult, showResultScreen, slide]);

  const goPrev = useCallback(() => {
    if (showResult) slide('back', () => setShowResult(false));
    else if (currentIdx > 0) slide('back', () => setCurrentIdx(i => i - 1));
  }, [currentIdx, showResult, slide]);

  const autoAdv = useCallback(() => { setTimeout(() => goNext(), 280); }, [goNext]);

  // Jump from a result chip straight to one step. Confirming it returns here.
  const jumpToStep = useCallback((stepId: StepId) => {
    const idx = steps.indexOf(stepId);
    if (idx < 0) return;
    setEditingFromResult(true);
    slide('back', () => {
      setShowResult(false);
      setCurrentIdx(idx);
    });
  }, [steps, slide]);

  // ── Exit guard ──────────────────────────────────────────────────
  const isReturning = !!initialData?.goal;
  const handleExit = () => {
    const hasProgress = !isReturning && (
      goal !== null || gender !== null || dobTouched || heightTouched || weight.trim() !== ''
    );
    if (hasProgress) {
      Alert.alert('Leave setup?', 'Your answers so far will be lost.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: onBack },
      ]);
      return;
    }
    onBack();
  };

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
      case 'dob': return !dobTouched;
      case 'height': return !heightTouched;
      case 'weight': return weight.trim() === '' || !(parseFloat(weight) > 0);
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

  // ── Progress ────────────────────────────────────────────────────
  // A continuous bar instead of dots: when choosing "maintain" removes the
  // pace step, the fill just recalculates instead of a dot visibly vanishing.
  const renderProgress = () => (
    <View style={st.progressTrack}>
      <View style={[st.progressFill, { width: `${((currentIdx + 1) / steps.length) * 100}%` }]} />
    </View>
  );

  // ── Result screen ───────────────────────────────────────────────
  const renderResult = () => {
    const goalLabel = goal === 'lose' ? 'Lose weight' : goal === 'gain' ? 'Gain weight' : 'Maintain weight';
    const goalSub = goal === 'maintain' ? 'Stay at your current weight'
      : `${fmtPace(selectedRate || 0, weightUnit)}/week · ${activityLevel === 'sedentary' ? 'Sedentary' : activityLevel === 'light' ? 'Light' : activityLevel === 'moderate' ? 'Moderate' : 'Very active'}`;

    const cal = calculatedCalories || 0;
    const pG = macroGrams(cal, proteinPct, 4);
    const cG = macroGrams(cal, carbsPct, 4);
    const fG = macroGrams(cal, fatPct, 9);

    const firstName = userName.trim().split(' ')[0];
    const heightLabel = heightUnit === 'cm' ? `${heightCmVal} cm` : `${heightFtVal}'${heightInVal}"`;
    // Every chip jumps straight to its step for a one-field edit, then returns here.
    const chips: { label: string; value: string; icon: string; step: StepId }[] = [
      { label: 'Goal', value: goalLabel, icon: 'target', step: 'goal' },
      { label: 'Activity', value: activityLevel === 'sedentary' ? 'Sedentary' : activityLevel === 'light' ? 'Lightly active' : activityLevel === 'moderate' ? 'Moderately active' : 'Very active', icon: 'activity', step: 'activity' },
    ];
    if (goal !== 'maintain' && selectedRate) chips.push({ label: 'Pace', value: `${fmtPace(selectedRate, weightUnit)}/wk`, icon: 'trending-up', step: 'pace' });
    chips.push({ label: 'Age', value: age, icon: 'user', step: 'dob' });
    chips.push({ label: 'Height', value: heightLabel, icon: 'arrow-up', step: 'height' });
    chips.push({ label: 'Weight', value: `${weight} ${weightUnit}`, icon: 'anchor', step: 'weight' });

    const macros = [
      { key: 'p' as const, label: 'Protein', color: MACRO_COLORS.protein, pct: proteinPct, g: pG },
      { key: 'c' as const, label: 'Carbs', color: MACRO_COLORS.carbs, pct: carbsPct, g: cG },
      { key: 'f' as const, label: 'Fat', color: MACRO_COLORS.fat, pct: fatPct, g: fG },
    ];

    return (
      <View style={st.resultWrap}>
        {/* Personalized headline */}
        <Text style={st.resultGoal}>
          {firstName ? `Here's your plan, ${firstName}` : goalLabel}
        </Text>
        <Text style={st.resultGoalSub}>{goalSub}</Text>

        {/* Calorie hero with count-up */}
        <View style={st.calCard}>
          <Text style={st.calLabel}>DAILY TARGET</Text>
          <View style={st.calRow}>
            <Text style={st.calNum}>{displayCal}</Text>
            <Text style={st.calUnit}>kcal</Text>
          </View>
        </View>

        {/* How we got this number */}
        {breakdown && (
          <View style={st.breakdownCard}>
            <Text style={st.breakdownTitle}>HOW WE CALCULATED THIS</Text>
            <View style={st.breakdownRow}>
              <Text style={st.breakdownLabel}>Basal Metabolic Rate (BMR)</Text>
              <Text style={st.breakdownValue}>{breakdown.bmr} kcal</Text>
            </View>
            <View style={st.breakdownRow}>
              <Text style={st.breakdownLabel}>Activity ({breakdown.multiplierLabel})</Text>
              <Text style={st.breakdownValue}>× {breakdown.multiplier}</Text>
            </View>
            <View style={[st.breakdownRow, { borderBottomWidth: 0 }]}>
              <Text style={st.breakdownLabel}>Maintenance (TDEE)</Text>
              <Text style={st.breakdownValue}>{breakdown.tdee} kcal</Text>
            </View>
            {breakdown.adjustment !== 0 && (
              <View style={[st.breakdownRow, { borderBottomWidth: 0 }]}>
                <Text style={st.breakdownLabel}>{goal === 'lose' ? 'Deficit' : 'Surplus'}</Text>
                <Text style={[st.breakdownValue, { color: goal === 'lose' ? Acid.error : Acid.good }]}>{breakdown.adjustmentLabel}</Text>
              </View>
            )}
          </View>
        )}

        {/* Summary chips — tap to edit that one answer */}
        <View style={st.chipGrid}>
          {chips.map((c, i) => (
            <TouchableOpacity key={i} style={st.chip} onPress={() => jumpToStep(c.step)} activeOpacity={0.6}>
              <Feather name={c.icon as any} size={14} color={Acid.tx3} />
              <View style={{ flex: 1 }}>
                <Text style={st.chipLbl}>{c.label}</Text>
                <Text style={st.chipVal}>{c.value}</Text>
              </View>
              <Feather name="chevron-right" size={14} color={Acid.tx3} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Macro section ─────────────────────────────────────── */}
        <Text style={st.macroTitle}>MACRO SPLIT</Text>

        {/* Stacked bar */}
        <View style={st.macroBar}>
          <View style={[st.macroSeg, { flex: proteinPct, backgroundColor: MACRO_COLORS.protein }]} />
          <View style={[st.macroSeg, { flex: carbsPct, backgroundColor: MACRO_COLORS.carbs }]} />
          <View style={[st.macroSeg, { flex: fatPct, backgroundColor: MACRO_COLORS.fat }]} />
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
        <TouchableOpacity style={st.customizeBtn} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setEditingMacros(v => !v); }}>
          <Text style={st.customizeTxt}>{editingMacros ? 'Done' : 'Customize macros'}</Text>
          <Feather name={editingMacros ? 'chevron-up' : 'chevron-down'} size={16} color={Acid.tx2} />
        </TouchableOpacity>

        {/* Editing controls */}
        {editingMacros && (
          <View style={st.editSection}>
            {totalPct !== 100 && (
              <View style={st.totalBadge}>
                <Text style={[st.totalTxt, { color: (totalPct >= 99 && totalPct <= 101) ? Acid.good : Acid.error }]}>{totalPct}% Total</Text>
              </View>
            )}
            {macros.map(m => (
              <View key={m.key} style={st.editRow}>
                <View style={st.macroLblRow}>
                  <View style={[st.macroDot, { backgroundColor: m.color }]} />
                  <Text style={st.macroName}>{m.label}</Text>
                </View>
                <View style={st.editControls}>
                  <TouchableOpacity style={st.adjBtn} onPress={() => setMacro(m.key, -5)}>
                    <Feather name="minus" size={14} color={Acid.tx} />
                  </TouchableOpacity>
                  <Text style={st.editPct}>{m.pct}%</Text>
                  <TouchableOpacity style={st.adjBtn} onPress={() => setMacro(m.key, 5)}>
                    <Feather name="plus" size={14} color={Acid.tx} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Save button */}
        <TouchableOpacity
          style={[st.savBtn, { backgroundColor: (totalPct >= 99 && totalPct <= 101) ? Acid.lime : Acid.hair2 }]}
          onPress={handleSave}
          disabled={totalPct < 99 || totalPct > 101}>
          <Text style={[st.savTxt, { color: (totalPct >= 99 && totalPct <= 101) ? Acid.moss : Acid.tx3 }]}>{isReturning ? 'Save Plan' : 'Start Tracking'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Step renderers ──────────────────────────────────────────────
  const renderName = () => (
    <View style={st.step}>
      <Text style={st.title}>And your name?</Text>
      <Text style={st.sub}>So we know who this plan is for</Text>
      <View style={st.field}>
        <TextInput
          style={[st.input, { borderBottomColor: userName ? Acid.lime : Acid.hair2 }]}
          selectionColor={Acid.lime}
          value={userName}
          onChangeText={setUserName}
          placeholder="Your name"
          placeholderTextColor={Acid.tx3}
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
      <Text style={st.title}>What are we doing?</Text>
      <Text style={st.sub}>This shapes your entire plan</Text>
      <View style={st.opts}>
        {([
          { id: 'lose' as Goal, label: 'Lose Weight', desc: 'Burn fat & get lean', icon: 'trending-down' },
          { id: 'maintain' as Goal, label: 'Maintain Weight', desc: 'Stay at your current weight', icon: 'minus' },
          { id: 'gain' as Goal, label: 'Gain Weight', desc: 'Build muscle & mass', icon: 'trending-up' },
        ]).map(o => (
          <TouchableOpacity key={o.id} style={st.optCard}
            onPress={() => {
              setGoal(o.id);
              // Maintain needs no pace and no target weight. Leaving maintain
              // must clear the forced 0 so the flow routes back through pace.
              if (o.id === 'maintain') { setSelectedRate(0); setTargetWeight(''); }
              else if (selectedRate === 0) setSelectedRate(null);
              // Changing the goal changes the step list, so the delayed goNext
              // would run against a stale array in a result edit. Route from
              // the tapped value instead.
              const needsPace = o.id !== 'maintain' && (selectedRate === null || selectedRate === 0);
              setTimeout(() => {
                if (editingFromResult) {
                  if (needsPace) {
                    const paceIdx = buildSteps(o.id, hasExistingName).indexOf('pace');
                    slide('fwd', () => setCurrentIdx(paceIdx));
                  } else {
                    showResultScreen();
                  }
                } else {
                  goNext();
                }
              }, 280);
            }}>
            <Feather name={o.icon as any} size={20} color={goal === o.id ? Acid.lime : Acid.tx3} style={{ width: 32 }} />
            <View style={{ flex: 1 }}>
              <Text style={[st.optTitle, { color: goal === o.id ? Acid.lime : Acid.tx }]}>{o.label}</Text>
              <Text style={st.optSub}>{o.desc}</Text>
            </View>
            {goal === o.id && <Feather name="check" size={20} color={Acid.lime} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSex = () => {
    return (
      <View style={st.step}>
        <Text style={st.title}>Biological sex</Text>
        <Text style={st.sub}>It only sets your metabolic rate</Text>
        <View style={st.opts}>
          {([
            { id: 'male' as Gender, label: 'Male' },
            { id: 'female' as Gender, label: 'Female' },
            { id: 'prefer_not_to_say' as Gender, label: 'Prefer not to say' },
          ]).map(o => (
            <TouchableOpacity key={o.id} style={st.selOpt}
              onPress={() => { setGender(o.id); autoAdv(); }}>
              <Text style={[st.selTxt, { color: gender === o.id ? Acid.lime : Acid.tx }]}>{o.label}</Text>
              {gender === o.id && <Feather name="check" size={20} color={Acid.lime} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderDob = () => {
    return (
      <View style={st.step}>
        <Text style={st.title}>When were you born?</Text>
        <Text style={st.sub}>We'll calculate your age automatically</Text>
        <View style={st.pickerRow}>
          <ScrollPicker items={MONTH_ITEMS} selectedValue={dobMonth} onValueChange={v => { setDobMonth(v as number); setDobTouched(true); }} width={90} />
          <ScrollPicker items={DAY_ITEMS} selectedValue={dobDay} onValueChange={v => { setDobDay(v as number); setDobTouched(true); }} width={60} />
          <ScrollPicker items={YEAR_ITEMS} selectedValue={dobYear} onValueChange={v => { setDobYear(v as number); setDobTouched(true); }} width={80} />
        </View>
        {!dobTouched && (
          <Text style={{ fontSize: 13, textAlign: 'center', marginTop: 18, color: Acid.tx3 }}>Scroll to your date, or tap it to confirm</Text>
        )}
      </View>
    );
  };

  const renderHeight = () => {
    return (
      <View style={st.step}>
        <Text style={st.title}>How tall are you?</Text>
        <View style={[st.toggle, { alignSelf: 'center', marginBottom: 24 }]}>
          {(['cm', 'ft'] as const).map(u => (
            <TouchableOpacity key={u} style={[st.togBtn, heightUnit === u && st.togActive]} onPress={() => setHeightUnit(u)}>
              <Text style={[st.togTxt, { color: heightUnit === u ? Acid.lime : Acid.tx3 }]}>{u.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {heightUnit === 'cm' ? (
          <View style={st.pickerRow}>
            <ScrollPicker items={CM_ITEMS} selectedValue={heightCmVal} onValueChange={v => { setHeightCmVal(v as number); setHeightTouched(true); }} width={100} />
            <Text style={[st.pickerUnit, { color: Acid.tx2 }]}>cm</Text>
          </View>
        ) : (
          <View style={st.pickerRow}>
            <ScrollPicker items={FT_ITEMS} selectedValue={heightFtVal} onValueChange={v => { setHeightFtVal(v as number); setHeightTouched(true); }} width={80} />
            <ScrollPicker items={IN_ITEMS} selectedValue={heightInVal} onValueChange={v => { setHeightInVal(v as number); setHeightTouched(true); }} width={80} />
          </View>
        )}
        {!heightTouched && (
          <Text style={{ fontSize: 13, textAlign: 'center', marginTop: 18, color: Acid.tx3 }}>Scroll to your height, or tap it to confirm</Text>
        )}
      </View>
    );
  };

  const [weightError, setWeightError] = useState('');

  const renderWeight = () => {
    return (
      <View style={st.step}>
        <Text style={st.title}>Where are we starting?</Text>
        {/* Unit toggle */}
        <View style={[st.toggle, { alignSelf: 'center', marginBottom: 24 }]}>
          {(['kg', 'lbs'] as const).map(u => (
            <TouchableOpacity key={u} style={[st.togBtn, weightUnit === u && st.togActive]} onPress={() => { setWeight(w => convertWeightField(w, weightUnit, u)); setTargetWeight(t => convertWeightField(t, weightUnit, u)); setWeightUnit(u); setTargetWeightUnit(u); persistWeightUnit(u).catch(() => {}); }}>
              <Text style={[st.togTxt, { color: weightUnit === u ? Acid.lime : Acid.tx3 }]}>{u.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={st.field}>
          <Text style={st.fieldLbl}>CURRENT WEIGHT ({weightUnit.toUpperCase()})</Text>
          <TextInput style={[st.input, { borderBottomColor: weight ? Acid.lime : Acid.hair2 }]}
            selectionColor={Acid.lime}
            value={weight} onChangeText={(v) => { setWeight(v); setWeightError(''); }} placeholder={weightUnit === 'kg' ? '70' : '150'}
            placeholderTextColor={Acid.tx3} keyboardType="numeric" maxLength={5} autoFocus />
        </View>
        {/* A target weight means nothing when the goal is to stay put */}
        {goal !== 'maintain' && (
          <View style={st.field}>
            <Text style={st.fieldLbl}>TARGET WEIGHT ({weightUnit.toUpperCase()})<Text style={{ fontWeight: '400' }}>  (optional)</Text></Text>
            <TextInput style={[st.input, { borderBottomColor: targetWeight ? Acid.lime : Acid.hair2 }]}
              selectionColor={Acid.lime}
              value={targetWeight} onChangeText={(v) => { setTargetWeight(v); setWeightError(''); }} placeholder={targetWeightUnit === 'kg' ? '65' : '140'}
              placeholderTextColor={Acid.tx3} keyboardType="numeric" maxLength={5} />
          </View>
        )}
        {weightError !== '' && (
          <Text style={[st.weightWarning, { color: Acid.error }]}>{weightError}</Text>
        )}
      </View>
    );
  };

  const renderPace = () => {
    return (
      <View style={st.step}>
        <Text style={st.title}>How fast?</Text>
        <Text style={st.sub}>Slower is easier to sustain</Text>
        <View style={st.opts}>
          {getRateOptions().map(o => (
            <TouchableOpacity key={o.rate} style={st.optCard}
              onPress={() => { setSelectedRate(o.rate); autoAdv(); }}>
              <View style={{ flex: 1 }}>
                <Text style={[st.optTitle, { color: selectedRate === o.rate ? Acid.lime : Acid.tx }]}>{o.label}</Text>
                <Text style={st.optSub}>{o.sub}</Text>
              </View>
              {selectedRate === o.rate && <Feather name="check" size={20} color={Acid.lime} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderActivity = () => {
    return (
      <View style={st.step}>
        <Text style={st.title}>How active are you?</Text>
        <Text style={st.sub}>Be honest. Most people overestimate this.</Text>
        <View style={st.opts}>
          {[
            { id: 'sedentary', label: 'Sedentary', desc: 'Office job, little exercise' },
            { id: 'light', label: 'Lightly Active', desc: '1-3 days/week exercise' },
            { id: 'moderate', label: 'Moderately Active', desc: '3-5 days/week exercise' },
            { id: 'very', label: 'Very Active', desc: '6-7 days/week hard exercise' },
          ].map(o => (
            <TouchableOpacity key={o.id} style={st.optCard}
              onPress={() => {
                setActivityLevel(o.id);
                const isLast = currentIdx === steps.length - 1;
                setTimeout(() => {
                  if (editingFromResult || isLast) showResultScreen(o.id);
                  else goNext();
                }, 280);
              }}>
              <View style={{ flex: 1 }}>
                <Text style={[st.optTitle, { color: activityLevel === o.id ? Acid.lime : Acid.tx }]}>{o.label}</Text>
                <Text style={st.optSub}>{o.desc}</Text>
              </View>
              {activityLevel === o.id && <Feather name="check" size={20} color={Acid.lime} />}
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
  const nextLabel = editingFromResult ? 'Done'
    : currentStepId === 'name' ? 'See my plan'
    : (currentStepId === 'weight' && goal !== 'maintain' && weight.trim() !== '' && targetWeight.trim() === '') ? 'Skip'
    : 'Next';
  // In a one-field edit the back arrow finishes the edit (when valid) instead
  // of walking the whole flow. There is no cancel: you came to change a field.
  const handleHeaderBack = () => {
    if (showResult) { goPrev(); return; }
    if (editingFromResult) { if (!isDisabled()) goNext(); return; }
    if (currentIdx > 0) { goPrev(); return; }
    handleExit();
  };

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: Acid.moss }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={[st.header, { borderBottomColor: Acid.hair }]}>
          <TouchableOpacity onPress={handleHeaderBack} style={st.backBtn}>
            <Feather name={showResult || editingFromResult || currentIdx > 0 ? 'arrow-left' : 'x'} size={24} color={Acid.tx2} />
          </TouchableOpacity>
          {!showResult && !editingFromResult && renderProgress()}
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
          <View style={[st.footer, { backgroundColor: Acid.moss, borderTopColor: Acid.hair, paddingBottom: 16 + insets.bottom }]}>
            {currentIdx > 0 && !editingFromResult && (
              <TouchableOpacity style={[st.navBtn, st.prevBtn]} onPress={goPrev} activeOpacity={0.7}>
                <Text style={[st.navTxt, { color: Acid.tx2 }]}>Previous</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[st.navBtn, st.nextBtn, { backgroundColor: isDisabled() ? Acid.hair2 : Acid.lime }, (currentIdx === 0 || editingFromResult) && { flex: 1 }]}
              onPress={goNext} disabled={isDisabled()}
              activeOpacity={0.7}>
              <Text style={[st.navTxt, { color: isDisabled() ? Acid.tx3 : Acid.moss, fontWeight: '600' }]}>{nextLabel}</Text>
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
  progressTrack: { flex: 1, maxWidth: 180, height: 2, borderRadius: 1, backgroundColor: Acid.hair2, overflow: 'hidden', marginHorizontal: 16 },
  progressFill: { height: '100%', borderRadius: 1, backgroundColor: Acid.lime },
  scrollCentered: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  scrollInput: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  scrollResult: { padding: 24 },
  footer: { padding: 16, borderTopWidth: 1, flexDirection: 'row', gap: 12 },
  navBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  prevBtn: { flex: 0.5 },
  nextBtn: { flex: 1 },
  navTxt: { fontSize: Typography.fontSize.md },

  step: { width: '100%', alignItems: 'center', marginBottom: 20 },
  title: { fontFamily: Acid.serifItalic, fontSize: 30, lineHeight: 38, color: Acid.tx, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: Typography.fontSize.md, color: Acid.tx2, textAlign: 'center', marginBottom: 28 },

  opts: { width: '100%' },
  optCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Acid.hair, gap: 14 },
  optTitle: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semiBold, marginBottom: 2 },
  optSub: { fontSize: Typography.fontSize.sm, color: Acid.tx2 },

  selOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: Acid.hair },
  selTxt: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium },

  field: { width: '100%', marginBottom: 28 },
  fieldLbl: { fontSize: 10, letterSpacing: 1.5, color: Acid.tx3, marginBottom: 12 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  input: { fontFamily: Acid.serif, fontSize: 26, color: Acid.tx, paddingVertical: 10, borderBottomWidth: 1.5, textAlign: 'center', width: '100%' },
  dual: { flexDirection: 'row', gap: 24 },
  unitLbl: { marginTop: 6, fontSize: Typography.fontSize.sm, fontWeight: '500' },

  toggle: { flexDirection: 'row', gap: 20 },
  togBtn: { paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  togActive: { borderBottomColor: Acid.lime },
  togTxt: { fontSize: Typography.fontSize.xs, letterSpacing: 1, fontWeight: Typography.fontWeight.bold },

  // Weight warning
  weightWarning: { fontSize: Typography.fontSize.sm, textAlign: 'center', marginTop: -12, marginBottom: 8 },

  // Picker
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 },
  pickerUnit: { fontSize: 18, fontWeight: '600', marginLeft: 4 },
  ageBadge: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  ageBadgeText: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semiBold },

  // Breakdown
  breakdownCard: { width: '100%', paddingTop: 12, marginBottom: 20, borderTopWidth: 1, borderTopColor: Acid.hair },
  breakdownTitle: { fontSize: 10, letterSpacing: 1.5, color: Acid.tx3, marginBottom: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Acid.hair },
  breakdownLabel: { fontSize: Typography.fontSize.sm, color: Acid.tx2 },
  breakdownValue: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semiBold, color: Acid.tx },

  // Result
  resultWrap: { width: '100%', alignItems: 'center' },
  resultGoal: { fontFamily: Acid.serifItalic, fontSize: 28, lineHeight: 36, color: Acid.tx, marginBottom: 4, textAlign: 'center' },
  resultGoalSub: { fontSize: Typography.fontSize.md, color: Acid.tx2, marginBottom: 24, textAlign: 'center' },
  calCard: { alignItems: 'center', paddingVertical: 16, width: '100%', marginBottom: 16 },
  calLabel: { fontSize: 10, letterSpacing: 2, color: Acid.tx3, marginBottom: 8, textTransform: 'uppercase' },
  calRow: { flexDirection: 'row', alignItems: 'baseline' },
  calNum: { fontFamily: Acid.serif, fontSize: 64, lineHeight: 68, color: Acid.lime },
  calUnit: { fontSize: Typography.fontSize.lg, color: Acid.tx3, marginLeft: 8 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginBottom: 28 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, minWidth: '45%' },
  chipLbl: { fontSize: Typography.fontSize.xs, color: Acid.tx3, marginBottom: 1 },
  chipVal: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semiBold, color: Acid.tx },

  // Macros
  macroTitle: { fontSize: 10, letterSpacing: 1.5, color: Acid.tx3, marginBottom: 12, alignSelf: 'flex-start' },
  macroBar: { width: '100%', height: 4, borderRadius: 2, flexDirection: 'row', overflow: 'hidden', backgroundColor: Acid.hair, marginBottom: 16 },
  macroSeg: { height: '100%' },
  macroRows: { width: '100%', gap: 10, marginBottom: 8 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  macroLblRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroDot: { width: 10, height: 10, borderRadius: 5 },
  macroName: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium, color: Acid.tx },
  macroVal: { fontSize: Typography.fontSize.sm, fontWeight: '500', color: Acid.tx2 },
  customizeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, width: '100%' },
  customizeTxt: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium, color: Acid.tx2 },

  editSection: { width: '100%', gap: 12, marginBottom: 8 },
  totalBadge: { alignSelf: 'flex-end', paddingVertical: 4 },
  totalTxt: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },
  editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Acid.hair },
  editControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  adjBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: Acid.hair2, alignItems: 'center', justifyContent: 'center' },
  editPct: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold, color: Acid.tx, width: 40, textAlign: 'center' },

  savBtn: { width: '100%', height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  savTxt: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold },
});
