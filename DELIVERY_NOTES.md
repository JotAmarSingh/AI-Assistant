# DayTrace 1.2.0 delivery notes

## Fixed

- GitHub Actions now caches Gradle dependencies and retries Maven downloads with bounded backoff when shared runners receive temporary HTTP 429 rate limits.
- Multiple time triggers in one sentence now create one automation per time block. The reported 12:30 snack, 3–4 lunch, and 4–6 movie sentence produces three separate alarms.
- Google Sheets on Android now uses native AuthorizationClient state, token retry, cancellation/error status, explicit disconnect/revocation, and non-destructive failures.
- Notification permission is requested only when prompts are enabled or the test is tapped; a granted test continues automatically, while denied/disabled status routes to Android settings.
- Fresh installs no longer contain fake tasks, routines, conversations, timeline entries, learned suggestions, or saved locations.
- “Save/log/tag my current location as …” is routed before generic task queries.
- Status/navigation insets and `adjustResize` protect the UI from Pixel system bars and the keyboard.
- Destructive task, timeline, reminder, automation, routine, category, location, meeting, learning, focus-reset, timetable-replacement, and all-data actions require confirmation.

## Added

- Schema-v5 non-destructive migration with conservative seeded-template cleanup metadata.
- Optional balanced-power location learning, ignored geographic clusters, manual current-location saving, rename/radius/delete controls, and duplicate-name resolution.
- User-managed categories with safe task reassignment and an Uncategorised fallback.
- Native Meeting Mode foreground microphone service with confirm/start, pause/resume/stop, private audio recovery, persistent controls only while recording, a Meetings tab, editable transcript/summary, and reviewed action-item-to-task creation.
- Shared destructive confirmation modal and short Undo support where the operation is safely reversible.
- Stable signing-secret support and a GitHub Actions release/debug fallback with signing report.
- Regression tests for state migrations, date separation/learning reset, native reconciliation/idempotency, Meeting Mode processing, and multi-trigger parsing.

## Preserved

- Package `com.amarsingh.daytrace`, active-task persistence, daily separation, calendar/history viewing, lock-screen learned-task buttons, exact RemoteInput activity text, AlarmManager/Doze behavior, reboot restoration, and the existing interface/features.

## Migration notes

- Local state is upgraded to schema version 5 at startup, JSON import, and cloud restore.
- Existing user data is merged rather than replaced. Real user items named Home, Office, or Gym are preserved.
- Native actions remain in SharedPreferences until React acknowledges their unique event IDs; reconciliation never adds the same timeline/meeting event twice.
- Android package upgrades retain app data only when the previous and new APK use the same signing certificate. Export/import is the safe fallback when an old key is unavailable.

## Verification record

- TypeScript `tsc --noEmit`: passed.
- Native accountability/task/reply/snooze/open/meeting reconciliation tests: passed.
- Daily history and learning-reset tests: passed.
- Schema migration/sample-preservation tests: passed.
- Exact reported multi-trigger parser test: passed.
- Meeting transcript/summary/action extraction tests: passed.
- Vite production build and Capacitor Android sync: run as part of final packaging.
- Android `assembleDebug`, emulator/instrumentation, locked-screen, process-death, reboot, Battery Saver, microphone, and Google account-consent tests could not be executed in this sandbox because it has no Android SDK/device and no interactive Google account. The GitHub workflow is configured to run the Android compile on push.

## Known platform limitation

The Pixel may include Gemini Nano/AICore, but Android does not expose a supported general-purpose API to every third-party app for transcribing an arbitrary saved meeting recording. DayTrace therefore stores the recording safely, makes the transcript editable, and performs deterministic local summary/action extraction. It does not fabricate a transcription or claim Gemini Nano processed audio when it did not.
