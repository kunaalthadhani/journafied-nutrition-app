# TrackKcal — Brand Guidelines

> AI-powered calorie tracker — built for the Middle East, made for everyone.

---

## 1. Brand Identity

### Brand Name
- **Full name:** TrackKcal
- **Capitalization:** Always "TrackKcal" — capital T, capital K. Never "Trackkcal", "trackkcal", or "TRACKKCAL".
- **Pronunciation:** "Track-K-Cal" (Track Kilocalories)
- **Previous name:** Journafied (fully retired — never reference in public-facing material)

### Tagline
- **Primary:** AI-powered calorie tracker
- **Secondary options:**
  - Just describe your food. AI handles the rest.
  - Built for the Middle East. Made for everyone.
  - No barcodes. No databases. Just AI.

### Mission Statement
Make calorie tracking effortless by letting AI do the hard work — no barcode scanning, no food databases, no manual entries. Just describe what you ate.

### Brand Personality
| Trait | What it means |
|-------|--------------|
| **Friendly** | Casual, warm, approachable — like a knowledgeable friend, not a drill sergeant |
| **Smart** | AI-first, tech-forward, but never intimidating |
| **Clean** | Minimal UI, no clutter, every element earns its place |
| **Inclusive** | Understands Middle Eastern, South Asian, and global cuisines natively |
| **Honest** | Transparent about what's free vs premium, no dark patterns |

### Tone of Voice
- **Casual + clean** — friendly but polished
- **Humanized** — not corporate, not robotic, never use hypens
- **Encouraging** — celebrate progress, never shame
- **Direct** — say it in one line, not three
- **Regional awareness** — shawarma, biryani, manakeesh are first-class citizens, not afterthoughts

**Do say:** "You had a solid day, protein was on point 💪"
**Don't say:** "Your daily protein intake has met the recommended threshold per your configured targets."

---

## 2. Logo & App Icon

### App Icon
- **File:** `assets/icon.png` (1024×1024)
- **Adaptive icon (Android):** `assets/adaptive-icon.png`
- **Favicon (web):** `assets/favicon.png`
- **Splash icon:** `assets/splash-icon.png`

### Logo Usage Rules
- Maintain clear space around the logo (minimum: half the logo height on all sides)
- Never stretch, rotate, or add effects (shadows, glows, outlines)
- On dark backgrounds, use the light variant
- Minimum display size: 32px height

### Splash Screen
- Background: Pure white `#FFFFFF`
- Logo centered, resize mode: contain

---

## 3. Color System

### Primary Palette — Zinc

The app uses a neutral zinc palette as its foundation. This keeps the UI clean and lets functional colors and macro colors pop where they matter.

| Token | Hex | Usage |
|-------|-----|-------|
| Zinc 50 | `#FAFAFA` | Primary foreground (dark mode background text) |
| Zinc 100 | `#F4F4F5` | Light borders, subtle backgrounds |
| Zinc 200 | `#E4E4E7` | Borders, dividers |
| Zinc 300 | `#D4D4D8` | Disabled states |
| Zinc 400 | `#A1A1AA` | Placeholder text, tertiary text |
| Zinc 500 | `#71717A` | Secondary text |
| Zinc 600 | `#52525B` | Dark mode tertiary text |
| Zinc 700 | `#3F3F46` | Dark mode light borders |
| Zinc 800 | `#27272A` | Dark mode borders, accent backgrounds |
| Zinc 900 | `#18181B` | **Primary color**, buttons, headings |
| Zinc 950 | `#09090B` | Primary text, dark mode background |

### Functional Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Success | `#10B981` | Positive states, streaks, goal met, health indicators |
| Success BG | `#ECFDF5` | Success badges, light green backgrounds |
| Error | `#EF4444` | Validation errors, destructive actions, over-budget |
| Warning | `#F59E0B` | Caution states, approaching limits |
| Info | `#3B82F6` | Informational badges, tips, highlights |

### Macro Colors

These are the **most recognizable brand colors** in-app. They appear on every food log, every chart, every analysis screen.

| Macro | Hex | Tailwind Equivalent |
|-------|-----|---------------------|
| **Protein** | `#3B82F6` | Blue-500 |
| **Carbs** | `#F59E0B` | Amber-500 |
| **Fat** | `#8B5CF6` | Purple-500 |

These colors are used consistently for:
- Macro breakdown bars
- Pie/donut charts
- Nutrient labels and badges
- Legend dots

