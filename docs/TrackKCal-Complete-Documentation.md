# TrackKCal — Complete Technical & Product Documentation

Created: 2026-04-09

---

## 1. App Overview

### What It Is

TrackKCal is an AI-powered calorie and nutrition tracking app built with React Native and Expo. Users describe what they ate in natural language (text or photo), and GPT-4o breaks it down into calories, macros, and micronutrients automatically. No barcode scanning, no database searching, no portion guessing.

### Who It's For

Anyone tracking their nutrition: people losing weight, bodybuilders gaining muscle, athletes maintaining performance, or anyone who wants to understand what they eat. The target audience skews toward people who have tried and abandoned calorie trackers because logging was tedious or the daily target felt rigid.

### Core Value Proposition

1. Natural language food input. Say "chicken rice and salad" and the AI figures out the rest.
2. Photo-based recognition. Take a picture of your plate and get a nutrition breakdown.
3. Flexible weekly calorie budgeting (Calorie Bank). No more guilt from one "bad" day.
4. AI-powered insights that actually reference your data, not generic advice.
5. Progressive engagement. Insights unlock as you log more, keeping users coming back.

### What Makes It Different

Every competitor (MyFitnessPal, Lose It, Cronometer) uses rigid daily targets and database-search food logging. TrackKCal uses AI for input (removing friction) and weekly budgeting for flexibility (removing guilt). The combination addresses the two biggest reasons people quit calorie tracking.

### Currency / Market

Pricing is in AED (UAE Dirhams). The primary market is the UAE/GCC region. The app name was originally "Journafied" and was renamed to "TrackKCal."

---

## 2. Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React Native | 0.81.5 | Cross-platform mobile framework |
| Expo | 54.0.25 | Build toolchain, managed workflow |
| React | 19.1.0 | UI library |
| TypeScript | 5.9.2 | Type safety |

### UI Libraries

| Library | Version | Purpose |
|---|---|---|
| @expo/vector-icons (Feather) | via Expo | Icon system throughout the app |
| lucide-react-native | 0.554.0 | Additional icons (PieChart, Bookmark) |
| react-native-svg | 15.12.1 | SVG charts (calorie trend, radar, bars) |
| expo-blur | 15.0.7 | BlurView for overlays |
| expo-linear-gradient | 15.0.7 | Gradient backgrounds |
| react-native-reanimated | 4.1.3 | Advanced animations |

### Navigation & Gesture

| Library | Version | Purpose |
|---|---|---|
| @react-navigation/native | 7.1.19 | Navigation framework |
| @react-navigation/stack | 7.6.2 | Stack navigator |
| react-native-gesture-handler | 2.28.0 | Gesture handling |
| react-native-screens | 4.16.0 | Native screen containers |
| react-native-safe-area-context | 5.6.2 | Safe area insets |

### Backend & Data

| Technology | Version | Purpose |
|---|---|---|
| Supabase | 2.86.0 (@supabase/supabase-js) | Auth, database, edge functions |
| AsyncStorage | 2.2.0 | Local persistent storage |
| PostgreSQL | (Supabase managed) | Remote database |

### AI & API

| Service | Model | Purpose |
|---|---|---|
| OpenAI GPT-4o | via Supabase Edge Function | Food analysis, photo recognition, chat coach |
| OpenAI GPT-4o-mini | via Supabase Edge Function | Weekly insights, smart suggest, grocery coach, pattern detection |

All AI calls route through a Supabase Edge Function (`ai-proxy`) so the OpenAI API key never reaches the client.

### Media & Device

| Library | Version | Purpose |
|---|---|---|
| expo-image-picker | 17.0.8 | Camera and photo library access |
| expo-file-system | 19.0.19 | File reading (base64 for image upload) |
| expo-av | 16.0.7 | Audio recording (voice input) |
| expo-speech | 14.0.7 | Text-to-speech |
| expo-notifications | 0.32.13 | Push notifications |
| expo-print | 15.0.8 | PDF generation (grocery list export) |
| expo-sharing | 14.0.8 | Share sheet (PDF export) |
| expo-device | 8.0.9 | Device info for analytics |
| expo-clipboard | 8.0.7 | Clipboard (referral code copy) |

### Health Integration

| Library | Version | Purpose |
|---|---|---|
| react-native-health | 1.19.0 | Apple HealthKit (iOS) |
| react-native-health-connect | 3.5.0 | Health Connect (Android) |

### Utilities

| Library | Version | Purpose |
|---|---|---|
| date-fns | 4.1.0 | Date manipulation throughout |
| uuid | 13.0.0 | Unique ID generation |
| react-native-get-random-values | 1.11.0 | Crypto polyfill for uuid |

### Architecture Decision: No Third-Party State Management

The app uses React's built-in useState/useEffect/useMemo hooks for all state management. No Redux, MobX, Zustand, or Context API (except for two small contexts: PreferencesContext for weight unit, UserContext for shared user data). This was a deliberate choice to keep the architecture simple and avoid dependency on state management libraries that add complexity for what is fundamentally a single-screen app with modals.

### Architecture Decision: AsyncStorage as Primary Storage

All data is stored locally in AsyncStorage first, then synced to Supabase when a user has an account. This means the app works fully offline and doesn't require sign-in for basic functionality. The sync is opportunistic, not required.

### Architecture Decision: Supabase Edge Function for AI

Rather than calling OpenAI directly from the client (which would expose the API key), all AI requests go through `supabase/functions/ai-proxy/index.ts`. This edge function receives the request, adds the OpenAI API key from Deno environment variables, and proxies the call. The client never sees the key.

---

## 3. Project Structure

