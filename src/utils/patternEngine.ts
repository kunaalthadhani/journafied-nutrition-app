// Deterministic pattern detection. Every number in every finding is computed
// from the user's actual logs, nothing is estimated by a model, so nothing
// can be fabricated. Fix suggestions personalize by naming foods the user
// already eats. Confidence is a documented formula over sample size and
// effect size, not a self grade.

export interface EngineDay {
  date: string; // yyyy-MM-dd, local
  weekday: number; // 0=Sun..6=Sat
  // hour is -1 when the log time is not trustworthy as an eating time
  // (backfilled onto a past date, or a batch logging session)
  meals: { hour: number; calories: number; protein: number; foods: { name: string; protein: number }[] }[];
  totalCalories: number;
  totalProtein: number;
}

export interface EngineInput {
  days: EngineDay[]; // logged settled days only, today excluded, oldest to newest
  windowDays: number; // calendar span the days were gathered from
  calorieTarget?: number;
  proteinTarget?: number;
  bankEnabled: boolean;
}

export interface EngineFinding {
  key: string; // stable per detector, dismissal suppresses the detector
  type: 'trigger' | 'correlation' | 'outcome';
  title: string;
  description: string;
  fix: string; // empty string when there is nothing to fix
  confidence: number; // computed, capped at 95
  dataPoints: number;
  priority: number; // internal ranking, higher shows first
}

// Overeating threshold: with banking on, a day over base target may be
// intentional spending, so only clearly over days count.
const overeatCutoff = (target: number, bankEnabled: boolean) =>
  bankEnabled ? target * 1.15 : target;

// Confidence: 50 base + 1.5 per supporting day + 25 x effect size (capped),
// capped at 95. No floor: a weak signal reads weak. Documented so it stays honest.
const conf = (samples: number, effect: number) =>
  Math.min(95, Math.round(50 + samples * 1.5 + Math.min(1, effect) * 25));

// A day's meal times are only usable when none were flagged unreliable.
const hoursTrusted = (d: EngineDay) => d.meals.every(m => m.hour >= 0);

// The user's own protein movers: foods they already eat that carry protein.
// Used to make fixes personal instead of generic advice.
function proteinFoods(days: EngineDay[]): string[] {
  const agg = new Map<string, { protein: number; count: number }>();
  for (const d of days) {
    for (const m of d.meals) {
      for (const f of m.foods) {
        const cur = agg.get(f.name) || { protein: 0, count: 0 };
        cur.protein += Number.isFinite(f.protein) ? f.protein : 0;
        cur.count += 1;
        agg.set(f.name, cur);
      }
    }
  }
  return [...agg.entries()]
    .filter(([, v]) => v.count >= 2 && v.protein / v.count >= 12)
    .sort((a, b) => b[1].protein / b[1].count - a[1].protein / a[1].count)
    .slice(0, 2)
    .map(([name]) => name);
}

function detectWeekend(i: EngineInput): EngineFinding | null {
  if (!i.calorieTarget) return null;
  const weekend = i.days.filter(d => d.weekday === 6 || d.weekday === 0);
  const weekdays = i.days.filter(d => d.weekday !== 6 && d.weekday !== 0);
  if (weekend.length < 3 || weekdays.length < 5) return null;
  const avgW = weekend.reduce((s, d) => s + d.totalCalories, 0) / weekend.length;
  const avgD = weekdays.reduce((s, d) => s + d.totalCalories, 0) / weekdays.length;
  if (!(avgD > 0)) return null;
  const lift = (avgW - avgD) / avgD;
  if (!(lift >= 0.15)) return null;
  return {
    key: 'weekend-lift',
    type: 'trigger',
    title: `Weekends run ${Math.round(lift * 100)}% heavier than your weekdays`,
    description: `Across your last ${weekend.length} logged weekend days you averaged ${Math.round(avgW).toLocaleString()} kcal, against ${Math.round(avgD).toLocaleString()} on ${weekdays.length} weekdays.`,
    fix: i.bankEnabled
      ? `Your calorie bank already fits this: keep banking a little Monday to Thursday and the weekend stays covered on purpose.`
      : `Plan the weekend like it's real: bank a couple hundred calories on weekdays, or turn on the weekly calorie bank and let it do the math.`,
    confidence: conf(weekend.length + weekdays.length, lift),
    dataPoints: weekend.length + weekdays.length,
    priority: 60 + Math.min(1, lift) * 100,
  };
}

