# TrackKcal - Fitness Tracking Mobile App

A cross-platform fitness and wellness tracking application built with React Native and Expo, featuring a clean, modern Apple Health-inspired design.

## 🚀 Features

### ✅ Implemented
- **Top Navigation Bar** with hamburger menu, date picker, and calendar icon
- **7-Day Date Selector** with active day highlighting and smooth scrolling
- **Calories Card** showing Food, Exercise, and Remaining calories with flame icon
- **Macros Card** displaying Carbs, Protein, and Fat with progress tracking
- **Bottom Input Bar** for logging meals and exercises with keyboard handling
- **Modern UI Design** with soft colors, rounded corners, and subtle shadows
- **Responsive Layout** that adapts to different screen sizes
- **TypeScript Support** for better code quality and development experience

### 🔄 Coming Soon
- Expanded food and exercise database integrations
- Social features and sharing
- Push notification scheduling and campaigns

## 🛠 Tech Stack

- **React Native** with Expo for cross-platform development
- **TypeScript** for type safety
- **React Navigation** for navigation
- **date-fns** for date manipulation
- **Expo Vector Icons** for consistent iconography

## 📱 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (Mac) or Android Studio (for emulator)
- Expo Go app on your mobile device

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd trackkcal-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment variables**
   Create a `.env` file in the project root with:
   ```bash
   EXPO_PUBLIC_OPENAI_API_KEY=<your-openai-key>
   EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   ```
   Restart Expo (`npm start`) after adding or changing these values.

### Supabase Auth setup
TrackKcal now uses Supabase Auth (email OTP) so guests can upgrade to synced accounts.

1. In the Supabase dashboard, enable **Email OTP** under Authentication → Providers.
2. Ensure your project has a valid **Site URL** (for Expo dev you can use `https://example.com`, because we verify the 6-digit code inside the app).
3. Customize the OTP email template if desired; users receive a 6-digit code they enter in the app.
4. Keep the anon key in `.env` (`EXPO_PUBLIC_SUPABASE_ANON_KEY`)—never commit the service role key.

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Run on your device**
   - Scan the QR code with Expo Go app (Android) or Camera app (iOS)
   - Or press `a` for Android emulator / `i` for iOS simulator

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── TopNavigationBar.tsx
│   ├── DateSelector.tsx
│   ├── CaloriesCard.tsx
│   ├── MacrosCard.tsx
│   ├── StatCardsSection.tsx
│   └── BottomInputBar.tsx
├── screens/            # Screen components
│   └── HomeScreen.tsx
├── constants/          # App constants
│   ├── colors.ts
│   └── typography.ts
└── types/              # TypeScript type definitions
    └── index.ts
```

## 🎨 Design System

### Colors
- **Background**: White (#FFFFFF)
- **Card Background**: Light Blue (#F2F7FF)
- **Input Background**: Light Gray (#F5F5F5)
- **Active Accent**: Soft Green (#E8F5E9)
- **Text**: Primary (#000000), Secondary (#666666), Tertiary (#9E9E9E)

### Typography
- Clean system fonts for cross-platform consistency
- Hierarchical font sizes (12px - 28px)
- Font weights: Normal (400) to Bold (700)

### Components
- **Cards**: 16px rounded corners, subtle shadows, generous padding
- **Buttons**: 44x44 minimum touch targets, haptic feedback
- **Inputs**: Rounded design, proper keyboard handling

## 🔧 Available Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Open Android app
- `npm run ios` - Open iOS app  
- `npm run web` - Open web version

## 🔄 Data Sync

- Every meal and weight entry now has a stable UUID and `updatedAt` timestamp.
- Supabase syncs incrementally (per entry upsert/delete), so multiple devices on the same account no longer overwrite each other.
- Offline edits are queued; once a connection is available the queue flushes automatically.
- Local storage continues to act as a cache, so the app works fully offline.

## 🧪 Testing

The app has been tested on:
- iOS Simulator
- Expo Go mobile app
- Various screen sizes and orientations

## 📦 Production Release (Play Store)

1. **Configure secrets**
   - Base64-encode your Android keystore and set the following environment variables referenced in `eas.json`:
     - `TRACKKCAL_KEYSTORE_BASE64`
     - `TRACKKCAL_KEYSTORE_PASSWORD`
     - `TRACKKCAL_KEY_ALIAS`
     - `TRACKKCAL_KEY_PASSWORD`
   - Keep these secrets outside of source control (CI/CD, `.env.local`, etc.).

2. **Verify project health**
   ```bash
   npx expo-doctor
   npm audit
   ```

3. **Create the production bundle**
   ```bash
   npx eas build --platform android --profile production
   ```

4. **Submit to Play Console**
   ```bash
   npx eas submit --platform android --profile production
   ```

5. **Finalize in Play Console**
   - Upload privacy policy URL and complete the Data Safety form using `docs/data-safety.md`.
   - Provide screenshots (phone + 7" tablet), feature graphic, and localized descriptions.
   - Complete content rating and target audience disclosures.

See `docs/RELEASE.md` for the full checklist.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Inspired by Apple Health app design
- Built with Expo and React Native community tools
- Icons provided by Expo Vector Icons (Feather icon set)