```
trackkcal-app/
  app.json                          # Expo configuration
  package.json                      # Dependencies
  tsconfig.json                     # TypeScript config
  App.tsx                           # Root component
  assets/                           # Icons, splash screens
    TrackKcal-Icon.jpeg
    TrackKcal-Adaptive-Icon.jpeg
    icon.png
    adaptive-icon.png
  docs/                             # Documentation
    app-features.md                 # All features breakdown
    calorie-bank-feature.md         # Calorie Bank deep dive
    TrackKcal-Brand-Guidelines.md   # Brand guidelines
    data-safety.md                  # Data safety/privacy
    RELEASE.md                      # Release notes
    supabase-schema.sql             # Database schema
    supabase-rls-policies.sql       # Row-level security
    TrackKCal-Complete-Documentation.md  # This document
  feature-docs/                     # Feature documentation copies
    calorie-bank-feature.md
  supabase/
    functions/
      ai-proxy/index.ts             # Edge function for OpenAI proxy
  src/
    config/
      env.ts                        # Environment variable access
      featureFlags.ts               # Feature flag configuration
    constants/
      border.ts                     # Border constants
      colors.ts                     # Color palette (light/dark)
      countries.ts                  # Country list with dial codes (for phone auth)
      spacing.ts                    # Spacing scale
      theme.tsx                     # Theme provider (light/dark mode)
      typography.ts                 # Font sizes, weights, line heights
    contexts/
      PreferencesContext.tsx         # Weight unit preference (kg/lbs)
      UserContext.tsx                # Shared user data (weight entries, goals)
    screens/
      HomeScreen.tsx                # Main screen — food logging, stat cards, modals
      SetGoalsScreen.tsx            # Goal calculator — TDEE, macros, custom plan
      AccountScreen.tsx             # Auth — sign in, sign up, profile
      SettingsScreen.tsx            # All settings, premium feature slide-ups
      WeightTrackerScreen.tsx       # Weight logging, chart, 10 insight cards
      NutritionAnalysisScreen.tsx   # Calorie/macro charts, 8+ insight cards
      SubscriptionScreen.tsx        # Pricing, plan selection
      ChatCoachScreen.tsx           # AI nutrition coach chat
      GrocerySuggestionsScreen.tsx  # AI grocery list with PDF export
      AdvancedAnalyticsScreen.tsx   # Trends, heatmaps, patterns
      NotificationSettingsScreen.tsx # Meal reminders, smart reminders
      IntegrationsScreen.tsx        # Apple Health, Google Fit
      ReferralScreen.tsx            # Referral code, sharing, rewards
      AboutScreen.tsx               # App info
      AdminPushScreen.tsx           # Admin push notification tool
    components/
      AccountWallModal.tsx          # Mandatory sign-up after 5 food logs
      AnimatedSpan.tsx              # Fade-in + spring bounce text
      AppWalkthroughModal.tsx       # Onboarding tutorial
      BottomInputBar.tsx            # Text/voice/photo input bar
      CalendarModal.tsx             # Full month calendar with log indicators
      CalorieBankCard.tsx           # Home screen bank progress card
      CalorieBankWeeklyCard.tsx     # Weekly budget swipeable card
      CalorieCalculatorModal.tsx    # TDEE calculator (stepped wizard)
      CaloriesCard.tsx              # Main calorie display card
      CycleResetCard.tsx            # Weekly bank reset summary
      DateSelector.tsx              # Horizontal scrollable date bar
      ExerciseLogSection.tsx        # Exercise log display
      FoodLogSection.tsx            # Meal cards + food detail slide-up
      ImageUploadStatus.tsx         # Photo upload progress
      InsightUnlockCard.tsx         # "New Insight Unlocked" announcement
      Macros2Card.tsx               # Calories card (Food/Banked/Surplus/Remaining)
      MacrosCard.tsx                # Macro breakdown card (P/C/F)
      NumberTicker.tsx              # Animated number counter
      PatternDetectionCard.tsx      # AI pattern card (premium)
      PhotoOptionsModal.tsx         # Camera/library picker
      PredictiveWarningBanner.tsx   # Over-target warning (premium)
      PremiumBlurredContent.tsx     # Blurred overlay for locked content
      SettingsComponents.tsx        # SettingItem, SettingSection reusables
      SidebarMenu.tsx               # Slide-out navigation menu
      SmartAdjustmentBanner.tsx     # Weight-based plan adjustment
      SmartAdjustmentModal.tsx      # Adjustment detail/accept modal
      SmartSuggestBanner.tsx        # AI meal suggestion (premium)
      StatCardsSection.tsx          # Swipeable stat card container
      StreakWidgetCard.tsx          # Streak display with freeze
      SwipeableCards.tsx            # Card carousel (2 or 3 cards)
      TimePickerModal.tsx           # Time picker for reminders
      TopNavigationBar.tsx          # Header with menu, date, calendar
      TypingAnimation.tsx           # Chat typing indicator
    services/
      aiProxyService.ts             # Supabase Edge Function caller
      analyticsService.ts           # Mixpanel/local analytics tracking
      authService.ts                # Supabase auth (OTP, sign in/up, sign out)
      calorieBankService.ts         # Calorie bank cycle management
      chatCoachService.ts           # AI coach context builder
      dataStorage.ts                # AsyncStorage CRUD (3200+ lines, core data layer)
      GrocerySuggestionService.ts   # Deterministic grocery list generator
      groceryCoachService.ts        # AI grocery explanation generator
      HealthService.ts              # Apple Health / Health Connect bridge
      insightService.ts             # Nutrition insight detection
      mixpanelService.ts            # Mixpanel SDK wrapper
      notificationService.ts        # Push notification scheduling
      openaiService.ts              # All OpenAI API calls
      patternDetectionService.ts    # AI eating pattern analyzer
      referralService.ts            # Referral code management
      smartReminderService.ts       # Context-aware reminder scheduling
      supabaseClient.ts             # Supabase client initialization
      supabaseDataService.ts        # Remote CRUD operations
      voiceService.ts               # Voice recording service
    utils/
      calorieBankEngine.ts          # Pure calorie bank calculations
      exerciseParser.ts             # Natural language exercise parsing
      foodNutrition.ts              # Nutrition calculation utilities
      insightUnlockEngine.ts        # Progressive unlock definitions
      sanitizeAI.ts                 # Prompt injection prevention
      streakLogic.ts                # Streak calculation
      streakUtils.ts                # Streak helper functions
      uuid.ts                       # UUID generation wrapper
    types/
      index.ts                      # Shared TypeScript types (MacroData, etc.)
```

