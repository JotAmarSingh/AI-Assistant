import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const navigation = read('src/components/android/AndroidNavigationBar.tsx');
const topBar = read('src/components/android/AndroidTopAppBar.tsx');
const app = read('src/App.tsx');
const settings = read('src/components/views/SettingsView.tsx');
const anchors = read('src/components/views/RemindersAnchorsView.tsx');
const hub = read('src/components/views/GeminiLiveHubView.tsx');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const nativePlugin = read('android/app/src/main/java/com/amarsingh/daytrace/DayTraceNativePlugin.java');

assert(!navigation.includes("label: 'AI Agent'"), 'AI Agent must not appear in bottom navigation');
assert(!navigation.includes("id: 'review'"), 'review must not be a bottom tab');
assert(!navigation.includes('MiniCyberneticFaceIcon'), 'bottom navigation must not use the old AI face');
assert.equal((navigation.match(/\{ id: '/g) || []).length, 6, 'bottom navigation must contain six production tabs');

assert(topBar.includes('id="settings-top-btn"'), 'top-left Settings entry is required');
assert(!topBar.includes('voice-capture-top-btn'), 'meeting microphone must not be in the top bar');
assert(!topBar.includes('json-backup-btn'), 'backup must live in Settings, not the top bar');
assert(!topBar.includes('MiniCyberneticFaceIcon'), 'top-left app face must be removed');

assert(app.includes("case 'hub'") && app.includes('<GeminiLiveHubView />'), 'Home must retain the full-screen AI hub');
assert(app.includes("case 'settings'") && app.includes('<SettingsView'), 'Settings route is required');
assert(!app.includes("case 'review'"), 'standalone AI Agent route must be removed');
assert(hub.includes('sticky bottom-0'), 'Home composer must remain attached to the bottom of the resized viewport');
assert(manifest.includes('android:windowSoftInputMode="adjustResize"'), 'Android keyboard must resize the app around the composer');

for (const label of ['Permission Settings', 'Saved Times', 'Check-In Prompt Frequency', 'Gaming Mode', 'Alarm Audio Ringtone', 'Data Backup & Restore']) {
  assert(settings.includes(label), `Settings is missing ${label}`);
}
assert(!settings.includes('Test In-App'), 'production Settings must not expose Test In-App');
assert(!settings.includes('Test Lock-Screen'), 'production Settings must not expose Test Lock-Screen');
assert(settings.includes("'daytrace-backup.json'"), 'backup export must update one stable JSON filename');
assert(settings.includes('Current data found') && settings.includes('Merge Backup'), 'import must verify and merge with current data');

assert(anchors.includes('<EndOfDayReviewView embedded />'), 'former AI Agent review must be embedded in Anchors');
for (const label of ['Fixed-Time Planning Anchors', 'Voice Automations & Triggers', 'Contextual Reminders']) {
  assert(anchors.includes(label), `Anchors is missing ${label}`);
}

assert(app.includes('<FirstRunPermissionsModal />'), 'first-run permission setup must be mounted');
for (const permission of ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED', 'ACCESS_BACKGROUND_LOCATION', 'RECORD_AUDIO']) {
  assert(manifest.includes(permission), `Android manifest is missing ${permission}`);
}
assert(nativePlugin.includes('public void requestMicrophonePermission'), 'native microphone permission request is required');
assert(nativePlugin.includes('MediaStore.Downloads.DISPLAY_NAME + " = ? AND "'), 'native export must replace the existing backup file');

console.log('Release UI, permissions, navigation, keyboard and backup structure passed.');
