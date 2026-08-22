import assert from 'node:assert/strict';
import { processMeetingTranscriptLocally } from '../src/utils/meetingProcessor';

const result = processMeetingTranscriptLocally(
  'We agreed to launch on Monday. Amar will send the final brief. The design was approved. Priya needs to schedule the client call.',
);
assert.match(result.summary, /agreed to launch/i);
assert.ok(result.actionItems.some((item) => /send the final brief/i.test(item.text)));
assert.ok(result.actionItems.some((item) => /schedule the client call/i.test(item.text)));

console.log('meeting processor: passed');
