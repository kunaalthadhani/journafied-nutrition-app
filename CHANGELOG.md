# TrackKcal version history

Plain English log of what changed in each version and why it matters to you. Newest first. The number in bold is the build version shown in Settings.

---

## Proactive

**v1.8.5**
Packaged food was being logged at the per 100g figure instead of what is actually in the packet. A pack of Chupa Chups sour belts came back as 356 calories because that is the rate per 100g. The pack is 57g, so the real answer is about 207. The search had already found the right product and the right numbers, it just never multiplied them by the pack size.

Two fixes. It now knows that nutrition published online is per 100g unless it says otherwise, and that a rate is not an answer. And there is a hard check behind that: 81g of carbs cannot fit inside a 57g packet, so when the numbers outweigh the food the app rescales them itself rather than trusting the estimate. Packs over 100g cannot be checked this way, so they still lean on the first fix.

**v1.8.4**
Typing a note over a photo no longer loses what you wrote. The moment the numbers came back the screen closed, taking the keyboard and your half finished sentence with it, which was worst for exactly the people trying to help it get the answer right. It now waits: if the field is empty it leaves the instant the answer lands, and if you are mid sentence it stays and tells you the numbers are in and it will redo them with what you send.

**v1.8.3**
You pick your own password now. Signing up used to invent one for you and never show it to you, which meant the account was yours but only on that one phone. TrackLifts is the same account and it could never let you in, because you did not know the password and there was no way to ask for a new one. Now there is a password field at signup, and if the email you type already has a Track account the same screen just signs you into it instead of sending you off to find a sign in page.

Forgotten passwords come back by code. We email you six digits, you type them into the app, you pick a new password, you are in. The old way sent a link that opened nothing on a phone, so anyone who tapped it was stuck.

After you sign up or sign in, the app tells you what you got. One account, both apps, and the real date your three weeks end, read from the day you made your Track account rather than from today. Make the account in TrackLifts and TrackKcal says how many days are actually left.

Also fixed before anyone met it: caching the trial date could overwrite your stored account with a thinner copy of itself on a cold start, losing your saved name and a couple of internal fields until the next sync put them back. Nothing you had logged was ever at risk.

**v1.8.2**
The signup screen says what you actually get. It used to be headed "Save your plan" and offered to keep your meals across devices, which is true and is the least interesting thing about handing over an email. It now leads with the three weeks: everything in TrackKcal on, TrackLifts unlocked at the same time on the same account, and yes, your data kept across devices. Skipping is still there and now says what it costs you.

**v1.8.1**
The coach gets 10 messages a day on the free plan, and Premium is uncapped. It used to be 7 and 10, which was not a difference worth having. Opening TrackLifts from TrackKcal now tries the app first and only falls back to the Play Store if you do not have it installed.

**v1.8.0**
Three weeks free, everything on, and it covers both apps. Make your Track account in TrackKcal and the same trial is already running in TrackLifts, and the other way round. One trial per person rather than one per app, counted from the day you signed up, so reinstalling does not restart it and neither does installing the other half. The home screen tells you how many days are left and reminds you that the gym app is sitting there unlocked. There is a link to open it from the banner and another in Settings.

The AI Nutritionist is free. It was half gated before, which meant free users could reach it through the tab bar and not through the home screen, which is worse than either answer. It is open to everyone now.

**v1.7.1**
The Privacy Policy and Terms links in Settings used to open a box that just said "Privacy Policy" back at you. They now open the real documents. Both were rewritten from scratch against what the app actually does, because the old ones were written in May and had gone out of date in ways that matter. The important one: your conversations with the AI Nutritionist are processed by Moonshot AI, a company in China. That was never disclosed. It is now, in plain words, along with every other company that touches your data and exactly what each one receives. There is also a page at trackkcal.com/delete-account explaining how to delete everything, including for people who no longer have the app installed. The About screen shows the real version number instead of 1.0.0.