---

## 4. Data Model

### Local Storage (AsyncStorage)

All data is stored as JSON strings in AsyncStorage under these keys:

```typescript
const STORAGE_KEYS = {
  GOALS: '@trackkal:goals',
  MEALS: '@trackkal:meals',
  EXERCISES: '@trackkal:exercises',
  WEIGHT_ENTRIES: '@trackkal:weightEntries',
  ENTRY_COUNT: '@trackkal:entryCount',
  USER_PLAN: '@trackkal:userPlan',
  DEVICE_INFO: '@trackkal:deviceInfo',
  ACCOUNT_INFO: '@trackkal:accountInfo',
  PREFERENCES: '@trackkal:preferences',
  PUSH_TOKENS: '@trackkal:pushTokens',
  PUSH_HISTORY: '@trackkal:pushHistory',
  REFERRAL_CODES: '@trackkal:referralCodes',
  REFERRAL_REDEMPTIONS: '@trackkal:referralRedemptions',
  REFERRAL_REWARDS: '@trackkal:referralRewards',
  SAVED_PROMPTS: '@trackkal:savedPrompts',
  ENTRY_TASKS: '@trackkal:entryTasks',
  SYNC_QUEUE: '@trackkal:syncQueue',
  STREAK_FREEZE: '@trackkal:streakFreeze',
  ADJUSTMENT_HISTORY: '@trackkal:adjustmentHistory',
  ANALYTICS_FEEDBACK: '@trackkal:analyticsFeedback',
  SUMMARIES: '@trackkal:summaries',
  DETECTED_PATTERNS: '@trackkal:detectedPatterns',
  WEEKLY_ACTION_PLAN: '@trackkal:weeklyActionPlan',
  dailyLog: (date: string) => `@trackkal:log:${date}`,
  USER_METRICS_SNAPSHOT: '@trackkal:userMetricsSnapshot',
  INSIGHTS: '@trackkal:insights',
  COACH_DISMISS_DATE: '@trackkal:coachDismissDate',
  SMART_REMINDER_CACHE: '@trackkal:smartReminderCache',
  SMART_REMINDER_LOG: '@trackkal:smartReminderLog',
  SMART_REMINDER_EFFECTIVENESS: '@trackkal:smartReminderEffectiveness',
  GROCERY_UNLOCKED: '@trackkal:groceryUnlocked',
  GROCERY_UNLOCK_SEEN: '@trackkal:groceryUnlockSeen',
  INSIGHT_UNLOCKS: '@trackkal:insightUnlocks',
  CALORIE_BANK_CONFIG: '@trackkal:calorieBankConfig',
  CALORIE_BANK_COMPLETED_CYCLES: '@trackkal:calorieBankCompletedCycles',
  CALORIE_BANK_CYCLE_RESET_SEEN: '@trackkal:calorieBankCycleResetSeen',
};
```

### Core Interfaces

#### MealEntry
```typescript
interface MealEntry {
  id: string;
  prompt: string;                    // What the user typed
  summary?: string;                  // AI-generated summary
  foods: ParsedFood[];               // Array of parsed food items
  timestamp: number;                 // Unix timestamp
  imageUri?: string;                 // Photo if image-based
  updatedAt?: string;
  date?: string;                     // YYYY-MM-DD
  userId?: string;
  isLoading?: boolean;               // True during AI analysis
  loadingState?: 'analyzing' | 'done' | 'failed';
}
```

#### ParsedFood
```typescript
interface ParsedFood {
  id: string;
  name: string;
  weight_g: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  dietary_fiber?: number;
  sugar?: number;
  added_sugars?: number;
  sugar_alcohols?: number;
  net_carbs?: number;
  saturated_fat?: number;
  trans_fat?: number;
  polyunsaturated_fat?: number;
  monounsaturated_fat?: number;
  cholesterol_mg?: number;
  sodium_mg?: number;
  calcium_mg?: number;
  iron_mg?: number;
  potassium_mg?: number;
  vitamin_a_mcg?: number;
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
  vitamin_e_mg?: number;
  vitamin_k_mcg?: number;
  vitamin_b12_mcg?: number;
}
```

#### ExtendedGoalData
```typescript
interface ExtendedGoalData {
  calories: number;
  proteinPercentage: number;
  carbsPercentage: number;
  fatPercentage: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  age?: number;
  gender?: 'male' | 'female' | 'prefer_not_to_say';
  heightCm?: number;
  heightFeet?: number;
  heightInches?: number;
  goal?: 'lose' | 'maintain' | 'gain';
  activityRate?: number;
  name?: string;
  dob?: string;
  trackingGoal?: string;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'very';
}
```

#### DailySummary
```typescript
interface DailySummary {
  date: string;                      // YYYY-MM-DD
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  entryCount: number;                // Number of meals logged
  updatedAt: string;
}
```

#### AccountInfo
```typescript
interface AccountInfo {
  name?: string;
  email?: string;
  phoneNumber?: string;
  supabaseUserId?: string;
  premiumUntil?: string;             // ISO date for premium expiry
  createdAt?: string;
  referralCode?: string;
}
```

#### CalorieBankConfig
```typescript
interface CalorieBankConfig {
  enabled: boolean;
  cycleStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0=Sun, 6=Sat
  dailyCapPercent: 15 | 20 | 25;
  spendingCapPercent: 15 | 20 | 25;
  enabledDate: string;               // ISO date
  onboardingSeen: boolean;
}
```

