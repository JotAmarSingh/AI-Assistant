import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFreshDailyState } from '../src/utils/initialState';
import {
  reconcileNativeAccountabilityEvents,
  selectNativeSuggestedTasks,
} from '../src/utils/nativeAccountability';

const base = createFreshDailyState();
base.tasks = [
  { id: 'focus', title: 'Focus', category: 'OFFICE', owner: 'ME', status: 'NEXT', priority: 1, createdAt: '09:00' },
  { id: 'active', title: 'Active', category: 'OFFICE', owner: 'ME', status: 'ACTIVE', priority: 5, createdAt: '09:01' },
  { id: 'next-high', title: 'Next high', category: 'OFFICE', owner: 'ME', status: 'NEXT', priority: 10, createdAt: '09:02' },
];
base.current.focusTaskId = 'focus';

assert.deepEqual(
  selectNativeSuggestedTasks(base.tasks, base.current.focusTaskId).map((task) => task.id),
  ['focus', 'active'],
  'Suggestions must prefer focus, then current ACTIVE task',
);

const taskEvent = {
  nativeEventId: 'native-task-1',
  actionType: 'TASK_SELECTED',
  type: 'TASK_STARTED',
  relatedTaskId: 'next-high',
  taskTitle: 'Next high',
  requestedTaskStatus: 'ACTIVE',
  makeCurrentFocus: true,
  currentActivity: 'Working on: Next high',
  description: 'Working on: Next high',
  time: '10:30',
  date: '2026-08-21',
  source: 'CHECK_IN',
  syncStatus: 'PENDING',
  createdAt: 1_777_000_000_000,
};
const taskResult = reconcileNativeAccountabilityEvents(base, [taskEvent]);
assert.equal(taskResult.state.tasks.find((task) => task.id === 'next-high')?.status, 'ACTIVE');
assert.equal(taskResult.state.tasks.find((task) => task.id === 'active')?.status, 'NEXT');
assert.equal(taskResult.state.current.focusTaskId, 'next-high');
assert.equal(taskResult.state.current.activity, 'Working on: Next high');
assert.equal(taskResult.state.timeline.length, 1);
assert.equal(taskResult.state.timeline[0].type, 'TASK_STARTED');
assert.equal(taskResult.state.timeline[0].relatedTaskId, 'next-high');

const duplicateResult = reconcileNativeAccountabilityEvents(taskResult.state, [taskEvent]);
assert.equal(duplicateResult.state.timeline.length, 1, 'A replay must not add a second timeline event');

const exactReply = '  Exact RemoteInput text  ';
const replyResult = reconcileNativeAccountabilityEvents(duplicateResult.state, [{
  nativeEventId: 'native-reply-1',
  actionType: 'WRITTEN_UPDATE',
  type: 'UPDATE',
  currentActivity: exactReply,
  description: exactReply,
  time: '10:45',
  source: 'CHECK_IN',
  syncStatus: 'PENDING',
  createdAt: 1_777_000_900_000,
}]);
assert.equal(replyResult.state.current.activity, exactReply);
assert.equal(replyResult.state.timeline.at(-1)?.description, exactReply);
assert.equal(replyResult.state.timeline.at(-1)?.type, 'UPDATE');

const snoozedUntilMillis = 1_777_004_500_000;
const snoozeResult = reconcileNativeAccountabilityEvents(replyResult.state, [{
  nativeEventId: 'native-snooze-1',
  actionType: 'SNOOZE',
  snoozedUntilMillis,
}]);
assert.equal(Date.parse(snoozeResult.state.userSettings.snoozedUntil || ''), snoozedUntilMillis);
assert.equal(snoozeResult.state.timeline.length, replyResult.state.timeline.length);

const openResult = reconcileNativeAccountabilityEvents(snoozeResult.state, [{
  nativeEventId: 'native-open-1',
  actionType: 'OPEN_PROMPT',
}]);
assert.equal(openResult.shouldOpenPrompt, true);
assert.deepEqual(openResult.acknowledgedEventIds, ['native-open-1']);

const meetingEvent = {
  nativeEventId: 'native-meeting-1',
  actionType: 'MEETING_STOPPED',
  meetingId: 'meeting-1',
  meetingTitle: 'Party planning',
  meetingStatus: 'STOPPED',
  startedAtMillis: 1_777_005_000_000,
  endedAtMillis: 1_777_005_600_000,
  durationSeconds: 600,
  audioPath: '/private/daytrace/meetings/meeting-1.m4a',
  time: '11:00',
  date: '2026-08-21',
  source: 'CHECK_IN',
};
const meetingResult = reconcileNativeAccountabilityEvents(openResult.state, [meetingEvent]);
assert.equal(meetingResult.state.meetings.length, 1);
assert.equal(meetingResult.state.meetings[0].status, 'NEEDS_TRANSCRIPT');
assert.equal(meetingResult.state.timeline.filter((item) => item.id === meetingEvent.nativeEventId).length, 1);
const duplicateMeeting = reconcileNativeAccountabilityEvents(meetingResult.state, [meetingEvent]);
assert.equal(duplicateMeeting.state.meetings.length, 1, 'Meeting replay must not duplicate the meeting');
assert.equal(duplicateMeeting.state.timeline.filter((item) => item.id === meetingEvent.nativeEventId).length, 1, 'Meeting replay must not duplicate the timeline row');

const mainActivitySource = readFileSync(new URL('../android/app/src/main/java/com/amarsingh/daytrace/MainActivity.java', import.meta.url), 'utf8');
const manifestSource = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
assert.match(mainActivitySource, /WindowInsetsCompat\.Type\.displayCutout\(\)/, 'Android shell must account for display cutouts');
assert.match(manifestSource, /android:windowSoftInputMode="adjustResize"/, 'Android must resize the Activity above the keyboard');
assert.doesNotMatch(mainActivitySource, /WindowInsetsCompat\.Type\.ime\(\)/, 'The keyboard inset must not be applied twice');
assert.match(mainActivitySource, /marginParams\.setMargins\(/, 'Android shell must inset the WebView with native layout margins');
assert.doesNotMatch(mainActivitySource, /GoogleAuthorization|AuthorizationClient/, 'Removed Google Sheets authorization must not remain in the Activity');

const nativePluginSource = readFileSync(new URL('../android/app/src/main/java/com/amarsingh/daytrace/DayTraceNativePlugin.java', import.meta.url), 'utf8');
assert.doesNotMatch(nativePluginSource, /GoogleSheets|AuthorizationClient|NightlySyncWorker/, 'Removed cloud sync code must not remain in the native plugin');
assert.match(nativePluginSource, /MediaStore\.Downloads\.EXTERNAL_CONTENT_URI/, 'JSON export must use scoped Android Downloads storage');
assert.match(nativePluginSource, /PREFS_GEOFENCE_NAMES/, 'Native geofences must preserve user-facing saved-place names');

console.log('Native accountability reconciliation tests passed.');
