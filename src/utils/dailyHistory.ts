import { DailyState, TaskItem } from '../types';
import { createFreshDailyState, DEFAULT_USER_SETTINGS } from './initialState';
import { analyzeAccountabilityHabits, recalculateAccountabilityState } from './accountabilityEngine';

export const DAILY_HISTORY_STORAGE_KEY = 'daytrace_daily_history_v1';

export type DailyHistoryMap = Record<string, DailyState>;

export const toLocalDateKey = (value: Date = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const extractDateKey = (value?: string): string | null => {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

export const taskCreatedDate = (task: TaskItem, fallbackDate: string): string =>
  task.date || extractDateKey(task.createdAt) || fallbackDate;

export const taskIsScheduledForDate = (task: TaskItem, date: string): boolean =>
  extractDateKey(task.scheduledAt) === date || extractDateKey(task.dueAt) === date;

export const taskIsForTodayHub = (task: TaskItem, date: string, fallbackDate: string): boolean =>
  taskCreatedDate(task, fallbackDate) === date || taskIsScheduledForDate(task, date);

export const taskIsVisibleOnBoard = (task: TaskItem, date: string, fallbackDate: string): boolean => {
  if (taskIsForTodayHub(task, date, fallbackDate)) return true;
  const taskDate = taskCreatedDate(task, fallbackDate);
  const isUnfinished = task.status !== 'DONE' && task.status !== 'CANCELLED';
  return isUnfinished && taskDate < date;
};

/** Adds explicit dates to legacy records so they cannot leak into later days. */
export const normalizeDailyStateDates = (state: DailyState): DailyState => {
  const fallbackDate = state.date || toLocalDateKey();
  return {
    ...state,
    date: fallbackDate,
    tasks: (state.tasks || []).map((task) => ({
      ...task,
      date: taskCreatedDate(task, fallbackDate),
    })),
    timeline: (state.timeline || []).map((event) => ({
      ...event,
      date: event.date || extractDateKey(event.createdAt) || fallbackDate,
    })),
    fixedEvents: (state.fixedEvents || []).map((event) => ({
      ...event,
      date: event.date || fallbackDate,
    })),
    reminders: (state.reminders || []).map((reminder) => ({
      ...reminder,
      date: reminder.date || extractDateKey(reminder.createdAt) || fallbackDate,
    })),
  };
};

export const readDailyHistory = (): DailyHistoryMap => {
  try {
    const raw = localStorage.getItem(DAILY_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Could not read DayTrace daily history', error);
    return {};
  }
};

export const saveDailySnapshot = (state: DailyState): void => {
  try {
    const normalized = normalizeDailyStateDates(state);
    const history = readDailyHistory();
    history[normalized.date] = normalized;
    localStorage.setItem(DAILY_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('Could not archive DayTrace daily state', error);
  }
};

export const getDailySnapshot = (date: string): DailyState | null => {
  const snapshot = readDailyHistory()[date];
  return snapshot ? normalizeDailyStateDates(snapshot) : null;
};

export const createEmptyHistoricalState = (date: string, liveState: DailyState): DailyState => ({
  ...createFreshDailyState(date),
  userSettings: { ...DEFAULT_USER_SETTINGS, ...liveState.userSettings },
  geofenceLocations: liveState.geofenceLocations,
  ignoredLocationClusters: liveState.ignoredLocationClusters,
  taskCategories: liveState.taskCategories,
  meetings: (liveState.meetings || []).filter((meeting) => meeting.date === date),
  migrationMetadata: liveState.migrationMetadata,
  gamification: liveState.gamification,
  current: {
    ...createFreshDailyState(date).current,
    activity: 'No saved DayTrace records for this date',
  },
});

/**
 * Starts a clean day while preserving only durable configuration and unfinished
 * work. Carried tasks retain their original date, so Today stays clean while the
 * Task Board can still show overdue/pending work.
 */
export const createNextDailyState = (previousInput: DailyState, nextDate: string): DailyState => {
  const previous = normalizeDailyStateDates(previousInput);
  const fresh = createFreshDailyState(nextDate);
  const unfinishedTasks = previous.tasks
    .filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED')
    .map((task) => ({
      ...task,
      status: task.status === 'ACTIVE' ? ('NEXT' as const) : task.status,
      date: taskCreatedDate(task, previous.date),
      persistent: task.persistent !== false,
      carryForwardCount: (task.carryForwardCount || 0) + 1,
      lastCarriedForwardAt: nextDate,
    }));
  const recurringTasks = previous.tasks
    .filter((task) => task.recurring && task.status === 'DONE')
    .map((task) => ({
      ...task,
      id: `${task.id}-${nextDate}`,
      date: nextDate,
      status: 'NEXT' as const,
      createdAt: new Date().toISOString(),
      completedAt: undefined,
      actualMinutes: undefined,
    }));

  const carryForwardHistory = unfinishedTasks.map((task) => ({
    taskId: task.id,
    title: task.title,
    fromDate: previous.date,
    toDate: nextDate,
    count: task.carryForwardCount || 1,
  }));
  const recentHistory = Object.values(readDailyHistory())
    .filter((state) => state.date !== previous.date)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-6);

  const nextState: DailyState = {
    ...fresh,
    userSettings: { ...DEFAULT_USER_SETTINGS, ...previous.userSettings },
    tasks: [...unfinishedTasks, ...recurringTasks],
    reminders: previous.reminders.filter((reminder) => !reminder.isDone),
    automations: (previous.automations || []).filter(
      (automation) => automation.status !== 'COMPLETED',
    ),
    timetable: (previous.timetable || []).map((slot) => ({
      ...slot,
      status: 'PENDING',
    })),
    geofenceLocations: previous.geofenceLocations,
    ignoredLocationClusters: previous.ignoredLocationClusters,
    taskCategories: previous.taskCategories,
    meetings: previous.meetings,
    migrationMetadata: previous.migrationMetadata,
    gamification: previous.gamification,
    nativeAccountability: previous.nativeAccountability,
    accountability: {
      corrections: (previous.accountability?.corrections || []).slice(-250),
      carryForwardHistory: [
        ...(previous.accountability?.carryForwardHistory || []),
        ...carryForwardHistory,
      ].slice(-250),
      habitSignals: (previous.accountability?.habitSignals || []).slice(-250),
      plannedVsActual: [],
      weeklyInsights: analyzeAccountabilityHabits([...recentHistory, previous]),
      lastRecalculatedAt: new Date().toISOString(),
    },
  };
  return recalculateAccountabilityState(nextState, { at: new Date().toISOString() });
};
