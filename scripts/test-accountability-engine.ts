import assert from 'node:assert/strict';
import { createFreshDailyState } from '../src/utils/initialState';
import {
  analyzeAccountabilityHabits,
  buildPlannedVsActual,
  classifyInterruption,
  conciseAccountabilityReply,
  detectContextEvent,
  selectNextBestAction,
} from '../src/utils/accountabilityEngine';
import { parseOfflineUserInput } from '../src/utils/offlineParser';
import { parseVoiceAutomations } from '../src/utils/localAutomationParser';
import { TaskItem } from '../src/types';

const makeTask = (id: string, title: string, priority: number, extra: Partial<TaskItem> = {}): TaskItem => ({
  id,
  date: '2026-08-25',
  title,
  category: 'OFFICE',
  owner: 'ME',
  status: 'NEXT',
  priority,
  createdAt: '2026-08-25T09:00:00.000Z',
  persistent: true,
  commitmentLevel: priority >= 9 ? 'CRITICAL' : 'IMPORTANT',
  ...extra,
});

const state = createFreshDailyState('2026-08-25');
state.current.location = 'Office';
state.current.activity = 'Rendering a client video';
state.tasks = [
  makeTask('video', 'Edit client video', 10, { requiredResources: ['VIDEO_EDITOR'] }),
  makeTask('call', 'Call the client', 8, { requiredResources: ['PHONE'], estimatedMinutes: 15 }),
];

assert.equal(selectNextBestAction(state)?.taskId, 'call', 'A busy editor must exclude another editing task.');

state.current.focusTaskId = 'video';
state.tasks[0].status = 'ACTIVE';
assert.equal(selectNextBestAction(state)?.taskId, 'video', 'Explicit active focus must be protected.');
assert.match(selectNextBestAction(state, { input: 'I am exhausted and hungry' })?.title || '', /Eat|health/i);

assert.equal(classifyInterruption('Rain stopped me from reaching the gym'), 'UNAVOIDABLE');
assert.equal(classifyInterruption('I got distracted scrolling reels'), 'AVOIDABLE');
assert.equal(classifyInterruption('The planned meeting interrupted the task'), 'EXPECTED');
assert.equal(detectContextEvent('The render has finished'), 'RENDERING_FINISHED');
assert.equal(detectContextEvent('I am leaving the desk'), 'LEAVING_DESK');

const contextual = parseVoiceAutomations('Remind me when rendering finishes to upload the final video', state, '12:00');
assert.equal(contextual.automations[0]?.triggerType, 'CONTEXT_EVENT');
assert.equal(contextual.automations[0]?.contextEvent, 'RENDERING_FINISHED');

const focused = createFreshDailyState('2026-08-25');
focused.current.focusTaskId = 'focus';
focused.tasks = [makeTask('focus', 'Finish proposal', 9, { status: 'ACTIVE' })];
const incoming = parseOfflineUserInput('I need to draft a follow-up email', focused, '12:10');
assert.equal(incoming.extractedStateUpdate.newTasks?.[0]?.status, 'CAPTURED');
assert.match(incoming.aiResponseText, /without interrupting/i);

const challenge = parseOfflineUserInput('Postpone finish proposal until tomorrow at 5 PM', focused, '12:15');
assert.equal(challenge.extractedStateUpdate.updatedTasks?.[0]?.postponementChallengeCount, 1);
assert.equal(challenge.extractedStateUpdate.updatedTasks?.[0]?.postponedUntil, undefined);

focused.tasks[0].postponementChallengeCount = 1;
const postponed = parseOfflineUserInput('Postpone it anyway until tomorrow at 5 PM because the client is late', focused, '12:16');
assert.ok(postponed.extractedStateUpdate.updatedTasks?.[0]?.postponedUntil);
assert.equal(postponed.extractedStateUpdate.updatedTasks?.[0]?.postponementReason, 'the client is late');

const cancelled = parseOfflineUserInput('Cancel finish proposal', focused, '12:17');
assert.equal(cancelled.extractedStateUpdate.updatedTasks?.[0]?.status, 'CANCELLED');

const planned = createFreshDailyState('2026-08-25');
planned.timetable = [{
  id: 'slot',
  startTime: '09:00',
  endTime: '10:00',
  durationMinutes: 60,
  days: 'TUE_THU',
  title: 'Write proposal',
  category: 'OFFICE',
  location: 'Office',
  isRegularHabit: false,
  status: 'COMPLETED',
}];
planned.timeline = [{
  id: 'actual',
  date: planned.date,
  time: '09:20–10:05',
  startTime: '09:20',
  endTime: '10:05',
  type: 'TASK_COMPLETED',
  description: 'Completed write proposal',
}];
assert.equal(buildPlannedVsActual(planned)[0]?.varianceMinutes, 20);

planned.accountability = {
  corrections: [],
  carryForwardHistory: [],
  plannedVsActual: [],
  habitSignals: [
    { id: 's1', at: '2026-08-25T09:00:00Z', type: 'FOCUS_SWITCH', value: 'Started another task' },
    { id: 's2', at: '2026-08-25T10:00:00Z', type: 'RESOURCE_CONSTRAINT', value: 'Render busy' },
  ],
};
const insights = analyzeAccountabilityHabits([planned]);
assert.ok(insights.some((item) => /context switch/i.test(item)));
assert.ok(insights.some((item) => /resource conflict/i.test(item)));

const concise = conciseAccountabilityReply(['Logged interruption.', 'Kept the task pending.'], selectNextBestAction(state));
assert.ok(concise.split('\n').length <= 6);
assert.match(concise, /Next:/);

console.log('Accountability engine tests passed.');
