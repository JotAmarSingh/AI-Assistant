import { DailyState, TaskItem, TaskStatus, TimelineEvent, FixedEvent, ReminderItem, ParseResult, EndOfDayReview, TaskCategory } from '../types';
import {
  analyzeAccountabilityHabits,
  buildPlannedVsActual,
  classifyInterruption,
  conciseAccountabilityReply,
  detectImmediateOverride,
  inferTaskResources,
  selectNextBestAction,
} from './accountabilityEngine';

/**
 * Deterministic Offline Parser for DayTrace
 * Implements Section 11, 14, 16 of DayTrace v10 specification:
 * - Device questions answering (time/date) without false timeline entries
 * - Compound tasks & negation handling (e.g. "couldn't bring pillow, took curd")
 * - AM/PM ordered time extraction
 * - Priority & dependency handling
 */

export function parseOfflineUserInput(
  userInput: string,
  currentState: DailyState,
  currentTimeStr?: string
): ParseResult {
  const now = currentTimeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const rawInput = userInput.trim();
  const lower = rawInput.toLowerCase();

  // 1. Direct device queries: Answer directly with device info without state pollution
  if (/^(what('s| is) (the )?time(\?)?|time(\?)?|current time(\?)?)$/i.test(rawInput.trim())) {
    const formattedTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    return {
      aiResponseText: `Current device time is ${formattedTime} (${now}).`,
      extractedStateUpdate: {},
    };
  }

  if (/^(what('s| is) (the )?date(\?)?|what day is (it|today)(\?)?|today('s)? date(\?)?)$/i.test(rawInput.trim())) {
    const d = new Date();
    const dateStr = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return {
      aiResponseText: `Today is ${dateStr}.`,
      extractedStateUpdate: {},
    };
  }

  const newTimelineEvents: Omit<TimelineEvent, 'id'>[] = [];
  const completedTaskTitles: string[] = [];
  const updatedTasks: Partial<TaskItem>[] = [];
  const newTasks: Omit<TaskItem, 'id'>[] = [];
  const existingTasks = currentState.tasks || [];
  const newFixedEvents: Omit<FixedEvent, 'id'>[] = [];
  const newReminders: Omit<ReminderItem, 'id'>[] = [];
  let currentLocation = currentState.current.location;
  let currentActivity = currentState.current.activity;
  let currentEnergy = currentState.current.energy;
  let responseNotes: string[] = [];
  const interruptionClassification = classifyInterruption(rawInput);
  const immediateOverride = detectImmediateOverride(rawInput);

  if (immediateOverride) {
    if (immediateOverride.kind === 'HEALTH') currentEnergy = 'LOW_ENERGY';
    newTimelineEvents.push({
      time: now,
      type: 'UPDATE',
      description: immediateOverride.title,
      location: currentLocation,
      source: 'CHECK_IN',
      notes: rawInput,
    });
    responseNotes.push(immediateOverride.rationale);
  }

  if (/\b(?:render|export|encoding)\s+(?:has\s+)?(?:started|begun|is running|initiated)\b|\bstarted\s+(?:the\s+)?render/i.test(lower)) {
    currentActivity = 'Rendering in progress';
    newTimelineEvents.push({
      time: now,
      type: 'UPDATE',
      description: 'Rendering started; video editor resource is busy',
      location: currentLocation,
      source: 'CHECK_IN',
      notes: rawInput,
    });
    responseNotes.push('Rendering logged; tasks requiring the video editor will not be recommended until it finishes');
  } else if (/\b(?:render|export|encoding)\s+(?:has\s+)?(?:finished|completed|done)\b/i.test(lower)) {
    currentActivity = 'Render completed';
    responseNotes.push('Rendering marked finished; video-editing tasks are available again');
  }

  if (/\b(exhausted|very tired|too tired|drained|don'?t feel like working|do not feel like working)\b/i.test(lower)) {
    currentEnergy = 'TIRED';
    newTimelineEvents.push({
      time: now,
      type: 'UPDATE',
      description: 'Energy reported as tired/exhausted',
      location: currentLocation,
      source: 'CHECK_IN',
      notes: rawInput,
    });
    const priorityTask = [...currentState.tasks]
      .filter((task) => task.status === 'ACTIVE' || task.status === 'NEXT')
      .sort((left, right) => (right.priority || 5) - (left.priority || 5))[0];
    responseNotes.push(priorityTask
      ? `Energy logged as tired. Priority task still pending: "${priorityTask.title}". Complete it now or move it to the next available timetable slot`
      : 'Energy logged as tired. Take a short recovery break before choosing a lighter task');
  }

  const compoundGymInterruption = /\b(?:going|went|started|heading)\s+(?:to|for)\s+(?:the\s+)?gym\b/i.test(lower)
    && /\brain(?:ing|ed)?\b/i.test(lower)
    && /\b(?:came|went|returned)\s+(?:back\s+)?home\b/i.test(lower);

  if (compoundGymInterruption) {
    currentLocation = 'Home';
    currentActivity = 'At Home • Gym remains pending';
    newTimelineEvents.push(
      {
        time: now,
        type: 'TASK_STARTED',
        description: 'Started trip to Gym',
        location: currentState.current.location,
        source: 'CHECK_IN',
      },
      {
        time: now,
        type: 'INTERRUPTION',
        description: 'Gym trip interrupted by rain',
        classification: 'UNAVOIDABLE',
        location: 'Transit',
        source: 'CHECK_IN',
        notes: rawInput,
      },
      {
        time: now,
        type: 'DEPARTURE',
        description: 'Returned home after interrupted Gym trip',
        location: 'Home',
        source: 'CHECK_IN',
      },
    );
    const gymTask = currentState.tasks.find((task) => /\bgym|workout|exercise\b/i.test(task.title) && task.status !== 'DONE');
    if (gymTask) {
      updatedTasks.push({ id: gymTask.id, status: 'NEXT', notes: `${gymTask.notes ? `${gymTask.notes}\n` : ''}Interrupted by rain at ${now}` });
    }
    responseNotes.push('Logged Gym trip, rain interruption and return Home; Gym remains pending');
  }

  if (interruptionClassification && !compoundGymInterruption) {
    newTimelineEvents.push({
      time: now,
      type: 'INTERRUPTION',
      description: rawInput,
      classification: interruptionClassification,
      location: currentLocation,
      source: 'CHECK_IN',
      notes: rawInput,
    });
    responseNotes.push(`Interruption classified as ${interruptionClassification.toLowerCase()}`);
  }

  // 2. Location arrivals & departures
  if (!compoundGymInterruption && /\b(reached|arrived at|in|at)\s+(office|work|workplace)\b/i.test(lower)) {
    currentLocation = 'Office';
    const parsedTime = extractExplicitTime(rawInput) || now;
    newTimelineEvents.push({
      time: parsedTime,
      type: 'DEPARTURE',
      description: 'Reached office',
      location: 'Office',
    });
    responseNotes.push('Recorded arrival at Office');
  } else if (!compoundGymInterruption && /\b(reached|arrived at|at|back at)\s+(home|house)\b/i.test(lower)) {
    currentLocation = 'Home';
    const parsedTime = extractExplicitTime(rawInput) || now;
    newTimelineEvents.push({
      time: parsedTime,
      type: 'DEPARTURE',
      description: 'Arrived at home',
      location: 'Home',
    });
    responseNotes.push('Recorded arrival at Home');
  } else if (!compoundGymInterruption && /\b(reached|at|in)\s+(gym|fitness center)\b/i.test(lower)) {
    currentLocation = 'Gym';
    newTimelineEvents.push({
      time: now,
      type: 'EVENT',
      description: 'Arrived at Gym',
      location: 'Gym',
    });
    responseNotes.push('Recorded arrival at Gym');
  }

  // 3. Reminders Parsing (with AM/PM order priority & contextual office/evening detection)
  if (/\bremind me\b/i.test(lower)) {
    const reminderInfo = parseReminderSentence(rawInput, now, currentState);
    if (reminderInfo) {
      newReminders.push(reminderInfo);
      responseNotes.push(`Scheduled reminder for "${reminderInfo.message}" (${reminderInfo.triggerCondition})`);
    }
  }

  // 4. Fixed Events & Meetings
  if (/\b(meeting|call|sync|appointment|interview)\b/i.test(lower) && /\b(at|from)\b/i.test(lower)) {
    const timeMatch = extractExplicitTime(rawInput);
    if (timeMatch) {
      let title = 'Scheduled Meeting';
      if (/boss/i.test(lower)) title = 'Boss Meeting';
      else if (/client/i.test(lower)) title = 'Client Call';
      else if (/recruiter|interview/i.test(lower)) title = 'Interview Sync';
      else if (/team|standup/i.test(lower)) title = 'Team Standup';

      newFixedEvents.push({
        time: timeMatch,
        title,
        category: 'OFFICE',
        location: currentLocation,
        notes: rawInput,
      });
      responseNotes.push(`Added anchor "${title}" at ${timeMatch}`);
    }
  }

  // 5. Persistent commitment changes. A task stays actionable until it is
  // completed, explicitly postponed, or explicitly cancelled.
  const postponementMatch = rawInput.match(/^(?:please\s+)?(?:postpone|defer|move)\s+(.+?)(?:\s+(?:until|to)\s+(.+))$/i);
  if (postponementMatch) {
    const taskHint = postponementMatch[1].replace(/\s+anyway$/i, '').trim();
    const targetHint = postponementMatch[2].trim();
    const task = /^(?:it|this|that|the task)$/i.test(taskHint)
      ? existingTasks.find((item) => item.id === currentState.current.focusTaskId)
      : findBestMatchingTask(existingTasks, taskHint);
    if (!task) {
      responseNotes.push(`I could not identify which task to postpone from “${taskHint}”`);
    } else {
      const postponedUntil = parsePostponedUntil(targetHint);
      const reason = rawInput.match(/\bbecause\s+(.+)$/i)?.[1]?.trim();
      const needsChallenge = task.commitmentLevel === 'CRITICAL'
        && (task.postponementChallengeCount || 0) < 1
        && !/\banyway\b/i.test(rawInput);
      if (needsChallenge) {
        updatedTasks.push({
          id: task.id,
          postponementChallengeCount: (task.postponementChallengeCount || 0) + 1,
        });
        responseNotes.push(`“${task.title}” is critical. I have not postponed it yet; say “postpone it anyway until …” if this is deliberate`);
      } else if (!postponedUntil) {
        responseNotes.push(`Tell me a valid date or time for postponing “${task.title}”`);
      } else {
        updatedTasks.push({
          id: task.id,
          status: 'NEXT',
          postponedUntil,
          postponementReason: reason,
          postponementChallengeCount: task.postponementChallengeCount || 0,
        });
        newTimelineEvents.push({
          time: now,
          type: 'UPDATE',
          description: `Postponed: ${task.title}`,
          relatedTaskId: task.id,
          notes: `${targetHint}${reason ? ` • ${reason}` : ''}`,
          source: 'CHECK_IN',
        });
        responseNotes.push(`Postponed “${task.title}” until ${new Date(postponedUntil).toLocaleString()}`);
      }
    }
  }

  const cancellationMatch = !postponementMatch
    ? rawInput.match(/^(?:please\s+)?cancel\s+(?:the\s+task\s+)?(.+)$/i)
    : null;
  if (cancellationMatch) {
    const taskHint = cancellationMatch[1].replace(/[.!?]+$/g, '').trim();
    const task = /^(?:it|this|that)$/i.test(taskHint)
      ? existingTasks.find((item) => item.id === currentState.current.focusTaskId)
      : findBestMatchingTask(existingTasks, taskHint);
    if (!task) {
      responseNotes.push(`I could not identify which task to cancel from “${taskHint}”`);
    } else {
      updatedTasks.push({ id: task.id, status: 'CANCELLED', postponedUntil: undefined });
      newTimelineEvents.push({
        time: now,
        type: 'UPDATE',
        description: `Cancelled: ${task.title}`,
        relatedTaskId: task.id,
        source: 'CHECK_IN',
      });
      responseNotes.push(`Cancelled “${task.title}” deliberately`);
    }
  }

  // 6. Compound tasks & Negation handling (Section 16)
  const clauses = splitIntoClauses(rawInput);

  for (const task of existingTasks) {
    if (task.status === 'DONE') continue;

    const taskTitleLower = task.title.toLowerCase();
    const isCompound = taskTitleLower.includes(' and ') || taskTitleLower.includes(' & ') || taskTitleLower.includes('+') || taskTitleLower.includes(',');
    const taskSubItems = isCompound ? taskTitleLower.split(/ and | & |\+|,/).map(s => s.trim()).filter(Boolean) : [taskTitleLower];

    let positiveSubItems: string[] = [];
    let negativeSubItems: string[] = [];

    for (const clause of clauses) {
      const isNegative = isNegatedClause(clause);
      const normalizedClause = normalizeTaskMatchText(clause);
      
      for (const item of taskSubItems) {
        const normalizedItem = normalizeTaskMatchText(item);
        if (normalizedItem && normalizedClause.includes(normalizedItem)) {
          if (isNegative) {
            negativeSubItems.push(item);
          } else if (isPositiveAction(clause)) {
            positiveSubItems.push(item);
          }
        }
      }
    }

    if (!isCompound) {
      const normalizedInput = normalizeTaskMatchText(lower);
      const mentionsTask = taskSubItems.some((sub) => normalizedInput.includes(normalizeTaskMatchText(sub)));
      const hasPositiveWord = isPositiveAction(lower);
      const hasNegativeWord = isNegatedClause(lower);

      if (mentionsTask && hasPositiveWord && !hasNegativeWord) {
        completedTaskTitles.push(task.title);
        newTimelineEvents.push({
          time: now,
          type: 'TASK_COMPLETED',
          description: `Completed: ${task.title}`,
          relatedTaskId: task.id,
        });
        responseNotes.push(`Marked "${task.title}" as DONE`);
      }
    } else {
      if (positiveSubItems.length > 0 && negativeSubItems.length > 0) {
        const completedParts = Array.from(new Set(positiveSubItems)).map(capitalizeFirst).join(', ');
        const pendingParts = Array.from(new Set(negativeSubItems)).map(capitalizeFirst).join(', ');
        
        updatedTasks.push({
          id: task.id,
          status: 'NEXT',
          notes: `${task.notes ? `${task.notes} | ` : ''}Partial progress: ${completedParts} completed. ${pendingParts} pending.`,
        });

        newTimelineEvents.push({
          time: now,
          type: 'UPDATE',
          description: `Partial progress on "${task.title}": ${completedParts} completed, ${pendingParts} pending.`,
          relatedTaskId: task.id,
        });

        responseNotes.push(`Recorded ${completedParts} as completed. "${task.title}" stays open because ${pendingParts} is still pending.`);
      } else if (positiveSubItems.length === taskSubItems.length && negativeSubItems.length === 0) {
        completedTaskTitles.push(task.title);
        newTimelineEvents.push({
          time: now,
          type: 'TASK_COMPLETED',
          description: `Completed: ${task.title}`,
          relatedTaskId: task.id,
        });
        responseNotes.push(`Marked "${task.title}" as DONE`);
      }
    }
  }

  // 7. Workflow submission -> IT waiting & CRM blocked cascade
  if (lower.includes('workflow') && (lower.includes('submitted') || lower.includes('finished') || lower.includes('handed over'))) {
    if (!completedTaskTitles.some(t => t.toLowerCase().includes('workflow'))) {
      completedTaskTitles.push('Prepare and submit final workflow');
    }
    
    const hasWaiting = existingTasks.some(t => t.title.toLowerCase().includes('implement workflow in crm'));
    if (!hasWaiting) {
      newTasks.push({
        title: 'Implement workflow in CRM',
        category: 'OFFICE',
        owner: 'IT_TEAM',
        status: 'WAITING',
        priority: 7,
        createdAt: now,
        notes: 'Waiting for IT team implementation (~24 hours estimate)',
      });
      newTasks.push({
        title: 'Test CRM workflow',
        category: 'OFFICE',
        owner: 'ME',
        status: 'BLOCKED',
        priority: 8,
        createdAt: now,
        blockedBy: 'Implement workflow in CRM (IT_TEAM)',
        trigger: 'IT confirms CRM workflow is live',
        notes: 'Verify pipeline stages and notifications once IT delivers',
      });
      responseNotes.push('Moved CRM implementation to WAITING (IT_TEAM) and Test CRM to BLOCKED');
    }
  }

  // 8. Idea capture
  if (/^idea:|\breel idea:|\bnew idea\b/i.test(lower)) {
    const ideaTitle = rawInput.replace(/^idea:|\breel idea:|\bnew idea:?/i, '').trim();
    if (ideaTitle) {
      newTasks.push({
        title: ideaTitle,
        category: 'IDEAS',
        owner: 'ME',
        status: 'CAPTURED',
        priority: 4,
        createdAt: now,
        notes: 'Captured idea in backlog',
      });
      responseNotes.push(`Captured idea in backlog: "${ideaTitle}"`);
    }
  }

  // 9. General task creation (Supports multi-task lists, numbered items, bullet points, and single tasks)
  const isTaskCreationIntent = /\b(these are the tasks|tasks (that|to)|my tasks|task list|todos?|add tasks?|need to|have to|must|should|plan to)\b/i.test(lower);

  if (isTaskCreationIntent && !newTasks.length && !completedTaskTitles.length) {
    const extractedTaskTitles = parseTaskListItems(rawInput);
    
    for (const title of extractedTaskTitles) {
      const cleanTitle = title.replace(/^[-*•\d.\s\)]+/, '').trim();
      if (cleanTitle.length >= 2) {
        const capitalizedTitle = capitalizeFirst(cleanTitle);
        const cat = inferTaskCategory(cleanTitle);
        newTasks.push({
          title: capitalizedTitle,
          category: cat,
          owner: 'ME',
          status: currentState.current.focusTaskId && !immediateOverride ? 'CAPTURED' : 'NEXT',
          priority: 7,
          createdAt: now,
          persistent: true,
          commitmentLevel: 'IMPORTANT',
          requiredResources: inferTaskResources({ title: capitalizedTitle, category: cat, owner: 'ME', status: 'NEXT', priority: 7, createdAt: now, id: 'preview' }),
        });
        responseNotes.push(`Added new task: "${capitalizedTitle}"`);
        if (currentState.current.focusTaskId && !immediateOverride) {
          responseNotes.push('Captured without interrupting the active focus task');
        }
      }
    }
  }

  // 10. Compute one resource-, deadline-, context- and energy-aware action.
  const previewTasks: TaskItem[] = [
    ...existingTasks.map((task) => {
      const taskUpdate = updatedTasks.find((update) => update.id === task.id);
      return {
        ...task,
        ...(taskUpdate || {}),
        ...(completedTaskTitles.includes(task.title) ? { status: 'DONE' as const } : {}),
      };
    }),
    ...newTasks.map((task, index) => ({ ...task, id: `preview-${index}` })),
  ];
  const previewState: DailyState = {
    ...currentState,
    current: { ...currentState.current, location: currentLocation, activity: currentActivity, energy: currentEnergy },
    tasks: previewTasks,
    timeline: [...currentState.timeline, ...newTimelineEvents.map((event, index) => ({ ...event, id: `preview-event-${index}` }))],
  };
  const nextAction = selectNextBestAction(previewState, { input: rawInput });
  const finalAiText = conciseAccountabilityReply(
    responseNotes.length ? responseNotes : [`Recorded update for ${now}`],
    nextAction,
  );

  return {
    aiResponseText: finalAiText,
    extractedStateUpdate: {
      currentLocation,
      currentActivity,
      currentEnergy,
      newTimelineEvents,
      completedTaskTitles,
      updatedTasks,
      newTasks,
      newFixedEvents,
      newReminders,
      nextBestAction: nextAction ? {
        taskId: nextAction.taskId,
        title: nextAction.title,
        rationale: nextAction.rationale,
        category: nextAction.category,
        estimatedMinutes: nextAction.estimatedMinutes,
        secondaryRecommendations: nextAction.secondaryRecommendations,
      } : undefined,
      changesSummary: {
        tasksDone: completedTaskTitles,
        tasksWaiting: newTasks.filter(t => t.status === 'WAITING').map(t => t.title),
        tasksBlocked: newTasks.filter(t => t.status === 'BLOCKED').map(t => t.title),
        tasksCreated: newTasks.map(t => t.title),
        timelineAdded: newTimelineEvents.map(e => e.description),
        nextAction: nextAction?.title,
      },
    },
  };
}

function splitIntoClauses(text: string): string[] {
  return text
    .split(/[,;.!?]|\bbut\b|\bhowever\b|\balso\b|\band then\b/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function findBestMatchingTask(tasks: TaskItem[], hint: string): TaskItem | undefined {
  const words = normalizeTaskMatchText(hint).split(/\s+/).filter((word) => word.length > 2);
  return tasks
    .filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED')
    .map((task) => {
      const title = normalizeTaskMatchText(task.title);
      const score = words.reduce((total, word) => total + (title.includes(word) ? 1 : 0), 0);
      return { task, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.task;
}

function parsePostponedUntil(value: string, now = new Date()): string | null {
  const text = value.toLowerCase();
  const target = new Date(now);
  const isoDate = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoDate) {
    target.setFullYear(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
  } else if (/\btomorrow\b/.test(text)) {
    target.setDate(target.getDate() + 1);
  } else {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekday = weekdays.findIndex((day) => new RegExp(`\\b(?:next\\s+)?${day}\\b`).test(text));
    if (weekday >= 0) {
      let daysAhead = (weekday - target.getDay() + 7) % 7;
      if (daysAhead === 0 || text.includes(`next ${weekdays[weekday]}`)) daysAhead += 7;
      target.setDate(target.getDate() + daysAhead);
    } else if (!/\btoday\b/.test(text) && !extractExplicitTime(value)) {
      return null;
    }
  }
  const clock = extractExplicitTime(value);
  if (clock) {
    const [hours, minutes] = clock.split(':').map(Number);
    target.setHours(hours, minutes, 0, 0);
  }
  return target.toISOString();
}

function isNegatedClause(clause: string): boolean {
  return /\b(couldn't|could not|didn't|did not|unable|can't|cannot|forgot|failed|not|left behind|missed)\b/i.test(clause);
}

function isPositiveAction(clause: string): boolean {
  return /\b(brought|took|picked up|completed|finished|sent|submitted|bought|done|published|got|took along|handled)\b/i.test(clause);
}

function normalizeTaskMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(bought|purchased|got|picked up|brought)\b/g, 'buy')
    .replace(/\b(the|a|an|to)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractExplicitTime(text: string): string | null {
  const ampmMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2] ? ampmMatch[2] : '00';
    const ampm = ampmMatch[3].toUpperCase();

    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  const time24Match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (time24Match) {
    return `${time24Match[1].padStart(2, '0')}:${time24Match[2]}`;
  }

  return null;
}

function parseReminderSentence(text: string, createdAt: string, currentState?: DailyState): Omit<ReminderItem, 'id'> | null {
  const time = extractExplicitTime(text);
  const lower = text.toLowerCase();
  
  // Clean raw reminder message
  let message = text.replace(/.*remind me\s+(in the evening after office|after office in the evening|in the evening|in the morning|after office|at\s+\S+|to)?/i, '').trim();
  if (!message) {
    message = text.replace(/.*remind me\s+/i, '').trim() || text;
  }

  // 1. Explicit time extracted
  if (time) {
    return {
      type: 'TIME_BASED',
      triggerCondition: time,
      message: capitalizeFirst(message),
      createdAt,
      isDone: false,
    };
  }

  // 2. "in the evening after office" or "after office" or "leaving office"
  const officeLeaveTime = currentState?.userSettings?.officeLeavingTime || '18:30';
  if (/\b(after office|leaving office|leave office|evening after office|in the evening after office)\b/i.test(lower)) {
    return {
      type: 'TIME_BASED',
      triggerCondition: officeLeaveTime,
      message: capitalizeFirst(message || 'Evening after office reminder'),
      createdAt,
      isDone: false,
    };
  }

  // 3. Evening without specific time -> default 19:00 or office leave + 30 min
  if (/\b(in the evening|tonight|evening)\b/i.test(lower)) {
    return {
      type: 'TIME_BASED',
      triggerCondition: '19:00',
      message: capitalizeFirst(message || 'Evening reminder'),
      createdAt,
      isDone: false,
    };
  }

  // 4. Morning without specific time -> default 08:30
  if (/\b(in the morning|tomorrow morning|morning)\b/i.test(lower)) {
    return {
      type: 'TIME_BASED',
      triggerCondition: '08:30',
      message: capitalizeFirst(message || 'Morning reminder'),
      createdAt,
      isDone: false,
    };
  }

  // 5. Location-based
  if (/\b(reaching|arriving|leaving)\s+(office|home|gym)\b/i.test(text)) {
    const locMatch = text.match(/\b(office|home|gym)\b/i);
    const loc = locMatch ? capitalizeFirst(locMatch[1]) : 'Location';
    return {
      type: 'LOCATION_BASED',
      triggerCondition: `Arriving ${loc}`,
      message: capitalizeFirst(message),
      createdAt,
      isDone: false,
    };
  }

  return {
    type: 'TIME_BASED',
    triggerCondition: officeLeaveTime,
    message: capitalizeFirst(message),
    createdAt,
    isDone: false,
  };
}

export function parseTaskListItems(rawText: string): string[] {
  let textToParse = rawText.trim();
  if (!textToParse) return [];

  textToParse = textToParse
    .replace(/^.*?\b(these are the tasks|tasks (that|to)|my tasks|task list|todos?|add tasks?|i need to|i have to|must|should|plan to|following tasks)( (that|to) (i|we)? (need|have|want) to)?( (do|complete|handle|finish|add))?:?\s*/i, '')
    .trim();

  let items: string[] = [];

  if (/\b\d+[\.\)]\s*/.test(rawText)) {
    const parts = rawText
      .split(/\b\d+[\.\)]\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    items = parts.filter(p => !isHeaderPhrase(p));
  } else if (/[\r\n]+|[\u2022\u25E6\u2023\u2043]|\s*[-*]\s+/.test(textToParse)) {
    const parts = textToParse
      .split(/[\r\n]+|[\u2022\u25E6\u2023\u2043]|\s*[-*]\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    items = parts.filter(p => !isHeaderPhrase(p));
  } else if (textToParse.includes(',') || textToParse.includes(';') || /\b,?\s+and\s+/i.test(textToParse)) {
    const parts = textToParse
      .split(/;|\b,?\s+and\s+|,/)
      .map(s => s.trim())
      .filter(Boolean);
    items = parts.filter(p => !isHeaderPhrase(p));
  } else if (textToParse && !isHeaderPhrase(textToParse)) {
    items = [textToParse];
  }

  return items
    .map(item => item.replace(/^[-*•\d.\s\)]+/, '').trim())
    .filter(item => {
      if (item.length < 2) return false;
      if (isHeaderPhrase(item)) return false;
      return true;
    });
}

function isHeaderPhrase(text: string): boolean {
  const l = text.toLowerCase().trim();
  if (!l) return true;
  if (/^(these are the tasks|tasks (that|to)?|my tasks|task list|todos?|add tasks?|i need to|i have to|must|should|plan to|following tasks|for today|today)$/i.test(l)) return true;
  if (l.includes('tasks that i need to do') || l.includes('these are the tasks') || l.includes('my tasks for today')) return true;
  return false;
}

function inferTaskCategory(title: string): TaskCategory {
  const l = title.toLowerCase();
  if (/\b(gym|workout|run|jog|exercise|meditate|health|doctor|walk|diet|water)\b/.test(l)) return 'HEALTH';
  if (/\b(home|house|groceries|clean|kitchen|family|rent|bills|laundry)\b/.test(l)) return 'PERSONAL';
  if (/\b(idea|feature|concept|project idea|draft)\b/.test(l)) return 'IDEAS';
  return 'OFFICE';
}

function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function generateOfflineEndOfDayReview(state: DailyState): EndOfDayReview {
  const completed = state.tasks.filter(t => t.status === 'DONE');
  const pending = state.tasks.filter(t => t.status === 'NEXT' || t.status === 'CAPTURED');
  const waiting = state.tasks.filter(t => t.status === 'WAITING');
  const blocked = state.tasks.filter(t => t.status === 'BLOCKED');
  const interruptions = state.timeline.filter(e => e.type === 'INTERRUPTION');

  const plannedVsActual = buildPlannedVsActual(state).map((row) => ({
    event: row.title,
    planned: `${row.plannedStart}${row.plannedEnd ? ` - ${row.plannedEnd}` : ''}`,
    actual: row.actualStart ? `${row.actualStart}${row.actualEnd ? ` - ${row.actualEnd}` : ''}` : row.status,
    variance: row.varianceMinutes === undefined ? 'Not enough actual-time data' : `${row.varianceMinutes >= 0 ? '+' : ''}${row.varianceMinutes} min`,
    notes: row.status === 'MISSED' ? 'Planned item was skipped' : undefined,
  }));

  const patterns = [
    `Completed ${completed.length} task${completed.length === 1 ? '' : 's'} across the day.`,
    completed.length > 0 ? 'Consistent morning momentum maintained.' : 'Plan smaller initial morning micro-wins.',
    waiting.length > 0 ? `${waiting.length} external delegation${waiting.length === 1 ? '' : 's'} awaiting follow-up.` : 'No blocked external handoffs.',
    ...(state.accountability?.weeklyInsights || []),
    ...analyzeAccountabilityHabits([state]),
  ].filter((item, index, values) => values.indexOf(item) === index).slice(0, 8);

  return {
    date: state.date,
    timeline: state.timeline,
    completedTasks: completed,
    pendingTasks: pending,
    waitingTasks: waiting,
    blockedTasks: blocked,
    interruptions,
    plannedVsActual,
    recurringPatterns: patterns,
    carryForwardTasks: pending,
    tomorrowAnchors: state.fixedEvents,
    summaryNarrative: `Day summary for ${state.date}: Completed ${completed.length} high-leverage items. ${pending.length} pending items ready to carry forward to tomorrow's blueprint.`,
  };
}
