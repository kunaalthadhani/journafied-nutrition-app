# PRD: Calorie Bank

Owner: Kunaal Thadhani. Status: draft (documents shipped behavior + proposes next). Version: 1.0. Last updated: 2026-06-08.

Related: [STRATEGY.md](STRATEGY.md), [METRICS.md](METRICS.md). Engine: [src/utils/calorieBankEngine.ts](../../src/utils/calorieBankEngine.ts).

---

## TL;DR

The Calorie Bank turns a rigid daily calorie limit into a weekly budget you can flex. Eat under your target on quiet days and you bank the difference. Those banked calories raise your targets later in the week, so a Friday dinner out does not feel like failure. Eat over and the bank absorbs it by trimming your remaining days. It is the feature that makes TrackKcal feel like a coach who gets that life is weekly, not a calculator that punishes one big meal.

Premium only. Live and shipped. This doc records how it works and proposes where it goes next.

## The problem

Daily calorie limits break the way real people eat. Nobody eats the same amount every day. You eat light at your desk Monday to Thursday and then there is a dinner Friday. A daily-cap app marks Friday red and calls you a failure, even if your week averaged out fine. That red mark is a top reason people quit trackers in week one. The unit of real eating is the week. The unit of most apps is the day. The Calorie Bank closes that gap.

## Why it matters strategically

This is a flagship differentiator, one of the two features that move TrackKcal from "another logger" to "AI nutritionist." MyFitnessPal does not do this. It rewards consistency without demanding rigidity, which is exactly the behavior change a nutrition coach is supposed to produce. See the wedge in [STRATEGY.md](STRATEGY.md).

## Goals and non-goals

**Goals**
- Make a single over-target day feel survivable, not like failure.
- Reward genuine weekly discipline with real flexibility.
- Keep the user safe: never let the mechanic push intake to an unhealthy floor.
- Lean the math toward the user's goal, not away from it.

**Non-goals**
- Not a macro-cycling or carb-cycling tool.
- Not a multi-week rollover system. The bank resets each cycle on purpose.
- Not on by default. It is an opt-in power feature for engaged users.
- Not applied to today. Today is always live and unsettled.

## Success metrics (proposed, see METRICS.md)

The bank earns its keep only if it lifts retention for the users who turn it on.

- **Primary**: week-1 and week-4 retention of bank-on users vs comparable bank-off users. The bank should retain better or it is just complexity.
- **Adoption**: percent of eligible (premium) users who enable it, and percent who keep it on after 2 cycles.
- **Healthy usage**: bank utilization (spent / banked). Near 0 means they bank and never use it (no value felt). Near 100 every week may mean they treat it as license to overeat. A healthy middle is the target.
- **Guardrail**: percent of days the floor clamp triggers. If high, the caps or the messaging are wrong.

## Target user and core use cases

The engaged premium user who already logs consistently and wants flexibility, not stricter rules.

1. **The planned blowout.** Eats light Mon to Thu, banks calories, has them available for a Friday dinner without going red.
2. **The recovery.** Overate yesterday. Opens the app today and sees the week absorbed it by trimming the next few days a little, instead of one catastrophic red day.
3. **The maintainer.** Wants a weekly average to hold steady and does not care about any single day.

## How it works (shipped behavior)

A cycle is 7 days, starting on a day the user picks (default configurable). Everything derives from one pure function, `calculateCurrentCycle`, recomputed on every render. No stored running totals to drift.

### The core loop

- Each user has a **base daily target** from their goals.
- For each **past completed day**:
  - Ate under target → **bank** the difference, capped at `dailyCapPercent` of base (user picks 15, 20, or 25 percent).
  - Ate over target → **spend** from the bank, capped at `spendingCapPercent` of base.
- **Bank balance** = total banked minus total spent, floored at 0.
- **Future days and today** get an **adjusted target**: the base plus or minus a redistribution of the week's position, spread evenly across the days remaining.

### The deliberate asymmetry (call this out in interviews)

The redistribution is intentionally not symmetric.

- If the user **overate** across the week, future targets drop by the **full** overspend, uncapped.
- If the user **underate**, future targets rise only by the **capped** bank balance.

