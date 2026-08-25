import assert from 'node:assert/strict';
import { createFreshDailyState } from '../src/utils/initialState';
import { parseOfflineUserInput, parseTaskListItems } from '../src/utils/offlineParser';
import { classifyUserIntent } from '../src/utils/intentClassifier';
import { parseVoiceAutomations } from '../src/utils/localAutomationParser';

// Test 1: Numbered list with "these are the tasks that i need to do"
const input1 = "these are the tasks that i need to do 1. Task A 2. Task B";
const items1 = parseTaskListItems(input1);
assert.deepEqual(items1, ['Task A', 'Task B'], 'Numbered tasks must be extracted cleanly');

const state1 = createFreshDailyState();
const result1 = parseOfflineUserInput(input1, state1, '12:00');
assert.equal(result1.extractedStateUpdate.newTasks?.length, 2, 'Must add 2 new tasks');
assert.equal(result1.extractedStateUpdate.newTasks?.[0].title, 'Task A');
assert.equal(result1.extractedStateUpdate.newTasks?.[1].title, 'Task B');
assert.match(result1.aiResponseText, /Added new task: "Task A"/);
assert.match(result1.aiResponseText, /Added new task: "Task B"/);

// Test 2: Bullet point / line separated list
const input2 = "tasks to do: - Buy groceries - Workout at gym";
const result2 = parseOfflineUserInput(input2, state1, '12:05');
assert.equal(result2.extractedStateUpdate.newTasks?.length, 2);
assert.equal(result2.extractedStateUpdate.newTasks?.[0].title, 'Buy groceries');
assert.equal(result2.extractedStateUpdate.newTasks?.[0].category, 'PERSONAL');
assert.equal(result2.extractedStateUpdate.newTasks?.[1].title, 'Workout at gym');
assert.equal(result2.extractedStateUpdate.newTasks?.[1].category, 'HEALTH');

// Test 3: Comma & "and" separated tasks
const input3 = "I need to call client, prepare report and send email";
const result3 = parseOfflineUserInput(input3, state1, '12:10');
assert.equal(result3.extractedStateUpdate.newTasks?.length, 3);
assert.deepEqual(
  result3.extractedStateUpdate.newTasks?.map(t => t.title),
  ['Call client', 'Prepare report', 'Send email']
);

// Test 4: Single task creation
const input4 = "I have to review pull request";
const result4 = parseOfflineUserInput(input4, state1, '12:15');
assert.equal(result4.extractedStateUpdate.newTasks?.length, 1);
assert.equal(result4.extractedStateUpdate.newTasks?.[0].title, 'Review pull request');

const gymState = createFreshDailyState();
gymState.tasks.push({
  id: 'gym-task',
  date: gymState.date,
  title: 'Go to Gym',
  category: 'HEALTH',
  owner: 'ME',
  status: 'ACTIVE',
  priority: 8,
  createdAt: new Date().toISOString(),
});
const interruptedGym = parseOfflineUserInput(
  'I was going to the gym, but it started raining, so I came back home',
  gymState,
  '18:10',
);
assert.deepEqual(
  interruptedGym.extractedStateUpdate.newTimelineEvents?.map((event) => event.type),
  ['TASK_STARTED', 'INTERRUPTION', 'DEPARTURE'],
);
assert.equal(interruptedGym.extractedStateUpdate.currentLocation, 'Home');
assert.equal(interruptedGym.extractedStateUpdate.updatedTasks?.[0]?.status, 'NEXT');

const milkState = createFreshDailyState();
milkState.tasks.push({
  id: 'milk-task',
  date: milkState.date,
  title: 'Buy milk',
  category: 'HOME',
  owner: 'ME',
  status: 'NEXT',
  priority: 7,
  createdAt: new Date().toISOString(),
});
const boughtMilk = parseOfflineUserInput('I bought the milk', milkState, '18:20');
assert.deepEqual(boughtMilk.extractedStateUpdate.completedTaskTitles, ['Buy milk']);
assert.match(boughtMilk.aiResponseText, /Marked "Buy milk" as DONE/);

// Natural first-person work statements must never disappear into generic chat.
const workingInput = "I'm working on app development";
assert.equal(classifyUserIntent(workingInput, state1).type, 'LOG_ACTIVITY');
const workingLog = parseVoiceAutomations(workingInput, state1, '18:25');
assert.equal(workingLog.timelineLogs.length, 1);
assert.equal(workingLog.timelineLogs[0].description, 'Working on app development');

console.log('Task parsing tests passed successfully!');
