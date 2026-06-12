# TrackKcal version history

Plain English log of what changed in each version and why it matters to you. Newest first. The number in bold is the build version shown in Settings.

---

## Goal setup

**v1.4.13**
Hardened the goal calculator so it stops producing a wrong target. The date-of-birth and height steps now make you actually set them instead of quietly using a default age of 26 and 170cm, which had been feeding a wrong calorie number for anyone who tapped through. A blank or zero weight is no longer accepted. The name you type on the save-your-plan screen now sticks instead of reverting to what you typed earlier. And a rare case where a brand-new user's plan could vanish mid sign-in is closed.

**v1.4.12**
Fixed a small mismatch where your saved macro grams could be off by about one percent from your saved macro percentages. The grams now match the percentages exactly.

**v1.4.11**
Recalculating your plan no longer throws away macro changes. If you reopen the calculator and adjust your protein, carbs, or fat on the results screen, those tweaks now stick instead of silently reverting to your old split.

**v1.4.10**
When you change your goal, the app now updates your AI coach and Nutrition Analysis straight away. Before, they kept using your old calorie and macro targets until the next day, so right after you changed your plan they were quietly coaching you against the wrong numbers.

**v1.4.4**
Recalculating your plan used to forget half your profile. It re-asked your name, reset your birthday to a default (quietly making you 26), forgot your pace and activity, and if you use pounds it could even halve your weight. All of that is preserved correctly now.

## AI Coach

**v1.4.9**
Gave the coach a personality. It used to talk like a cold lab instrument. Now it is a tough-love coach: blunt, a bit of edge, pushes you, but on your side. Also moved it to a faster, far cheaper model that handles its short replies just as well, and capped how long a single question can be.

**v1.4.8**
Made the coach fair when something breaks. If a reply fails to come through or comes back empty, it no longer costs you one of your daily messages. You only get charged when it actually answers. A fast double tap can no longer fire off two messages at once either.

**v1.4.7**
Fixed the coach reading the wrong day around midnight. It was working off UTC time instead of your actual local date, so for the first few hours after midnight it could pull yesterday's meals, and your daily message count reset at the wrong hour. It now uses your local day everywhere.

**v1.4.6**
Cleaned up how the coach talks and what it knows. It used to say "I do not remember past conversations," which was cold and pointless, so that line is gone. It also told you to log 7 days when it really needs 14, now it says the right number. It can no longer make up figures, it has to answer only from your real logged data. And it now feeds on your real target weight instead of going in blind.

**v1.4.5**
Fixed the "AI Nutritionist Unlocked" notification that arrived way too early and then left you staring at a locked screen. The unlock now lines up with when the coach can actually help. Also fixed a mix-up that had stopped the coach tailoring its tips and its suggested starter questions to your goal, so weight-loss users get weight-loss prompts again.

## Weight tracker

**v1.4.3**
Picking a date range with no weigh-ins used to silently show your whole history instead. Now it clearly says there is nothing in that range, and the range buttons and history stay put so you can widen it.

**v1.4.2**
Removed duplicate "locked" cards that showed the wrong unlock requirements (it said one weigh-in when it really needed ten).

**v1.4.1**
Tapping an unlocked weight insight now scrolls to the right card instead of landing above it, and reopening the screen no longer lands you on the wrong tab.

**v1.4.0**
The AI weight analysis no longer runs, and no longer costs anything, for people who are not premium.

## Nutrition analysis

**v1.3.9**
Added a Top Priority card at the top of Insights that tells you the single most important thing to act on today, with a concrete next step.

**v1.3.8**
Charts and averages stopped treating days you did not log as zero-calorie days, which had been faking dips in the line and dragging your averages down. Today's half-finished day is no longer counted in your averages either. Empty date ranges now show a clear message.

**v1.3.7**
Tapping an unlocked insight scrolls to the exact card, and the screen opens on the right tab each time.

**v1.3.6**
Every insight now stays locked until you have logged enough to earn it, with the correct requirement shown.

**v1.3.5**
Fixed wrong vitamin and mineral averages that were being fed to the AI, so its advice is based on accurate numbers.

## Calorie bank

**v1.3.4**
Polish: a clearer weekly card, better accessibility, and the numbers refresh correctly when you reopen the screen.

**v1.3.3**
The AI coach now understands your calorie bank, and the bank stops quietly letting saved calories expire without telling you.

**v1.3.2**
Changing your daily cap now applies from next week instead of disrupting the week you are in.

**v1.3.1**
Rebuilt how the bank closes out past weeks so every completed week settles correctly.

**v1.3.0**
The bank settings no longer wipe themselves or flicker when you open them.

**v1.2.9**
Simplified the calorie card in bank mode to Food, Exercise, and Remaining.

**v1.2.8**
Fixed the math for gain-weight goals and a drift in the "calories used" number.

## Home and logging

**v1.2.7**
Cleanup sweep: clearer account prompt wording, banners that hide themselves, and a guard against picking future dates.

**v1.2.6**
The home screen stopped reporting success when something had actually failed.

**v1.2.5**
New users now see a "set your goal" prompt instead of fake placeholder calorie and macro numbers.

**v1.2.4**
Logging a meal by photo now behaves exactly like logging by text (same limits, same prompts).

**v1.2.3**
Switching to another day while a meal was still being analyzed no longer wipes the original day's meals. This was the most serious bug fixed in the campaign.

## Background sync

**v1.2.0 to v1.2.2**
A full overhaul of how your data syncs in the background. Stopped dropping meals that had not synced yet, made sure your newest edits win, and stopped deleted meals from coming back.

## Sign-in and session

**v1.1.2 to v1.1.9**
A run of auth and session fixes: sign-out hangs, the screen briefly reverting to old cloud data, preferences resetting, deleted meals reappearing, and a calorie number flashing on cold open.

**v1.1.1**
Added the build version display in Settings (the number this log refers to).

## Earlier builds

The first builds focused on the onboarding and quick-signup flow, the calorie calculator macros step, and fixing the walkthrough on the web app. These predate the version display.
