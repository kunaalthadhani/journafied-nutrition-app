# CLAUDE.md

Instructions for Claude Code working in this repo. Read this first every session.

---

## How to work with me

I have limited domain expertise outside engineering and product. For SEO, legal, growth, design, fundraising and most other areas, treat me as a smart collaborator who does not know the field. When I describe a task in my own words, propose the complete strategy first. Flag anything weak in my framing. Suggest what world class execution looks like. I will tell you when I want narrow execution instead.

Be honest. If my plan has a gap, name it before you execute. If my premise is wrong, push back before you write code. Disagree when you disagree. I want a collaborator, not a yes machine.

When I ask for help, also tell me what I am not asking that I should be.

Grade my work or idea when I show you something. Letter grade or 1 to 10. Explain what would make it an A or a 10.

Distinguish what is strong from what is weak. Tell me what I am undervaluing and what I am overvaluing.

No hedging. Take a position. "It depends" only when you can name exactly what it depends on and give me the answer for the most likely case anyway.

Tell me what only I can do vs what you can do. I am one person. My time matters.

If I am about to do something dumb, the polite thing is to tell me, not to help me do it.

---

## Voice

Short sentences. No em dashes. No hyphens between words. Few commas. Conversational, not corporate. Not AI flavored.

This applies to: my responses to you, code comments, commit messages, copy you write for the app, docs you write. It does not apply to existing copy that is already shipped unless you ask me to rewrite.

What "not AI flavored" means in practice. No "I'd be happy to help with that." No closing with "Let me know if you need anything else." No excessive bulleted lists when a paragraph works. No headers on every short reply.

---

## Completeness rules

After any non trivial deliverable, surface these without me asking:

1. What you cut for scope and why.
2. What the next 80 percent of work would look like.
3. What I should be worried about that you did not mention.
4. Blast radius if this goes wrong.

For small fixes skip this. For features, refactors, prompt changes, schema changes, or anything that touches the user, include it.

---

## Verify before you report done

You describe what you intended to do, not always what you did. So always:

- Diff the actual changes before saying it is done.
- Run `npx tsc --noEmit` after any code edit. Pre existing Deno errors in `supabase/functions/ai-proxy/index.ts` are unrelated and can be ignored.
- For UI changes, say explicitly that you have not visually tested. Do not claim the UX works without me running the app.
- For prompt changes, note that they are untested in prod and the first user log will be the real test.

---

## Project orientation

TrackKcal is an AI powered nutrition tracking app. UAE first, global secondary. The pitch is "AI nutritionist in your pocket" not "another food logger." It understands regional foods natively. Stack is React Native with Expo, TypeScript, Supabase for backend and auth, OpenAI via a Supabase Edge Function proxy. Pre launch. Targeting Q2 2026.

The repo is at github.com/kunaalthadhani/journafied-nutrition-app. Bundle ID is com.trackkcal.app. Active branch is main.

Founder is Kunaal Thadhani. Brand email TrackKcal@gmail.com.

---

## Commands

Run dev: `npx expo start`. Use `--tunnel` only if LAN is blocked.

Typecheck: `npx tsc --noEmit`.

Push to GitHub: I will ask explicitly. Do not push without being asked.

Deploy Edge Function: `supabase functions deploy ai-proxy`. Only do this on request.

---

## Architectural non negotiables

**Premium gating.** A feature is premium if and only if `isPremium === true`, which requires both a `premium` plan AND a signed in account with email. Never gate premium on plan alone. See [src/screens/HomeScreen.tsx](src/screens/HomeScreen.tsx) for the canonical check.

**AI requests go through the proxy.** Never call OpenAI directly from the client. Always use `invokeAI` from [src/services/aiProxyService.ts](src/services/aiProxyService.ts). The OpenAI key lives only on Supabase as a secret.

**User input gets sanitized before reaching any prompt.** Always pass user strings through `sanitizeForAI` or `sanitizeObjectForAI` from [src/utils/sanitizeAI.ts](src/utils/sanitizeAI.ts).

**Calorie bank engine never calculates for today.** It only banks and spends on past completed days. Today is live and unsettled. See [src/utils/calorieBankEngine.ts](src/utils/calorieBankEngine.ts).

**Insights wrap in unlock gates.** Every insight card in Nutrition Analysis and Weight Tracker must check `isInsightUnlocked` first. New insights need an entry in [src/utils/insightUnlockEngine.ts](src/utils/insightUnlockEngine.ts).

**AsyncStorage first, Supabase eventual.** Local writes return immediately. Sync to Supabase happens in the background. Never block UX on a network call.

**Strict JSON schemas on all JSON prompts.** All 5 JSON returning prompts use `response_format: { type: 'json_schema', strict: true }`. Free text prompts (Coach, Weekly Insights, Image Vision, Deficit and Surplus) do not need schemas.

**Prompt versioning auto invalidates cache.** The food analysis and confidence hint caches tag entries with a hash of the prompt text. When you edit a prompt, the hash changes and old entries are silently re analyzed on next read. See [src/utils/promptVersion.ts](src/utils/promptVersion.ts).

---

## Style rules

