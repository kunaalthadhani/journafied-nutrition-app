# Acid on Moss

The design system. This file is the source of truth for every app that uses it. It travels with every new repo. If a screen disagrees with this file, the screen is wrong.

Rules for any AI or developer working in a repo that contains this file: read this before writing any UI. Never invent a color, a font, a radius, or a motion curve. Never approximate from memory. If a needed component exists in the inventory at the bottom, use it. If something is not covered here, build it from the laws and the recipes, then add it to this file.

---

## Identity

Dark only. A near black green ground, bone text, one acid lime accent, serif numerals. Everything separates with hairlines, nothing sits in a box. Numbers are the heroes and they are always honest. The app should feel like a beautiful ledger kept by a sharp coach, not like a dashboard.

---

## Tokens

Copy these exactly. They live in `src/constants/acid.ts` as `export const Acid = { ... } as const`.

```ts
export const Acid = {
  // grounds
  moss: '#0C120D',
  mossDeep: '#080D09',
  // the one accent
  lime: '#C6F432',
  limeDim: '#87A81F',
  limeSoft: 'rgba(198,244,50,0.12)',
  // text ramp (bone)
  tx: '#EEF2E6',
  tx2: '#9AA894',
  tx3: '#5C685A',
  // hairlines, separation without boxes
  hair: '#1E2A1F',
  hair2: '#27352A',
  // data semantics (never used for chrome)
  protein: '#7CC8E0',
  carbs: '#EDBB55',
  fat: '#C79BE0',
  good: '#8FD98A',
  error: '#FF9B7A',
  // type
  serif: 'Fraunces_600SemiBold',
  serifItalic: 'Fraunces_600SemiBold_Italic',
} as const;
```

Note: `as const` narrows these to literal types. A variable that gets reassigned between token colors needs an explicit `: string` annotation.

Grounds. `moss` is the app background. `mossDeep` is one step darker, used for inset surfaces like sheets and the rare card that needs a ground shift.

Text ramp. `tx` for content, `tx2` for secondary, `tx3` for labels and metadata. Never use pure white or pure gray.

Data colors are for data only. Protein is sky, carbs are amber, fat is lilac, good is green, error is soft red. They color numbers, bars, and chart marks. They never color buttons, icons, or chrome.

---

## Type

Two families, no more.

Serif: Fraunces 600 SemiBold and its italic, loaded with `@expo-google-fonts/fraunces`, non blocking:

```ts
import { useFonts, Fraunces_600SemiBold, Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces';
// in the root component, do not block render on it:
useFonts({ Fraunces_600SemiBold, Fraunces_600SemiBold_Italic });
```

System font for everything else, via a `Typography` constant (weights 400 to 700).

