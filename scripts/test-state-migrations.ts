import assert from 'node:assert/strict';
import { createFreshDailyState, CURRENT_STATE_SCHEMA_VERSION } from '../src/utils/initialState';
import { migrateDailyState } from '../src/utils/stateMigrations';

const fresh = createFreshDailyState('2026-08-22');
assert.equal(fresh.tasks.length, 0);
assert.equal(fresh.timeline.length, 0);
assert.equal(fresh.timetable.length, 0);
assert.equal(fresh.geofenceLocations?.length, 0);
assert.equal(fresh.meetings?.length, 0);
assert.equal(fresh.current.location, 'Unknown');
assert.equal(fresh.userSettings.periodicPromptEnabled, false);
assert.deepEqual(fresh.taskCategories?.map((category) => category.label), ['Uncategorised']);
assert.equal(fresh.gamification?.points, 0);
assert.equal(fresh.gamification?.currentStreakDays, 0);
assert.equal(fresh.gamification?.totalTasksCompleted, 0);

const legacy = {
  ...fresh,
  schemaVersion: 1,
  current: { ...fresh.current, location: 'Office', focusTaskId: 'task-3' },
  geofenceLocations: [
    { id: 'geo-office', name: 'Office', latitude: 37.7899, longitude: -122.4008, radiusMeters: 250 },
    { id: 'user-home', name: 'Home', latitude: 28.6139, longitude: 77.209, radiusMeters: 175 },
  ],
  tasks: [
    { id: 'task-1', title: 'Morning content post', category: 'CONTENT', owner: 'ME', status: 'DONE', priority: 8, createdAt: '07:30' },
    { id: 'task-2', title: 'Prepare and submit final workflow', category: 'OFFICE', owner: 'ME', status: 'DONE', priority: 9, createdAt: '09:15' },
    { id: 'task-3', title: 'Job/recruiter correspondence & follow-ups', category: 'CAREER', owner: 'ME', status: 'ACTIVE', priority: 9, createdAt: '09:38' },
    { id: 'user-task', title: 'Home', category: 'PERSONAL', owner: 'ME', status: 'NEXT', priority: 5, createdAt: '2026-08-22T10:00:00.000Z' },
  ],
};

const migrated = migrateDailyState(legacy);
assert.equal(migrated.toVersion, CURRENT_STATE_SCHEMA_VERSION);
assert.ok(migrated.removedSeedRecords >= 4);
assert.deepEqual(migrated.state.tasks.map((task) => task.id), ['user-task']);
assert.deepEqual(migrated.state.geofenceLocations?.map((location) => location.id), ['user-home']);
assert.equal(migrated.state.current.focusTaskId, null);
assert.equal(migrated.state.current.location, 'Unknown');
assert.equal(migrated.state.tasks[0].title, 'Home', 'Real user-created names must be preserved');

const ordinary = migrateDailyState({
  ...fresh,
  schemaVersion: 2,
  tasks: [{ id: 'task-1', title: 'Morning content post', category: 'CONTENT', owner: 'ME', status: 'NEXT', priority: 4, createdAt: '2026-08-22T11:00:00.000Z' }],
});
assert.equal(ordinary.state.tasks.length, 1, 'One coincidental legacy ID/title is not proof of a seeded board');

const legacyStarterRewards = migrateDailyState({
  ...fresh,
  schemaVersion: 7,
  gamification: {
    points: 120,
    currentStreakDays: 1,
    longestStreakDays: 1,
    totalFocusMinutes: 25,
    totalTasksCompleted: 3,
    totalReviewsCompleted: 0,
    lastActiveDate: '2026-08-22',
    claimedRewards: [],
    customRewards: [],
  },
});
assert.equal(legacyStarterRewards.state.gamification?.points, 0, 'legacy starter XP must not survive migration');
assert.equal(legacyStarterRewards.state.gamification?.currentStreakDays, 0, 'legacy starter streak must not survive migration');

console.log('state migrations: passed');
