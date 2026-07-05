# TrackKcal version history

Plain English log of what changed in each version and why it matters to you. Newest first. The number in bold is the build version shown in Settings.

---

## Charts and streak

**v1.4.30**
Deep clean of the Macros and Insights tabs. Goal Adherence can finally show above 100% instead of hiding every overshoot as perfect. Cards with no data in your selected range now say so instead of showing 0% rings and collapsed charts. Every card states what period it covers, the Macros tab got the same context line as Calories, and comparisons only show when there is really something to compare. The AI weekly insight now analyzes an actual week of completed days no matter which chart range is open, never fires while its card is locked, and no longer caches an apology as if it were your insight. The Top Priority card refreshes its data daily instead of feeding you week-old claims, says which days it covers, and the engine behind it (which also feeds your coach) now uses your local calendar instead of UTC and stops counting today's half-finished day. The calorie bank now shows the same weekly number as the home screen and marks skipped days as skipped instead of rendering them like perfect days.

**v1.4.29**
Rebuilt the chart logic end to end. Every range pill now means exactly one thing across the whole app, where before the same "1W" was 7 days on one screen and 8 on another, and one screen used three different windows at once. The confusing 1D option is gone. Every number now says what it is and what period it covers: the calorie hero reads "avg per day" with a line explaining how many logged days it averages and that today counts once complete, the comparison chip compares your selected period against the equal period before it instead of always last week, and the weight charts tell you how many weigh-ins you are looking at. The weekly rate is now a proper trend fit over your selected range so one odd weigh-in cannot swing it, and your estimated goal date is anchored to your last 3 months so flipping the chart view cannot move it. Micronutrients now use the same window and local dates as everything else. Also fixed the streak display: the snowflake only shows while a recovery day is actually protecting your streak, and the recovery banner now names the day it saved and how many recovery days you have left.

## Cloud sync

**v1.4.28**
Finished the sync honesty work across the whole app. Every cloud write now reports failure instead of silently pretending it worked, so nothing can quietly stop syncing again. Your weight unit choice now syncs across devices too. And a big cleanup under the hood: removed seven dead database tables and around 800 lines of code for features that were designed but never shipped, so what remains is only what the app actually uses.

**v1.4.27**
Your goal plan and preferences now actually reach the cloud. Both had a silent failure mode where the app believed the sync succeeded when nothing was written, and your plan was only ever sent once, at onboarding, so one miss meant it lived on your phone forever. Now a failed write reports itself and retries, signing in backfills anything missing, and the app self-heals on open: if you are signed in and the cloud copy of your plan or preferences is missing, it quietly uploads yours. Bookmarked meals also sync now instead of staying phone-only.

## Security and privacy

**v1.4.26**
Closed a gap in the shared-device fix. It now checks who owns the device on every sign-in, not just a fresh one. Before, if you were already signed in and then switched accounts, the check was skipped and the previous person's data could still cross over. Now every sign-in reconciles first.

**v1.4.25**
Two safety fixes under the hood. On a shared device, signing in with a different account now wipes the previous person's meals, weights, and history off the phone before anything syncs. Your data can no longer land in someone else's account. And the AI service behind food analysis, the coach, and voice logging is locked down. It only runs the models the app actually uses, with size and rate caps, so it cannot be abused to run up a bill.

## Grocery list

**v1.4.24**
Rebuilt the grocery list screen and fixed the bugs under it. It is a clean shopping list first now. Tap any food to see its calories and why it is on the list, check things off as you shop, and your checkmarks stick if you close and reopen. Dropped a misleading "expected weight loss" number and a made-up "junk swapped" stat that were never real. And if your logged foods are mostly processed so a proper list cannot be built, you now get a real screen that explains it and offers a healthy starter template, instead of a blank page.

## Notifications

**v1.4.23**
Reworded the end-of-day reminder so it does not imply a premium feature. Everyone gets the nightly nudge to finish logging, and premium still gets the personalized calorie wrap-up.

**v1.4.22**
The reminder settings screen now uses the same defaults as what is actually saved, so the per-meal reminder toggles can no longer appear switched on while being off underneath.

**v1.4.21**
Reminder settings now take effect right away. Turning a reminder off, changing a meal time, or switching reminder mode used to do nothing until you fully restarted the app. Now it applies when you leave Settings. Reminders also stop scheduling quietly when you have denied notification permission at the phone level, and premium reminders no longer keep firing after you sign out.

**v1.4.20**
Fixed wrong wording in reminders. The daily wrap-up used to congratulate you for hitting your target even when you had gone well over it, and the calorie heads-up could show a negative "calories left." Both now read correctly when you are over your goal. Also fixed a quiet-hours bug so a same-day quiet window like 2pm to 4pm silences reminders only in that window instead of all day.

## Settings

**v1.4.19**
Three smaller Settings fixes. Clearing all data now pushes anything you logged offline up to the cloud first, so a signed-in user does not lose recent edits that had not synced yet. The locked Grocery Suggestions row now explains how to unlock it when you tap it, instead of doing nothing. And the Calorie Bank panel refreshes its settings when you open it, so it can no longer show stale info.

**v1.4.18**
Two calorie bank fixes. Changing your cycle start day no longer risks losing the calories you banked this week. If your plan cannot load at that moment, it now stops and tells you instead of resetting the week and dropping the history. And turning the bank on now stamps the start day in your own local time, so it can no longer be off by a day near midnight.

**v1.4.17**
Premium features now stop when you are no longer premium. The Dynamic Adjustment and Calorie Bank engines used to keep running off an old saved setting even after you signed out, so a signed-out user could still get paid behavior. They now check whether you are actually entitled before doing anything.

**v1.4.16**
Your settings toggles can no longer erase each other. Flipping two switches quickly used to let the second one quietly undo the first, because each one re-saved a stale copy of everything. Now each toggle saves one write at a time and only changes the exact setting you touched, so every switch sticks. This covers the dynamic adjustment, smart suggest, and notification toggles.

**v1.4.15**
Fixed the risky actions in the Settings screen. Clear All Data now actually restarts the app instead of just claiming it would and leaving old data on screen. Delete Account no longer traps you behind a frozen "processing" popup, and it closes the settings screen once it finishes. And an internal "(Dev) Downgrade to Free" button that was showing to real premium users is now hidden.

## Goal setup

**v1.4.14**
Cleaned up units for pounds users. Your pace now reads in lbs per week instead of kg, everywhere it shows, on the pace step, the results screen, and the goals screen. Switching your weight unit inside the calculator now carries over to the rest of the app instead of resetting. Also tightened the target-weight check and capped the signup name length to match the calculator.

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
