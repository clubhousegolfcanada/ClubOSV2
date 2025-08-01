# ClubOS Native App Setup

## Quick Start

1. **Add platforms:**
```bash
npx cap add ios
npx cap add android
```

2. **Build & Sync:**
```bash
npm run build
npx cap sync
```

3. **Open in IDE:**
```bash
# For iOS (requires Mac + Xcode)
npx cap open ios

# For Android (requires Android Studio)
npx cap open android
```

## Android APK Build
1. Open Android Studio
2. Build → Build Bundle(s) / APK(s) → Build APK(s)
3. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

## iOS Build
1. Open Xcode
2. Select device/simulator
3. Product → Run

## Publishing
- **Android**: Google Play Console ($25 one-time)
- **iOS**: Apple Developer Program ($99/year)

## Features Included
- Full ClubOS web app
- Push notifications
- Native app icon
- Offline support
- Fullscreen mode

## Update App Content
The app loads from: https://club-osv-2-owqx.vercel.app
Any updates to the website automatically appear in the app!