When to use which:
- Hero numbers: serif, large. The main stat of a screen is serif at 56 to 58.
- Ledger values: serif at 17.
- Key statements in the coach voice (the daily brief, pattern titles, card headlines): serif italic, 16 to 17, line height ~1.4.
- Screen titles: serif italic 19.
- Everything else: system font.
- Micro labels: system, fontSize 9 to 10, letterSpacing 1 to 1.5, UPPERCASE, color `tx3` (or `lime` when the label is the view's accent).

---

## The laws

1. **No boxes.** Content separates with hairlines (`borderTopWidth: StyleSheet.hairlineWidth, borderColor: Acid.hair`), never with filled cards, borders on all four sides, or background chips. The rare inset surface uses `mossDeep`, still no border.
2. **One lime accent per view.** Each screen or card spends its lime once: the primary action, the active state, or the key word. If two things are lime, one of them is wrong.
3. **Serif numerals.** Any number a user cares about is Fraunces. System font numbers are for metadata only.
4. **Underlined words, not pills.** Actions and links are uppercase micro text with `textDecorationLine: 'underline'`, or a lime micro word with an arrow (`LOG A MEAL →`). Never a filled button unless it is the single primary action of a modal, and then it is lime fill with moss text.
5. **Red is destructive only.** `error` colors deletion and true failure. Warnings are amber (`carbs`). A warning shown in red is a bug.
6. **Honest data.** Copy never claims what the math cannot prove. Every number shown is computed from real data. Today is live and unsettled, do not summarize it as if it were done.
7. **Dark only.** There is no light theme. Status bars, splash, and PWA meta are moss.

---

## Anatomy recipes

**Screen shell.** SafeAreaView with `edges={['top']}`, background moss, horizontal padding 16 to 20. Title row: serif italic 19 title, micro label metadata on the right.

**Ledger** (the table pattern, used for any history):
- Header row: `paddingVertical: 10`, space between. Left: micro label like `RECENT DAYS`. Right: micro label with a computed aggregate like `AVG 2,140 KCAL / DAY`.
- Rows: hairline top border, `paddingVertical` ~10. Left: date `fontSize 12, color tx3, width ~62`. Middle: value in serif 17 bone with unit in `fontSize 11 tx3` beside it on the baseline. Right: signed delta in `fontSize 12` semibold, green when good, amber when over, with `▾`/`▴` glyphs.
- Column headers for multi value ledgers: micro labels `fontSize 9, letterSpacing 1, width 56, textAlign right`, each in its data color.
- Foot: one lime micro link (`LOG A MEAL →`).

**Stat hero.** The screen's main number in serif 58, animated with NumberTicker. Under it one micro subline in tx3 with the context (`LEFT TODAY · 1,240 EATEN · 2,100 TARGET`).

**Track rows** (macros, water): label micro left, thin track (height ~4 to 6, backgroundColor hair) with an AnimatedFill in the data color, value right as `current / target` with serif current.

**Cards that carry one insight** (patterns, priorities): no box. Hairline top and bottom. Micro word in the accent or tone color top left (`PATTERN`, `PRIORITY`), micro metadata top right (`FROM 18 LOGGED DAYS`). Title serif italic 17. Body 14 in tx2, line height 20. Action behind a hairline with a micro label. Footer: underlined `DISMISS` left, metadata right.

**Bottom sheets.** All menus are in-app bottom sheets: Modal, mossDeep surface, rows separated by hairlines, a cancel row at the end. Never `Alert.alert` for menus (Android caps at 3 buttons, web runs only one).

**Tab bar.** Floating glass pill: height 62, borderRadius 31, `rgba(255,255,255,0.07)` rim, iOS `BlurView intensity 40 tint dark` plus a `rgba(12,18,13,0.45)` overlay, Android `rgba(12,18,13,0.94)` solid. Icons 21, labels 9.5. Active is lime, inactive tx3. Beside it a separate 56 circle in lime with a moss plus icon and a lime glow (`shadowOpacity 0.4, shadowRadius 14`). Pages render in place behind the persistent bar, never as slide up modals.

**Input pill.** Single line, height 48, fully rounded, mossDeep ground. Idle: bare mic icon. With text: lime send circle. No camera icon in the bar, capture lives in the plus menu.

**Week of columns.** Seven vertical tracks (~40 tall), AnimatedFill axis y. Lime under target, amber when covered over, error only at a hard cap, hollow for unlogged, faint for future, today glows.

**Charts.** Line charts: 2px line in the data color, lime endpoint dot, dashed lime goal line or a corner `GOAL X ↓` when out of range, date labels at first and last x. Comparisons are stacked lanes on a shared timeline, never dual y axes. Scales (like BMI): muted zone bands 5px, lime needle, boundary numbers written underneath.

---

## Motion

One component does the moving: `AnimatedFill`. Width or height percentage, duration 700ms, `Easing.out(Easing.cubic)`, JS driver (layout props cannot ride native). While moving it glows: `shadowColor` = its fill color, `shadowOpacity 0.85, shadowRadius 7, elevation 5`. `glowAlways` for the one element that represents now.

Numbers tick to their new value with `NumberTicker`, they do not jump.

Expanding and collapsing uses `LayoutAnimation.easeInEaseOut` (enable experimental on Android).

Nothing else animates. No spring physics, no bounces, no fades between screens.

---

## Copy voice

Short sentences. No em dashes. No hyphens between words where avoidable. Few commas. The app speaks like a sharp coach: specific, warm, never corporate, never AI flavored. Counts are always real (`8 of your last 14 logged days`), never vague (`often`, `usually`). Limitations are framed as choices, not confessed as constraints.

---

## Component inventory

Until the shared `acid-ui` package exists, these files ARE the system. Copy them whole into a new app, do not rewrite them:

- `src/constants/acid.ts` — the tokens
- `src/constants/typography.ts` — system type scale
- `src/components/AnimatedFill.tsx` — the only bar motion
- `src/components/NumberTicker.tsx` — number transitions
- `src/components/AcidTabBar.tsx` — the glass pill bar
- `src/components/BottomInputBar.tsx` — the input pill

Everything else (ledgers, sheets, cards) is a recipe above, composed from these.

## New app checklist

1. Expo app, `userInterfaceStyle: "dark"`, splash and web theme color `#0C120D`.
2. Install and load Fraunces exactly as in Type above.
3. Copy the inventory files unchanged.
4. Copy this file to the repo root.
5. Add to the new app's CLAUDE.md: "Read DESIGN.md before any UI work. Never invent styles. Use the inventory components."
6. For PWA builds: inject `apple-mobile-web-app-status-bar-style: black` and a moss body background into the exported index.html, Expo does not emit them.