### Onboarding Step Accent Colors

Each onboarding step has a unique accent for visual variety and energy:

| Step | Hex | Color |
|------|-----|-------|
| Name | `#3B82F6` | Blue |
| Goal | `#3B82F6` | Blue |
| Sex | `#8B5CF6` | Purple |
| DOB | `#10B981` | Green |
| Height | `#10B981` | Green |
| Weight | `#F59E0B` | Amber |
| Pace | `#EC4899` | Pink |
| Activity | `#06B6D4` | Cyan |

### Theme Modes

The app supports **Light**, **Dark**, and **System-detected** themes.

#### Light Mode
| Token | Hex |
|-------|-----|
| Background | `#F5F5F5` |
| Card | `#F5F5F5` |
| Text Primary | `#333333` |
| Border | `#E4E4E7` |
| Overlay | `rgba(0,0,0,0.40)` |

#### Dark Mode
| Token | Hex |
|-------|-----|
| Background | `#09090B` |
| Card | `#09090B` |
| Text Primary | `#FAFAFA` |
| Border | `#27272A` |
| Overlay | `rgba(0,0,0,0.80)` |

---

## 4. Typography

### Font Family
**System fonts** across all platforms — no custom fonts loaded. This ensures:
- Native feel on iOS (San Francisco) and Android (Roboto)
- Zero font loading latency
- Automatic accessibility scaling support

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| xs | 12px | Captions, labels, timestamps |
| sm | 14px | Body text, food names, secondary info |
| md | 16px | Default body, buttons, inputs |
| lg | 18px | Section headers |
| xl | 20px | Modal titles |
| xxl | 24px | Screen titles, large headers |
| xxxl | 28px | Hero text, splash numbers |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Normal | 400 | Body text, descriptions |
| Medium | 500 | Emphasized body, secondary headers |
| Semi-Bold | 600 | Button text, labels, macro values |
| Bold | 700 | Headings, calorie numbers, CTAs |

### Line Heights

| Token | Multiplier | Usage |
|-------|-----------|-------|
| Tight | 1.2× | Headings, compact UI |
| Normal | 1.4× | Body text (default) |
| Relaxed | 1.6× | Long-form text, descriptions |

---

## 5. Spacing & Layout

### Spacing Scale

Based on a **4px base unit**:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight gaps, icon padding |
| sm | 8px | Inline spacing, small gaps |
| md | 16px | Container padding, standard gaps |
| lg | 24px | Section margins, generous spacing |
| xl | 32px | Large separations |
| xxl | 48px | Screen-level spacing |

### Layout Constants
- **Container padding:** 16px horizontal
- **Section margin:** 24px vertical between sections
- **Card padding:** 12–16px
- **Screen safe area:** Handled by SafeAreaView (top edge)

### Grid
No formal grid system. Layout is flex-based with consistent spacing tokens.

---

## 6. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| none | 0px | — |
| sm | 4px | Tiny elements, tags |
| md | 8px | Inputs, small cards |
| lg | 12px | Cards, meal cards, chips, buttons |
| xl | 16px | Modals, large cards, containers |
| full | 9999px | Circular buttons, pills, avatars |

### Standard Usage
- **Buttons:** 12–14px (friendly, rounded)
- **Cards:** 12px (consistent across all card types)
- **Modals:** 16px
- **Circular buttons:** 9999px (toggle buttons, adjustment +/- buttons)
- **Progress bars / macro bars:** Half of height (fully rounded)

---

## 7. Shadows & Elevation

Shadows are **minimal and subtle** — the design relies on borders and spacing for hierarchy, not heavy shadows.

#### Light Mode
| Level | Shadow Color | Offset | Opacity | Radius | Android Elevation |
|-------|-------------|--------|---------|--------|-------------------|
| None | transparent | (0, 0) | 0 | 0 | 0 |
| Small | `#000000` | (0, 1) | 0.05 | 2 | 1 |
| Medium | `#000000` | (0, 2) | 0.10 | 4 | 2 |

#### Dark Mode
| Level | Shadow Color | Offset | Opacity | Radius | Android Elevation |
|-------|-------------|--------|---------|--------|-------------------|
| None | transparent | (0, 0) | 0 | 0 | 0 |
| Small | `#000000` | (0, 1) | 0.20 | 2 | 1 |
| Medium | `#000000` | (0, 2) | 0.30 | 4 | 2 |

---

## 8. Component Patterns

