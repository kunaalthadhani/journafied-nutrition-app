/**
 * The diets a user can follow, and what each one means to the rest of the app.
 *
 * A plan does two things. It sets the macro split, because keto with a 45 per
 * cent carb target is not keto, it is a broken number on the home screen. And
 * it gives every AI prompt a rule to obey, so the coach never offers chicken to
 * a vegan or rice to someone in ketosis.
 *
 * This is a diet, not a restriction. Allergies, intolerances and religious
 * requirements are a separate, multi select, safety shaped problem and do not
 * belong on this single choice.
 */

export type DietPlanId =
  | 'none'
  | 'high_protein'
  | 'low_carb'
  | 'keto'
  | 'mediterranean'
  | 'vegetarian'
  | 'vegan';

export interface DietPlan {
  id: DietPlanId;
  label: string;
  hint: string;
  macros: { protein: number; carbs: number; fat: number };
  /** Handed to every prompt verbatim. Empty means the AI has nothing to obey. */
  rule: string;
}

export const DIET_PLANS: DietPlan[] = [
  {
    id: 'none',
    label: 'No specific plan',
    hint: 'A balanced split, nothing off limits',
    macros: { protein: 30, carbs: 45, fat: 25 },
    rule: '',
  },
  {
    id: 'high_protein',
    label: 'High protein',
    hint: 'Protein first, built around holding muscle',
    macros: { protein: 40, carbs: 35, fat: 25 },
    rule: 'They eat high protein. Protein is the number you lead with, and every meal you suggest carries a real amount of it.',
  },
  {
    id: 'low_carb',
    label: 'Low carb',
    hint: 'Fewer carbs, more protein and fat',
    macros: { protein: 35, carbs: 20, fat: 45 },
    rule: 'They eat low carb. Keep suggestions light on bread, rice, pasta and sugar, and lean on protein and fat instead.',
  },
  {
    id: 'keto',
    label: 'Keto',
    hint: 'Very low carb, high fat',
    macros: { protein: 25, carbs: 5, fat: 70 },
    rule: 'They are ketogenic. Net carbs have to stay very low, roughly under 30g a day. Never suggest bread, rice, pasta, potatoes, sugar or fruit beyond a few berries. If a logged day breaks ketosis, say so plainly.',
  },
  {
    id: 'mediterranean',
    label: 'Mediterranean',
    hint: 'Olive oil, fish, vegetables, whole grains',
    macros: { protein: 25, carbs: 45, fat: 30 },
    rule: 'They eat Mediterranean. Favour olive oil, fish, legumes, vegetables, nuts and whole grains. Red meat and processed food are occasional, not daily.',
  },
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    hint: 'No meat or fish. Eggs and dairy are in',
    macros: { protein: 25, carbs: 50, fat: 25 },
    rule: 'They are vegetarian. Never suggest meat, poultry or fish. Eggs and dairy are fine. Watch their protein, it is the number vegetarians miss.',
  },
  {
    id: 'vegan',
    label: 'Vegan',
    hint: 'No animal products at all',
    macros: { protein: 25, carbs: 50, fat: 25 },
    rule: 'They are vegan. Never suggest any animal product, including eggs, dairy, honey, whey or gelatin. Watch their protein and B12.',
  },
];

export const getDietPlan = (id?: string | null): DietPlan =>
  DIET_PLANS.find(p => p.id === id) || DIET_PLANS[0];

/** One entry per switch, oldest first. Written by dataStorage.saveGoals. */
export interface DietChange {
  from: DietPlanId;
  to: DietPlanId;
  changedAt: string; // ISO
}

/** What the coach is told about a switch, and only while it still matters. */
export interface DietContext {
  plan: string;
  rule: string;
  switchedFrom?: string;
  daysOnPlan?: number;
}

// A switch three months ago is just their diet. A switch on Tuesday is the
// single most useful thing in the context, because it explains the numbers.
export const DIET_SWITCH_RELEVANT_DAYS = 30;

export const buildDietContext = (
  planId: string | null | undefined,
  history: DietChange[] = [],
  now: Date = new Date(),
): DietContext | undefined => {
  const plan = getDietPlan(planId);
  const last = history[history.length - 1];

  // No rule and no recent switch means there is nothing worth a prompt section.
  // Coming off a diet is still worth saying, so a switch to 'none' survives.
  const days = last
    ? Math.floor((now.getTime() - new Date(last.changedAt).getTime()) / 86400000)
    : null;
  const recent = last && days !== null && days <= DIET_SWITCH_RELEVANT_DAYS && last.to === plan.id;

  if (!plan.rule && !recent) return undefined;

  return {
    plan: plan.label,
    rule: plan.rule,
    ...(recent ? { switchedFrom: getDietPlan(last.from).label, daysOnPlan: days! } : {}),
  };
};

/**
 * The line every prompt gets. Returns null when there is nothing to say, so
 * callers can leave the section out entirely rather than printing "none".
 */
export const dietPromptLine = (id?: string | null): string | null => {
  const plan = getDietPlan(id);
  if (!plan.rule) return null;
  return `${plan.label}: ${plan.rule}`;
};
