import assert from 'node:assert/strict';
import { parseVoiceAutomations } from '../src/utils/localAutomationParser';

const result = parseVoiceAutomations(
  "today at 12:30pm we have snack break - then from 3-4 lunch time and 4-6 it's movie time because it's party day",
  undefined,
  '10:00',
);

assert.equal(result.automations.length, 3);
assert.deepEqual(result.automations.map((item) => item.scheduledTime), ['12:30', '15:00', '16:00']);
assert.deepEqual(result.automations.map((item) => item.title), [
  'Snack break',
  'Lunch time',
  "Movie time because it's party day",
]);
assert.match(result.automations[1].reminderText, /15:00–16:00/);
assert.match(result.automations[2].reminderText, /16:00–18:00/);

console.log('multi-trigger parser: passed');
