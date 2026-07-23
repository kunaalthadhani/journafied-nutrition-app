# TrackKcal version history

Plain English log of what changed in each version and why it matters to you. Newest first. The number in bold is the build version shown in Settings.

---

## Proactive

**v1.4.56**
The weekly bank chart moved from the top of Home to the foot of the page, after your food log and the coach line. The day is the hero up top; the week reads as the epilogue. Nothing else about the chart changed.

**v1.4.55**
The app opens fast now. Everything you look at first, the calorie hero, the macro bars, the weekly bank, loads together in one parallel pass the moment the app boots, instead of queueing behind analytics, device telemetry, and account sync. That background work still happens, just after you can already see your day. On the PWA this cuts the staged 5 to 7 second trickle to roughly the boot time of the app itself. The bottom tab bar also sits properly above the bottom edge on the PWA now, matching how it looks in the native builds.

**v1.4.54**
You can finally type your own calorie target. In Nutrition Goals, tap the big number (or the new Edit link next to Recalculate) and enter any target from 800 to 6000. Your macro grams re-derive from the new number instantly, and saving flows the change everywhere: the Home hero, macro targets, the calorie bank's weekly budget, the coach, insights, and pattern detection. Recalculate still runs the full wizard when you want the math done for you.

**v1.4.53**
Pattern detection is now real math instead of an AI guess. Six detectors read your last 21 days directly: weekend lift, late night calories, protein gaps, low protein breakfasts predicting over days, rebound after skipped days, and consistency wins. Every count on a pattern card is computed from your actual logs, so nothing can be made up, and the fixes name foods you already eat instead of generic advice. Detection runs daily now, free, no AI call. It also got smarter about dirty data: half logged days do not count, backfilled and batch logged meals do not pollute the time based patterns, and eating past midnight finally counts as late night. Old AI era patterns are purged, dismissing a pattern now sticks for 30 days across devices, and the strongest pattern always wins the Home card. The card itself joined the ledger design, and the Pattern Detection page in Settings now lists all six detectors.

**v1.4.52**
The Top Priority card on the Insights tab dropped its alarm-red stripe, icon circle, and badge chip for the coach voice: a quiet colored word for its kind, the finding as a serif italic sentence, the next step under a hairline, and a lime LOG A MEAL link. Warnings are amber now, red stays reserved for destructive things. The water table SQL is in docs/sql, ready to run.

**v1.4.51**
Two additions that make the app speak first. The coach line on Home is now the daily brief: it picks the one most useful thing to tell you from everything the app knows, your streak at risk in the evening, a protein gap after 3pm, an over day your bank quietly covered, banked calories about to expire, a pattern it spotted in your habits, or simply your pace for the day. One sentence, chosen by priority, honest when there is nothing dramatic to say. And water logging arrived the way water should be logged: one tap. A Water option in the lime plus and a tappable WATER bar under your macros open a counter with glass, bottle, and litre buttons. Typing "2 glasses of water" in the meal bar counts it too, without waking the AI. Water is stored on this device for now; cloud sync follows.

## Redesign

**v1.4.50**
The bars move now. Log a meal and the protein, carbs, and fat bars ease to their new fill instead of jumping, the column on the right edge rises smoothly, and the weekly bank columns grow into place, all with a soft glow while they travel. Numbers already ticked; now everything that fills, flows.

**v1.4.49**
Two more insight charts rebuilt. Weight vs Calories dropped the two-scales-on-one-chart overlay for two clean lanes on a shared timeline: your weight as a lime line on top with its change over the window, and each day's calories as columns below, green at or under your recent average, amber above it. Heavy days visibly feed the line above them. Logging Consistency traded its seven gray dots for the week-of-columns look from the calorie bank: a lime column for every day you weighed in, today glowing.

**v1.4.48**
The BMI card grew up. Instead of a rainbow bar with a triangle pointer and a four-item legend, it is now a quiet scale with muted zone bands, a lime needle at your number, and the boundaries written underneath. The number is bone with the category beside it in its zone color. And it finally answers the question BMI never answers on its own: it shows the healthy range in actual kilograms for your height, and where your target weight lands on the scale.

**v1.4.47**
Logging your weight no longer means scrolling to the bottom of the page. The lime plus in the tab bar now has a Weigh in option that jumps you straight into the log sheet from anywhere. And the sheet itself became a meter: your weight in big serif with a tape measure under it that you drag left and right, snapping to every 0.1, prefilled at your last weigh-in so most days you just nudge it and save.

**v1.4.46**
The calorie and macro history tables under the charts now match the Weight Tracker ledger you liked. Same anatomy everywhere: RECENT DAYS header with your average per day on the right, short dates, serif numbers, and for calories a small arrow showing how far each day landed from your target, green under, amber over. The macros table got serif numbers in each macro color with column labels, and the calories ledger ends with a lime LOG A MEAL line. One ledger language across the whole app now.

