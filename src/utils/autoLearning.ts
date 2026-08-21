import { DailyState, TaskItem } from '../types';

export interface TaskUsageStat {
  taskId: string;
  title: string;
  category: string;
  startCount: number;
  completeCount: number;
  totalInteractions: number;
  lastUsedAt: string;
}

export interface RoutineUsageStat {
  id: string;
  label: string;
  prompt: string;
  category: 'ROUTINE' | 'TRANSITION' | 'TRIGGER';
  usageCount: number;
  lastUsedAt: string;
}

export interface AutoLearningProfile {
  taskUsage: Record<string, TaskUsageStat>;
  routineUsage: Record<string, RoutineUsageStat>;
  totalLearnedInteractions: number;
  lastUpdated: string;
}

const LEARNING_STORAGE_KEY = 'ai_day_tracker_learning_profile_v2';

export interface LearnedQuickOption {
  id: string;
  label: string;
  prompt: string;
  category: 'MOST_USED' | 'CURRENT_FLOW' | 'ROUTINE' | 'DELEGATION';
  badge?: string;
  frequency: number;
  taskId?: string;
}

// Initial seed usage statistics so the user starts with realistic intelligence
const INITIAL_LEARNING_PROFILE: AutoLearningProfile = {
  totalLearnedInteractions: 18,
  lastUpdated: new Date().toISOString(),
  taskUsage: {
    'Morning content post': {
      taskId: 'task-1',
      title: 'Morning content post',
      category: 'CONTENT',
      startCount: 8,
      completeCount: 8,
      totalInteractions: 16,
      lastUsedAt: '09:40',
    },
    'Job/recruiter correspondence & follow-ups': {
      taskId: 'task-3',
      title: 'Job/recruiter correspondence & follow-ups',
      category: 'CAREER',
      startCount: 6,
      completeCount: 3,
      totalInteractions: 11,
      lastUsedAt: '09:38',
    },
    'Client work proposal revision': {
      taskId: 'task-4',
      title: 'Client work proposal revision',
      category: 'CLIENT',
      startCount: 5,
      completeCount: 2,
      totalInteractions: 8,
      lastUsedAt: '09:38',
    },
    'Prepare and submit final workflow': {
      taskId: 'task-2',
      title: 'Prepare and submit final workflow',
      category: 'OFFICE',
      startCount: 4,
      completeCount: 4,
      totalInteractions: 9,
      lastUsedAt: '12:30',
    },
    'Next content reel script drafting': {
      taskId: 'task-7',
      title: 'Next content reel script drafting',
      category: 'CONTENT',
      startCount: 3,
      completeCount: 1,
      totalInteractions: 5,
      lastUsedAt: '09:45',
    },
  },
  routineUsage: {
    'office_arrival': {
      id: 'office_arrival',
      label: '📍 Reached office at 9:10',
      prompt: 'I reached office at 9:10. Logging this now. I have a boss meeting at 11:30.',
      category: 'TRANSITION',
      usageCount: 12,
      lastUsedAt: '09:38',
    },
    'lunch_break': {
      id: 'lunch_break',
      label: '🍱 Lunch break at 1:00 PM',
      prompt: 'Went home for lunch at 1:00 PM. Grabbed my water bottle and returned at 1:45 PM.',
      category: 'ROUTINE',
      usageCount: 9,
      lastUsedAt: '13:00',
    },
    'workflow_submitted': {
      id: 'workflow_submitted',
      label: '✅ Workflow submitted to IT',
      prompt: 'I submitted the final workflow. Sir will ask IT to put it into CRM. Once IT finishes, I will test it.',
      category: 'DELEGATION' as any,
      usageCount: 7,
      lastUsedAt: '12:30',
    },
    'crm_confirmed': {
      id: 'crm_confirmed',
      label: '⚡ IT confirmed CRM is live',
      prompt: 'IT confirmed the CRM workflow is live now.',
      category: 'TRIGGER',
      usageCount: 5,
      lastUsedAt: '12:30',
    },
    'quick_idea': {
      id: 'quick_idea',
      label: '💡 Idea: AI productivity reel',
      prompt: 'Idea: Film a short reel on context switching vs deep work.',
      category: 'ROUTINE',
      usageCount: 4,
      lastUsedAt: '10:15',
    },
    'office_evening_reminder': {
      id: 'office_evening_reminder',
      label: '⏰ Remind after office in evening',
      prompt: 'Remind me in the evening after office to review today\'s pending tasks and take my gym bag.',
      category: 'ROUTINE',
      usageCount: 8,
      lastUsedAt: '18:30',
    },
  },
};

