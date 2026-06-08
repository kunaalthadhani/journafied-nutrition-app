# TrackKcal Metrics Framework

What winning looks like in numbers, and whether you can measure it today. Owner: Kunaal Thadhani. Status: draft for review. Last updated: 2026-06-07.

---

## The one belief this rests on

A nutrition app is a habit business. Not a download business, not a feature business. If a user does not log in week one, they are gone, and no feature saves them. So every metric here points at one question: are people forming the habit, and are they keeping it.

## North Star Metric (proposed)

**Weekly Active Loggers: the count of users who logged food on 3 or more distinct days in the last 7.**

Why this one. It is not "active users" (opening the app is not value). It is not "meals logged" (one user spamming logs inflates it). Three days in a week is the threshold where the data becomes useful to the user and the habit starts to hold. If this number grows, the business is real. If it does not, nothing else matters.

Pick a single number to obsess over. This is my nominee. If you disagree, the act of arguing it is the PM work.

## The metric tree

North Star: Weekly Active Loggers
- driven by **Activation**: do new users reach the habit at all
- driven by **Retention**: do activated users stay
- driven by **Logging quality**: is the core action fast and correct
- output **Revenue**: do retained users pay
- output **Referral**: do they bring others

### Activation (the first 7 days decide everything)

- **Aha moment**: first successful AI log, food appears correctly from plain words, in the first session.
- **Activation event (proposed)**: logged on 3 distinct days within the first 7. This is the single strongest predictor of long-term retention for trackers.
- Watch: onboarding completion (goal set), time to first log, first-log success rate.

### Retention

- D1, D7, D30 retention.
- The curve that matters most: Week 1 to Week 2. If it bends flat, you have a real product. If it falls to zero, you have a leak no feature fixes.

### Logging quality (the wedge, in numbers)

- **Log success rate**: percent of log attempts that return food with no error and no "no entry detected." This is the wedge measured directly. If regional food fails, this drops, and so does retention.
- **Edit rate**: percent of logs the user had to correct. High edit rate means the AI is guessing wrong.
- Time from tap to logged.

### Revenue (when payments go live)

- Free to paid conversion. Today this is masked by the launch flag, so it is unmeasurable until real payments ship.
- AI cost per active user vs revenue per user. The app calls OpenAI on every log. If cost per retained user exceeds what they pay, the model is upside down. Track this from day one of payments.

### Referral

- Codes shared, codes redeemed, and the ratio (your K-factor). You already have the events.

## Targets (proposed, benchmark-based, your call)

These are consumer health/fitness benchmarks, not promises. Set your own line, but start here.

| Metric | Floor | Good | Strong |
|---|---|---|---|
| D1 retention | 30% | 40% | 50% |
| D7 retention | 15% | 22% | 28% |
| D30 retention | 8% | 12% | 18% |
| Activation (3 logs in 7 days) | 25% | 35% | 45% |
| Log success rate | 85% | 92% | 96% |
| Free to paid (post-payments) | 2% | 4% | 6% |

## Instrumentation reality check

I looked at the code. You are better instrumented than most pre-launch apps. This is the honest gap analysis.

**What you already track (Mixpanel, via analyticsService):** app open/close, meal logged (with date), exercise logged, weight logged, onboarding started / goal set / first meal logged, nutrition analysis and weight tracker opens, voice/camera/photo usage, subscription screen open, saved prompts, smart reminders (scheduled/opened/effective), referral lifecycle, and `identifyUser`.

So the events for activation, retention, and the funnel mostly exist already. Good.

**What to verify before you trust any number:**
1. **Anonymous to identified continuity.** Users log before they make an account. Confirm the pre-account device id is aliased to the user on signup, or your funnel breaks exactly where it matters most: the first session. This is the number one thing to check.
2. **Stable user identity** on every `trackMealLogged`, so retention cohorts are real and not fragmented.

**What is missing:**
1. **A logging quality event.** You do not currently distinguish a successful log from a failed or "no entry detected" one in analytics. Add a `food_log_result` event with a success/clarification/error/no-food property. Without it, you cannot measure the wedge.
2. **Revenue events.** No purchase / premium-activated event yet (fine, no payments live, but build it with payments).
3. **AI cost per user.** Not a client metric. Pull from the proxy / OpenAI usage and divide by active users.

**The actual work is not more events. It is reports.** Events firing into Mixpanel are not a dashboard. Nobody has built the retention cohort or the activation funnel yet. That is the gap between "we have data" and "we know."

## The one dashboard to build first

A single Mixpanel board with two things:
1. **Week 1 retention cohort** (new users by signup week, percent still logging each following week).
2. **Activation funnel**: install to goal set, to first successful log, to 3 logs in 7 days.

Build that before anything else. It answers the only question that matters right now: is this a business or a hobby. Everything in STRATEGY.md is a guess until this board is live.

## Open calls (Kunaal)

1. Confirm or replace the North Star.
2. Confirm the activation definition (3 logs in 7 days).
3. Set the real targets. Mine are benchmarks, not your ambition.
4. Decide who owns building the Mixpanel reports and by when.