function detectLateNight(i: EngineInput): EngineFinding | null {
  const qualifying = i.days.filter(d => d.totalCalories > 0 && hoursTrusted(d));
  if (qualifying.length < 7) return null;
  const lateCals = (d: EngineDay) =>
    d.meals.filter(m => m.hour >= 21 || m.hour < 4).reduce((s, m) => s + m.calories, 0);
  const lateDays = qualifying.filter(d => lateCals(d) / d.totalCalories >= 0.25);
  if (lateDays.length < 5 || lateDays.length / qualifying.length < 0.4) return null;
  const share = lateDays.length / qualifying.length;
  const totalLate = qualifying.reduce((s, d) => s + lateCals(d), 0);
  const totalAll = qualifying.reduce((s, d) => s + d.totalCalories, 0);
  const overallPct = Math.round((totalLate / totalAll) * 100);
  return {
    key: 'late-night',
    type: 'trigger',
    title: `Late nights carry ${overallPct}% of your calories`,
    description: `On ${lateDays.length} of your last ${qualifying.length} logged days, a quarter or more of the day's calories came after 9pm or past midnight.`,
    fix: `Move one of those late portions to an afternoon snack. Same food, earlier clock, easier sleep and hunger control.`,
    confidence: conf(lateDays.length, share),
    dataPoints: qualifying.length,
    priority: 55 + share * 40,
  };
}

function detectProteinShortfall(i: EngineInput): EngineFinding | null {
  if (!i.proteinTarget || i.proteinTarget <= 0) return null;
  const qualifying = i.days;
  if (qualifying.length < 7) return null;
  const shortDays = qualifying.filter(d => d.totalProtein < i.proteinTarget! * 0.7);
  const rate = shortDays.length / qualifying.length;
  if (shortDays.length < 5 || rate < 0.5) return null;
  const avgGap = Math.round(
    shortDays.reduce((s, d) => s + (i.proteinTarget! - d.totalProtein), 0) / shortDays.length
  );
  const movers = proteinFoods(i.days);
  const moverFix =
    movers.length === 2
      ? `You already eat ${movers[0]} and ${movers[1]}. One more serving of either closes most of that ${avgGap}g gap.`
      : movers.length === 1
        ? `You already eat ${movers[0]}. One more serving closes most of that ${avgGap}g gap.`
        : `Add one high protein item to your usual day. About ${avgGap}g extra covers the gap.`;
  return {
    key: 'protein-short',
    type: 'outcome',
    title: `Protein misses target on most days`,
    description: `${shortDays.length} of your last ${qualifying.length} logged days landed under 70% of your ${Math.round(i.proteinTarget)}g protein target, short by about ${avgGap}g on those days.`,
    fix: moverFix,
    confidence: conf(shortDays.length, rate),
    dataPoints: qualifying.length,
    priority: 70 + rate * 30,
  };
}

function detectBreakfastCorrelation(i: EngineInput): EngineFinding | null {
  if (!i.calorieTarget) return null;
  const cutoff = overeatCutoff(i.calorieTarget, i.bankEnabled);
  const withBreakfast = i.days
    .map(d => {
      if (!hoursTrusted(d)) return null;
      const first = [...d.meals].sort((a, b) => a.hour - b.hour).find(m => m.hour >= 5);
      return first && first.hour < 11 ? { d, breakfastProtein: first.protein } : null;
    })
    .filter(Boolean) as { d: EngineDay; breakfastProtein: number }[];
  const low = withBreakfast.filter(x => x.breakfastProtein < 20);
  const high = withBreakfast.filter(x => x.breakfastProtein >= 20);
  if (low.length < 4 || high.length < 4) return null;
  const overRate = (g: typeof low) => g.filter(x => x.d.totalCalories > cutoff).length / g.length;
  const gap = overRate(low) - overRate(high);
  if (!(gap >= 0.3)) return null;
  const lowOver = low.filter(x => x.d.totalCalories > cutoff).length;
  const highOver = high.filter(x => x.d.totalCalories > cutoff).length;
  const movers = proteinFoods(i.days);
  return {
    key: 'breakfast-protein',
    type: 'correlation',
    title: `Low protein breakfasts predict your over days`,
    description: `You went over target on ${lowOver} of ${low.length} days that started with under 20g of protein, but only ${highOver} of ${high.length} days that started with 20g or more.`,
    fix: movers.length > 0
      ? `Start the day with ${movers[0]} and the evening tends to take care of itself.`
      : `Put 20g of protein in the first meal and the evening tends to take care of itself.`,
    confidence: conf(withBreakfast.length, gap),
    dataPoints: withBreakfast.length,
    priority: 80 + gap * 40,
  };
}

