import {
  DailyState,
  GeofenceLocation,
  TaskCategoryDefinition,
  TaskItem,
  TimelineEvent,
} from '../types';
import {
  createFreshDailyState,
  CURRENT_STATE_SCHEMA_VERSION,
  DEFAULT_TASK_CATEGORIES,
  DEFAULT_USER_SETTINGS,
  UNCATEGORISED_CATEGORY_ID,
} from './initialState';
import { normalizeDailyStateDates } from './dailyHistory';

const SAMPLE_LOCATION_SIGNATURES: Record<string, { latitude: number; longitude: number }> = {
  'geo-office': { latitude: 37.7899, longitude: -122.4008 },
  'geo-home': { latitude: 37.7749, longitude: -122.4194 },
  'geo-gym': { latitude: 37.7833, longitude: -122.4167 },
};

const SAMPLE_TASK_SIGNATURES: Record<string, string> = {
  'task-1': 'Morning content post',
  'task-2': 'Prepare and submit final workflow',
  'task-3': 'Job/recruiter correspondence & follow-ups',
  'task-4': 'Client work proposal revision',
  'task-5': 'Implement workflow in CRM',
  'task-6': 'Test CRM workflow',
  'task-7': 'Pillow and Curd',
};

const SAMPLE_TIMELINE_SIGNATURES: Record<string, string> = {
  'time-1': 'Woke up & morning routine',
  'time-2': 'Reached office (10 min traffic delay)',
  'time-3': 'Logged morning update & task alignment',
};

const nearlyEqual = (left: number, right: number) => Math.abs(left - right) < 0.000001;

const isSeedLocation = (location: GeofenceLocation): boolean => {
  if (location.seededExampleId) return true;
  const signature = SAMPLE_LOCATION_SIGNATURES[location.id];
  return !!signature
    && nearlyEqual(location.latitude, signature.latitude)
    && nearlyEqual(location.longitude, signature.longitude);
};

const isSeedTask = (task: TaskItem): boolean => SAMPLE_TASK_SIGNATURES[task.id] === task.title;
const isSeedTimeline = (event: TimelineEvent): boolean => SAMPLE_TIMELINE_SIGNATURES[event.id] === event.description;

/**
 * Older exports did not tag their sample board. Purge it only when a constellation
 * of at least three exact ID/title pairs proves that the built-in template was
 * loaded. A real item named Home, Office, Gym, or similar is never name-deleted.
 */
const hasLegacySampleConstellation = (state: Partial<DailyState>): boolean => {
  const exactTaskMatches = (state.tasks || []).filter(isSeedTask).length;
  const exactTimelineMatches = (state.timeline || []).filter(isSeedTimeline).length;
  return exactTaskMatches >= 3 || (exactTaskMatches >= 2 && exactTimelineMatches >= 2);
};

const createCategoryForLegacyId = (id: string): TaskCategoryDefinition => {
  const now = new Date().toISOString();
  return {
    id,
    label: id
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase()),
    color: '#6B7280',
    icon: 'tag',
    createdAt: now,
    updatedAt: now,
  };
};

const normalizeCategories = (state: Partial<DailyState>): TaskCategoryDefinition[] => {
  const byId = new Map<string, TaskCategoryDefinition>();
  DEFAULT_TASK_CATEGORIES.forEach((item) => byId.set(item.id, { ...item }));
  (state.taskCategories || []).forEach((item) => {
    if (!item?.id) return;
    byId.set(item.id, {
      ...createCategoryForLegacyId(item.id),
      ...item,
      label: item.label || item.id,
    });
  });
  (state.tasks || []).forEach((task) => {
    const id = task.category || UNCATEGORISED_CATEGORY_ID;
    if (!byId.has(id)) byId.set(id, createCategoryForLegacyId(id));
  });
  return Array.from(byId.values());
};

export interface MigrationResult {
  state: DailyState;
  removedSeedRecords: number;
  fromVersion: number;
  toVersion: number;
}

