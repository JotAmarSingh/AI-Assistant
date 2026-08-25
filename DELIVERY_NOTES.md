# DayTrace 1.3.0 delivery notes

## Fixed

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
- Startup no longer bulk-requests notification, microphone, and location permissions.

## Changed

- Replaced the home-screen bot WebP with an asset-free animated energy orb with idle, listening, thinking, speaking, alert, and reduced-motion states.
- Removed the legacy Sheets/cloud-sync implementation, OAuth dependencies, background worker, configuration, and UI. Local JSON export/restore is the only backup path.
- Upgraded local state schema to version 6 and Android version to 1.3.0 (2026082501), preserving package \`com.amarsingh.daytrace\`.

## Verification completed

- TypeScript \`tsc --noEmit\`: passed.
- Vite production build: passed.
- Capacitor Android sync: passed.
- Native accountability/reconciliation regression tests: passed.
- Daily history, state migration, multi-trigger, meeting processing, and task parsing tests: passed.
- AI context isolation and reminder-time tests: passed.
- Static checks cover scoped JSON export, saved geofence names, keyboard inset handling, and absence of legacy cloud-sync code.

## Delivery gate

An in-place update requires the same signing certificate as the APK currently installed on the client device. The CI build must report stable signing enabled and its certificate must match the installed Pixel 10a app. The final Pixel checklist in \`README.md\` must still be completed on the physical device before client handoff.
