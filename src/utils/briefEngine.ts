// The daily brief: one proactive sentence for the coach line on Home, picked
// by priority from everything the app already computes. Pure and deterministic,
// no AI call. The honesty law applies: when nothing is worth saying, say
// something small and true instead of manufacturing profundity.

export interface BriefInput {
  goalsSet: boolean;
  remaining: number; // bank-adjusted kcal left today (negative = over)
  mealsToday: number;
  exercisesToday: number;
  hourOfDay: number;
  proteinSoFar?: number;
  proteinTarget?: number;
  bankActive?: boolean;
  bankBalance?: number;
  bankRemainingDays?: number;
  patternTitle?: string;
  patternFix?: string;
  streak?: number;
  waterMl?: number;
  waterTargetMl?: number;
}

export interface Brief {
  text: string;
  kind: string;
}

const dayPhrase = (h: number) =>
  h < 12 ? 'the whole day ahead' : h < 17 ? 'the afternoon ahead' : 'the evening to go';

export function buildBrief(i: BriefInput): Brief {
  const nothingLogged = i.mealsToday === 0 && i.exercisesToday === 0;
  const over = Math.abs(Math.round(i.remaining));

  if (!i.goalsSet) {
    return { kind: 'setup', text: "Tell me what you ate or how you moved and I'll handle the rest." };
  }

  if (nothingLogged && i.hourOfDay >= 19 && (i.streak || 0) > 0) {
    return { kind: 'streak-risk', text: `Nothing logged and the day is closing. One meal keeps day ${(i.streak || 0) + 1} alive.` };
  }

  if (nothingLogged) {
    return { kind: 'start', text: "Nothing logged yet. Tell me your first meal and I'll pace your day." };
  }

  if (i.mealsToday === 0 && i.exercisesToday > 0) {
    return { kind: 'exercise-only', text: "Workout logged. Tell me what you eat and I'll balance the day." };
  }

  if (i.remaining < 0 && i.bankActive && (i.bankBalance || 0) >= over) {
    return { kind: 'bank-covered', text: `${over.toLocaleString()} over target, but your bank covers it. The week is still yours.` };
  }

  if (i.remaining < 0) {
    return { kind: 'over', text: `${over.toLocaleString()} kcal over today. Tomorrow starts a clean page.` };
  }

  if (
    i.hourOfDay >= 15 &&
    (i.proteinTarget || 0) > 0 &&
    (i.proteinSoFar || 0) < (i.proteinTarget || 0) * 0.5 &&
    i.remaining > 300
  ) {
    return {
      kind: 'protein-gap',
      text: `Protein sits at ${Math.round(i.proteinSoFar || 0)} of ${Math.round(i.proteinTarget || 0)}g with ${Math.round(i.remaining).toLocaleString()} kcal left. Make the next meal carry it.`,
    };
  }

  if (
    i.hourOfDay >= 15 &&
    (i.waterTargetMl || 0) > 0 &&
    (i.waterMl || 0) < (i.waterTargetMl || 0) * 0.4
  ) {
    const behind = ((i.waterTargetMl || 0) * 0.6 - (i.waterMl || 0)) / 1000;
    return { kind: 'water', text: `You're about ${Math.max(0.5, Math.round(behind * 2) / 2)}L behind on water. Two glasses catches you up.` };
  }

  if (i.bankActive && (i.bankBalance || 0) >= 200 && (i.bankRemainingDays || 0) >= 1 && (i.bankRemainingDays || 0) <= 2) {
    return {
      kind: 'bank-expiry',
      text: `${Math.round(i.bankBalance || 0).toLocaleString()} kcal banked and ${i.bankRemainingDays === 1 ? 'today is the last day' : '2 days left'}. Enjoy a bigger meal before the week resets.`,
    };
  }

  if (i.patternTitle) {
    return { kind: 'pattern', text: i.patternFix ? `${i.patternTitle}. ${i.patternFix}` : `${i.patternTitle}.` };
  }

  return { kind: 'pace', text: `${Math.round(i.remaining).toLocaleString()} kcal left with ${dayPhrase(i.hourOfDay)}.` };
}
