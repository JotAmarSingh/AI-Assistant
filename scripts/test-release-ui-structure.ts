import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const navigation = read('src/components/android/AndroidNavigationBar.tsx');
const topBar = read('src/components/android/AndroidTopAppBar.tsx');
const app = read('src/App.tsx');
const settings = read('src/components/views/SettingsView.tsx');
const anchors = read('src/components/views/RemindersAnchorsView.tsx');
const hub = read('src/components/views/GeminiLiveHubView.tsx');
const timetable = read('src/components/views/TimetableView.tsx');
const taskBoard = read('src/components/views/TaskBoardView.tsx');
const timeline = read('src/components/views/TimelineView.tsx');
const meetings = read('src/components/views/MeetingsView.tsx');
const rewards = read('src/components/rewards/RewardsVaultModal.tsx');
const initialState = read('src/utils/initialState.ts');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const nativePlugin = read('android/app/src/main/java/com/amarsingh/daytrace/DayTraceNativePlugin.java');
const dayContext = read('src/context/DayContext.tsx');

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
assert(app.includes("const swipeTabs: AndroidTab[] = ['hub', 'timetable', 'board', 'timeline', 'meetings', 'reminders']"), 'all six production tabs must support ordered horizontal swipe navigation');
assert(app.includes('<ViewErrorBoundary key={activeTab}'), 'each tab must be isolated by the runtime recovery boundary');

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

for (const legacyExample of ['Video Editing', 'Growth Strategy', 'Client Feedback', 'Coffee Break']) {
  assert(!timetable.includes(legacyExample), `Timetable must not render legacy example ${legacyExample}`);
  assert(!timeline.includes(legacyExample), `Timeline must not render legacy example ${legacyExample}`);
  assert(!taskBoard.includes(legacyExample), `Tasks must not render legacy example ${legacyExample}`);
}
assert(taskBoard.includes('category-island-') && taskBoard.includes('task-card-'), 'category islands and task cards must be tappable');
assert(taskBoard.includes('Map as MapIcon'), 'the map icon must not shadow the built-in Map collection');
assert(dayContext.includes('automations: displayedState.automations || []'), 'Anchors must receive persisted automations from context');
for (const action of ['Start', 'Complete', 'Edit', 'Delete']) assert(taskBoard.includes(action), `task details must expose ${action}`);
assert(taskBoard.includes("useGeneratedVisual('CATEGORY_ISLAND'") && taskBoard.includes("useGeneratedVisual('TASK_STICKER'"), 'task and category artwork must use generated, cached visual assets');
assert(timetable.includes('No plans for this day') && timeline.includes('Nothing logged yet'), 'new timetable and timeline must have honest empty states');
assert(meetings.includes('record-meeting-island') && meetings.includes('Quest Progress'), 'Meetings must expose real recording and quest controls');
assert(rewards.includes('confetti.reset()'), 'reward confetti must be explicitly cleared');
assert(initialState.includes("category(UNCATEGORISED_CATEGORY_ID, 'Uncategorised'"), 'fresh state must retain only a neutral fallback category');

console.log('Release UI, permissions, navigation, keyboard and backup structure passed.');
