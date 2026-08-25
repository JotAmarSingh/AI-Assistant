import assert from 'node:assert/strict';
import { buildSmartTokenContext, parseDayTraceActionPlan } from '../src/services/geminiService';
import { parseReminderTriggerTime } from '../src/services/nativeBridge';

const fullContext = {
  location: 'Test Place',
  coords: { latitude: 0.123, longitude: 0.456 },
  savedPlace: 'Test Place',
  locationPermission: 'GRANTED' as const,
  activeFocusTask: 'Synthetic focus fixture',
  memories: [{ category: 'PERSONAL', fact: 'Synthetic memory fixture' }],
  pendingTasks: [{ title: 'Synthetic pending fixture' }],
  permissions: { location: 'GRANTED', microphone: 'DENIED' },
  features: ['local tasks', 'live location'],
};

const general = buildSmartTokenContext('Explain photosynthesis', fullContext);
assert.doesNotMatch(general, /0\.123|Test Place|Synthetic|permission/i, 'General questions must not receive private app context');

const savedPlace = buildSmartTokenContext('Where am I?', fullContext);
assert.match(savedPlace, /saved place match="Test Place"/);
assert.doesNotMatch(savedPlace, /0\.123|Synthetic focus fixture/, 'A saved-place match must not send coordinates or tasks');

const coordinates = buildSmartTokenContext('Where am I?', { ...fullContext, savedPlace: undefined });
assert.match(coordinates, /latitude=0\.123000, longitude=0\.456000/);
assert.doesNotMatch(coordinates, /Synthetic focus fixture|Synthetic memory fixture/, 'Location lookup must send coordinates only');

const capabilities = buildSmartTokenContext('Which permissions can you access?', fullContext);
assert.match(capabilities, /location=GRANTED/);
assert.doesNotMatch(capabilities, /0\.123|Synthetic focus fixture|Synthetic memory fixture/, 'Capability questions must not receive user content');

const festival = buildSmartTokenContext('Which public holiday is upcoming nationally?', fullContext, {
  now: new Date('2026-08-25T11:05:00+05:30'),
  forceLiveSearch: true,
});
assert.match(festival, /2026/);
assert.match(festival, /live Google Search/);
assert.doesNotMatch(festival, /Synthetic focus fixture|Synthetic memory fixture|0\.123/);

const correction = buildSmartTokenContext('No, that public holiday is later', fullContext, {
  now: new Date('2026-08-25T11:06:00+05:30'),
  forceLiveSearch: true,
  conversationTurns: [
    { role: 'user', text: 'Which public holiday is upcoming nationally?' },
    { role: 'assistant', text: 'The next public holiday is Example Day.' },
  ],
});
assert.match(correction, /The next public holiday is Example Day/);
assert.match(correction, /No, that public holiday is later/);
assert.doesNotMatch(correction, /Synthetic focus fixture|Synthetic memory fixture|0\.123/);

const nearby = buildSmartTokenContext('Find the nearest open pharmacy', { ...fullContext, savedPlace: undefined }, {
  now: new Date('2026-08-25T11:08:00+05:30'),
  forceLiveSearch: true,
});
assert.match(nearby, /latitude=0\.123000, longitude=0\.456000/);
assert.match(nearby, /currently relevant nearby choices/);
assert.doesNotMatch(nearby, /Synthetic focus fixture|Synthetic memory fixture/);

const outfit = buildSmartTokenContext('What should I wear today?', {
  ...fullContext,
  savedPlace: undefined,
  timetableSlots: [{ time: '18:30-21:00', title: 'Family party' }],
}, {
  now: new Date('2026-08-25T11:09:00+05:30'),
  forceLiveSearch: true,
});
assert.match(outfit, /Family party/);
assert.match(outfit, /2-3 distinct outfit options/);
assert.doesNotMatch(outfit, /Synthetic focus fixture/);

const actionPlan = parseDayTraceActionPlan(JSON.stringify({
  intentSummary: 'Tag the current place and record current work',
  actions: [
    { type: 'SAVE_CURRENT_LOCATION', label: 'Desk', ignoredMutation: 'DELETE_ALL_DATA' },
    { type: 'LOG_ACTIVITY', description: 'Working on a product prototype and demo project' },
    { type: 'UNSUPPORTED_DELETE', title: 'Everything' },
  ],
}));
assert.deepEqual(actionPlan?.actions.map((action) => action.type), ['SAVE_CURRENT_LOCATION', 'LOG_ACTIVITY']);
assert.equal(actionPlan?.actions[0].label, 'Desk');
assert.equal(actionPlan?.actions[1].description, 'Working on a product prototype and demo project');

const locationReminderPlan = parseDayTraceActionPlan(JSON.stringify({
  intentSummary: 'Create an exit reminder at the current place',
  actions: [{
    type: 'CREATE_LOCATION_REMINDER',
    triggerType: 'GEOFENCE_EXIT',
    locationReference: 'CURRENT',
    reminderMessage: "Get my son's medicine",
  }],
}));
assert.equal(locationReminderPlan?.actions[0].type, 'CREATE_LOCATION_REMINDER');
assert.equal(locationReminderPlan?.actions[0].triggerType, 'GEOFENCE_EXIT');
assert.equal(locationReminderPlan?.actions[0].locationReference, 'CURRENT');
assert.equal(locationReminderPlan?.actions[0].reminderMessage, "Get my son's medicine");

const clarificationPlan = parseDayTraceActionPlan(JSON.stringify({
  intentSummary: 'Create tomorrow task',
  actions: [],
  clarification: 'At what time should I remind you?',
  clarificationOptions: ['9:00 AM', '1:00 PM', '6:00 PM'],
}));
assert.equal(clarificationPlan?.actions.length, 0);
assert.equal(clarificationPlan?.clarificationOptions?.length, 3);

const now = new Date('2026-08-25T12:00:00+05:30');
const evening = new Date(parseReminderTriggerTime('7:30 PM', now)!);
assert.equal(evening.getHours(), 19);
assert.equal(evening.getMinutes(), 30);

const tomorrow = new Date(parseReminderTriggerTime('tomorrow at 6:05 am', now)!);
assert.equal(tomorrow.getDate(), now.getDate() + 1);
assert.equal(tomorrow.getHours(), 6);
assert.equal(tomorrow.getMinutes(), 5);

console.log('AI context isolation and reminder-time tests passed.');