#### CalorieBankCompletedCycle
```typescript
interface CalorieBankCompletedCycle {
  startDate: string;
  endDate: string;
  weeklyBudget: number;
  weeklyActual: number;
  bankUtilization: number;           // % of banked calories used
  expiredCalories: number;
  daysLogged: number;
  daysInCycle: number;
  peakBankBalance: number;
  capHitDays: number;
  spendCapHitDays: number;
  goalType: 'lose' | 'gain' | 'maintain';
}
```

#### DetectedPattern
```typescript
interface DetectedPattern {
  id: string;
  type: 'correlation' | 'trigger' | 'outcome';
  title: string;
  description: string;
  fix?: string;                      // Premium only
  confidence: number;                // 0-100, only show if >70
  dataPoints: number;
  detectedAt: string;
  dismissed?: boolean;
}
```

#### WeightEntry
```typescript
interface WeightEntry {
  id?: string;
  date: Date;
  weight: number;                    // Always stored in kg
  note?: string;
}
```

#### StreakFreezeData
```typescript
interface StreakFreezeData {
  freezesAvailable: number;          // Resets to 2 monthly
  lastResetDate: string;
  usedOnDates: string[];
}
```

#### Preferences
```typescript
interface Preferences {
  weightUnit?: 'kg' | 'lbs';
  notificationsEnabled?: boolean;
  mealReminders?: {
    breakfast: { enabled: boolean; hour: number; minute: number };
    lunch: { enabled: boolean; hour: number; minute: number };
    dinner: { enabled: boolean; hour: number; minute: number };
  };
  smartSuggestEnabled?: boolean;
  dynamicAdjustmentEnabled?: boolean;
  dynamicAdjustmentThreshold?: number;
  smartReminderPreferences?: SmartReminderPreferences;
}
```

---

## 5. API / Endpoints

### Supabase Edge Function: ai-proxy

All AI calls go through a single Supabase Edge Function.

**Endpoint:** `supabase.functions.invoke('ai-proxy', { body: request })`

**Request shape:**
```typescript
interface AIRequest {
  model: 'gpt-4o' | 'gpt-4o-mini';
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
  call_type?: string;               // For logging/billing: 'food-analysis', 'weekly-insights', etc.
}
```

**Call types used:**
- `food-analysis` — GPT-4o, 3-stage food analysis
- `image-analysis` — GPT-4o with vision, photo food recognition
- `weekly-insights` — GPT-4o-mini, weekly AI review
- `smart-suggest` — GPT-4o-mini, next meal suggestion
- `grocery-coach` — GPT-4o-mini, grocery list explanation
- `pattern-detection` — GPT-4o-mini, eating pattern analysis
- `chat-coach` — GPT-4o, nutrition coach responses
- `deficit-insight` — GPT-4o-mini, weight tracker AI analysis

### Supabase Database Operations (via supabaseDataService.ts)

- `getOrCreateUser(accountInfo)` — Find or create user record
- `fetchNutritionGoals(accountInfo)` — Load goals from remote
- `saveNutritionGoals(accountInfo, goals)` — Sync goals to remote
- `syncMealLog(accountInfo, date, meals)` — Sync daily meals
- `syncWeightEntry(accountInfo, entry)` — Sync weight entry
- `deleteAllUserData(userId)` — Account deletion
- `fetchUserReferralCode(email)` — Get referral code
- `redeemReferralCode(code, email)` — Redeem a code

---

## 6. Authentication & Authorization

### Provider
Supabase Auth with email OTP (one-time password) as the primary flow.

### Auth Flow

1. User enters email address
2. `authService.sendOtp(email)` calls `supabase.auth.signInWithOtp({ email, shouldCreateUser: true })`
3. Supabase sends a 6-digit OTP to the email
4. User enters OTP code
5. `authService.verifyOtp(email, token)` verifies and returns a session
6. Session persisted automatically via AsyncStorage (Supabase handles this)
7. Optional: user can set a password after OTP verification via `authService.updatePassword()`

### Token Handling
Supabase SDK handles token refresh automatically (`autoRefreshToken: true` in client config). Session persists across app restarts via AsyncStorage.

### Sign Out
`authService.signOut()` clears all local data via `dataStorage.clearAllData()` and signs out from Supabase. This removes the session token but preserves nothing locally.

### Account Deletion
`authService.deleteAccount()` first deletes all remote data via `supabaseDataService.deleteAllUserData()`, then clears local data, then signs out.

### Premium Gating
Premium status is determined by `isPremium` in HomeScreen:
```typescript
const isPremium = useMemo(() => {
  if (!accountInfo?.email) return false;   // MUST be signed in
  if (userPlan === 'premium') return true;
  if (accountInfo?.premiumUntil) {
    return new Date(accountInfo.premiumUntil) > new Date();
  }
  return false;
}, [userPlan, accountInfo]);
```

Every premium feature checks `isPremium`, which requires both sign-in AND a premium plan. This is enforced at the HomeScreen level (source of truth) and propagated to all child screens via props.

In SettingsScreen, an additional `isSignedIn` check gates the premium feature rows: `plan === 'premium' && isSignedIn`. If a user taps a locked feature without being signed in, an alert prompts them to sign in first.

---

## 7. Core Features

### 7.1 Food Logging (AI-Powered)

**User perspective:** Type what you ate in natural language, or take a photo. The AI analyzes it and creates a detailed nutrition breakdown.

**Technical flow:**
1. User types in BottomInputBar → `handleInputSubmit(text)` in HomeScreen
2. A pending meal entry is created immediately (shows loading state)
3. Food cache checked (`@food_cache:` + normalized input) — if hit, skip AI
4. If cache miss: `analyzeFoodWithChatGPT(text)` called
5. Uses 3-stage agentic analysis:
   - Stage 1 (Gatekeeper): Checks for ambiguity, asks clarification if needed
   - Stage 2 (Chef): Decomposes composite items into atomic ingredients
   - Stage 3 (Physicist): Converts to grams, estimates full micro/macronutrient profile