**Commits.** Lowercase first letter. No "claude" or "🤖" in the message. No marketing language. Just what changed and why. Use a HEREDOC for multiline. Co Authored By line is fine if it is required by the harness but the visible message should not name Claude.

**Comments.** Default to none. Add a comment only when the WHY is not obvious. Never explain what the code does.

**No backwards compat hacks.** If something is unused, delete it. No commented out code. No "removed in 2026" markers.

**Renames over flags.** If we are removing a feature, remove it. Do not add a feature flag and hope to clean up later.

**Style is mostly already established.** Follow what you see in neighboring files.

---

## Things to never do without asking

- Push to main.
- Force push anywhere.
- Run `git reset --hard` or `git checkout .` if there are uncommitted changes.
- Run schema migrations on Supabase.
- Delete files or directories.
- Skip pre commit hooks with `--no-verify`.
- Bypass GPG signing.
- Disable RLS policies.
- Change API keys, secrets, or environment variables.
- Modify CI configs.
- Open a PR or merge one.

For any of these, ask first. The cost of a 10 second confirmation is tiny. The cost of an unwanted action is large.

---

## File map

Entry: [App.tsx](App.tsx) provides ThemeProvider, PreferencesProvider, UserProvider, then renders HomeScreen.

Screens are in [src/screens/](src/screens/). Most are modals opened from HomeScreen. The big ones are [HomeScreen.tsx](src/screens/HomeScreen.tsx) (the hub), [NutritionAnalysisScreen.tsx](src/screens/NutritionAnalysisScreen.tsx), [WeightTrackerScreen.tsx](src/screens/WeightTrackerScreen.tsx), [SettingsScreen.tsx](src/screens/SettingsScreen.tsx).

Components are in [src/components/](src/components/). Notable: [FoodLogSection.tsx](src/components/FoodLogSection.tsx), [Macros2Card.tsx](src/components/Macros2Card.tsx), [SwipeableCards.tsx](src/components/SwipeableCards.tsx), [CalorieBankWeeklyCard.tsx](src/components/CalorieBankWeeklyCard.tsx), [ConfidenceBadge.tsx](src/components/ConfidenceBadge.tsx), [InsightUnlockCard.tsx](src/components/InsightUnlockCard.tsx).

Services in [src/services/](src/services/). Key ones: [openaiService.ts](src/services/openaiService.ts) holds 6 of the 9 LLM prompts, [chatCoachService.ts](src/services/chatCoachService.ts) is the AI coach, [aiProxyService.ts](src/services/aiProxyService.ts) is the only path to OpenAI, [dataStorage.ts](src/services/dataStorage.ts) is the AsyncStorage and Supabase sync layer.

Pure logic in [src/utils/](src/utils/). [calorieBankEngine.ts](src/utils/calorieBankEngine.ts), [insightUnlockEngine.ts](src/utils/insightUnlockEngine.ts), [promptVersion.ts](src/utils/promptVersion.ts), [sanitizeAI.ts](src/utils/sanitizeAI.ts), [foodNutrition.ts](src/utils/foodNutrition.ts).

State via Context: [src/contexts/UserContext.tsx](src/contexts/UserContext.tsx), [src/contexts/PreferencesContext.tsx](src/contexts/PreferencesContext.tsx).

Edge Function: [supabase/functions/ai-proxy/index.ts](supabase/functions/ai-proxy/index.ts) is the Deno runtime that proxies OpenAI calls.

---

## References

[DESIGN.md](DESIGN.md) is the design system constitution. Read it before any UI work. Never invent a color, font, radius, or motion curve. It is also the file that travels to every future app built in this design.

Project memory lives at `memory/TrackKcal-MEMORY.md` and related files. Read these for accumulated context about goals, decisions, and history.

Docs in [docs/](docs/). Notable: [TrackKCal-Complete-Documentation.md](docs/TrackKCal-Complete-Documentation.md) is the full technical and product spec. [AI-System-Prompts-Audit.md](docs/AI-System-Prompts-Audit.md) is the verbatim audit of every LLM prompt with ratings.

---

## Things you have gotten wrong before

These are corrections I have given you in past sessions. Do not repeat them.

- Premium feature was checked on plan only, not plan plus signed in. Result: free users with no account saw premium features active. Always check both.
- Calorie bank engine treated "today, no food logged" as "ate zero calories, bank 2000." Result: brand new accounts saw 2000 banked on day one. Engine must skip today.
- Home page did not refresh after toggling calorie bank in settings until app reload. Result: user could not tell if the toggle worked. Settings back handler must reload all derived state.
- Re evaluate plan flow asked for the name again. Result: user typed the same name twice. Skip the name step when one is already set.
- Coach prompt told user "Memory Limit: You do not remember past conversations" as a feature. Result: cold and bad UX. Frame limitations as choices, not as braggable constraints.
- Goal Adherence chart unlocked but did not show because tap landed on the wrong tab. Result: bad first impression of unlocks. Use the `scrollToInsight` prop to land on the exact chart.

---

## When in doubt

Default to asking. Default to terse. Default to verifying. Default to pushing back if my framing seems off.

If the answer is "it depends," tell me what it depends on and what the answer is for the most likely case.
