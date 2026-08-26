# DayTrace

DayTrace is a React/TypeScript + Capacitor Android accountability assistant with local tasks, exact reminders, interactive lock-screen check-ins, day-separated history, saved places/geofences, Meeting Mode, optional Gemini answers, and local JSON backup/restore.

- Android application ID: \`com.amarsingh.daytrace\`
- Version: \`1.4.7\` (\`versionCode 2026082604\`)
- Action execution is always local. Simple commands are parsed fully offline; complex compound commands may use Gemini for a compact structured plan without uploading the full app database.
- Online answers: the user adds a Gemini API key once from the AI Agent OFFLINE button. A verified key is stored on-device and reused automatically.
- Backup: JSON export writes directly to Android Downloads through MediaStore; restore accepts that JSON without an account.

## Local checks and web build

Requirements: Node.js 22+.

\`\`\`bash
npm install
npm test
npm run build
./node_modules/.bin/cap sync android
\`\`\`

## Android build and in-place updates

Open \`android/\` in Android Studio, or run the included GitHub Actions workflow. The workflow installs Android API 36, runs TypeScript/regression tests, builds the web bundle, syncs Capacitor, and assembles APKs.

The project intentionally does not contain a signing key. Configure the same stable key used for the client’s installed APK:

- \`DAYTRACE_KEYSTORE_BASE64\`
- \`DAYTRACE_KEYSTORE_PASSWORD\`
- \`DAYTRACE_KEY_ALIAS\`
- \`DAYTRACE_KEY_PASSWORD\`

Android accepts an in-place update only when the application ID and signing certificate match and the new version code is higher. This release preserves the application ID and raises the version code. If the prior signing key is unavailable, export JSON before uninstalling and restore it after installation.

## Pixel 10a verification

1. Install with \`adb install -r path/to/app-release.apk\`; confirm tasks, settings, saved places, history, and the stored Gemini key remain.
2. On the full-screen Home AI, verify the saved key reconnects without asking again. Ask “Which festival is upcoming in Punjab?”, then correct the answer with “No, it is Rakhi or Bhai Dooj.” Confirm both turns stay in one live-grounded conversation and the correction is not logged as an activity.
3. Ask “Where am I?” at a saved place; confirm the saved name is returned. Test an untagged place and verify the answer gives a cautious grounded road/neighborhood/city without inventing a house number.
4. Focus the AI typing field; confirm the bottom navigation hides and the composer sits directly above Gboard.
5. Speak a request; confirm the energy orb changes for listening, thinking, and speaking.
6. Create “Remind me at 7:30 PM”; confirm the automation shows 19:30 and the lock-screen notification has DONE and SNOOZE actions.
7. Let a real scheduled lock-screen prompt fire; verify inline reply/task actions after unlocking.
8. Save/rename/delete a place, enable location reminders with “Allow all the time,” and verify the user-facing saved name appears on arrival/departure.
9. Export JSON, confirm the file appears in Downloads, make a test change, restore, and confirm the prior state returns.
10. Reboot once and confirm future alarms and periodic prompts are restored.
11. Start one focus task, add another task, and confirm the new task is captured without replacing the active focus. Ask “What should I do next?” and verify only one available action is recommended.
12. Create “Remind me when rendering finishes to upload the video,” then say “The render has finished.” Confirm the contextual reminder fires once.
13. Switch to Research or Creative mode and request a task creation. Confirm no data changes until “Switch to Accountability and continue” is tapped.
14. Leave a task unfinished overnight (or exercise the day-rollover test), then confirm it carries forward with its count and remains actionable.

## Data migrations

State schema version 8 is migrated non-destructively at load/import/restore. Tasks, settings, history, categories, learned data, memories, locations, meetings, accountability ledgers, and pending native events are retained. Removed legacy cloud-sync fields are discarded without touching user records. Sample records are removed only when proven seed identifiers/template constellations identify them.

See \`DELIVERY_NOTES.md\` for the release changelog and verification record.