Translation: it is easy to lose banked headroom and hard to game the system. The math always leans toward the goal, never away from it. This is a safety and integrity choice, not an accident. It is what stops the bank from becoming a license to overeat.

### Safety floors and ceilings

- Adjusted target never drops below **max(70% of base, gender floor)**, where the gender floor is 1,500 for men and 1,200 for women. The bank can never starve a user.
- Adjusted target never rises above **base plus the spending cap**.
- Macros (protein, carbs, fat) scale proportionally with the adjusted target.

### Honest defaults for missing data

- A **past day with no logs** is assumed to be "ate exactly target." No bank, no penalty. We do not punish a user for forgetting to log, and we do not hand out free banked calories for an empty day.
- **Today** uses live logged intake for display but is never banked or spent. Today is unsettled. (This is an architecture non-negotiable, see CLAUDE.md.)

### Goal-aware logic

For a **gain** goal the logic flips. Eating over target banks the extra surplus, eating under spends it. The same engine serves lose, maintain, and gain.

### Partial first cycle

If the user enables the bank mid-week, the first cycle starts on the enable date, not the cycle's natural start. So they are never judged on days before the feature existed.

### Cycle end

At reset the cycle is archived with utilization, expired calories (banked but unspent, which do not roll over), peak balance, and cap-hit counts. Unspent banked calories **expire**. The reset is a fresh start.

## Settings (shipped)

- Enable / disable.
- Cycle start day (Sun to Sat).
- Daily banking cap: 15, 20, or 25 percent of base.
- Spending cap: 15, 20, or 25 percent of base.
- A 3-card onboarding the first time it is enabled.

## Surfaces (shipped)

- **Home calorie card, bank mode**: a 4-column layout, Food, Banked, Surplus, Remaining, replacing the default Food/Exercise/Remaining.
- **Weekly bank card**: weekly budget, actual, balance, days remaining.
- **Settings**: the controls above.
- Premium gated throughout. Bank data shows only when `isPremium` is true (plan premium AND a signed-in account with email).

## Dependencies and constraints

- **Premium gating** is load-bearing. No bank UI or math for free or signed-out users.
- **Never calculate today.** The engine only banks and spends on past completed days.
- **Local-first.** Config and summaries are local, synced in the background. The engine is pure and runs on local data.
- Goals must exist. With no goals set, there is no base target and the bank cannot run.

## Risks and open questions

1. **Comprehension.** This is the most conceptually complex feature in the app. If users do not understand banked vs surplus vs remaining, they distrust the numbers. The recent card-math fix (v1.2.6) closed one contradiction. Open question: does the 3-card onboarding actually land, and can we measure that.
2. **Gaming and health.** The asymmetry and floors are the defense. Open question: are the default caps right, and do we ever see the floor clamp firing often enough to worry.
3. **Expiry feels bad.** Banked calories expiring at cycle end is correct design but may read as "you lost something." Open question: is the cycle-end summary framed as a win or a loss.
4. **Adoption depth.** Is the bank actually retaining the users who turn it on, or is it complexity that a minority loves. The metric above answers this. We are not yet measuring it.

## Future iterations (proposed, not committed)

- **v1.1 Comprehension**: instrument bank onboarding completion and first-week bank usage. Prove people understand it before building more.
- **v1.2 Proactive coaching**: the AI coach references the bank. "You have 600 banked. Friday dinner is covered." Turns a passive ledger into active guidance, which is the whole brand.
- **v1.3 End-of-cycle story**: a weekly recap that frames the cycle as progress, not expiry, with one insight.
- **Later**: smarter redistribution (weight the increase toward the user's known heavy day instead of spreading evenly).

## Glossary

- **Base daily target**: the user's normal daily calorie goal.
- **Banked**: calories saved from eating under target on a past day, capped.
- **Spent / Surplus**: calories used by eating over target on a past day, capped for the bank, uncapped for the redistribution penalty.
- **Bank balance**: banked minus spent, floored at 0.
- **Adjusted target**: today's or a future day's target after redistribution.
- **Cycle**: a 7-day window. Resets and does not roll over.
- **Utilization**: spent divided by banked, a read on whether the bank is actually used.