**v1.7.0**
The coach no longer makes you wait two weeks. It used to refuse to talk until you had logged 14 days, and worse, below 14 days it could not actually see the days you had logged. So on day three it was blind to three days it was holding, and then told you off for not having enough data. Both fixed. Ask it anything from day one. What changes as you log is not whether it answers, it is how big a claim it is allowed to make: nothing logged and it works from your goal and your targets, a few days in and it uses your real numbers and tells you which days it read them from, and at 14 days it starts talking about patterns and weeks. It will never refuse you for lack of data. If it genuinely cannot answer, it tells you which number is missing. The question mark on the coach screen now shows you exactly where you stand.

The weekly review remembers. It used to write each Sunday from scratch, having thrown the last one away. It now keeps the last three and writes the new one having read the previous two, so it follows up on what it asked you for, tells you what moved rather than restating the level, and never makes the same point in the same words twice. "Your protein is up from 68g to 91g" instead of "your protein was 91g". And it arrives on Sunday evening now, as a notification and a line on your home screen, instead of waiting for you to go looking for it.

You can pick a diet. High protein, low carb, keto, Mediterranean, vegetarian or vegan, asked once when you set your calories and changeable any time. It sets your macro split, because keto with a 45 per cent carb target is not keto. And every part of the app that talks to you obeys it, so the coach will not offer you chicken if you are vegetarian and Smart Suggest will not put rice in front of you in ketosis. Allergies and intolerances are not covered, and the app says so rather than pretending.

Change your diet and the app knows you changed it, and what from. For the first month on a new plan the coach reads your numbers in that light instead of taking them at face value. Your seven day carb average three days into keto is mostly your old diet, and it will say that rather than congratulate you for a number you did not earn. It judges you against the diet you are on now, never the one you left, and if a switch is why your protein dropped it says the switch is why. Come off a diet entirely and it treats that as a decision, not a relapse.

The free plan now has real edges: three logged meals a day, typed. Photo logging is Premium. You can see how many logs you have left before you run into it, and deleting a meal gives the slot back. Editing a meal you already logged is free and always will be, because correcting yourself should never cost you a slot. None of this affects you today, since everything Premium is still free for everyone until the app store release.

**v1.6.6**
New app icon. The serif k on its lime line, which is the mark you picked back in July and which never actually made it onto a phone. The wordmark in the app is unchanged. You will only see the new icon after a fresh build, because icons are baked in rather than sent over the air.

You can also talk to a photo now. While it is reading, there is an optional line where you can tell it what the camera cannot see. Photograph a whole loaf and type "only 2 slices" and it logs two slices. Same for what you left, what you shared, and what you asked the kitchen to leave out. Type nothing and it behaves exactly as before. And photos of home cooked food no longer go online for no reason, so a plate of biryani is fast again while a branded packet still gets looked up.

**v1.6.5**
Biryani gets broken down properly now. Log one and you get the rice, the chicken, the ghee, the raita and the spice base as separate lines, instead of one vague total or a question asking how much you ate. The ghee alone is 135 calories and about a sixth of the meal, which is exactly the sort of thing you should be able to see. Same for machboos, kabsa, mandi, harees, thareed, karahi, korma, butter chicken, daal, dosa, chaat, shawarma and mixed grill. Named restaurant items stay whole on purpose, because a McDonald's cheeseburger has a real published number and splitting it into three guesses would make it worse. And it no longer asks you how much you ate. No portion means a normal plate, and you can correct it in one tap. Home cooked food is also fast again: the app only goes online when you mention something it might not know, so a biryani is instant while a Maggi packet still gets looked up.

**v1.6.4**
The app googles your food now. Type a packaged product and it runs a real web search first, reads what comes back, and uses those numbers instead of guessing. Modern Bakery high protein khaboos used to come back at 24g of protein when the real answer is 46g. It now returns 46g, and the right pack weight with it. A packet of Maggi used to be logged as a made-up 70g packet; it now uses the 79g that is actually printed on it. Food you cooked yourself is untouched. A shawarma still gets broken into its parts and still says it is estimating, because a web page's calorie count describes somebody else's shawarma, not yours.

