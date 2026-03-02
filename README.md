# Dozlo

Dozlo is an Ionic + Angular + Capacitor Android app for streaming and playing audio stories with a stable background player, ambient audio support, offline downloads, and Firebase-backed content/auth flows.

## Tech Stack
- Ionic 8 + Angular 20
- Capacitor 7 (Android)
- Firebase (Auth, Firestore, Analytics)
- Cloudflare R2 audio/image delivery

## Key App Areas
- `Home`, `Explore`, `Library`, `Profile` main flows
- Global audio player with background playback support
- Offline download management and offline-aware UX
- Force-update check using Firestore config

## Project Structure
- `src/` Angular/Ionic application code
- `android/` native Android project (Play Store release values live here)
- `resources/` app icon and splash assets
- `scripts/` custom tooling (obfuscation and postinstall patching)

## Common Commands
```bash
npm install
npm run start
npm run build
npx cap sync android
```

## Release Versioning (Play Store)
Current Android release values:
- `versionName`: `2.0.9`
- `versionCode`: `18`

Files that must stay in sync:
- `android/app/build.gradle`
- `src/app/version.ts`
- `package.json` (project/package version)

Before every Play Store release, update versions in this order:
1. Choose next semantic app version (`versionName`) like `2.0.10`.
2. Increment `versionCode` by exactly `+1` from previous release.
3. Update in `android/app/build.gradle`:
   - `versionName "x.y.z"`
   - `versionCode N`
4. Update in `src/app/version.ts`:
   - `APP_VERSION = 'x.y.z'`
   - `BUILD_NUMBER = 'N'`
   - `lastUpdated = 'YYYY-MM-DD'`
5. Update `package.json` `version` to `x.y.z`.
6. Build and sync Android:
   ```bash
   npm run build
   npx cap sync android
   ```
7. Generate release artifact from Android Studio / Gradle and upload to Play Console.
8. If force update is used, update Firestore `app_config/force_update` values (`latestVersionCode`, `latestVersionName`, and `minSupportedVersionCode` when needed).

## Play Store Rule
- Play Console rejects uploads if `versionCode` is not greater than the last published build.
- `versionName` is user-facing; `versionCode` is strictly an increasing integer.
