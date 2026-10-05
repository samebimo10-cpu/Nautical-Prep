# Native builds (Capacitor)

The PWA is the primary product. Capacitor wraps the same `dist/` for store presence.

## Android
Requires Android Studio / SDK 34+, JDK 17.
```bash
cd apps/web
npx cap add android            # first time only (creates apps/web/android)
pnpm cap:build:android         # vite build → cap sync → ./gradlew bundleRelease
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```
Signing: create an upload keystore, configure `android/app/build.gradle` `signingConfigs`, and keep the keystore and passwords out of Git.
Speech recognition in the WebView needs the `RECORD_AUDIO` permission and Google speech services. Plan a native STT plugin behind the `VoiceProvider` interface for offline voice.

## iOS
Requires macOS + Xcode 15+. `npx cap add ios && npx cap sync ios && npx cap open ios`, set the team and bundle id, then Archive. Add `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription` to Info.plist.

## Not done in the build sandbox
No Android SDK was available, so the AAB was **not** produced here (M8 verify step `cap:build:android` is pending).