It also looks products up in a food database. Type a brand and it checks a real food database first, and if it finds the product it uses the manufacturer's own label rather than an estimate. Modern Bakery high protein khaboos used to come back at 24g of protein. The label says 46g. It now reads the label, so the only thing left to guess is how much a piece weighs, and it tells you what it assumed so you can correct it in one tap. It also stopped ignoring what is written on the packet: "high protein", "keto", "low carb" and "sugar free" are now treated as the hard numbers they legally are, not as adjectives, so a high protein bread no longer comes back with the macros of ordinary bread. Same food typed twice now always gives the same answer, which was not true before. And it will not ask you what a piece weighs or read out a nutrition label to it, because that was never your job.

**v1.6.3**
Photograph a packaged thing and the app now reads the packet. Brand, product, flavour, net weight, and if the nutrition panel is in shot it copies the manufacturer's own numbers straight off the label instead of guessing. Those numbers win over any estimate, so a protein bar shot with the back of the wrapper visible should now be exactly right rather than roughly right. It will only ever claim a brand it can actually read in your photo, never one it thinks the wrapper looks like, because a wrong brand comes with confident wrong numbers attached. It also knows regional dishes by name now, so machboos comes back as machboos and not as rice with chicken.

The photo flow is rebuilt. Take a photo and the reading starts immediately, with a progress bar over your own picture telling you what it is doing. After a few seconds it hands the rest of the wait to your food log, where the meal sits being put together, and you can carry on typing while it finishes. If it comes back sooner than that, you get it sooner. The old version showed a fake upload bar that was counting nothing, waited for it to finish before it started any real work, and then locked the whole screen behind "Analyzing". Photos were also being sent twice on every single log, which we have stopped. The photo menu is now a small sheet with two options instead of a full page with empty space under it, and editing a meal no longer blacks out the screen for a change to one line. One real bug fixed: after you edited a meal it kept the name of the food you had just replaced, and that wrong name was being saved for next time too. Both sorted. The date of birth question is new as well, month by name and the day and year typed, faster than spinning three wheels and it cannot land you on the wrong year by accident.

**v1.6.2**
Supplements now count. A shake ticked in TrackLifts adds its calories, protein, carbs and fat to your day here, the same as food you logged yourself, and the line still says where it came from. Creatine and vitamins carry no numbers so they change nothing, they just show. Untick something over there and its numbers come back out of your day. The weekly calorie bank counts them too, because your body does not care which app the shake arrived through.

**v1.6.1**
Supplements you tick in TrackLifts now show up on your day here, under their own "from TrackLifts" heading with whatever each one actually carries. Creatine shows as creatine and nothing else, because it is not food. A protein shake shows its calories and its protein. Untick something there and the line disappears here. They are shown separately from your food log on purpose: you logged them in the other app, and the number you see here should always tell you where it came from.

**v1.6.0**
If you already use TrackLifts, TrackKcal stops asking you things it can look up. Sign in and the setup skips your sex, height, weight, goal weight and name, shows you what it found in one card, and lets you correct any line with a tap. It also starts your activity level from how often you actually train, and tells you why it picked that so you can change it. If you are not signed in nothing changes, you get the same setup as always, plus one quiet line offering to fill it in for you. And whatever you answer here now goes back to your Track account, so the next app does not ask either.

**v1.5.9**
Three fixes under the surface. The important one: if your session had quietly expired, the app still thought you were signed in, tried to save to the cloud, failed, and after five tries threw the change away. So the settings or counts you changed while signed out were gone before you signed back in. Now it recognises "not signed in yet" for what it is, keeps everything queued exactly as it was, and sends it the moment you are back. Also, tapping through to an unlocked insight in the weight tracker could crash the screen instead of scrolling to it, and the app could report a scary error about the microphone on phones whose build does not include voice yet. Both silenced properly, not hidden.

**v1.5.8**
Logging a meal takes seconds again. Typing "chicken shawarma wrap and a small fries" now comes back in about eight seconds instead of well over a minute, broken into the pita, the chicken, the garlic sauce, the pickles and the fries. Photos are on a stronger model than before too. The coach deliberately stays on the slower, more thoughtful brain, because taking a moment before answering is a good trait in a coach and a terrible one in a calculator. Nothing changed in how you use the app, and nothing you have logged was touched.

