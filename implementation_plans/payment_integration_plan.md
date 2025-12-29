# Payment Integration Implementation Plan

## 1. Overview
The current payment implementation is a dummy placeholder affecting `src/screens/SubscriptionScreen.tsx` and `src/screens/HomeScreen.tsx`. We will replace this with RevenueCat (`react-native-purchases`) for a robust cross-platform subscription system.

## 2. Prerequisites (User Action Required)
Before we can write the code, you need to set up the following accounts:

1.  **RevenueCat Account**: Sign up at [revenuecat.com](https://www.revenuecat.com/).
    *   Create a new project "TrackKcal".
    *   Obtain your **Public API Keys** for iOS and Android.

2.  **App Store Connect (iOS)**:
    *   Go to "In-App Purchases" -> "Subscriptions".
    *   Create a Subscription Group (e.g., "Premium Access").
    *   Create two products:
        *   Monthly (e.g., `com.trackkcal.app.monthly`) - Set price (AED 24.99).
        *   Annual (e.g., `com.trackkcal.app.yearly`) - Set price (AED 89.99).
    *   Fill in all metadata and submit for review (can be done later, but IDs needed now).

3.  **Google Play Console (Android)**:
    *   Go to "Monetize" -> "Products" -> "Subscriptions".
    *   Create the same two products (`com.trackkcal.app.monthly`, `com.trackkcal.app.yearly`).

4.  **Connect to RevenueCat**:
    *   Enter your App Store Shared Secret and Google Service Account credentials into RevenueCat.
    *   Create an **Entitlement** called `premium` in RevenueCat.
    *   Attach your iOS and Android products to an **Offering** (default offering).

## 3. Implementation Steps (I can do this)

### Phase 1: Installation & Config
1.  Install `react-native-purchases` and `expo-build-properties` (plugin support).
2.  Update `app.json` to include the RevenueCat plugin if necessary (usually auto-handled or requires native build).
3.  Add `RevenueCatProvider` or Service to initialize the SDK with keys.

### Phase 2: UI Integration
1.  **Update `SubscriptionScreen.tsx`**:
    *   Fetch current "Offerings" from RevenueCat to display real prices (dynamic, not hardcoded text).
    *   Wire up "Subscribe" button to `Purchases.purchasePackage()`.
    *   Wire up "Restore" button to `Purchases.restorePurchases()`.

2.  **Update `HomeScreen.tsx`**:
    *   Replace `userPlan` dummy state with a listener: `Purchases.addCustomerInfoUpdateListener`.
    *   This ensures if a sub expires or renews, the app knows instantly.

### Phase 3: Testing
1.  **iOS**: Use TestFlight sandbox users.
2.  **Android**: Use Internal Testing track with license testers.

## 4. Immediate Next Steps for You
- [ ] Sign up for RevenueCat.
- [ ] Create the Subscription Products in Apple/Google consoles.
- [ ] Share the API Keys here so I can create the configuration file.
