import assert from 'node:assert/strict';
import {
  classifyAIAgentRoute,
  requiresLiveGrounding,
} from '../src/utils/aiRouting';

assert.equal(classifyAIAgentRoute('Which festival is upcoming in Punjab?'), 'ONLINE_KNOWLEDGE');
assert.equal(requiresLiveGrounding('Which festival is upcoming in Punjab?'), true);
assert.equal(classifyAIAgentRoute('No, it is Rakhi or Bhai Dooj', { hasRecentOnlineTurn: true }), 'ONLINE_FOLLOW_UP');
assert.equal(classifyAIAgentRoute('I reached Office', { hasRecentOnlineTurn: true }), 'LOCAL_ACTION');
assert.equal(classifyAIAgentRoute('What tasks are pending?'), 'LOCAL_QUERY');
assert.equal(classifyAIAgentRoute('I need to buy milk tomorrow'), 'LOCAL_ACTION');
assert.equal(
  classifyAIAgentRoute('Find Rakhi\'s date and remind me two days before'),
  'HYBRID_GROUNDED_REMINDER',
);
assert.equal(classifyAIAgentRoute('Rakhi is more important than Teej in Punjab'), 'PENDING_MEMORY');
assert.equal(classifyAIAgentRoute('What is tomorrow\'s weather in Ludhiana?'), 'ONLINE_KNOWLEDGE');
assert.equal(requiresLiveGrounding('What is tomorrow\'s weather in Ludhiana?'), true);
assert.equal(requiresLiveGrounding('What should I wear today?'), true);
assert.equal(requiresLiveGrounding('Find the nearest open pharmacy'), true);
assert.equal(requiresLiveGrounding('Can my child take this cough syrup?'), true);
assert.equal(classifyAIAgentRoute('No, make it 7:30 PM', { hasRecentLocalAction: true }), 'LOCAL_ACTION');
assert.equal(classifyAIAgentRoute('Explain that again', { forcedOnlineFollowUp: true }), 'ONLINE_FOLLOW_UP');

console.log('AI Agent routing tests passed.');
