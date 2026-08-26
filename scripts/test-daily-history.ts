import assert from 'node:assert/strict';
import { createFreshDailyState } from '../src/utils/initialState';
import {
  createNextDailyState,
  getDailySnapshot,
  saveDailySnapshot,
  taskIsForTodayHub,
  taskIsVisibleOnBoard,
  timelineEventIsForDate,
} from '../src/utils/dailyHistory';
import { getLearningProfile, resetLearningProfile, saveLearningProfile } from '../src/utils/autoLearning';

const values = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(),
};

const previous = createFreshDailyState('2026-08-21');
previous.tasks = [
  {
    id: 'old-active', date: '2026-08-21', title: 'Carry me', category: 'OFFICE', owner: 'ME',
    status: 'ACTIVE', priority: 8, createdAt: '2026-08-21T09:00:00+05:30',
  },
  {
    id: 'old-done', date: '2026-08-21', title: 'Archive me', category: 'HOME', owner: 'ME',
    status: 'DONE', priority: 4, createdAt: '2026-08-21T10:00:00+05:30',
  },
  {
    id: 'daily', date: '2026-08-21', title: 'Daily post', category: 'CONTENT', owner: 'ME',
    status: 'DONE', priority: 7, createdAt: '2026-08-21T08:00:00+05:30', recurring: true,
  },
];
previous.timeline = [{ id: 'event-1', date: '2026-08-21', time: '10:00', type: 'UPDATE', description: 'Yesterday' }];

saveDailySnapshot(previous);
assert.equal(getDailySnapshot('2026-08-21')?.timeline.length, 1, 'archived date should remain readable');

const next = createNextDailyState(previous, '2026-08-22');
assert.equal(next.timeline.length, 0, 'a new day must start with an empty timeline');
assert.equal(timelineEventIsForDate(previous.timeline[0], '2026-08-22', previous.date), false, 'yesterday must not leak into today Timeline');
assert.equal(timelineEventIsForDate(previous.timeline[0], '2026-08-21', previous.date), true, 'the archived calendar date must still show its Timeline');
assert.equal(next.tasks.find((task) => task.id === 'old-active')?.status, 'NEXT', 'active work carries as pending');
assert.equal(next.tasks.some((task) => task.id === 'old-done'), false, 'completed yesterday tasks stay archived');
assert.equal(next.tasks.find((task) => task.id === 'daily-2026-08-22')?.date, '2026-08-22', 'recurring work gets a new dated task');

const carried = next.tasks.find((task) => task.id === 'old-active')!;
assert.equal(taskIsForTodayHub(carried, '2026-08-22', next.date), false, 'Today must not show yesterday carryover');
assert.equal(taskIsVisibleOnBoard(carried, '2026-08-22', next.date), true, 'Task Board keeps unfinished carryover visible');
assert.equal(carried.persistent, true, 'Unfinished commitments remain persistent across days');
assert.equal(carried.carryForwardCount, 1, 'Carry-forward count must increment');
assert.equal(next.accountability?.carryForwardHistory[0]?.taskId, carried.id, 'Carry-forward must be recorded in the local accountability ledger');

saveLearningProfile({
  totalLearnedInteractions: 4,
  lastUpdated: new Date().toISOString(),
  taskUsage: {
    Example: {
      taskId: 'example', title: 'Example', category: 'OFFICE', startCount: 2,
      completeCount: 1, totalInteractions: 4, lastUsedAt: '10:00',
    },
  },
  routineUsage: {},
});
resetLearningProfile();
assert.equal(getLearningProfile().totalLearnedInteractions, 0, 'reset must purge interaction count');
assert.deepEqual(getLearningProfile().taskUsage, {}, 'reset must purge learned tasks');
assert.deepEqual(getLearningProfile().routineUsage, {}, 'reset must purge learned routines');

console.log('Daily history and learning reset tests passed.');
