import assert from 'node:assert/strict';
import {
  classifyAIAgentRoute,
  isHybridGroundedReminder,
  requiresLiveGrounding,
  shouldUseCloudActionPlanner,
} from '../src/utils/aiRouting';

assert.equal(classifyAIAgentRoute('Which public holiday is upcoming nationally?'), 'ONLINE_KNOWLEDGE');
assert.equal(requiresLiveGrounding('Which public holiday is upcoming nationally?'), true);
assert.equal(classifyAIAgentRoute('No, that holiday is later', { hasRecentOnlineTurn: true }), 'ONLINE_FOLLOW_UP');
assert.equal(classifyAIAgentRoute('I reached Office', { hasRecentOnlineTurn: true }), 'LOCAL_ACTION');
assert.equal(classifyAIAgentRoute('Working on the app development'), 'LOCAL_ACTION');
assert.equal(classifyAIAgentRoute('I am still on the bed'), 'LOCAL_ACTION');
assert.equal(shouldUseCloudActionPlanner('I am still on the bed'), false, 'A simple status must stay deterministic');
assert.equal(classifyAIAgentRoute('What tasks are pending?'), 'LOCAL_QUERY');
assert.equal(classifyAIAgentRoute('I need to buy milk tomorrow'), 'LOCAL_ACTION');
assert.equal(
  classifyAIAgentRoute('Find the public holiday date and remind me two days before'),
  'HYBRID_GROUNDED_REMINDER',
);
assert.equal(classifyAIAgentRoute('The first example is more important than the second'), 'PENDING_MEMORY');
assert.equal(classifyAIAgentRoute('What is tomorrow\'s weather in Sample City?'), 'ONLINE_KNOWLEDGE');
assert.equal(requiresLiveGrounding('What is tomorrow\'s weather in Sample City?'), true);
assert.equal(requiresLiveGrounding('What should I wear today?'), true);
assert.equal(requiresLiveGrounding('Find the nearest open pharmacy'), true);
assert.equal(requiresLiveGrounding('Are the safety instructions for this medication current?'), true);
assert.equal(classifyAIAgentRoute('No, make it 7:30 PM', { hasRecentLocalAction: true }), 'LOCAL_ACTION');
assert.equal(classifyAIAgentRoute('Explain that again', { forcedOnlineFollowUp: true }), 'ONLINE_FOLLOW_UP');

assert.equal(
  shouldUseCloudActionPlanner('I am at my desk. Please mark this location as desk. And I am currently working on sample projects.'),
  true,
);
assert.equal(
  shouldUseCloudActionPlanner("Save this spot as Studio and log that I'm editing two demo files"),
  true,
);
assert.equal(
  shouldUseCloudActionPlanner("I've reached the test table; call this place Work Desk, and note that I am reviewing sample records"),
  true,
);
assert.equal(shouldUseCloudActionPlanner('Mark this location as Desk'), false);
assert.equal(classifyAIAgentRoute('Please mark this location as Desk'), 'LOCAL_ACTION');
const locationMedicineReminder = "Make a reminder for me whenever I leave my current location to get my son's medicine";
assert.equal(classifyAIAgentRoute(locationMedicineReminder), 'LOCAL_ACTION');
assert.equal(requiresLiveGrounding(locationMedicineReminder), false, 'An errand reminder is not a medical-advice query');
assert.equal(isHybridGroundedReminder(locationMedicineReminder), false, 'A geofence command must not enter the grounded knowledge route');
assert.equal(classifyAIAgentRoute('Is this medicine dose safe for my son?'), 'ONLINE_KNOWLEDGE');
assert.equal(requiresLiveGrounding('Is this medicine dose safe for my son?'), true);
assert.equal(shouldUseCloudActionPlanner('What tasks are pending?'), false);
assert.equal(classifyAIAgentRoute('Please jot down that sample review work is underway'), 'LOCAL_ACTION');
assert.equal(shouldUseCloudActionPlanner('Please jot down that sample review work is underway'), true);
assert.equal(classifyAIAgentRoute('Could you record my test review and save this place as Work Desk'), 'LOCAL_ACTION');
assert.equal(shouldUseCloudActionPlanner('Could you record my test review and save this place as Work Desk'), true);

console.log('AI Agent routing tests passed.');