export const getLearningProfile = (): AutoLearningProfile => {
  try {
    const raw = localStorage.getItem(LEARNING_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading learning profile', e);
  }
  return INITIAL_LEARNING_PROFILE;
};

export const saveLearningProfile = (profile: AutoLearningProfile) => {
  try {
    localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving learning profile', e);
  }
};

export const recordTaskInteraction = (
  taskTitle: string,
  taskId?: string,
  actionType: 'START' | 'COMPLETE' | 'UPDATE' | 'MENTION' = 'UPDATE',
  category: string = 'OFFICE'
) => {
  const profile = getLearningProfile();
  const key = taskTitle.trim();
  const existing = profile.taskUsage[key] || {
    taskId: taskId || `task-${Date.now()}`,
    title: key,
    category,
    startCount: 0,
    completeCount: 0,
    totalInteractions: 0,
    lastUsedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  if (actionType === 'START') existing.startCount += 1;
  if (actionType === 'COMPLETE') existing.completeCount += 1;
  existing.totalInteractions += 1;
  existing.lastUsedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  profile.taskUsage[key] = existing;
  profile.totalLearnedInteractions += 1;
  profile.lastUpdated = new Date().toISOString();

  saveLearningProfile(profile);
};

export const recordRoutineInteraction = (id: string, label: string, prompt: string) => {
  const profile = getLearningProfile();
  const existing = profile.routineUsage[id] || {
    id,
    label,
    prompt,
    category: 'ROUTINE',
    usageCount: 0,
    lastUsedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  existing.usageCount += 1;
  existing.lastUsedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  profile.routineUsage[id] = existing;
  profile.totalLearnedInteractions += 1;
  profile.lastUpdated = new Date().toISOString();

  saveLearningProfile(profile);
};

export const resetLearningProfile = () => {
  saveLearningProfile(INITIAL_LEARNING_PROFILE);
  return INITIAL_LEARNING_PROFILE;
};

/**
 * Dynamically computes auto-learned quick updates based on:
 * 1. Tasks used most frequently (startCount + completeCount + totalInteractions)
 * 2. Currently active / next tasks
 * 3. Waiting & blocked triggers
 * 4. User's top routine actions
 */
export const computeAutoLearnedQuickUpdates = (
  state: DailyState,
  profile: AutoLearningProfile
): LearnedQuickOption[] => {
  const options: LearnedQuickOption[] = [];
  const seenLabels = new Set<string>();

  // 1. Map all tasks in current state to learning stats
  const allTasks = state.tasks;
  const activeTask = allTasks.find(t => t.id === state.current.focusTaskId || t.status === 'ACTIVE');
  const nextTasks = allTasks.filter(t => t.status === 'NEXT');
  const waitingTasks = allTasks.filter(t => t.status === 'WAITING' || t.status === 'BLOCKED');

  // If there's an active task, offer immediate smart actions
  if (activeTask) {
    options.push({
      id: `action-done-${activeTask.id}`,
      label: `✅ Finished: ${activeTask.title.slice(0, 24)}${activeTask.title.length > 24 ? '...' : ''}`,
      prompt: `I just finished "${activeTask.title}". Mark it as done. What should I focus on next?`,
      category: 'CURRENT_FLOW',
      badge: 'Active Task',
      frequency: (profile.taskUsage[activeTask.title]?.totalInteractions || 1) + 5,
      taskId: activeTask.id,
    });
    seenLabels.add(activeTask.title.toLowerCase());
  }

  // 2. Rank user's most frequently interacted tasks
  const rankedTaskTitles = Object.entries(profile.taskUsage)
    .sort(([, a], [, b]) => b.totalInteractions - a.totalInteractions)
    .map(([title, stat]) => ({ title, stat }));

  for (const { title, stat } of rankedTaskTitles) {
    if (seenLabels.has(title.toLowerCase())) continue;

    // Check if task exists in current state
    const currentTask = allTasks.find(t => t.title.toLowerCase() === title.toLowerCase());
    
    if (currentTask) {
      if (currentTask.status === 'DONE') {
        // Offer repeat / daily recurrence if recurring or frequent
        options.push({
          id: `frequent-repeat-${currentTask.id}`,
          label: `🔄 Daily: ${title.slice(0, 22)}`,
          prompt: `Logging progress on "${title}".`,
          category: 'MOST_USED',
          badge: `${stat.totalInteractions}x used`,
          frequency: stat.totalInteractions,
          taskId: currentTask.id,
        });
      } else {
        options.push({
          id: `frequent-start-${currentTask.id}`,
          label: `▶️ ${stat.startCount > 3 ? 'Top Habit: ' : ''}${title.slice(0, 24)}`,
          prompt: `Starting work on "${title}". Setting my focus for ~${currentTask.estimatedMinutes || 30} minutes.`,
          category: 'MOST_USED',
          badge: `${stat.totalInteractions}x used`,
          frequency: stat.totalInteractions,
          taskId: currentTask.id,
        });
      }
      seenLabels.add(title.toLowerCase());
    }
  }

  // 3. Timetable Routines (Gym, Breakfast, Lunch, Social Media, etc.)
  const timetableSlots = state.timetable || [];
  for (const slot of timetableSlots) {
    if (seenLabels.has(slot.title.toLowerCase())) continue;

    if (slot.status === 'ACTIVE') {
      options.push({
        id: `routine-slot-${slot.id}`,
        label: `✅ Done: ${slot.title.slice(0, 22)}`,
        prompt: `Completed ${slot.title} (${slot.targetMetric || 'scheduled routine'}). Logging into today's timeline.`,
        category: 'CURRENT_FLOW',
        badge: 'Routine Active',
        frequency: 8,
      });
      seenLabels.add(slot.title.toLowerCase());
    } else if (slot.status === 'PENDING') {
      options.push({
        id: `routine-slot-start-${slot.id}`,
        label: `▶️ ${slot.title.slice(0, 22)}`,
        prompt: `Starting ${slot.title} (${slot.startTime}-${slot.endTime}).`,
        category: 'ROUTINE',
        badge: slot.startTime,
        frequency: 5,
      });
      seenLabels.add(slot.title.toLowerCase());
    }
  }

  // 4. For any NEXT tasks with high priority not yet in options
  for (const nt of nextTasks) {
    if (seenLabels.has(nt.title.toLowerCase())) continue;
    options.push({
      id: `next-task-${nt.id}`,
      label: `🎯 Start: ${nt.title.slice(0, 22)}`,
      prompt: `Starting "${nt.title}".`,
      category: 'CURRENT_FLOW',
      badge: `Pri ${nt.priority}/10`,
      frequency: 4,
      taskId: nt.id,
    });
    seenLabels.add(nt.title.toLowerCase());
  }

  // 5. Waiting / Blocked Task triggers
  for (const wt of waitingTasks) {
    if (wt.trigger) {
      options.push({
        id: `trigger-${wt.id}`,
        label: `⚡ Trigger: ${wt.trigger.slice(0, 24)}`,
        prompt: `${wt.trigger}. Now ready to unblock "${wt.title}".`,
        category: 'DELEGATION',
        badge: 'Trigger',
        frequency: 6,
        taskId: wt.id,
      });
    }
  }

  // 6. Frequently used Routines (Office, Lunch, Idea, Meeting)
  const rankedRoutines = Object.values(profile.routineUsage)
    .sort((a, b) => b.usageCount - a.usageCount);

  for (const routine of rankedRoutines) {
    options.push({
      id: `routine-${routine.id}`,
      label: routine.label,
      prompt: routine.prompt,
      category: 'ROUTINE',
      badge: `${routine.usageCount}x`,
      frequency: routine.usageCount,
    });
  }

  // Sort overall by frequency and current relevance
  return options.slice(0, 10);
};