/** Non-destructive localStorage schema migration used on load, import and restore. */
export const migrateDailyState = (input: unknown): MigrationResult => {
  const raw = input && typeof input === 'object' ? input as Partial<DailyState> : {};
  const fromVersion = Number(raw.schemaVersion || 1);
  const fresh = createFreshDailyState(raw.date);
  const legacySampleLoaded = hasLegacySampleConstellation(raw);

  const originalLocations = raw.geofenceLocations || [];
  const locations = originalLocations.filter((location) => !isSeedLocation(location));
  const tasks = (raw.tasks || []).filter((task) => !(legacySampleLoaded && isSeedTask(task)));
  const timeline = (raw.timeline || []).filter((event) => !(legacySampleLoaded && isSeedTimeline(event)));
  const fixedEvents = legacySampleLoaded
    ? (raw.fixedEvents || []).filter((event) => !['fix-1', 'fix-2'].includes(event.id))
    : (raw.fixedEvents || []);
  const reminders = legacySampleLoaded
    ? (raw.reminders || []).filter((reminder) => !['rem-1', 'rem-2', 'rem-3'].includes(reminder.id))
    : (raw.reminders || []);
  const timetable = legacySampleLoaded
    ? (raw.timetable || []).filter((slot) => !/^slot-[1-5]$/.test(slot.id))
    : (raw.timetable || []);
  const removedSeedRecords = (originalLocations.length - locations.length)
    + ((raw.tasks || []).length - tasks.length)
    + ((raw.timeline || []).length - timeline.length)
    + ((raw.fixedEvents || []).length - fixedEvents.length)
    + ((raw.reminders || []).length - reminders.length)
    + ((raw.timetable || []).length - timetable.length);

  const focusTaskId = tasks.some((task) => task.id === raw.current?.focusTaskId)
    ? raw.current?.focusTaskId || null
    : null;
  const now = new Date().toISOString();
  const appliedVersions = Array.from(new Set([
    ...(raw.migrationMetadata?.appliedVersions || []),
    CURRENT_STATE_SCHEMA_VERSION,
  ])).sort((a, b) => a - b);

  const merged: DailyState = {
    ...fresh,
    ...raw,
    schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
    userSettings: {
      ...DEFAULT_USER_SETTINGS,
      ...(raw.userSettings || {}),
      // Old example locations must never keep tracking enabled on their own.
      geofenceEnabled: locations.length > 0 && !!raw.userSettings?.geofenceEnabled,
    },
    current: {
      ...fresh.current,
      ...(raw.current || {}),
      focusTaskId,
      location: isSeedLocationNameOnly(raw.current?.location, originalLocations) ? 'Unknown' : (raw.current?.location || 'Unknown'),
    },
    tasks: tasks.map((task) => ({
      ...task,
      category: task.category || UNCATEGORISED_CATEGORY_ID,
    })),
    timeline,
    fixedEvents,
    reminders,
    timetable,
    automations: raw.automations || [],
    geofenceLocations: locations,
    ignoredLocationClusters: raw.ignoredLocationClusters || [],
    taskCategories: normalizeCategories({ ...raw, tasks }),
    meetings: raw.meetings || [],
    migrationMetadata: {
      ...(raw.migrationMetadata || {}),
      ...(removedSeedRecords > 0 || fromVersion < CURRENT_STATE_SCHEMA_VERSION
        ? { seededExamplesPurgedAt: raw.migrationMetadata?.seededExamplesPurgedAt || now }
        : {}),
      appliedVersions,
    },
  };

  return {
    state: normalizeDailyStateDates(merged),
    removedSeedRecords,
    fromVersion,
    toVersion: CURRENT_STATE_SCHEMA_VERSION,
  };
};

const isSeedLocationNameOnly = (name: string | undefined, originalLocations: GeofenceLocation[]): boolean => {
  if (!name || !['Home', 'Office', 'Gym'].includes(name)) return false;
  return originalLocations.some((location) => location.name === name && isSeedLocation(location));
};