6. Returns `ParsedFood[]` array
7. Meal saved to AsyncStorage via daily shard (`@trackkal:log:YYYY-MM-DD`)
8. DailySummary updated
9. Synced to Supabase if user has account

**Photo flow:**
1. `expo-image-picker` opens camera or library
2. Image read as base64 via `expo-file-system`
3. Sent to GPT-4o Vision API for food description
4. Description fed back through text analysis pipeline
5. Results cached and saved

**Edge cases:**
- Clarification questions: AI can ask "Did you mean a cup or a can?" before analyzing
- Exercise detection: If input looks like exercise ("ran 30 minutes"), it routes to exerciseParser instead
- Empty/gibberish input: Handled gracefully with error message
- Offline: Food is logged locally, syncs when online

**Free limit:** 3 meals per day. Premium: unlimited.

### 7.2 Calorie Bank (Weekly Budgeting)

See [docs/calorie-bank-feature.md](calorie-bank-feature.md) for the complete specification.

**Summary:** Daily target x 7 = weekly budget. Eat less on some days, bank the difference. Eat more on others, it gets deducted. Caps prevent extreme behavior (15/20/25% of daily target max). Floor of 1,500 kcal (men) / 1,200 kcal (women). Ceiling of base + cap. Weekly reset on chosen day.

**Key files:**
- `src/utils/calorieBankEngine.ts` — Pure calculation engine
- `src/services/calorieBankService.ts` — Cycle management, enable/disable
- `src/components/CalorieBankCard.tsx` — Home screen display (unused, replaced by stat card integration)
- `src/components/CalorieBankWeeklyCard.tsx` — Weekly swipeable card
- `src/components/CycleResetCard.tsx` — Reset summary

**Integration points:**
- StatCardsSection: 4-column layout (Food/Banked/Surplus/Remaining) when active
- SwipeableCards: 3rd card (Weekly) added when active
- NutritionAnalysisScreen: Bank insights + distribution chart
- Weekly AI Insight: Receives banking data in prompt
- Pattern Detection: Knows banking is active to avoid false flags
- Goals: Manual plan change resets bank. Dynamic Adjustment queues for next reset.

### 7.3 Dynamic Adjustments

**User perspective:** The app monitors your weight trend and suggests calorie adjustments when your weight changes by a chosen threshold (3%, 4%, or 5%).

**Technical flow:**
1. `dataStorage.checkAndGenerateAdjustment()` runs on app open
2. Compares current weight trend against baseline
3. If threshold exceeded, creates an `AdjustmentRecord` with status 'pending'
4. `SmartAdjustmentBanner` appears on Home screen
5. User can tap to view `SmartAdjustmentModal` with details
6. Accept: new calorie target applied, macros recalculated
7. Dismiss: adjustment recorded as dismissed, won't re-suggest for the same trend

**Interaction with Calorie Bank:** When banking is active, accepted dynamic adjustments queue for the next cycle reset instead of applying immediately.

### 7.4 Weight Tracker

**User perspective:** Log weight, see trends on a chart, get 10 different insight cards analyzing your progress.

**Components:**
- Weight chart with scrubbing (touch and drag to see each data point)
- Time range selector (1W, 1M, 3M, 6M, 1Y, 2Y)
- Inline weight logging with number input
- Weight history list with edit/delete

**Insight Cards (10 total, premium only, progressively unlocked):**
1. Goal Progress — % toward target, progress bar
2. Estimated Goal Date — projected date based on rate of change
3. Weekly Rate of Change — kg/week average
4. Deficit & Surplus Impact — AI analysis of calorie vs weight relationship
5. Weight vs Calories — overlay chart (bars + line)
6. Monthly Comparison — this month vs last month
7. Milestones & Records — lowest/highest recorded, achievements
8. Weight Fluctuation — 7-day range, normal vs concerning
9. Logging Consistency — days logged this week (dot indicators)
10. BMI — calculated from height + weight, gauge visualization

### 7.5 Nutrition Analysis

**User perspective:** Charts and analytics about your eating patterns.

**Tabs:** Calories | Macros | Insights

**Insight Cards (8+ total, premium only, progressively unlocked):**
1. AI Weekly Insight — collapsible, 3 personalized paragraphs
2. Calorie Bank (when active) — budget progress, utilization, distribution
3. Goal Adherence — ring charts for each macro + calories
4. Calorie Trend — line chart with average and target lines
5. Macro Split — stacked bar showing P/C/F percentages
6. Nutrition Balance — radar chart
7. Weekly Pattern — bar chart by day of week
8. Meal Timing — morning/afternoon/evening distribution
9. Top Foods — most frequently logged items
10. Sugar Load — total vs added sugar

### 7.6 Progressive Insight Unlocking

**Purpose:** Insights don't all appear at once. They unlock as the user logs more data, creating a drip of engagement.

**Engine:** `src/utils/insightUnlockEngine.ts` defines 18 insights with data requirements:

| Insight | Requirement |
|---|---|
| Goal Adherence | 2 logged days |
| Macro Split | 2 logged days |
| Calorie Trend | 3 logged days |
| Meal Timing | 3 logged days |
| Top Foods | 4 logged days |
| Weekly Pattern | 5 logged days |
| Nutrition Balance | 5 logged days |
| AI Weekly Insight | 7 logged days |
| Logging Consistency | 1 weight entry |
| BMI | 1 weight entry + height set |
| Weight Fluctuation | 3 weight entries |
| Goal Progress | 3 weight entries + target set |
| Weekly Rate | 5 entries over 2+ weeks |
| Weight vs Calories | 5 days with both |
| Estimated Goal Date | 7 entries over 3+ weeks |
| Monthly Comparison | 2 months of data |
| Deficit & Surplus AI | 7 days with both |
| Milestones & Records | 10 weight entries |

**Flow:** On every meal log and app open, `checkInsightUnlocks()` in HomeScreen calculates current stats and compares against stored unlocks. Newly unlocked insights get saved and an `InsightUnlockCard` announcement appears on the Home screen. Tapping navigates directly to the Insights tab. Dismissing marks it as seen and shows the next queued unlock.

