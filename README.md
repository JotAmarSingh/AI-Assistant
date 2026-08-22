# DayTrace

DayTrace is the existing React/TypeScript + Capacitor Android accountability app with native Android alarms, interactive lock-screen check-ins, task persistence, day-separated history, smart locations, categories, Meeting Mode, and optional Google Sheets backup.

- Android application ID: `com.amarsingh.daytrace`
- Version: `1.2.0` (`versionCode 2026082201`)
- Local parsing: deterministic and offline; no AI API key is required by the installed Android app.
- Google Sheets is optional and uses Android Google Identity Services.

## Local checks and web build

Requirements: Node.js 22+.

```bash
npm install
npm test
npm run build
npx cap sync android
```

The optional development server can use `GEMINI_API_KEY`, but the Android app does not require it and always retains its offline parser fallback.

## Android build

Open `android/` in Android Studio, or run the included GitHub Actions workflow. The workflow installs Android API 36, verifies the Gradle wrapper JAR, runs TypeScript/regression tests, builds the web bundle, syncs Capacitor, and assembles an APK.

The workflow uses the official Gradle Actions dependency cache and a four-attempt bounded backoff wrapper. Temporary Maven Central HTTP 429 responses therefore retry while already-downloaded artifacts remain cached; genuine compile failures still fail after the final attempt.

The project intentionally does not contain a signing key. Configure one stable key for every APK that must update the same installed app:

- `DAYTRACE_KEYSTORE_BASE64`
- `DAYTRACE_KEYSTORE_PASSWORD`
- `DAYTRACE_KEY_ALIAS`
- `DAYTRACE_KEY_PASSWORD`

GitHub Actions builds a release APK with those secrets. Without them it builds a debug APK and warns that a hosted-runner debug certificate may not match an older installation.

Android only accepts an in-place update when both the application ID and signing certificate match. DayTrace preserves `com.amarsingh.daytrace` and increases `versionCode`, but an APK signed by an unavailable older key cannot be replaced in place. Use DayTrace Export before any unavoidable uninstall, then Import after installation.

## Google Sheets OAuth setup

In Google Cloud Console:

1. Enable Google Sheets API and Google Drive API.
2. Configure the OAuth consent screen.
3. Create an Android OAuth client for package `com.amarsingh.daytrace`.
4. Use the SHA-1 from the exact stable signing key used for the installed/release APK. The workflow prints `:app:signingReport` to make this visible.
5. Rebuild with that same key.

Android uses `AuthorizationClient`, not the browser Google Identity Services script. Cancellation is non-destructive, expired/unauthorized requests retry authorization once, and Disconnect Google revokes the granted Sheets/Drive-file scopes when account metadata is available. The PWA/browser path can optionally use `VITE_GOOGLE_CLIENT_ID`.

## Phone verification

For the recurring accountability check:

1. Install the APK and open Anchors.
2. Enable check-in prompts, choose the interval, wake time, and bed time.
3. Tap **Test Lock-Screen (10s)**. Grant notifications if Android asks, then immediately lock the phone.
4. Verify the public lock-screen notification shows up to two stable-ID task suggestions and **Write update**.
5. Tap a task after unlocking. Confirm it becomes the only Active task, current focus/activity changes, and one TASK_STARTED entry is present.
6. Repeat with an inline written reply and confirm the exact text becomes current activity with one UPDATE entry.
7. Swipe DayTrace away and repeat. Reopen afterward to verify native pending-state reconciliation is idempotent.
8. Test disabled prompts, Gaming Mode, snooze, sleep window, Battery Saver, reboot, time/timezone changes, and app replacement.
9. Deny notifications once, confirm the real denied state appears, then use Android settings to enable them and retry.

For Meeting Mode, tap the top microphone, confirm recording, lock the phone, verify the microphone foreground-service notification remains only while recording, then Stop & save. The recording is stored in private app storage. This build does not pretend that Pixel AICore exposes a supported general recorded-audio transcription API: add/correct a transcript in Meetings, then DayTrace creates its summary and selectable action items locally.

## Data migrations

State schema version 5 is migrated non-destructively at load/import/restore. Durable settings, active task state, history, categories, learned data, locations, meetings, and native pending events are retained. Legacy sample records are removed only when seeded IDs/coordinates or a proven multi-record template constellation identifies them; user-created items are never deleted merely because they are named Home, Office, or Gym.

See `DELIVERY_NOTES.md` for the release changelog and test record.
