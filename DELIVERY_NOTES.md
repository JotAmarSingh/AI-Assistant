# DayTrace 1.4.8 delivery notes

## Fixed

- Custom task artwork now uses Google's current native image endpoints, attempting the cost-efficient \`gemini-3.1-flash-lite-image\` model first with \`gemini-2.5-flash-image\` and \`gemini-3.1-flash-image\` as compatible fallbacks.
- A free-tier image response with quota limit \`0\` is now reported as image access/billing required instead of a temporary rate limit. Text AI can remain connected independently.
- Accountability messages now use Gemini's structured action planner whenever Online AI is available. Offline messages enter a timestamped Pending AI Inbox and are automatically classified and executed on reconnection; delayed Timeline actions retain their original capture time, while unresolved items remain pending for clarification. Natural updates such as “Just reached office” and “Last night I…” no longer become permanent memory, duplicate final voice transcripts are ignored, and schema migration 10 recovers check-ins previously misfiled by the old fallback.
- Text-AI connectivity and image-generation health are reported separately. Image rate limits, rejected image access, offline state, and pending work can no longer masquerade as a successfully generated generic icon.
- Failed/offline visual requests remain durable and de-duplicated, respect a request circuit breaker, retry automatically, and can be retried explicitly from Settings without reopening each task.
- While Gemini artwork is pending, DayTrace renders task-specific local vector artwork instead of the generic person/star emoji. Medicine/family, editing, social media, client work, fitness, meals, travel, calls, and other common contexts have distinct compositions; numeric workout quantities are retained.
- Free-text replies to the periodic accountability prompt now use DayTrace intent parsing instead of always creating an active task; past/present updates such as “logged in after lunch”, “returned from break”, and “resumed work” are Timeline-only.
- Tapping a real suggested task still starts that task directly, while reminder directives and future commitments retain their existing action behavior.
- Replaced Android's oversized native date dialog with a compact DayTrace calendar and removed splash artwork from native dialog backgrounds.
- Added visible category management in the Tasks header and a direct New-category action inside task creation.
- Calendar history now recovers dated records from older JSON backups, and new backups include every archived day.
- Pending task and category artwork retries immediately after reconnecting when the configured Gemini project has image-generation API access.
- Present-status check-ins such as “I am still on the bed” are now logged to Timeline without creating a task or reminder, including on Pixels with on-device AI available.
- Timeline rows are strictly filtered by the selected calendar date: today starts clean, while archived entries remain visible only after selecting their date.
- Offline-created tasks, timeline logs, timetable entries, and task categories now enter a durable, de-duplicated visual queue. Missing Gemini vector stickers/islands resume automatically when the saved API key and connectivity are available, without opening each tab again.
- Location-triggered errand commands are executed by DayTrace before conversational AI. Words such as “medicine” in the reminder message no longer turn the command into medical advice.
- “My current location” and “here” resolve to the live/saved place instead of silently defaulting to Office; DayTrace verifies background location access before activating a native enter/exit geofence.
- Gemini's structured action planner now supports current/saved-place enter/exit reminders for compound commands while still executing and validating the action locally.

- Compound Accountability commands now use Gemini as a structured semantic planner and can execute several requested operations, such as saving the current GPS location and logging current work, instead of returning a generic acknowledgement.
- Cloud action plans are strictly allowlisted and validated before DayTrace mutates local data; Gemini cannot directly write, delete, or claim completion of an operation that the device did not execute.
- Simple known commands remain on-device to conserve tokens. Complex commands send only compact capability/permission status and relevant saved-place or pending-task names, never the complete user database.
- Completed action commands no longer receive invented conversational follow-up questions; DayTrace asks only for information required to safely finish an operation.

- Fixed the Tasks tab crash caused by a UI icon shadowing JavaScript's built-in `Map` collection.
- Fixed the Anchors tab crash caused by the provider omitting the persisted automations array.
- Added per-screen crash recovery so a future rendering error cannot blank the entire app or require a force-close.
- Accountability commitments now persist across days until completed, deliberately postponed, or cancelled; critical commitments receive one challenge before postponement.
- “What should I do next?” now returns one resource-, deadline-, location-, duration-, energy-, and active-focus-aware action instead of an unranked task dump.
- Context reminders can trigger when leaving the desk, rendering starts/finishes, work finishes, lunch begins, or a client deadline is due tonight.
- Rendering, calls, and travel now mark related resources as busy so unavailable work is not recommended.
- Interruptions are classified as expected, unexpected, avoidable, or unavoidable and feed the local habit ledger.
- Reported health needs and urgent family needs override productivity recommendations.
- New tasks are captured without replacing an active focus task; an explicit “working on …” statement creates/activates the task and records it on the timeline.
- Planned-versus-actual timing, daily carry-forward counts, and rolling seven-day habit insights are stored locally and included in end-of-day review.
- Explicit “No/Actually/I mean” corrections update the latest relevant record instead of creating a contradictory timeline entry.
- Accountability confirmations are concise and end with one next action when available.
- Normal Chat, Research, and Creative modes are read-only. Explicit actions require a tappable switch back to Accountability before any local data changes.

- Gemini API keys are no longer embedded in source. The user enters a key once; successful verification stores it on-device for future launches and in-place updates.
- Online AI context is intent-selective: general questions receive no private app data; saved-place location answers receive only the place name; untagged location lookup receives only live coordinates; permission/capability status is sent only when asked.
- “Where am I?” now reads live GPS, matches the nearest saved place within its configured radius, and otherwise performs a cautious grounded lookup that must not invent a house number.
- Device commands now use the deterministic local action parser. Tasks, reminders, saved places, and timeline commands no longer upload the full state or consume Gemini tokens.
- Removed fabricated medicine prices/dosages, travel fares, weather, and “verified grounding” claims.
- Time parsing now preserves minutes and meridiem (for example, 7:30 PM becomes 19:30) before scheduling the native alarm.
- Android IME handling no longer subtracts Gboard twice. Bottom navigation hides while typing, keeping the composer attached to the keyboard.
- Native geofences persist request-ID-to-display-name mappings, replace stale registrations, and deliver saved names such as Home, Office, or Gym.
- Location reminders request foreground/background access only when enabled and remain off when required access is denied.
- JSON export uses Android scoped MediaStore Downloads and no longer opens an unsolicited share sheet.
- Notification small icons now use a valid monochrome DayTrace status icon.
- First launch now presents a one-time permission setup for notifications, microphone, location/background location, and exact alarms; every permission remains manageable in Settings.
- AI corrections and short follow-ups remain attached to the recent cloud answer instead of being logged as unrelated offline activities.
- Festivals, weather, news, prices, opening hours, nearby-place searches, outfit/weather advice, and medical questions require live grounding and never fall back to stale model memory.
- The trusted device date, year, time, and timezone are included in cloud questions; only the last two compact conversation exchanges are retained.
- Mixed requests such as finding an event date and reminding before it verify the date live, ask for a clock time when missing, and then create the linked task/reminder.
- Offline live-data failures now offer contextual actions to fetch after reconnection, show a timestamped verified cache, or open the relevant installed app.
- Unclassified statements enter a pending local memory inbox; explicit preferences can trigger narrowly relevant reminders and can be paused or disabled.

## Changed

- Replaced the home-screen bot WebP with an asset-free animated energy orb with idle, listening, thinking, speaking, alert, and reduced-motion states.
- Removed the legacy Sheets/cloud-sync implementation, OAuth dependencies, background worker, configuration, and UI. Local JSON export/restore is the only backup path.
- Upgraded Android version to 1.4.8 (2026082605), preserving package \`com.amarsingh.daytrace\`.
- Rebuilt Timetable, Task Islands, category task details, Timeline, Meetings, Anchors, and Settings around real user records; fresh installs now show honest empty states with no sample schedules, categories, timeline events, XP, streaks, or claimable rewards.
- Added horizontal swipe navigation across the six production tabs, animated water/island scenes, cached Gemini-generated category islands and per-task vector stickers, and working task complete/reopen/start/edit/delete/checklist controls.
- Fixed natural activity check-ins such as “I’m working on app development” so Accountability mode creates an active task and a visible timeline event.
- Reward confetti now stops and clears after the claim animation or whenever the rewards view closes.
- Replaced the top-left app face with Settings, removed the top meeting microphone, and removed the AI Agent bottom tab.
- Kept the full-screen Home energy orb and keyboard-attached composer; moved daily review intelligence into Anchors.
- Moved permissions, saved times, check-in frequency, Gaming Mode, alarm audio, JSON backup/restore, and fresh start into Settings.
- JSON imports now warn and merge with current records instead of deleting new tasks/reminders; saved location tags are included, and native export rewrites \`daytrace-backup.json\`.

## Verification completed

- TypeScript \`tsc --noEmit\`: passed.
- Vite production build: passed.
- Capacitor Android sync: passed.
- Native accountability/reconciliation regression tests: passed.
- Daily history, state migration, multi-trigger, meeting processing, and task parsing tests: passed.
- AI context isolation and reminder-time tests: passed.
- AI routing, grounded follow-up, and changing-fact classification tests: passed.
- Deferred visual-queue de-duplication and prompt privacy tests: passed.
- Accountability engine, contextual trigger, focus protection, persistence, correction, postponement, interruption, planned-versus-actual, and habit-analysis tests: passed.
- Static checks cover scoped JSON export, saved geofence names, keyboard inset handling, and absence of legacy cloud-sync code.
- Runtime rendering smoke tests cover Tasks and Anchors with the real DayTrace provider.

## Delivery gate

An in-place update requires the same signing certificate as the APK currently installed on the client device. The CI build must report stable signing enabled and its certificate must match the installed Pixel 10a app. The final Pixel checklist in \`README.md\` must still be completed on the physical device before client handoff.