### Cards
```
Background: theme.colors.card
Border: 1px solid theme.colors.border
Border Radius: 12px
Padding: 12–16px
Shadow: elevation small (subtle)
```

Cards are the primary content container. They hold meal logs, insight cards, weight data, and analytics.

### Buttons

**Primary (CTA)**
```
Height: 56px
Border Radius: 14px
Background: theme.colors.primary (#18181B light / #FAFAFA dark)
Text: theme.colors.primaryForeground
Font: 16px, Bold (700)
```

**Secondary (Outlined)**
```
Border: 1px solid theme.colors.border
Background: transparent
Text: theme.colors.textSecondary
Font: 16px, Normal (400)
```

**Disabled State**
```
Background: theme.colors.border
Text: theme.colors.textSecondary
Opacity: 1 (color change indicates disabled, not opacity)
```

**Small/Circular (Adjustment buttons)**
```
Size: 32×32px
Border Radius: 16px (circle)
Border: 1px solid theme.colors.border
```

### Inputs
```
Background: theme.colors.input
Border: 1px solid theme.colors.border
Border Radius: 8–12px
Padding: 12–16px
Placeholder color: #A1A1AA (zinc-400)
Font: 16px
```

### Modals
```
Overlay: rgba(0,0,0,0.4) light / rgba(0,0,0,0.8) dark
Content Background: theme.colors.card
Border Radius: 16px
Border: 1px solid theme.colors.border
Padding: 24px
Shadow: elevation medium
```

### Chips / Tags
```
Padding: 10px vertical, 14px horizontal
Border Radius: 12px
Background: accent + '15' (15% opacity tint)
Border: 1.5px solid accent
Font: 14px, Semi-Bold (600)
```

### Toggle Buttons (Unit selectors)
When selected:
```
Background: accent + '15' (tinted)
Border: 1.5px solid accent color
Font Weight: 600
```
When unselected:
```
Background: transparent
Border: 1px solid theme.colors.border
Font Weight: 400
```

### Macro Bar (Stacked horizontal)
```
Height: 14px
Border Radius: 7px (half height)
Segments: flex proportional to macro %
Colors: Protein #3B82F6, Carbs #F59E0B, Fat #8B5CF6
```

---

## 9. Iconography

### Icon Library
**Feather Icons** (`@expo/vector-icons/Feather`) — consistent, minimal, open-source line icons.

### Icon Sizes
| Context | Size |
|---------|------|
| Small (inline, labels) | 12–14px |
| Standard (actions, nav) | 16–20px |
| Large (hero, headers) | 24px+ |

### Icon Color
- Default: `theme.colors.textSecondary`
- Active/primary: `theme.colors.textPrimary`
- On colored backgrounds: `#FFFFFF`

### Common Icons Used
| Icon | Feather Name | Context |
|------|-------------|---------|
| Back/Close | `arrow-left` / `x` | Navigation |
| Settings | `settings` | Sidebar |
| Edit | `edit-2` | Food log editing |
| Delete | `trash-2` | Remove items |
| Add | `plus` | Add entries |
| Mic | `mic` | Voice input |
| Camera | `camera` | Photo input |
| Bookmark | `bookmark` | Saved items |
| Chevron | `chevron-right` | List items, expandable |
| Check | `check` | Confirmations |
| Info | `info` | Tooltips, help |
| Star | `star` | Premium features |

---

## 10. Navigation Pattern

### Architecture
**Modal-based navigation** from a single HomeScreen root. No React Navigation stack.

- All screens are full-screen modals controlled by boolean state
- Back navigation via `onBack` callbacks
- Sidebar menu slides in from the left
- This keeps the navigation simple and performant for a solo dev

### Screen Flow
```
HomeScreen (root)
├── SidebarMenu (slide-in overlay)
├── SetGoalsScreen (modal)
│   └── CalorieCalculatorModal (nested modal)
├── WeightTrackerScreen (modal)
├── NutritionAnalysisScreen (modal)
├── ChatCoachScreen (modal)
├── GrocerySuggestionsScreen (modal)
├── AdvancedAnalyticsScreen (modal)
├── AccountScreen (modal)
├── SettingsScreen (modal)
├── NotificationSettingsScreen (modal)
├── IntegrationsScreen (modal)
├── ReferralScreen (modal)
├── SubscriptionScreen (modal)
└── AboutScreen (modal)
```

---

## 11. Social Media & Presence