**v1.5.7**
Meals parse again, properly this time. The last fix stopped the errors but left the app talking to a model that thinks itself in circles and never actually answers, so every meal came back as "could not reach the food AI" after a minute of waiting. The brain behind food logging has been changed to one that answers, and it is a good one: "chicken shawarma wrap and a small fries" comes back as pita, shawarma chicken, garlic sauce, pickles and fries, priced separately. It is slower than it should be, up to about a minute and a half for a complicated meal, so the app now waits properly instead of giving up early. Photos already used this model and were never affected.

**v1.5.6**
Food logging works again. The AI model changed a rule on its side and started rejecting every request the app made, so nothing could be parsed: not typed meals, not photos, not the coach. That is fixed on the server, so it is already working for everyone with no update needed. The second half of the fix is here in the app: when the AI cannot be reached, it now says exactly that and leaves your meal sitting in the box so you can try again. Before, an outage came back as "No Entry Detected", which read like your food was the problem when the request had never even arrived.

**v1.5.5**
Your coach can now talk about protein after training. When TrackLifts records what time you finished, TrackKcal knows how long ago that was and how much protein you have eaten since, so the advice is about this session rather than the day in general. When the time is not recorded it says nothing about timing instead of guessing, because a workout at an unknown hour is not a workout at midnight. TrackKcal also started publishing your carbs and fat each day alongside calories and protein, which is what TrackLifts uses to tell a fuelled session from an empty one.

**v1.5.4**
TrackKcal can see your training. If you use TrackLifts, the day you trained now shows up on Home under your food, with the session in one line and the numbers beside it. Your coach knows about it too, so it can talk about your food and your training as one thing instead of guessing at half the picture. One deliberate decision: the calories TrackLifts estimates you burned are shown as an estimate and nothing more. They never get added to what you can eat. An estimate that buys food is how people quietly eat back a workout that was never that big. Going the other way, TrackKcal now publishes what you were aiming at each day, not just what you ate, and a short list of your habits, so the TrackLifts coach can speak about food without guessing. Everything here is off unless you are signed in and using both apps.

**v1.5.3**
Real prices, and premium that follows your Track account. The upgrade screen was rebuilt around Track Plus: both apps together for AED 44 a month or 299 a year, with TrackKcal on its own at 29 or 199 under it. A monthly and annual switch sits at the top, annual chosen for you because it saves 43 percent. Each plan says exactly what it gives you, and the buttons tell the truth: buying arrives with the app store release, everything is free until then. Underneath, premium now reads only from your Track account entitlement, so if you subscribe in TrackLifts and open TrackKcal, premium is simply on. Nothing on your phone can grant or remove it any more. Two places that quietly disagreed about who counts as premium, your insight unlocks and your streak freezes, now ask the same question as the rest of the app.

**v1.5.2**
Voice logging is back, and now your phone does the listening. Tap the mic, say your meal, and the words appear in the box as you speak. Nothing is sent anywhere to be transcribed, the phone turns speech into text by itself, so it is free and it works the same whether you are on wifi or not. It stops when you stop talking, or you can tap to stop it. The words always land in the meal box first so you can fix "too eggs" to "two eggs" before anything gets counted. If you had already typed something, speaking adds to it instead of wiping it. On a phone or browser that cannot do speech, the mic simply is not there rather than sitting on screen doing nothing. Android and iPhone need the next app build for this, the web app has it now.

**v1.5.1**
The AI brain moved to Moonshot. Food parsing from text runs on the kimi reasoning model, food photos run on kimi-k3 which genuinely sees, and the app itself changed nothing, the proxy translates. No OpenAI account needed anymore. Voice input is parked until a speech option is picked; the mic now says so politely instead of failing. Under the hood the proxy also learned that Moonshot returns garbage for strict JSON schemas, so it enforces JSON object mode and hands the schema to the model in words, verified on a real meal end to end.

**v1.5.0**
TrackKcal joins the Track family database. Your account now lives on the same project as TrackLifts: one email, one body, every Track app. Weigh in here and TrackLifts sees it; weigh in there and your chart here already knows the day. Your name, height, weight, goal weight, and weight unit live on one shared profile, so the next Track app starts already knowing you. Meals, goals, and insights are unchanged on the surface, they moved house underneath. If you were signed in before, sign in again once, the old account system is retired.

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
