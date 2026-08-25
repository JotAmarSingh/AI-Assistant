import assert from 'node:assert/strict';
import { buildSmartTokenContext } from '../src/services/geminiService';
import { parseReminderTriggerTime } from '../src/services/nativeBridge';

const fullContext = {
  location: 'Office',
  coords: { latitude: 30.901, longitude: 75.857 },
  savedPlace: 'Office',
  locationPermission: 'GRANTED' as const,
  activeFocusTask: 'Private client task',
  memories: [{ category: 'PERSONAL', fact: 'Private memory' }],
  pendingTasks: [{ title: 'Private pending task' }],
  permissions: { location: 'GRANTED', microphone: 'DENIED' },
  features: ['local tasks', 'live location'],
};

const general = buildSmartTokenContext('Explain photosynthesis', fullContext);
assert.doesNotMatch(general, /30\.901|Office|Private|permission/i, 'General questions must not receive private app context');

const savedPlace = buildSmartTokenContext('Where am I?', fullContext);
assert.match(savedPlace, /saved place match="Office"/);
assert.doesNotMatch(savedPlace, /30\.901|Private client task/, 'A saved-place match must not send coordinates or tasks');

const coordinates = buildSmartTokenContext('Where am I?', { ...fullContext, savedPlace: undefined });
assert.match(coordinates, /latitude=30\.901000, longitude=75\.857000/);
assert.doesNotMatch(coordinates, /Private client task|Private memory/, 'Location lookup must send coordinates only');

const capabilities = buildSmartTokenContext('Which permissions can you access?', fullContext);
assert.match(capabilities, /location=GRANTED/);
assert.doesNotMatch(capabilities, /30\.901|Private client task|Private memory/, 'Capability questions must not receive user content');

const now = new Date('2026-08-25T12:00:00+05:30');
const evening = new Date(parseReminderTriggerTime('7:30 PM', now)!);
assert.equal(evening.getHours(), 19);
assert.equal(evening.getMinutes(), 30);

const tomorrow = new Date(parseReminderTriggerTime('tomorrow at 6:05 am', now)!);
assert.equal(tomorrow.getDate(), now.getDate() + 1);
assert.equal(tomorrow.getHours(), 6);
assert.equal(tomorrow.getMinutes(), 5);

console.log('AI context isolation and reminder-time tests passed.');
