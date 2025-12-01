# TrackKcal Data Safety Notes

Use this document when completing the Google Play Data Safety questionnaire and privacy policy.

## Data Collection
| Data Type | Purpose | Stored On Device | Sent Off Device | Notes |
| --- | --- | --- | --- | --- |
| Food entries (text + nutrition) | Core functionality (tracking) | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Synced securely to Supabase so you can access logs across devices. |
| Exercise entries | Core functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Synced to Supabase when user is logged in. |
| Weight entries | Core functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Synced so weight history is backed up remotely. |
| Goals / custom plans | Core functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Includes target calories, macros, and profile data (name, age, gender, height, weight, goals, activity level). Synced to Supabase when user is logged in. |
| User preferences | App functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Weight unit, notification settings, meal reminders. Synced to Supabase when user is logged in. |
| User settings | App functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Entry count, user plan (free/premium), device info. Synced to Supabase when user is logged in. |
| Entry tasks | App functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Tracks completion state for custom plan and registration tasks. Synced to Supabase when user is logged in. |
| Push tokens | App functionality (notifications) | Yes (AsyncStorage + Supabase) | Yes (Supabase + Expo push service) | Required to deliver reminders; synced to Supabase and stored with Expo's push service. |
| Push history | App functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Broadcast notification history. Synced to Supabase when user is logged in. |
| Saved prompts | App functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | User's saved meal prompts. Synced to Supabase when user is logged in. |
| Referral codes | App functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | User referral codes. Synced to Supabase when user is logged in. |
| Referral redemptions | App functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Referral code usage tracking. Synced to Supabase when user is logged in. |
| Referral rewards | App functionality | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Bonus entries earned from referrals. Synced to Supabase when user is logged in. |
| Photos taken for analysis | Core functionality | Temporarily (cache) | Yes (OpenAI API) | Images are uploaded to OpenAI for nutrition parsing; not retained by TrackKcal servers. |
| Phone numbers | Account management | Yes (AsyncStorage + Supabase) | Yes (Supabase) | Stored in Supabase for account lookups; never shared with third parties. |
| Email address | Authentication & sync | Yes (AsyncStorage + Supabase) | Yes (Supabase Auth) | Used to send OTP codes and link logs across devices. |

## Data Sharing
- Push tokens are shared with Expo's secure push notification service.
- Food/exercise photos are sent to OpenAI for image analysis when the user explicitly requests it.
- No analytics service is enabled by default; add disclosures if a third-party analytics provider is integrated later.

## Security
- Data is stored in `@react-native-async-storage/async-storage`, which uses OS-level sandboxing.
- Keystore secrets are injected at build time via the environment variables documented in `eas.json`.

## User Choice
- Users can delete logged entries individually from the UI.
- Clearing app data (Settings ➜ Apps ➜ TrackKcal ➜ Storage ➜ Clear data) removes all locally stored information.
- To revoke push notifications, the user can toggle permissions in the OS settings.

## Privacy Policy Checklist
Your external privacy policy should mention:
1. The types of personal/non-personal data the app stores locally.
2. The fact that optional camera/library media can be uploaded to OpenAI for nutrition analysis.
3. That push notification tokens are shared with Expo solely for delivering reminders.
4. Instructions on how to delete data or contact support.

