# Forged native apps (Capacitor)

The iOS and Android apps wrap the same web app that runs at https://forgedfightapp.github.io.
There is no separate codebase: `scripts/copy-web.mjs` copies the web files from the repo root into `native/www`, and Capacitor puts them into the native projects.

| | |
|---|---|
| App ID (bundle id / package) | `com.forgedfightapp.forged` |
| App name | Forged |
| Version | 3.7.0 (Android versionCode 370, iOS MARKETING_VERSION 3.7.0; bump `CURRENT_PROJECT_VERSION` / `versionCode` for every store upload) |
| Capacitor | 8.x (`@capacitor/core`, `android`, `ios`, `cli`, `assets`) |
| Icons and splash | `native/assets/` was built from `brand/forged/icon-1024.png` and `forged-mark-1024.png`. Regenerate with `npm run assets` |

## Requirements
- **Node 22+** (Capacitor 8 CLI). The box has Node 20 system-wide, so a local Node 22 was used: `/workspace/.tools/node-v22.23.3-linux-x64/bin`.
- **Android:** JDK 21 and the Android SDK (platform 36, build-tools 36/35). On the box they live in `/workspace/.tools/jdk21` and `/workspace/.tools/android-sdk`.
- **iOS:** a Mac with Xcode 26+ and CocoaPods or SPM. It can't be built on Linux. See the options below.

## Everyday commands
```bash
cd native
npm install
npm run sync          # copy web files -> www, then cap sync (do this after every web change)
npm run android:debug # debug APK -> android/app/build/outputs/apk/debug/app-debug.apk
npm run ios:open      # on a Mac: opens Xcode
```
On the box:
```bash
export JAVA_HOME=/workspace/.tools/jdk21 ANDROID_HOME=/workspace/.tools/android-sdk
export PATH=/workspace/.tools/node-v22.23.3-linux-x64/bin:$JAVA_HOME/bin:$PATH
cd /workspace/bjj-tracker/native && npm run android:debug
```

## Status (Oct 20, 2026)
- Android debug APK **built** on the box: `com.forgedfightapp.forged`, label "Forged", 3.7.0, target SDK 36, about 7 MB. It isn't committed (`*.apk` is git-ignored). A copy was left at `/workspace/forged-3.7.0-debug.apk` for sideloading.
- The iOS project was generated (`ios/App`). It hasn't been built, because that needs Xcode.
- Release builds need signing:
  - Android: an upload keystore plus Play App Signing.
  - iOS: an Apple Developer account, a distribution certificate and a provisioning profile.
- Neither exists yet. They come after the LLC and the developer accounts in `docs/launch-checklist.md`.

## Building iOS without owning a Mac
| Option | Cost | Notes |
|---|---|---|
| **Codemagic** (codemagic.io) | Free tier: 500 macOS build minutes a month | Has first-class Capacitor/Ionic workflows. Connect the GitHub repo, set the working dir to `native`, run `npm ci && npm run sync && npx cap sync ios`, then build and sign with an App Store Connect API key. It can upload straight to TestFlight. Usually the easiest choice. |
| **GitHub Actions macOS runners** | Free minutes on public repos. Private repos bill macOS minutes at 10× | Use a `macos-latest` job: Node 22 → `npm ci` → `npm run sync` → `xcodebuild -workspace ios/App/App.xcworkspace -scheme App archive`, plus `fastlane match` or manual certificates in secrets, and `xcrun altool`/`fastlane pilot` to upload to TestFlight. |
| **Ionic Appflow** | Paid (has a trial) | The managed Capacitor build service from the Capacitor team. |
| **EAS-style CI** (Expo EAS Build) | Free tier | It's built for Expo/React Native projects, not Capacitor, so it isn't a good fit here. Codemagic is the Capacitor equivalent. |
| **Rent a Mac** (MacinCloud, AWS EC2 Mac) | About $1/hour, or $25–50/month | A real Xcode GUI, useful for the first signing setup and debugging. |
| **Borrow or buy a Mac** | – | A Mac mini works fine. Needed anyway for the real-device Xcode debugging pass. |

Apple requires the build to be uploaded from Xcode or Apple tools, which every option above uses on macOS. Sign in with Apple must be enabled once Friends ships in the App Store build (`config.js` `apple:true`), because email sign-in alone is fine but any third-party login requires it.

## Native notes
- **Service worker:** the WKWebView on iOS doesn't run service workers for the app scheme, and on Android it isn't needed. The bundled files are already offline, so `sw.js` registration failing quietly inside the app is expected.
- **Data:** the native app has its own localStorage, separate from Safari's. Users moving from the web app should use Export → Import backup.
- **Payments:** Pro in the native apps must use StoreKit / Play Billing (for example the RevenueCat Capacitor plugin) behind the existing `Payments` stub in `app.js`. Stripe is only for web.
- **Barcode scanning** uses the camera through the web API. If needed, add `NSCameraUsageDescription` ("Scan food barcodes to look up nutrition") to `ios/App/App/Info.plist` before submitting.