### Handles
- **Instagram:** @trackkcal
- **TikTok:** @trackkcal
- **X / Twitter:** @trackkcal
- **LinkedIn:** TrackKcal (company page)
- **Email:** TrackKcal@gmail.com

### Founder's Personal Brand
- **Name:** Kunaal Thadhani
- **Handle:** @Kunaal_Thadhani (Instagram + TikTok)
- **LinkedIn:** Personal account for founder-led content

### Content Guidelines
- Mix educational (nutrition tips) + product (feature showcases) + personal (founder journey)
- Use macro colors in graphics when showing nutrition data
- App screenshots should always show the light theme unless specifically showing dark mode
- Never show placeholder/test data in screenshots — always use realistic Middle Eastern food entries

---

## 12. Competitive Positioning

### Who We're Up Against
| Competitor | Their Approach | Our Advantage |
|-----------|---------------|---------------|
| MyFitnessPal | Barcode scanning + massive food DB | No scanning needed — just describe your food |
| Lose It | Barcode + manual search | AI understands "chicken shawarma with garlic sauce" instantly |
| MacroFactor | Algorithmic + manual logging | Voice + photo + text — three ways to log |
| Yazio | Barcode + meal plans | Regional food knowledge (Middle Eastern cuisine) |
| Noom | Psychology-based coaching | AI coach with actual nutritional context |

### Key Differentiators (in order of importance)
1. **AI-first input** — describe food naturally, AI decomposes and calculates
2. **Regional food understanding** — shawarma, biryani, manakeesh, machboos, hummus, karak chai are first-class
3. **Three input methods** — type, speak, or snap a photo
4. **No barcode dependency** — works for home-cooked meals, street food, restaurants
5. **Transparent AI** — shows how it broke down your meal and calculated nutrients

---

## 13. Target Market

### Primary Market
- **UAE and Middle East** — underserved by existing calorie trackers
- Demographics: Health-conscious 18–40, urban, smartphone-first
- Pain point: Existing apps don't understand regional foods

### Secondary Market
- **Global English-speaking** — anyone tired of barcode scanning
- Demographics: Same age range, tech-savvy, prefer convenience
- Pain point: Logging home-cooked or restaurant meals is painful

### User Personas

**Persona 1: Fatima (25, Dubai)**
- Works in marketing, eats a mix of Arabic and South Asian food
- Tried MyFitnessPal but gave up — couldn't find machboos or karak chai
- Wants something quick between meetings
- → TrackKcal: voice-logs her lunch in 5 seconds

**Persona 2: Raj (30, Abu Dhabi)**
- Gym-goer, tracks macros seriously
- Eats a lot of home-cooked Indian food (dal, roti, biryani)
- Frustrated with manual gram-by-gram entry
- → TrackKcal: "chicken biryani with raita, 1 plate" → done

**Persona 3: Sarah (28, London)**
- Meal preps but also eats out frequently
- Hates scanning barcodes for restaurant food
- Wants a quick photo log
- → TrackKcal: snaps a photo of her bowl, AI identifies everything

---

## 14. Premium Model

### Freemium Structure

| Feature | Free | Premium |
|---------|------|---------|
| Food logging (text, voice, photo) | ✅ Unlimited | ✅ Unlimited |
| Basic macro tracking | ✅ | ✅ |
| Weight tracker | ✅ | ✅ |
| Smart Suggest | ✅ | ✅ |
| AI Coach messages | 7/day | 10/day |
| Basic reminders | ✅ | ✅ |
| AI Insights tab | ❌ | ✅ |
| Smart pattern reminders | ❌ | ✅ |
| Pattern detection | ❌ | ✅ |
| Advanced analytics | ❌ | ✅ |
| Grocery suggestions | ❌ | ✅ |

### Pricing (Placeholder — not finalized)
- Monthly: AED 24.99
- Annual: AED 89.99

### Payment Integration
- RevenueCat (planned, not yet integrated)

---

## 15. Technical Quick Reference

| Item | Value |
|------|-------|
| Framework | React Native + Expo |
| Language | TypeScript |
| Backend | Supabase (auth, DB, Edge Functions) |
| AI Provider | OpenAI GPT-4o-mini (text), GPT-4o (images), Whisper (voice) |
| Analytics | Mixpanel |
| Bundle ID | com.trackkcal.app |
| Platforms | iOS + Android (simultaneous launch) |
| Target Launch | Q2 2026 (April–June) |

---

*Last updated: March 2026*
*Prepared for: Claude Project context & Canva brand guideline design*