**v1.4.45**
Three touches from your screenshot. The label next to the date now says what it is: LOGGED 5 OF LAST 7 DAYS, your logging consistency this week. The weekly calorie bank became the week of columns from the design board: seven bars, one per day, lime when you were on target, amber when the bank covered an over day, hollow when you did not log, with used, in bank, and left underneath in serif. And the input bar is now genuinely one line tall, the web version was quietly rendering it as a two line text area.

**v1.4.44**
The bottom bar is now truly persistent. Insights, Coach, Body, and Profile no longer slide up as full covers, they appear as pages with the glass pill staying put, and switching between them is instant. Home keeps its state underneath the whole time. The input bar became a compact rounded pill without the camera icon (the lime plus covers photo, voice, and typing). The white strip above the app is genuinely fixed this time: iOS takes the status bar color of an installed web app from a meta tag Expo never emitted, it's injected at deploy now, and you'll need to remove and re-add the app to your home screen once for it to take. This build was adversarially reviewed by 26 agents before shipping; their 23 confirmed findings, including Android's back button quitting the app from the Coach tab, a doubled subscription screen, and tab taps being eaten by a stale cooldown, are all fixed in it.

**v1.4.43**
Home gets its final polish from the design review. The side menu is gone: everything it held now lives where it belongs. Nutrition Goals, Send Feedback, and About are rows in Settings (Profile tab), and the hidden admin console moved to tapping the version number in Settings seven times. The bottom bar is now a floating glass pill in the Apple style you pointed to, with a lime plus button beside it that opens a quick log sheet: Type it, Snap it, or Say it. The white strip above the app on your iPhone is fixed, it was the web app's theme color still set to the old paper white, now moss. The sign-in reminder lost its box, and the splash screen goes dark to match.

**v1.4.42**
Home rebuilt to the design board's exact anatomy, not just its colors. The big number is now calories LEFT, with eaten, burned, and target in one line under it. The three macro bars are always visible below the hero. Your meals are one flat timestamped ledger: time, food, serif calories on the right, and portions written in words instead of P/C/F codes. Meal actions (save prompt, edit, delete) moved into a proper bottom sheet, opened by the ··· on each meal or a long press, and it works on Android and the web where the old alert menu could not. A greeting with your streak as a "day N" counter sits at the top, the scrolling date strip became a serif date headline with arrows to step between days plus a days-logged count, and one serif italic coach line above the input reads your day and offers ASK COACH. The input became a single rounded pill with a camera glyph. The column on the right edge is now visible with a lime glow. This build was adversarially reviewed by 22 agents before shipping; their 17 confirmed findings (Android menu trap, mislabeled TODAY on past days, invisible failed meals, unreadable button text, and more) are all fixed in it.

**v1.4.41**
The whole app is dark now. This is the big one: every remaining screen and component moved to the new identity in a single wave, and the old white design no longer exists anywhere in the app. Home got the board's anatomy: a huge serif calorie hero with the day's story in one line, macros as three columns with thin bars, your meals as a typographic ledger with serif italic summaries instead of white cards, and the column on the screen's edge that fills with lime as you eat toward your target. A bottom tab bar arrived: Home, Insights, Coach, Body, Profile, replacing the floating coach button and the header shortcut icons. The header is now the TrackKcal wordmark with your streak as a small flame count instead of the fire-emoji badge. Nutrition Analysis converted fully: serif heroes, underline tabs and range words, dark charts. Every remaining surface followed: signup, subscription, referral, grocery, connections, about, admin, the date strip, the input bar, the sidebar, and every small modal. The status bar went light-on-moss to match.

**v1.4.40**
The Weight Tracker rebuilt to match the design board properly, not just recolored. Your current weight is now a huge serif number at the top with the whole story in one line under it: how much you've dropped since your first weigh-in and how many weigh-ins you've logged. The range picker moved up beside the serif "Weight" title. The chart gained what the mock promised: your goal as a dashed lime line when it's in view (or a corner note pointing toward it when it's far), date labels along the bottom, and a solid lime dot on your latest weigh-in. History became the mock's ledger: date, serif weight, and a per-entry change showing how much each weigh-in moved from the one before, with the trend per week in the header. The big bottom button is gone, logging is now the lime "LOG TODAY'S WEIGHT" line at the foot of the ledger. Same math, same editing, same protections.

**v1.4.39**
The Weight Tracker joins the new look, the biggest data screen so far. Your weight chart is now a lime line on open moss with no card around it, the hero numbers (current, change, target) are serif columns instead of bordered boxes, and the Tracker and Insights tabs plus the time range picker became underlined words. Editing a history entry shows a lime underline, the log weight sheet went dark with a serif input and a glowing lime save, and every insight card converted to a dark panel with the chart colors mapped to the app's data palette: green for good, amber for caution, sky and lilac for informational. All the chart math, scrubbing, insights logic, and the data protections from earlier versions are untouched.

