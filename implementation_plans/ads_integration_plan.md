# Ads Integration Implementation Plan

This plan outlines the steps to integrate advertisements into the application using **Google AdMob** via the `react-native-google-mobile-ads` library. The implementation focuses on a "Freemium" strategy where advertisements are shown only to users on the free plan and hidden for premium subscribers.

## 1. Prerequisites & Setup

### Dependencies
- **Library**: `react-native-google-mobile-ads`
- **Expo Config Plugin**: Required for managing native code changes (AndroidManifest.xml, Info.plist).

### AdMob Account
- Create an AdMob account.
- Register apps (iOS and Android).
- Obtain **App IDs** for both platforms.
- Create Ad Units (Banner, Interstitial, Rewarded) to get **Ad Unit IDs**.

## 2. Configuration (`app.json` / `app.config.js`)

Add the Google Mobile Ads config plugin to the Expo configuration.

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx", 
          "iosAppId": "ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx",
          "userTrackingUsageDescription": "This identifier will be used to deliver personalized ads to you."
        }
      ]
    ]
  }
}
```

*Note: Use test App IDs during development.*

## 3. Implementation Steps

### Step 1: Initialize SDK
Initialize the ads SDK at the root of the application (usually `App.tsx`) and handle the App Tracking Transparency (ATT) request for iOS users (iOS 14+).

```typescript
// src/services/adsService.ts
import mobileAds from 'react-native-google-mobile-ads';

export const initializeAds = async () => {
    await mobileAds().initialize();
};
```

### Step 2: Create a Banner Ad Component
Create a reusable component that renders a banner ad safely. It should inherently check the user's premium status before rendering.

**Ad Placement Strategy:**
- **Sticky Footer**: Fixed at the bottom of the screen.
- **Inline**: Inserted within scrollable content (e.g., between food log entries history).

```typescript
// src/components/AdBanner.tsx
// Usage: <AdBanner type="standard" />
```

### Step 3: Implement Interstitial Ads
Interstitial ads cover the full screen. They are best used at natural transition points.

**Trigger Points:**
- After logging a meal (but before returning to home).
- When saving a weight entry.
- *Avoid showing on every action; use a counter (e.g., every 3rd log).*

```typescript
// src/services/adsService.ts
// function showInterstitialAd()
```

### Step 4: Implement Rewarded Ads (Optional but High Value)
Rewarded ads allow users to watch a video to earn premium features temporarily.

**Use Cases:**
- "Watch an ad to unlock AI Insights for this meal."
- "Watch an ad to get 1 extra daily log (if exceeding free limit)."

### Step 5: Premium Logic Integration
Ensure all ad calls are wrapped in a check for the user's plan.

```typescript
// Example Logic
const showAd = !isUserPremium; 
if (showAd) {
    // Render <AdBanner />
}
```

## 4. Privacy & Compliance (Critical)

### iOS App Tracking Transparency (ATT)
Apple requires asking for permission to track.
- The config plugin handles adding `NSUserTrackingUsageDescription` to `Info.plist`.
- You must manually call `requestTrackingPermissionsAsync()` (using `expo-tracking-transparency` or the ads library's method) when the app starts.

### GDPR / CMP
For users in the EEA/UK, you must use a Consent Management Platform (CMP) or Google's User Messaging Platform (UMP) SDK (included in the library) to gather consent before initializing ads.

## 5. Testing
- **Always** use Test Ad Unit IDs provided by Google during development. Using real ads during testing can get your account banned.
- Test strict "No Ads" experience for Premium users.
- Test offline behavior (ads should degrade gracefully or collapse).
