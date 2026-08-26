import assert from 'node:assert/strict';
import { createFreshDailyState } from '../src/utils/initialState';
import { parseOfflineUserInput } from '../src/utils/offlineParser';
import { parseVoiceAutomations } from '../src/utils/localAutomationParser';

const state = createFreshDailyState('2026-08-26');

for (const checkIn of ['Logged in after lunch', 'I just returned from break', 'Resumed work on the client project']) {
  const parsedCheckIn = parseVoiceAutomations(checkIn, state, '14:05');
  assert.equal(parsedCheckIn.timelineLogs.length, 1, `“${checkIn}” must be a Timeline check-in`);
  assert.equal(parsedCheckIn.automations.length, 0, `“${checkIn}” must not create an automation`);
  const offlineCheckIn = parseOfflineUserInput(checkIn, state, '14:05');
  assert.equal(offlineCheckIn.extractedStateUpdate.newTasks?.length || 0, 0, `“${checkIn}” must not create a task`);
}

const explicitReminder = parseVoiceAutomations('Remind me after lunch to call the client', state, '11:00');
assert.equal(explicitReminder.automations.length, 1, 'An explicit reminder must retain automation behavior');

console.log('Periodic accountability check-in routing tests passed.');
