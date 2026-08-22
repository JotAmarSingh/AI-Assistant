import { DailyState, GeofenceLocation, TaskCategoryDefinition } from '../types';
import { INITIAL_GAMIFICATION_STATE } from '../services/rewardsCatalog';

export const CURRENT_STATE_SCHEMA_VERSION = 5;
export const UNCATEGORISED_CATEGORY_ID = 'UNCATEGORISED';

const category = (
  id: string,
  label: string,
  color: string,
  icon: string,
  isSystem = false,
): TaskCategoryDefinition => ({
  id,
  label,
  color,
  icon,
  isSystem,
  createdAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z',
});

/** Neutral category definitions are configuration, not pre-filled user data. */
export const DEFAULT_TASK_CATEGORIES: TaskCategoryDefinition[] = [
  category(UNCATEGORISED_CATEGORY_ID, 'Uncategorised', '#6B7280', 'inbox', true),
  category('OFFICE', 'Office', '#60A5FA', 'briefcase'),
  category('CAREER', 'Career', '#A78BFA', 'graduation-cap'),
  category('CLIENT', 'Client', '#22D3EE', 'users'),
  category('CONTENT', 'Content', '#F472B6', 'file-text'),
  category('KHABARZAAR', 'Khabarzaar', '#F59E0B', 'newspaper'),
  category('HOME', 'Home', '#34D399', 'home'),
  category('FAMILY', 'Family', '#FB7185', 'heart'),
  category('HEALTH', 'Health', '#4ADE80', 'activity'),
  category('PERSONAL', 'Personal', '#FBBF24', 'user'),
  category('IDEAS', 'Ideas', '#C084FC', 'lightbulb'),
];

/** Retained only as a compatibility export. No fake locations are created. */
export const DEFAULT_GEOFENCE_LOCATIONS: GeofenceLocation[] = [];

export const DEFAULT_USER_SETTINGS = {
  officeStartTime: '09:30',
  officeLeavingTime: '18:30',
  wakeUpTime: '07:00',
  bedTime: '23:30',
  periodicPromptEnabled: false,
  periodicPromptIntervalMinutes: 30,
  gamingModeActive: false,
  snoozedUntil: null,
  alarmSoundEnabled: true,
  enableNightlySync: true,
  nightlySyncHour: 2,
  lastNightlyBackupAt: null,
  geofenceEnabled: false,
  geofenceRadiusMeters: 200,
  locationLearningEnabled: false,
  locationDwellMinutes: 10,
  meetingAudioRetention: 'KEEP' as const,
  googleAuthStatus: 'DISCONNECTED' as const,
  googleAuthError: null,
};

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** A real fresh installation contains no personal examples or inferred places. */
export const createFreshDailyState = (date?: string): DailyState => ({
  schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
  date: date || localDateKey(),
  userSettings: { ...DEFAULT_USER_SETTINGS },
  current: {
    location: 'Unknown',
    activity: '',
    energy: 'NORMAL',
    focusTaskId: null,
    updatedAt: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  },
  fixedEvents: [],
  timeline: [],
  tasks: [],
  reminders: [],
  automations: [],
  timetable: [],
  geofenceLocations: [],
  ignoredLocationClusters: [],
  taskCategories: DEFAULT_TASK_CATEGORIES.map((item) => ({ ...item })),
  meetings: [],
  migrationMetadata: { appliedVersions: [CURRENT_STATE_SCHEMA_VERSION] },
  gamification: {
    ...INITIAL_GAMIFICATION_STATE,
    claimedRewards: [],
    customRewards: [],
  },
  nextBestAction: null,
  conversationHistory: [],
  nativeAccountability: { processedEventIds: [] },
});

/** Deprecated compatibility constant. It deliberately contains no example data. */
export const SAMPLE_TEMPLATE_STATE: DailyState = createFreshDailyState();
export const INITIAL_DAILY_STATE = createFreshDailyState();