**v1.4.38**
The goal questionnaire got a structural rebuild on top of its new look. The big one: recalculating your plan now saves the moment you confirm it. Before, "Save Plan" only staged the numbers on the summary screen, and backing out from there silently threw your whole recalculation away. Also fixed: every result chip (goal, activity, pace, age, height, weight) is now tappable, jumping you to that one question and straight back to your plan. Your name is asked last instead of first, right before the plan reveal. Maintain users no longer see a meaningless target weight field, and switching to maintain clears a stale target. Progress is a smooth bar instead of dots that vanished when steps changed. Leaving mid-setup asks before discarding your answers, and so does leaving the goals screen with unsaved macro tweaks. Macro splits are snapped to exactly 100% before saving on every path. Same questions, same math.

**v1.4.37**
The AI coach and the whole goal setup flow join the new look. The coach lost its chat bubbles: it now speaks in the serif italic voice on open moss, your questions sit right-aligned in lime, and the starter questions became clean hairline rows. The goal questionnaire dropped its rainbow of step colors for the one lime accent, questions got friendlier ("What are we doing?", "Where are we starting?", "How active are you?"), option cards became ledger rows, the scroll pickers show your pick in the serif between two lime hairlines, and your calculated daily target lands as a huge lime serif number. The Nutrition Goals screen matches. Every step, every calculation, and the order of questions are exactly as before.

**v1.4.36**
Settings joins the new look, and it's the biggest conversion yet. The whole screen is now a clean dark ledger: no more white boxes around sections, no more icon circles, just hairline rows with a serif title. Every feature panel that slides up from Settings got the same treatment, including Calorie Bank, Dynamic Adjustments, Smart Suggest, Pattern Detection, Grocery Suggestions, Weekly AI Overview, the weight unit picker, and the Notifications screen. Pickers like the threshold and cycle day are now underlined words instead of outlined chips. Every toggle and setting works exactly as before. The account and connections panels keep the old look for now, they're later in the queue.

**v1.4.35**
The how it works walkthrough joins the new look. It used to be a white card floating over the screen with icons in tinted circles. Now it's a full-screen moss experience: lime accent icon, serif headline, and a lime pill button, matching the sign-in screen. Same five slides, same copy, same swipe behavior. You can replay it any time from the menu.

**v1.4.34**
Second screen of the new look: the food detail sheet you get when tapping a logged item. Dark moss sheet, your food's name in the serif, a big serif calorie number, and macros as clean columns instead of colored boxes. The edit fields are now underlines that light up lime while you type. The Nutrition Facts list also got decluttered: instead of 26 rows of mostly empty dashes, you only see the nutrients your food actually has, with a "show all" toggle if you want to fill in more. All editing behavior is unchanged, including calories recalculating when you change a macro.

**v1.4.33**
First screen of the new look. The sign-in and create-account screen now wears the app's new identity: deep moss ink, one acid-lime accent, a serif headline, and inputs that are clean underlines instead of boxes. The pilot also brings the redesign's foundations into the codebase, the color tokens and the bundled Fraunces serif, which every screen after this will reuse. Everything still works exactly as before, only the look changed.

## Data safety

**v1.4.32**
Fixed a serious bug that could delete your weight history. The tracker worked out deletions by noticing what was missing from a list, so if the screen ever handed over an empty list, which happened when the web app reopened the tracker, it read that as "delete everything" and wiped your logged weigh-ins. Deletions are now explicit. Only the entry you actually delete is removed, and the app flat out refuses to erase your history from an empty reload. The exact same protection was added to exercise logs, which had the identical flaw.

## Charts and streak

**v1.4.31**
Same deep clean for the Weight Tracker insights. Goal Progress no longer shows weight moving away from your goal as positive progress, and its status now says what it measures: net change since your first weigh-in. Maintain-goal users stop getting "You reached your goal!" while off target, and overshooting a goal shows the real percentage past 100. BMI picks up height changes instead of using the height from when the screen first opened, and shows feet and inches if that is how you entered it. Unlocked cards that have no recent data now explain what they need instead of silently disappearing. The onboarding starting weight no longer counts as a real weigh-in anywhere, including a leak that saved it as one when closing the screen. Weight vs Calories excludes today's half-finished day and lines its dots up over the right bars. The weekly rate is pinned to your last 3 months and says so. The AI deficit insight can no longer fire duplicate paid calls or re-buy itself every launch, and it now tells the AI how many days each week actually had logs. Monthly comparison labels the current month as partial.

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