### 7.7 Smart Suggest

**User perspective:** AI suggests what to eat next based on your goals, time of day, and what you've already eaten today.

**Technical:** Uses GPT-4o-mini with context about remaining macros, meal timing, and common foods. Returns a display text and a loggable text (so the user can one-tap log the suggestion). Daily limit cache prevents regeneration.

### 7.8 Pattern Detection

**User perspective:** AI analyzes 2-3 weeks of eating data and finds patterns you might not notice.

**Technical:** Requires 14+ days of data. Runs at most once per week. Uses GPT-4o-mini to find correlations, triggers, and outcomes. Each pattern has a confidence score (only shows 70%+) and a specific fix recommendation. The fix is blurred for free users.

### 7.9 AI Chat Coach

**User perspective:** Chat with an AI nutritionist who has seen your food log.

**Technical:** `chatCoachService.ts` builds a rich context object (user profile, today's log, remaining macros, weight trends, consistency score, top foods) and passes it as the system message to GPT-4o. The coach has a specific persona: direct, surgical, no fluff. Free users get 7 messages, premium gets 10.

### 7.10 Grocery Suggestions

**User perspective:** AI generates a personalized shopping list based on your goals and the foods you actually eat.

**Technical:** Two-layer system:
1. `GrocerySuggestionService.ts` — deterministic algorithm that maps user's common foods to categories, fills gaps with defaults, scales quantities to weekly calorie target
2. `groceryCoachService.ts` — GPT-4o-mini generates explanations for why each food was chosen

**Unlock requirement:** 5 logged days + 7 unique foods (prevents generic lists for new users).

**Export:** PDF generation via `expo-print` with HTML template. Clean black and white design.

### 7.11 Streak Tracking

**User perspective:** See how many consecutive days you've logged food. Recovery days (streak freeze) protect your streak if you miss a day.

**Technical:** 2 freezes per month, auto-applied to missed days. Streak calculated from `summariesByDate`. StreakWidgetCard displays on Home screen.

### 7.12 Referral Program

**User perspective:** Share your referral code. When someone signs up with it, you earn 3 free premium days.

**Technical:** `referralService.ts` manages codes, redemptions, and rewards. Codes stored in Supabase. Share via WhatsApp deep link or clipboard.

### 7.13 Food Detail Modal

**User perspective:** Tap any food item to see full nutrition breakdown. Edit calories/macros with auto-scaling.

**Technical:** Slide-up modal (95% height, spring animation, swipe to dismiss). Shows:
- Hero calorie number
- Macro distribution bar (P/C/F)
- Macro pills with colored backgrounds
- Editable macro inputs (editing calories scales all macros proportionally, editing macros recalculates calories)
- Full Nutrition Facts table (22 micronutrients, all editable)
- Save/Cancel buttons

---

## 8. Nutrition Data Pipeline

### Data Source
All food data is generated by OpenAI GPT-4o. There is no integration with USDA, Open Food Facts, Nutritionix, or any external food database. The AI estimates nutrition based on its training data.

### Analysis Pipeline

```
User input (text or photo)
    ↓
Cache check (AsyncStorage, keyed by normalized input)
    ↓ (miss)
Stage 1: Gatekeeper
    - Is the input ambiguous? ("rice" → which type? how much?)
    - If ambiguous and allowClarification: return clarification question
    - If clear: proceed
    ↓
Stage 2: Chef
    - Decompose composite items: "chicken biryani" → rice, chicken, oil, spices
    - Handle colloquial names: "shawarma" → pita, chicken, garlic sauce, vegetables
    ↓
Stage 3: Physicist
    - Convert everything to grams
    - Estimate per-100g nutrition
    - Scale to actual portion
    - Include micronutrients (vitamins, minerals)
    ↓
ParsedFood[] array returned
    ↓
Cached locally (never expires)
    ↓
Saved to daily log
    ↓
DailySummary updated
    ↓
Synced to Supabase (if account exists)
```

### Prompt Injection Prevention
`src/utils/sanitizeAI.ts` provides `sanitizeForAI()` and `sanitizeObjectForAI()` that recursively sanitize all strings in AI payloads. This prevents users from injecting instructions via food descriptions.

### Accuracy Limitations
AI-estimated nutrition is approximate. The app makes this clear in disclaimers. Users can manually edit any value in the food detail modal if they know the actual numbers.

---

## 9. UI/UX Implementation

### Design System

**Colors:** Defined in `src/constants/colors.ts` with light and dark mode support via `src/constants/theme.tsx`.

**Typography:** `src/constants/typography.ts` defines font sizes (xs through xxl), font weights, and line heights.

**Spacing:** `src/constants/spacing.ts` defines a spacing scale.

**Icons:** Feather icons (via @expo/vector-icons) as primary icon set. Lucide icons for specific cases (PieChart, Bookmark).

### Animation Patterns

All modals and screens use a consistent slide-up pattern:
- `Animated.spring` for opening (damping: 20, stiffness: 90)
- `Animated.timing` for closing (duration: 300ms)
- `PanResponder` for swipe-to-dismiss (threshold: 100px or velocity > 0.5)
- 95% screen height with rounded top corners (borderRadius: 20)
- Semi-transparent backdrop (tappable to close)
- Drag handle indicator at top

### Screen Navigation

The app uses a single-screen architecture with modals. HomeScreen is the root, and all other screens are rendered as Modal components:
- Settings, Account, Subscription, etc. use `animationType="slide"` + `presentationStyle="pageSheet"`
- Weight Tracker and Nutrition Analysis use `animationType="slide"` + `presentationStyle="fullScreen"` (to prevent HomeScreen unmounting)
- Within Settings, sub-screens (Notifications, Connections, Account, Weight Unit, all premium features) use custom slide-up Animated.View modals

### Swipeable Stat Cards

The Home screen has a swipeable card area (vertical swipe to switch):
- Card 1 (default): Macros2Card — Calories with Food/Banked/Surplus/Remaining (or Food/Exercise/Remaining when bank is off)
- Card 2: CalorieBankWeeklyCard — Weekly budget progress (only when bank is active)
- Card 3: MacrosCard — Protein/Carbs/Fat with progress bars

### Dark Mode
Supported via `useTheme()` hook. Theme provider in `src/constants/theme.tsx`. All colors reference `theme.colors.*` rather than hardcoded values.

---

## 10. Offline Behavior & Sync

### What Works Offline
- All food logging (stored in AsyncStorage)
- All weight logging
- Goal setting and modification
- Viewing logged data
- Calorie bank calculations (derived from local data)
- Streak tracking

### What Requires Network
- AI food analysis (GPT-4o call)
- Photo food recognition
- AI chat coach
- Weekly AI insights generation
- Pattern detection
- Grocery suggestions (AI explanation)
- Smart suggest
- Account sign-in/sign-up
- Syncing data to Supabase

### Sync Strategy
- Data is saved locally first, then synced opportunistically
- `syncQueue` in AsyncStorage stores pending sync operations
- On app open and foreground resume, pending syncs are attempted
- Conflict resolution: last-write-wins (local data takes precedence if timestamps conflict)

---

## 11. Performance & Optimization

### Meal Data Sharding
Meals are stored in daily shards (`@trackkal:log:2026-04-09`) rather than one giant blob. This prevents loading all historical meals when only today's data is needed.

### DailySummary Pre-computation
Instead of recalculating totals from raw meals on every render, `DailySummary` records cache the totals. Updated when meals change.

### InteractionManager
Heavy operations (like loading detailed nutrition facts in the food modal) previously used `InteractionManager.runAfterInteractions` to avoid blocking the UI. This was removed in favor of immediate rendering with the slide-up animation providing the visual transition time.

### Image Handling
Photos are read as base64 and sent directly to the AI proxy. No local image compression or resizing is implemented. [VERIFY: This could be a performance issue for large photos.]

### Calorie Bank Engine
Pure functions with no side effects. Derives everything from `summariesByDate` on every render rather than storing computed state. This prevents stale data but means the calculation runs on every re-render. For 7-day cycles this is negligible.

---

## 12. Testing

No automated tests exist in the codebase. Testing has been manual throughout development. [VERIFY: This is a significant gap.]

### Manual Testing Patterns
- Dev tools in Settings: "(Dev) Downgrade to Free" button, "Inject Plateau Data" button
- `__DEV__` checks throughout for debug logging
- `patternDetectionService.injectDemoPattern()` for UI testing

---

## 13. Deployment & Infrastructure

### Build System
Expo managed workflow. Builds via `expo build` or EAS Build.

### App Configuration (app.json)
```json
{
  "expo": {
    "name": "TrackKcal",
    "slug": "trackkcal-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "ios": {
      "bundleIdentifier": "com.trackkcal.app"
    },
    "android": {
      "package": "com.trackkcal.app",
      "versionCode": 1
    }
  }
}
```

### Environment Variables
```
EXPO_PUBLIC_SUPABASE_URL=<supabase project URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
```

The OpenAI API key is stored in the Supabase Edge Function environment (Deno), not in the client app.

### Supabase Edge Function
`supabase/functions/ai-proxy/index.ts` — Deno runtime, deployed via Supabase CLI.

### Monitoring
Mixpanel integration via `analyticsService.ts` for event tracking. No error monitoring (Sentry, etc.) currently implemented. [VERIFY]

---

## 14. Third-Party Integrations

| Service | Purpose | API Key Location | Fallback |
|---|---|---|---|
| Supabase | Auth, database, edge functions | Client env vars | App works offline with AsyncStorage |
| OpenAI GPT-4o | Food analysis, photo recognition, chat coach | Supabase Edge Function env | Cached results; no fallback for new analysis |
| OpenAI GPT-4o-mini | Weekly insights, smart suggest, pattern detection, grocery coach | Supabase Edge Function env | Graceful error messages |
| Apple HealthKit | Steps, calories from iOS | No API key (device permission) | Feature disabled if module unavailable |
| Health Connect | Steps, calories from Android | No API key (device permission) | Feature disabled if module unavailable |
| Mixpanel | Analytics | In analyticsService.ts | Analytics silently fail |

---

## 15. Security

### AI Prompt Injection Prevention
`sanitizeForAI()` and `sanitizeObjectForAI()` in `src/utils/sanitizeAI.ts` recursively sanitize all user-provided strings before they reach the AI. This prevents users from embedding instructions in food descriptions.

### API Key Protection
The OpenAI API key never reaches the client. All AI calls route through the Supabase Edge Function which adds the key server-side.

### Authentication
OTP-based email authentication via Supabase Auth. Sessions managed by Supabase SDK with auto-refresh. No passwords stored locally.

### Data Privacy
Health data (weight, food logs, calories) stored locally in AsyncStorage. Only synced to Supabase if the user has created an account. Account deletion removes all remote data.

### Premium Feature Gating
`isPremium` requires both `accountInfo?.email` (signed in) AND `userPlan === 'premium'` (paid). No premium feature can be accessed without sign-in. This is enforced at the HomeScreen level and propagated to all child components.

---

## 16. Known Issues & Technical Debt

1. **No automated tests.** All testing is manual. This is the biggest gap.

2. **Exercise section still exists in code** even though Calorie Bank replaces it when active. The ExerciseLogSection component and exercise-related state/handlers remain for non-banking users but exercise tracking is not a core feature.

3. **Grocery list suggests default foods** that the user hasn't logged. The logic to restrict to user's logged foods only was discussed but not fully implemented. The `DEFAULT_FOODS` arrays in `GrocerySuggestionService.ts` still exist as fallbacks.

4. **No RevenueCat integration.** Subscription purchasing is simulated (onSubscribe callback sets local plan to 'premium'). Real IAP not yet connected.

5. **No real email/SMTP service.** OTP emails go through Supabase's built-in email service which has rate limits and deliverability limitations.

6. **The calorie bank redistribution recalculates on every render** via a useEffect. For a 7-day cycle this is fast, but if the component re-renders frequently it's unnecessary work.

7. **Account info can desync.** `accountInfo` in AsyncStorage and the Supabase user record can drift if the user signs in on a different device. The merge logic in `loadGoals()` handles this for goals but not all data types.

8. **Image analysis doesn't compress photos.** Large photos are sent as full-size base64 to the AI proxy, which could be slow on poor connections.

9. **No pagination in meal history.** All daily shards are loaded into state. For users with months of data, this could become slow.

10. **Smart Suggest daily cache** uses `new Date().toISOString().split('T')[0]` which can have timezone issues near midnight.

---

## 17. Decision Log

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Framework | React Native + Expo | Flutter, Native | Team expertise, faster iteration, managed workflow |
| State management | React hooks only | Redux, Zustand | App is fundamentally one screen with modals; hooks are sufficient |
| Local storage | AsyncStorage | SQLite, Realm | Simple key-value works for this data model; no complex queries needed |
| Backend | Supabase | Firebase, custom | Free tier sufficient, Postgres flexibility, Edge Functions for AI proxy |
| Auth | Email OTP (Supabase) | Google/Apple sign-in, password-only | Lowest friction; OTP requires no password memory; OAuth planned but not shipped |
| AI provider | OpenAI GPT-4o | Claude, Gemini | Best food recognition accuracy at time of testing |
| AI proxy | Supabase Edge Function | Client-side API key, custom server | Zero additional infrastructure; key never reaches client |
| Food data source | AI-generated only | USDA, Nutritionix, Open Food Facts | AI handles natural language and composite dishes; database would require exact matches |
| Calorie model | Weekly budgeting (Calorie Bank) | Daily-only | Weekly reflects actual physiology; reduces guilt and improves retention |
| Banking caps | Percentage-based (15/20/25%) | Fixed amount, no cap | Scales with different calorie targets; prevents extreme behavior |
| Banking floor | Gender-aware (1500M/1200F) | Fixed 70% of base | Medically safer; respects physiological differences |
| Subscription pricing | AED 89.99/year, AED 24.99/month | N/A | UAE market pricing; annual plan positioned as best value |
| Insight unlocking | Progressive (data-requirement-based) | All at once, time-based | Creates engagement loops; ensures charts have meaningful data when unlocked |
| Navigation | Single screen + modals | Tab navigator, stack navigator | Modals prevent screen unmounting and data loss; consistent animation pattern |
| Charts | react-native-svg (custom) | Victory, react-native-chart-kit | Full control over design; no dependency bloat for simple charts |

---

## 18. Future Roadmap

### Not Yet Built
- **RevenueCat integration** for real in-app purchases (currently simulated)
- **OAuth** sign-in (Google, Apple)
- **SMTP service** for reliable email delivery
- **Data export** (CSV/JSON of all user data)
- **Water tracking**
- **Barcode scanning** (discussed but not implemented)
- **Recipe builder** (ingredient aggregation, serving size math)
- **Social features** (sharing progress, challenges)
- **Apple Watch / WearOS** companion app
- **Widget** for quick calorie check without opening app

### Scaling Considerations
- **1K users:** Current architecture works fine. Supabase free tier may need upgrading.
- **10K users:** OpenAI costs become significant. Consider caching common food analyses more aggressively. Add Sentry for error monitoring.
- **100K users:** Need proper CDN, image compression pipeline, pagination for meal history, and likely a move from Supabase Edge Functions to a dedicated API server with rate limiting and cost controls.

---

## 19. How to Run / Developer Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account (for auth and AI proxy)
- OpenAI API key (set in Supabase Edge Function)

### Setup

```bash
# Clone
git clone https://github.com/kunaalthadhani/journafied-nutrition-app.git
cd journafied-nutrition-app

# Install dependencies
npm install

# Create .env (or set in Expo config)
# EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Start Expo development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Run on physical device
# Scan the QR code from Expo Go app
```

### Supabase Edge Function Setup

```bash
# Login to Supabase
supabase login

# Deploy the AI proxy function
supabase functions deploy ai-proxy

# Set the OpenAI API key as a secret
supabase secrets set OPENAI_API_KEY=your_openai_key
```

### TypeScript Check

```bash
npx tsc --noEmit
# Only errors should be in supabase/functions/ (Deno types)
```

### Key Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| EXPO_PUBLIC_SUPABASE_URL | Client .env | Supabase project URL |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | Client .env | Supabase anonymous key |
| OPENAI_API_KEY | Supabase Edge Function secrets | OpenAI API access |

---

## Appendix: Feature Gating Matrix

| Feature | Free | Premium | Requires Sign-In |
|---|---|---|---|
| Food logging | 3/day | Unlimited | No |
| Photo recognition | Yes | Yes | No |
| Macro tracking | Yes | Yes | No |
| Goal setting | Yes | Yes | No |
| Weight tracker | Yes | Yes + insights | No |
| Exercise logging | Yes | Yes | No |
| Health app sync | Yes | Yes | No |
| Basic notifications | Yes | Yes | No |
| Streak tracking | Yes | Yes | No |
| Calorie Bank | No | Yes | Yes |
| Dynamic Adjustments | No | Yes | Yes |
| Smart Suggest | No | Yes | Yes |
| Pattern Detection | No | Yes | Yes |
| Predictive Warnings | No | Yes | Yes |
| AI Chat Coach | No | Yes | Yes |
| Advanced Analytics | No | Yes | Yes |
| Weekly AI Insights | No | Yes | Yes |
| Grocery Suggestions | No | Yes (unlock required) | Yes |
| Insight Cards (all) | No | Yes (progressive unlock) | Yes |

---

*This document represents the complete state of the TrackKCal codebase as of April 9, 2026.*
