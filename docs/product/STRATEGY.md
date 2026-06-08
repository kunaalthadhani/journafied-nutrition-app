# TrackKcal Product Strategy

One page. The decisions everything else hangs off. Owner: Kunaal Thadhani. Status: draft for review. Last updated: 2026-06-07.

---

## Positioning statement

For people in the UAE who want to eat better but find Western calorie apps blind to their food, TrackKcal is an AI nutritionist in your pocket that understands what they actually eat and tells them what to do about it. Unlike MyFitnessPal and the other loggers, it does not make you search a database. You tell it, in your words, and it figures out the rest.

The one line: **An AI nutritionist that speaks your food.**

---

## The problem

Calorie tracking works and almost nobody sticks with it. The reason is friction, not motivation. Every existing app makes you the data-entry clerk: search a database, pick the right entry from twenty wrong ones, guess the portion. For regional food it is worse. Search "machboos" or "karak" or "biryani from the place downstairs" and you get nothing useful. So people quit in the first week and blame themselves.

## Who it is for

Primary ICP (proposed, your call): a UAE resident, 25 to 40, phone-first, has tried MyFitnessPal or Lifesum and quit inside two weeks, eats a mix of regional and Western food, wants to lose or maintain weight without becoming an accountant about it.

Secondary: the global user who wants a logger that is actually fast. The UAE wedge earns the right to expand; it is not the ceiling.

We are NOT for: bodybuilders weighing food to the gram, clinical/medical nutrition, or people who enjoy spreadsheets. Those users exist and other apps serve them. Chasing them blunts the wedge.

## The wedge: why we win

Regional food understanding, delivered through natural language, with zero database search. That is the whole game. A first-time user logs "two chapati and dal" or "shawarma and a laban" and it just works. That single moment, food appearing correctly from plain words, is the product. Everything else is supporting cast.

The flagship differentiators that compound the wedge: the Calorie Bank (spend and save calories across the week, not a rigid daily cap) and the insight engine (the app tells you what your data means, not just what you ate).

## Why now

LLMs made natural-language food understanding good enough to replace database search in the last two years. That capability did not exist when MyFitnessPal was built, and incumbents are trapped by their database-first UX and their scale. A focused team can own the regional wedge before they react. The window is the gap between "the tech works" and "the incumbents ship it." That gap is now.

## What it is (one paragraph)

A React Native app. You log food by text, photo, or voice and the AI parses it into foods with calories and macros. It tracks against goals you set, with a Calorie Bank that lets you flex across the week. A nutrition analysis screen and a weight tracker surface insights that unlock as you log. A premium tier (AI coach, deeper insights) gates behind a real account. Local-first, so it is instant, and syncs in the background.

## What we will deliberately NOT do (the discipline)

- No manual database search as a primary path. The moment we add it, we become the thing we are replacing.
- No gram-level scale workflows. That is a different product.
- No social feed. Not the wedge, huge maintenance cost.
- No Android-Western-market push before the UAE wedge is proven retained.
- No new feature until activation and week-1 retention are measured and healthy. (See METRICS.md.)

## Unfair advantages / moat

- Regional food taste and prompt quality that improves with every real log (the food-analysis cache tags by prompt version, so corrections compound).
- Founder who builds and ships solo, so iteration speed is a moat against slower incumbents.
- A premium model that is honest (gated on a real account plus plan), which builds trust the ad-funded incumbents cannot.

The moat is thin today. It deepens only with retained users and accumulated regional accuracy. Protect both.

## The 12-month bet (success definition, proposed)

By Q2 2027: a defined, measured week-1 retention above the category benchmark (see METRICS.md), a paying conversion that covers AI cost per user, and a UAE word-of-mouth loop you can point to. Not vanity downloads. Retention and unit economics.

## Open strategic calls (only Kunaal can make these)

1. Exact ICP. The one above is a hypothesis. Confirm or kill it with five real conversations.
2. Free vs paid line. Where does the AI nutritionist stop being free? This is the whole business model and it is currently a launch flag, not a decision.
3. UAE depth vs global breadth. How long do you stay narrow before you expand. Staying narrow longer is usually right and always feels wrong.
4. The single metric you will not let slip. My nominee is week-1 retention. Yours?
