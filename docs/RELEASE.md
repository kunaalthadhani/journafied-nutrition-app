# TrackKcal Release Checklist

This document captures the steps we follow before publishing a production build to the Google Play Store (and App Store when applicable).

## 1. Code & Dependency Health
- [x] `npm install`
- [x] `npx expo-doctor`
- [x] `npm audit`
- [ ] Verify `.env` contains `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `npm test` (add once automated test suite is available)
- [ ] Manual smoke test on a physical Android device

## 2. Asset & Branding Review
- Confirm `app.json` contains:
  - `"name": "TrackKcal"`
  - `"slug": "trackkcal-app"`
  - `"android.package": "com.trackkcal.app"`
  - `"android.versionCode":` incremented for every release
  - `"ios.bundleIdentifier": "com.trackkcal.app"`
- Verify icons (`assets/icon.png`, `assets/adaptive-icon.png`) and splash (`assets/splash-icon.png`) meet Play Store asset specs.

## 3. Signing & Secrets
- Base64-encode the Android keystore and provide secrets referenced in `eas.json`:
  - `TRACKKCAL_KEYSTORE_BASE64`
  - `TRACKKCAL_KEYSTORE_PASSWORD`
  - `TRACKKCAL_KEY_ALIAS`
  - `TRACKKCAL_KEY_PASSWORD`
- Never commit secrets; store them in the CI/CD secret store or the local shell when invoking `eas build`.

## 4. Build Commands
```bash
npx eas build --platform android --profile production
npx eas submit --platform android --profile production
```

## 5. Play Console To‑Do
- Upload the generated `.aab`.
- Fill out store listing (title, short/long description, screenshots, feature graphic).
- Complete the Content Rating questionnaire.
- Provide privacy policy URL and Data Safety answers (see `docs/data-safety.md`).
- Enable Play Integrity / App Signing if required.

## 6. Post-Release Monitoring
- Track crash/freezing reports from Play Console & Sentry (when enabled).
- Monitor notification delivery success.
- Review analytics for onboarding success and retention.

