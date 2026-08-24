import assert from 'node:assert/strict';
import { createFreshDailyState } from '../src/utils/initialState';
import { parseOfflineUserInput, parseTaskListItems } from '../src/utils/offlineParser';

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

console.log('Task parsing tests passed successfully!');
