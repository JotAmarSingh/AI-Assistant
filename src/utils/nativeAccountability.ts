import { DailyState, TaskItem, TimelineEvent } from '../types';

export interface NativeSuggestedTask {
  id: string;
  title: string;
  status: string;
  priority: number;
}

export interface NativeAccountabilityEvent {
  id?: string;
  nativeEventId?: string;
  actionType?: 'TASK_SELECTED' | 'WRITTEN_UPDATE' | 'SNOOZE' | 'OPEN_PROMPT' | string;
  type?: string;
  relatedTaskId?: string;
  taskTitle?: string;
  requestedTaskStatus?: string;
  makeCurrentFocus?: boolean;
  currentActivity?: string;
  snoozedUntilMillis?: number;
  description?: string;
  time?: string;
  date?: string;
  location?: string;
  source?: string;
  syncStatus?: string;
  createdAt?: number | string;
  isTestPrompt?: boolean;
}

export const selectNativeSuggestedTasks = (
  tasks: TaskItem[],
  focusTaskId: string | null,
): NativeSuggestedTask[] => {
  const selected: TaskItem[] = [];
  const seen = new Set<string>();
  const eligible = (task: TaskItem | undefined): task is TaskItem =>
    !!task && task.status !== 'DONE' && task.status !== 'CANCELLED';
  const add = (task: TaskItem | undefined) => {
    if (!eligible(task) || seen.has(task.id) || selected.length >= 2) return;
    seen.add(task.id);
    selected.push(task);
  };

  add(tasks.find((task) => task.id === focusTaskId));
  tasks
    .filter((task) => task.status === 'ACTIVE')
    .sort((a, b) => b.priority - a.priority)
    .forEach(add);
  tasks
    .filter((task) => task.status === 'NEXT')
    .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))
    .forEach(add);

  return selected.map(({ id, title, status, priority }) => ({ id, title, status, priority }));
};

export interface NativeReconciliationResult {
  state: DailyState;
  acknowledgedEventIds: string[];
  shouldOpenPrompt: boolean;
}

/** Applies each native intent transaction once and returns a durable idempotency ledger. */
export const reconcileNativeAccountabilityEvents = (
  previous: DailyState,
  events: NativeAccountabilityEvent[],
): NativeReconciliationResult => {
  let next = previous;
  let shouldOpenPrompt = false;
  const processed = new Set(previous.nativeAccountability?.processedEventIds || []);
  const acknowledgedEventIds: string[] = [];

  for (const event of events) {
    const eventId = event.nativeEventId || event.id;
    if (!eventId) continue;
    acknowledgedEventIds.push(eventId);
    if (processed.has(eventId) || next.timeline.some((item) => item.id === eventId)) {
      processed.add(eventId);
      continue;
    }

    const inferredAction = event.actionType
      || (event.relatedTaskId && event.makeCurrentFocus ? 'TASK_SELECTED' : undefined)
      || (event.currentActivity ? 'WRITTEN_UPDATE' : undefined);
    const eventTime = event.time || new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    if (inferredAction === 'OPEN_PROMPT') {
      shouldOpenPrompt = true;
    } else if (inferredAction === 'SNOOZE') {
      const nativeSnooze = Number(event.snoozedUntilMillis || 0);
      const currentSnooze = next.userSettings.snoozedUntil
        ? Date.parse(next.userSettings.snoozedUntil) || 0
        : 0;
      if (nativeSnooze > currentSnooze) {
        next = {
          ...next,
          userSettings: {
            ...next.userSettings,
            snoozedUntil: new Date(nativeSnooze).toISOString(),
          },
        };
      }
    } else if (inferredAction === 'TASK_SELECTED') {
      const taskId = event.relatedTaskId || '';
      const selectedTask = next.tasks.find((task) => task.id === taskId);
      if (selectedTask) {
        const activity = event.currentActivity || `Working on: ${selectedTask.title}`;
        next = {
          ...next,
          tasks: next.tasks.map((task) => {
            if (task.id === taskId) return { ...task, status: 'ACTIVE' };
            if (task.status === 'ACTIVE') return { ...task, status: 'NEXT' };
            return task;
          }),
          current: {
            ...next.current,
            focusTaskId: taskId,
            activity,
            updatedAt: eventTime,
          },
          timeline: [
            ...next.timeline,
            toTimelineEvent(event, eventId, 'TASK_STARTED', activity, eventTime, taskId),
          ],
        };
      }
    } else if (inferredAction === 'WRITTEN_UPDATE') {
      const exactActivity = event.currentActivity ?? event.description ?? '';
      if (exactActivity) {
        next = {
          ...next,
          current: {
            ...next.current,
            activity: exactActivity,
            updatedAt: eventTime,
          },
          timeline: [
            ...next.timeline,
            toTimelineEvent(event, eventId, 'UPDATE', exactActivity, eventTime),
          ],
        };
      }
    } else if (event.description) {
      next = {
        ...next,
        timeline: [
          ...next.timeline,
          toTimelineEvent(event, eventId, event.type || 'EVENT', event.description, eventTime, event.relatedTaskId),
        ],
      };
    }

    processed.add(eventId);
    const createdAtMillis = typeof event.createdAt === 'number'
      ? event.createdAt
      : Date.parse(event.createdAt || '') || 0;
    const lastCompletedAtMillis = !event.isTestPrompt
      && (inferredAction === 'TASK_SELECTED' || inferredAction === 'WRITTEN_UPDATE')
      ? Math.max(next.nativeAccountability?.lastCompletedAtMillis || 0, createdAtMillis)
      : next.nativeAccountability?.lastCompletedAtMillis;
    next = {
      ...next,
      nativeAccountability: {
        processedEventIds: Array.from(processed).slice(-500),
        lastCompletedAtMillis,
      },
    };
  }

  if (events.length > 0 && !next.nativeAccountability) {
    next = {
      ...next,
      nativeAccountability: { processedEventIds: Array.from(processed).slice(-500) },
    };
  }

  return { state: next, acknowledgedEventIds, shouldOpenPrompt };
};

const toTimelineEvent = (
  event: NativeAccountabilityEvent,
  id: string,
  type: string,
  description: string,
  time: string,
  relatedTaskId?: string,
): TimelineEvent => ({
  id,
  date: event.date,
  time,
  type: type as TimelineEvent['type'],
  description,
  relatedTaskId: relatedTaskId || undefined,
  location: event.location || undefined,
  source: event.source || 'CHECK_IN',
  syncStatus: (event.syncStatus as TimelineEvent['syncStatus']) || 'PENDING',
  createdAt: typeof event.createdAt === 'number'
    ? new Date(event.createdAt).toISOString()
    : event.createdAt,
});
