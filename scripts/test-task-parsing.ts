import assert from 'node:assert/strict';
import { createFreshDailyState } from '../src/utils/initialState';
import { parseOfflineUserInput, parseTaskListItems } from '../src/utils/offlineParser';
import { classifyUserIntent, extractCompoundCheckInIntent, extractSaveCurrentLocationIntent } from '../src/utils/intentClassifier';
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
const input3 = "I need to call collaborator, prepare report and send email";
const result3 = parseOfflineUserInput(input3, state1, '12:10');
assert.equal(result3.extractedStateUpdate.newTasks?.length, 3);
assert.deepEqual(
  result3.extractedStateUpdate.newTasks?.map(t => t.title),
  ['Call collaborator', 'Prepare report', 'Send email']
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

const bedStatusInput = 'I am still on the bed';
assert.equal(classifyUserIntent(bedStatusInput, state1).type, 'OTHER');
const bedStatusLog = parseVoiceAutomations(bedStatusInput, state1, '08:15');
assert.equal(bedStatusLog.timelineLogs.length, 1, 'A passive personal status belongs in Timeline');
assert.equal(bedStatusLog.timelineLogs[0].description, 'Still on the bed');
const bedStatusOfflineResult = parseOfflineUserInput(bedStatusInput, state1, '08:15');
assert.equal(bedStatusOfflineResult.extractedStateUpdate.newTasks?.length || 0, 0, 'A passive status must never create a task');

const compoundDeskCheckIn = 'I am at my desk. Please mark this location as desk. And I am currently working on a product prototype and demo project.';
assert.equal(classifyUserIntent(compoundDeskCheckIn, state1).type, 'SAVE_CURRENT_LOCATION');
assert.equal(extractSaveCurrentLocationIntent(compoundDeskCheckIn)?.label, 'desk');
assert.deepEqual(extractCompoundCheckInIntent(compoundDeskCheckIn), {
  locationLabel: 'desk',
  activityDescription: 'Working on a product prototype and demo project',
});
const compoundDeskLog = parseVoiceAutomations(compoundDeskCheckIn, state1, '19:12');
assert.equal(compoundDeskLog.timelineLogs.length, 1);
assert.equal(compoundDeskLog.timelineLogs[0].time, '19:12');
assert.equal(compoundDeskLog.timelineLogs[0].description, 'Working on a product prototype and demo project');

const currentPlaceState = createFreshDailyState();
currentPlaceState.current.location = 'Editing Desk';
currentPlaceState.geofenceLocations = [{
  id: 'editing-desk-location',
  name: 'Editing Desk',
  latitude: 30.901,
  longitude: 75.857,
  radiusMeters: 200,
}];
const exitMedicineReminder = parseVoiceAutomations(
  "Make a reminder for me whenever I leave my current location to get my son's medicine",
  currentPlaceState,
  '19:30',
);
assert.equal(exitMedicineReminder.isAutomation, true);
assert.equal(exitMedicineReminder.automations.length, 1);
assert.equal(exitMedicineReminder.automations[0].triggerType, 'GEOFENCE_EXIT');
assert.equal(exitMedicineReminder.automations[0].locationId, 'editing-desk-location');
assert.equal(exitMedicineReminder.automations[0].locationName, 'Editing Desk');
assert.equal(exitMedicineReminder.automations[0].reminderText, "Get my son's medicine");

const leaveHereReminder = parseVoiceAutomations(
  'Notify me when I leave here to collect the prescription',
  currentPlaceState,
  '19:31',
);
assert.equal(leaveHereReminder.automations[0].locationName, 'Editing Desk');
assert.equal(leaveHereReminder.automations[0].reminderText, 'Collect the prescription');

console.log('Task parsing tests passed successfully!');
