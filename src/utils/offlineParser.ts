import { DailyState, TaskItem, TaskStatus, TimelineEvent, FixedEvent, ReminderItem, ParseResult, EndOfDayReview, TaskCategory } from '../types';

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
  const newFixedEvents: Omit<FixedEvent, 'id'>[] = [];
  const newReminders: Omit<ReminderItem, 'id'>[] = [];
  let currentLocation = currentState.current.location;
  let currentActivity = currentState.current.activity;
  let currentEnergy = currentState.current.energy;
  let responseNotes: string[] = [];

  // 2. Location arrivals & departures
  if (/\b(reached|arrived at|in|at)\s+(office|work|workplace)\b/i.test(lower)) {
    currentLocation = 'Office';
    const parsedTime = extractExplicitTime(rawInput) || now;
    newTimelineEvents.push({
      time: parsedTime,
      type: 'DEPARTURE',
      description: 'Reached office',
      location: 'Office',
    });
    responseNotes.push('Recorded arrival at Office');
  } else if (/\b(reached|arrived at|at|back at)\s+(home|house)\b/i.test(lower)) {
    currentLocation = 'Home';
    const parsedTime = extractExplicitTime(rawInput) || now;
    newTimelineEvents.push({
      time: parsedTime,
      type: 'DEPARTURE',
      description: 'Arrived at home',
      location: 'Home',
    });
    responseNotes.push('Recorded arrival at Home');
  } else if (/\b(reached|at|in)\s+(gym|fitness center)\b/i.test(lower)) {
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

  // 5. Compound tasks & Negation handling (Section 16)
  const existingTasks = currentState.tasks || [];
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
      
      for (const item of taskSubItems) {
        if (clause.toLowerCase().includes(item)) {
          if (isNegative) {
            negativeSubItems.push(item);
          } else if (isPositiveAction(clause)) {
            positiveSubItems.push(item);
          }
        }
      }
    }

    if (!isCompound) {
      const mentionsTask = taskSubItems.some(sub => lower.includes(sub));
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

  // 6. Workflow submission -> IT waiting & CRM blocked cascade
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

  // 7. Idea capture
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

  // 8. General task creation
  if (/\b(need to|have to|must|add task|todo:)\b/i.test(lower) && !newTasks.length && !completedTaskTitles.length) {
    const taskTitle = rawInput.replace(/.*(need to|have to|must|add task|todo:)\s+/i, '').trim();
    if (taskTitle) {
      newTasks.push({
        title: capitalizeFirst(taskTitle),
        category: 'OFFICE',
        owner: 'ME',
        status: 'NEXT',
        priority: 7,
        createdAt: now,
      });
      responseNotes.push(`Added new task: "${taskTitle}"`);
    }
  }

  // 9. Compute Next Best Action
  let nextActionTitle = 'Review priorities & next tasks';
  let nextActionRationale = 'Stay focused on your highest leverage open item.';
  let nextCategory: TaskCategory = 'OFFICE';

  const nextCandidate = existingTasks.find(t => t.status === 'NEXT' && !completedTaskTitles.includes(t.title)) ||
    newTasks.find(t => t.status === 'NEXT');

  if (nextCandidate) {
    nextActionTitle = nextCandidate.title;
    nextActionRationale = `High leverage item in ${nextCandidate.category}.`;
    nextCategory = nextCandidate.category;
  }

  const finalAiText = responseNotes.length > 0
    ? responseNotes.join('. ') + `. Next focus: ${nextActionTitle}.`
    : `Recorded update for ${now}. Next best action: Focus on ${nextActionTitle}.`;

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
      nextBestAction: {
        title: nextActionTitle,
        rationale: nextActionRationale,
        category: nextCategory,
      },
      changesSummary: {
        tasksDone: completedTaskTitles,
        tasksWaiting: newTasks.filter(t => t.status === 'WAITING').map(t => t.title),
        tasksBlocked: newTasks.filter(t => t.status === 'BLOCKED').map(t => t.title),
        tasksCreated: newTasks.map(t => t.title),
        timelineAdded: newTimelineEvents.map(e => e.description),
        nextAction: nextActionTitle,
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

function isNegatedClause(clause: string): boolean {
  return /\b(couldn't|could not|didn't|did not|unable|can't|cannot|forgot|failed|not|left behind|missed)\b/i.test(clause);
}

function isPositiveAction(clause: string): boolean {
  return /\b(brought|took|picked up|completed|finished|sent|submitted|bought|done|published|got|took along|handled)\b/i.test(clause);
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

  const plannedVsActual = (state.timetable || []).map(slot => ({
    event: slot.title,
    planned: `${slot.startTime} - ${slot.endTime}`,
    actual: slot.status === 'COMPLETED' ? 'Completed on time' : slot.status === 'ACTIVE' ? 'In progress' : 'Pending / Skipped',
    variance: slot.status === 'COMPLETED' ? '0 min' : 'Pending',
    notes: slot.notes,
  }));

  const patterns = [
    `Completed ${completed.length} task${completed.length === 1 ? '' : 's'} across the day.`,
    completed.length > 0 ? 'Consistent morning momentum maintained.' : 'Plan smaller initial morning micro-wins.',
    waiting.length > 0 ? `${waiting.length} external delegation${waiting.length === 1 ? '' : 's'} awaiting follow-up.` : 'No blocked external handoffs.',
  ];

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
