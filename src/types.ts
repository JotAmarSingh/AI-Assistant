export type TaskStatus = 
  | 'CAPTURED'
  | 'NEXT'
  | 'ACTIVE'
  | 'WAITING'
  | 'BLOCKED'
  | 'SCHEDULED'
  | 'DONE'
  | 'CANCELLED';

export type TaskOwner = 
  | 'ME'
  | 'SPOUSE'
  | 'CLIENT'
  | 'BOSS'
  | 'IT_TEAM'
  | 'RECRUITER'
  | 'OTHER';

/** Category IDs are durable strings so users can add and rename categories. */
export type TaskCategory = string;

export interface TaskCategoryDefinition {
  id: string;
  label: string;
  color: string;
  icon: string;
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EnergyLevel = 
  | 'HIGH_FOCUS'
  | 'NORMAL'
  | 'LOW_ENERGY'
  | 'RUSHED'
  | 'DISTRACTED'
  | 'EMOTIONAL'
  | 'TIRED';

export type InterruptionClassification = 
  | 'EXPECTED'
  | 'UNEXPECTED'
  | 'AVOIDABLE'
  | 'UNAVOIDABLE';

export type ReminderType = 
  | 'TIME_BASED'
  | 'LOCATION_BASED'
  | 'EVENT_TRIGGERED';

export type RoutineRecurrence = 
  | 'DAILY' 
  | 'WEEKDAYS' 
  | 'WEEKENDS' 
  | 'MON_WED_FRI' 
  | 'TUE_THU' 
  | 'CUSTOM';

export type RoutineSlotStatus = 
  | 'PENDING' 
  | 'ACTIVE' 
  | 'COMPLETED' 
  | 'SKIPPED';

export interface TimetableSlot {
  id: string;
  title: string;
  category: TaskCategory;
  startTime: string; // "08:15"
  endTime: string;   // "09:15"
  durationMinutes: number;
  days: RoutineRecurrence;
  status: RoutineSlotStatus; // status for current day
  location?: 'HOME' | 'OFFICE' | 'GYM' | 'TRANSIT' | 'OUTDOORS' | 'ANY' | string;
  isRegularHabit: boolean;
  notes?: string;
  targetMetric?: string; // e.g. "Push workout", "High protein breakfast", "1 post + 10 replies"
  iconKey?: 'gym' | 'breakfast' | 'lunch' | 'social' | 'work' | 'coffee' | 'script' | 'reading' | 'night' | 'walk' | 'default';
}

export type AppMode = 
  | 'ACCOUNTABILITY'
  | 'NORMAL_CHAT'
  | 'RESEARCH'
  | 'CREATIVE';

export interface TaskItem {
  id: string;
  date?: string; // YYYY-MM-DD when the task entered DayTrace
  title: string;
  category: TaskCategory;
  owner: TaskOwner;
  status: TaskStatus;
  priority: number; // 1-10 (calculated dynamically)
  createdAt: string; // ISO or time string
  dueAt?: string;
  scheduledAt?: string;
  completedAt?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  location?: 'OFFICE' | 'HOME' | 'TRANSIT' | 'ANY' | string;
  context?: 'COMPUTER' | 'PHONE' | 'ERRAND' | 'MEETING' | 'ANY' | string;
  dependsOn?: string; // Task ID or title
  blockedBy?: string; // Task ID or description
  trigger?: string; // e.g., "IT confirms CRM workflow is live"
  recurring?: boolean;
  recurrenceRule?: 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'CUSTOM';
  notes?: string;
  source?: string;
}

export type EventSource = 
  | 'VOICE'
  | 'MANUAL'
  | 'CHECK_IN'
  | 'AUTOMATION'
  | 'GEOFENCE'
  | 'TASK_COMPLETION'
  | 'SYSTEM';

export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface Automation {
  id: string;
  title: string;
  originalVoiceText: string;
  triggerType: 'TIME' | 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT';
  locationId?: string;
  locationName?: string;
  scheduledTime?: string; // e.g. "18:00"
  reminderText: string;
  status: 'PENDING' | 'TRIGGERED' | 'COMPLETED' | 'SNOOZED';
  parentAutomationId?: string;
  relatedAutomationIds?: string[];
  createdAt: string;
  triggeredAt?: string;
  completedAt?: string;
  snoozedUntil?: string;
  relatedContext?: string;
}

export interface TimelineEvent {
  id: string;
  date?: string; // YYYY-MM-DD
  time: string; // e.g. "09:10" or "13:15–13:45"
  startTime?: string;
  endTime?: string;
  type: 'EVENT' | 'TASK_STARTED' | 'TASK_COMPLETED' | 'INTERRUPTION' | 'MEETING' | 'DEPARTURE' | 'UPDATE' | 'GEOFENCE' | 'REMINDER';
  description: string;
  relatedTaskId?: string;
  relatedAutomationId?: string;
  location?: string;
  locationId?: string;
  classification?: InterruptionClassification;
  source?: EventSource | string;
  category?: TaskCategory;
  plannedTime?: string;
  varianceMinutes?: number;
  notes?: string;
  syncStatus?: SyncStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface FixedEvent {
  id: string;
  date?: string; // YYYY-MM-DD
  time: string; // e.g. "11:30"
  endTime?: string;
  title: string;
  category?: TaskCategory;
  location?: string;
  prepTaskId?: string;
  notes?: string;
}

export interface ReminderItem {
  id: string;
  date?: string; // YYYY-MM-DD
  type: ReminderType;
  triggerCondition: string; // "13:00" or "Arriving Home" or "When IT confirms CRM"
  message: string;
  relatedTaskId?: string;
  isDone: boolean;
  createdAt: string;
}

export interface UserSettings {
  officeStartTime: string; // e.g. "09:00"
  officeLeavingTime: string; // e.g. "18:00" or "18:30"
  wakeUpTime: string; // e.g. "07:00"
  bedTime: string; // e.g. "23:30"
  // 30-minute accountability prompt popup
  periodicPromptEnabled: boolean;
  periodicPromptIntervalMinutes: number; // 30
  gamingModeActive: boolean; // Pause all popup dialogues during gaming
  snoozedUntil: string | null; // ISO string if temporarily snoozed (e.g. 1 hour)
  alarmSoundEnabled: boolean;
  // Geofence configuration
  geofenceEnabled?: boolean;
  geofenceRadiusMeters?: number;
  locationLearningEnabled?: boolean;
  locationDwellMinutes?: number;
  meetingAudioRetention?: 'KEEP' | 'DELETE_AFTER_PROCESSING';
  homeCoords?: { latitude: number; longitude: number };
  officeCoords?: { latitude: number; longitude: number };
  gymCoords?: { latitude: number; longitude: number };
}

export type FocusTimerMode = 'POMODORO_25' | 'DEEP_FLOW_50' | 'SHORT_BREAK_5' | 'LONG_BREAK_15' | 'STOPWATCH';

export interface FocusSessionState {
  isActive: boolean;
  isPaused: boolean;
  mode: FocusTimerMode;
  targetTaskId: string | null;
  targetTaskTitle: string;
  secondsRemaining: number;
  totalDurationSeconds: number;
  elapsedSeconds: number;
  startedAt?: string;
}

export interface GeofenceLocation {
  id: string;
  name: string; // e.g. "Office", "Home", "Gym"
  latitude: number;
  longitude: number;
  radiusMeters: number;
  arrivalMessage?: string;
  departureMessage?: string;
  targetDepartureTime?: string; // e.g. "18:30"
  createdAt?: string;
  updatedAt?: string;
  source?: 'USER' | 'LEARNED' | 'IMPORTED';
  /** Present only on records that were created by an app seed migration. */
  seededExampleId?: string;
}

export interface IgnoredLocationCluster {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  ignoredAt: string;
  label?: string;
}

export type MeetingStatus = 'RECORDING' | 'PAUSED' | 'PROCESSING' | 'READY' | 'NEEDS_TRANSCRIPT' | 'INTERRUPTED' | 'FAILED';

export interface MeetingActionItem {
  id: string;
  text: string;
  selected: boolean;
  taskId?: string;
}

export interface MeetingRecord {
  id: string;
  title: string;
  objective?: string;
  date: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  status: MeetingStatus;
  audioPath?: string;
  transcript?: string;
  summary?: string;
  actionItems: MeetingActionItem[];
  processingMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type RewardTier = 'MICRO' | 'WEEKLY' | 'GRAND';

export interface RewardItem {
  id: string;
  title: string;
  icon: string; // 'candy' | 'chocolate' | 'donut' | 'coffee' | 'pizza' | 'movie' | 'gaming' | 'iphone' | 'headphones' | 'trip' | 'custom'
  category: string;
  pointsCost: number;
  tier: RewardTier;
  description: string;
  isCustom?: boolean;
  timesClaimed: number;
  lastClaimedAt?: string;
}

export interface ClaimedRewardHistory {
  id: string;
  rewardId: string;
  title: string;
  icon: string;
  pointsCost: number;
  claimedAt: string;
  tier: RewardTier;
  note?: string;
}

export interface UserGamification {
  points: number;
  currentStreakDays: number;
  longestStreakDays: number;
  totalFocusMinutes: number;
  totalTasksCompleted: number;
  totalReviewsCompleted: number;
  lastActiveDate: string; // YYYY-MM-DD
  claimedRewards: ClaimedRewardHistory[];
  customRewards: RewardItem[];
}

export interface DailyState {
  schemaVersion?: number;
  date: string; // YYYY-MM-DD
  userSettings: UserSettings;
  current: {
    location: string;
    activity: string;
    energy: EnergyLevel;
    focusTaskId: string | null;
    updatedAt: string;
  };
  fixedEvents: FixedEvent[];
  timeline: TimelineEvent[];
  tasks: TaskItem[];
  reminders: ReminderItem[];
  automations?: Automation[];
  timetable: TimetableSlot[];
  geofenceLocations?: GeofenceLocation[];
  ignoredLocationClusters?: IgnoredLocationCluster[];
  taskCategories?: TaskCategoryDefinition[];
  meetings?: MeetingRecord[];
  migrationMetadata?: {
    seededExamplesPurgedAt?: string;
    appliedVersions?: number[];
  };
  gamification?: UserGamification;
  nextBestAction: {
    taskId: string | null;
    title: string;
    rationale: string;
    category?: TaskCategory;
    estimatedMinutes?: number;
    urgencyReason?: string;
    secondaryRecommendations?: string[];
  } | null;
  conversationHistory: {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: string;
    changesSummary?: {
      tasksDone?: string[];
      tasksWaiting?: string[];
      tasksBlocked?: string[];
      tasksCreated?: string[];
      timelineAdded?: string[];
      nextAction?: string;
    };
  }[];
  /** Internal idempotency ledger for durable Android receiver events. */
  nativeAccountability?: {
    processedEventIds: string[];
    lastCompletedAtMillis?: number;
  };
}

export interface ParseResult {
  aiResponseText: string;
  extractedStateUpdate: {
    currentLocation?: string;
    currentActivity?: string;
    currentEnergy?: EnergyLevel;
    focusTaskId?: string | null;
    newTimelineEvents?: Omit<TimelineEvent, 'id'>[];
    updatedTasks?: Partial<TaskItem>[];
    newTasks?: Omit<TaskItem, 'id'>[];
    completedTaskTitles?: string[];
    cancelledTaskTitles?: string[];
    newFixedEvents?: Omit<FixedEvent, 'id'>[];
    newReminders?: Omit<ReminderItem, 'id'>[];
    newAutomations?: Omit<Automation, 'id'>[];
    nextBestAction?: {
      taskId?: string | null;
      title: string;
      rationale: string;
      category?: TaskCategory;
      estimatedMinutes?: number;
      secondaryRecommendations?: string[];
    };
    changesSummary?: {
      tasksDone?: string[];
      tasksWaiting?: string[];
      tasksBlocked?: string[];
      tasksCreated?: string[];
      automationsCreated?: string[];
      timelineAdded?: string[];
      nextAction?: string;
    };
  };
}

export interface EndOfDayReview {
  date: string;
  timeline: TimelineEvent[];
  completedTasks: TaskItem[];
  pendingTasks: TaskItem[];
  waitingTasks: TaskItem[];
  blockedTasks: TaskItem[];
  interruptions: TimelineEvent[];
  plannedVsActual: {
    event: string;
    planned: string;
    actual: string;
    variance: string;
    notes?: string;
  }[];
  recurringPatterns: string[];
  carryForwardTasks: TaskItem[];
  tomorrowAnchors: FixedEvent[];
  summaryNarrative: string;
}

export interface UserMemoryItem {
  id: string;
  category: 'FAMILY' | 'HEALTH' | 'WORK' | 'PREFERENCE' | 'VEHICLE' | 'FINANCE' | 'GENERAL';
  fact: string;
  source?: string;
  createdAt: number;
}

export type SmartAICardType = 
  | 'PRICE_COMPARISON'
  | 'MULTI_STEP_ROADMAP'
  | 'CONFLICT_WARNING'
  | 'PERSISTENT_MEMORY'
  | 'EXPERT_ADVICE';

export interface SmartAICard {
  id: string;
  type: SmartAICardType;
  title: string;
  subtitle?: string;
  engineMode?: 'ONLINE_CLOUD' | 'OFFLINE_LOCAL';
  followUpQuestions?: string[];
  createdAt: number;
  data: {
    // For Price Comparison
    comparisonRows?: { seller: string; price: string; stock?: string; link?: string; rating?: string }[];
    safetyWarning?: string;
    
    // For Multi-Step Roadmap
    goalTitle?: string;
    steps?: { id: string; title: string; estimatedMinutes?: number; isDone?: boolean; deadlineTime?: string }[];

    // For Conflict Warning
    conflictingTitle?: string;
    routineTitle?: string;
    conflictingTime?: string;
    suggestedFreeSlot?: { startTime: string; endTime: string };

    // For Persistent Memory
    memoryFact?: string;
    memoryCategory?: string;

    // Follow-up intelligent questions
    followUpQuestions?: string[];
  };
}

export interface ScheduleConflict {
  hasConflict: boolean;
  routineTitle?: string;
  conflictTime?: string;
  suggestedFreeWindow?: { startTime: string; endTime: string };
  reason?: string;
}