function detectRebound(i: EngineInput): EngineFinding | null {
  if (!i.calorieTarget || i.days.length < 8) return null;
  const byDate = new Map(i.days.map(d => [d.date, d]));
  const dates = i.days.map(d => d.date).sort();
  const reboundDays: EngineDay[] = [];
  for (const d of i.days) {
    const prev = new Date(d.date + 'T12:00:00');
    prev.setDate(prev.getDate() - 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
    // previous calendar day inside the window but never logged
    if (!byDate.has(prevKey) && prevKey >= dates[0]) reboundDays.push(d);
  }
  if (reboundDays.length < 3) return null;
  const avgAll = i.days.reduce((s, d) => s + d.totalCalories, 0) / i.days.length;
  const avgRebound = reboundDays.reduce((s, d) => s + d.totalCalories, 0) / reboundDays.length;
  if (!(avgAll > 0)) return null;
  const lift = (avgRebound - avgAll) / avgAll;
  if (!(lift >= 0.2)) return null;
  return {
    key: 'skip-rebound',
    type: 'outcome',
    title: `Days after a skipped day run ${Math.round(lift * 100)}% heavier`,
    description: `On the ${reboundDays.length} days that followed an unlogged day, you averaged ${Math.round(avgRebound).toLocaleString()} kcal against your overall ${Math.round(avgAll).toLocaleString()}.`,
    fix: `Skipped days hide, they don't help. Even a rough one line log on busy days keeps the next day honest.`,
    confidence: conf(reboundDays.length, lift),
    dataPoints: i.days.length,
    priority: 50 + Math.min(1, lift) * 60,
  };
}

function detectConsistencyWin(i: EngineInput): EngineFinding | null {
  if (!i.calorieTarget) return null;
  const last7 = i.days.slice(-7);
  if (last7.length < 5) return null;
  const onTarget = last7.filter(
    d => Math.abs(d.totalCalories - i.calorieTarget!) <= i.calorieTarget! * 0.1
  );
  if (onTarget.length < 4) return null;
  return {
    key: 'consistency-win',
    type: 'outcome',
    title: `You're in a groove`,
    description: `${onTarget.length} of your last ${last7.length} logged days landed within 10% of target. That consistency is what actually moves the scale. Whatever this week's routine is, protect it.`,
    fix: ``,
    confidence: conf(onTarget.length, onTarget.length / last7.length),
    dataPoints: last7.length,
    priority: 30 + onTarget.length * 4,
  };
}

const DETECTORS = [
  detectBreakfastCorrelation,
  detectProteinShortfall,
  detectWeekend,
  detectLateNight,
  detectRebound,
  detectConsistencyWin,
];

// excludeKeys: detectors under a dismissal hold, filtered out BEFORE the top-3
// cut so a held detector never blocks a live one from surfacing.
export function detectPatterns(input: EngineInput, excludeKeys?: Set<string>): EngineFinding[] {
  const findings: EngineFinding[] = [];
  for (const det of DETECTORS) {
    try {
      const f = det(input);
      if (f && !excludeKeys?.has(f.key)) findings.push(f);
    } catch {
      // one broken detector must never take down the rest
    }
  }
  return findings.sort((a, b) => b.priority - a.priority).slice(0, 3);
}
