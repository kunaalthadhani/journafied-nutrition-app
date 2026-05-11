/**
 * Personalized micronutrient and macro target lookup.
 *
 * Inputs: age + sex (from the user's custom plan).
 * Outputs: per-day target for every nutrient TrackKcal tracks.
 *
 * Sources: NIH Office of Dietary Supplements DRI tables, AHA sodium guidance,
 * AI/AMDR for omega-3. US RDA. Same numbers used by Apple Health.
 *
 * All targets are per day unless noted. Two kinds:
 *   - "target": aim to reach this amount or more (vitamins, minerals, fiber, omega-3)
 *   - "limit":  stay under this amount (sodium, added sugars, saturated fat, cholesterol)
 *
 * When age or sex is unknown we fall back to adult-male defaults.
 * These are general population values. Pregnancy, lactation, and clinical
 * conditions are NOT factored in. The UI must show the "talk to a doctor"
 * disclaimer wherever these are surfaced.
 */

export type Sex = 'male' | 'female' | 'prefer_not_to_say';
export type TargetKind = 'target' | 'limit';

export interface MicroTarget {
  value: number;
  unit: 'g' | 'mg' | 'mcg';
  kind: TargetKind;
}

export interface MicroTargetSet {
  // macros and fiber
  protein_g: MicroTarget;       // computed elsewhere from weight + activity; we mirror it here for completeness
  dietary_fiber: MicroTarget;
  added_sugars: MicroTarget;
  saturated_fat: MicroTarget;

  // minerals
  sodium_mg: MicroTarget;
  potassium_mg: MicroTarget;
  calcium_mg: MicroTarget;
  iron_mg: MicroTarget;
  magnesium_mg: MicroTarget;
  zinc_mg: MicroTarget;
  cholesterol_mg: MicroTarget;

  // omega
  omega_3_g: MicroTarget;

  // vitamins
  vitamin_a_mcg: MicroTarget;
  vitamin_c_mg: MicroTarget;
  vitamin_d_mcg: MicroTarget;
  vitamin_b12_mcg: MicroTarget;
}

export interface MicroTargetInputs {
  age?: number;
  sex?: Sex;
  proteinGramsOverride?: number; // pulled from the user's custom calorie plan
}

const t = (value: number, unit: MicroTarget['unit'], kind: TargetKind = 'target'): MicroTarget => ({ value, unit, kind });

export function getMicroTargets(inputs: MicroTargetInputs): MicroTargetSet {
  const age = typeof inputs.age === 'number' && inputs.age > 0 ? inputs.age : 30;
  const sex: Sex = inputs.sex === 'female' ? 'female' : 'male'; // prefer_not_to_say falls back to male defaults
  const isMale = sex === 'male';
  const isAdult = age >= 19;
  const isElder = age >= 51;
  const isTeen = age >= 14 && age <= 18;

  // ── Fiber (Institute of Medicine) ──
  const fiber = isMale
    ? (age <= 50 ? 38 : 30)
    : (age <= 50 ? 25 : 21);

  // ── Calcium ──
  let calcium = 1000;
  if (age <= 18) calcium = 1300;
  else if (isMale && age <= 70) calcium = 1000;
  else if (!isMale && age <= 50) calcium = 1000;
  else calcium = 1200; // women 51+, men 71+

  // ── Iron ──
  // Women 19–50 need 18 mg. After menopause and for men, 8 mg.
  const iron = !isMale && age >= 19 && age <= 50 ? 18 : 8;

  // ── Magnesium ──
  let magnesium = 400;
  if (isMale) magnesium = age <= 30 ? 400 : 420;
  else magnesium = age <= 30 ? 310 : 320;
  if (isTeen) magnesium = isMale ? 410 : 360;

  // ── Zinc ──
  const zinc = isMale ? 11 : 8;

  // ── Potassium ──
  const potassium = isMale ? 3400 : 2600;

  // ── Omega-3 (total ALA + EPA + DHA, AI guidance) ──
  const omega3 = isMale ? 1.6 : 1.1;

  // ── Vitamin A ──
  const vitaminA = isMale ? 900 : 700;

  // ── Vitamin C ──
  const vitaminC = isMale ? 90 : 75;

  // ── Vitamin D ──
  const vitaminD = age >= 71 ? 20 : 15;

  // ── Vitamin B12 ──
  const vitaminB12 = 2.4;

  // ── Protein ──
  // If the user's custom plan already computed protein grams, use that.
  // Otherwise fall back to 0.8 g/kg using a default 70 kg body mass.
  const protein = inputs.proteinGramsOverride && inputs.proteinGramsOverride > 0
    ? inputs.proteinGramsOverride
    : Math.round(70 * 0.8);

  return {
    // macros
    protein_g: t(protein, 'g'),
    dietary_fiber: t(fiber, 'g'),
    added_sugars: t(50, 'g', 'limit'),     // AHA: 36 g men, 25 g women, but FDA Daily Value is 50 g. Using FDA.
    saturated_fat: t(20, 'g', 'limit'),    // 10% of 2000 kcal / 9 = 22 g, rounded to FDA Daily Value 20 g

    // minerals
    sodium_mg: t(2300, 'mg', 'limit'),     // FDA upper limit
    potassium_mg: t(potassium, 'mg'),
    calcium_mg: t(calcium, 'mg'),
    iron_mg: t(iron, 'mg'),
    magnesium_mg: t(magnesium, 'mg'),
    zinc_mg: t(zinc, 'mg'),
    cholesterol_mg: t(300, 'mg', 'limit'), // historic FDA limit, kept here as a soft ceiling

    // omega
    omega_3_g: t(omega3, 'g'),

    // vitamins
    vitamin_a_mcg: t(vitaminA, 'mcg'),
    vitamin_c_mg: t(vitaminC, 'mg'),
    vitamin_d_mcg: t(vitaminD, 'mcg'),
    vitamin_b12_mcg: t(vitaminB12, 'mcg'),
  };
}

/**
 * Format a value against its target as a percentage.
 * Returned as a whole number, clamped 0..999 so the UI does not explode on absurd inputs.
 */
export function percentOfTarget(actual: number | undefined, target: MicroTarget | undefined): number {
  if (!target || !target.value) return 0;
  const v = actual || 0;
  return Math.max(0, Math.min(999, Math.round((v / target.value) * 100)));
}

/**
 * Status bucket for color coding the UI.
 *   "deficient" — under 50% of a target
 *   "low"       — 50 to 80% of a target
 *   "on_track"  — 80 to 120% of a target, or under a limit
 *   "over"      — over 120% of a target, or over a limit
 *   "way_over"  — over 200% (mainly matters for sodium and vitamin A)
 */
export type MicroStatus = 'deficient' | 'low' | 'on_track' | 'over' | 'way_over';

export function statusFor(actual: number | undefined, target: MicroTarget | undefined): MicroStatus {
  if (!target) return 'on_track';
  const pct = percentOfTarget(actual, target);

  if (target.kind === 'limit') {
    if (pct < 80) return 'on_track';
    if (pct < 120) return 'over';
    return 'way_over';
  }

  if (pct < 50) return 'deficient';
  if (pct < 80) return 'low';
  if (pct <= 120) return 'on_track';
  if (pct <= 200) return 'over';
  return 'way_over';
}
