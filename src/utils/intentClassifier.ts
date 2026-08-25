import { DailyState, Automation, TaskItem, ReminderItem, TimelineEvent, TimetableSlot, GeofenceLocation } from '../types';
import { contextTriggerLabel, resolveLocationName } from './localAutomationParser';
import { extractExplicitTime } from './offlineParser';
import { selectNextBestAction } from './accountabilityEngine';

export type UserIntentType =
  | 'QUERY'
  | 'SAVE_CURRENT_LOCATION'
  | 'CREATE_AUTOMATION'
  | 'LOG_ACTIVITY'
  | 'COMPLETE_TASK'
  | 'MODIFY_TASK'
  | 'CANCEL_TASK_OR_AUTOMATION'
  | 'OTHER';

export interface ClassifiedIntent {
  type: UserIntentType;
  confidence: number;
  isQuestion: boolean;
  queryDetails?: {
    category: 'GEOFENCE_REMINDERS' | 'NEXT_UP' | 'PENDING_ALL' | 'COMPLETED_TODAY' | 'TIME_OR_DATE' | 'LOCATION_REMINDERS' | 'GENERAL_QUERY';
    targetLocation?: { name: string; id?: string };
    triggerType?: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'ANY';
    timeHint?: string;
  };
}

export interface QueryResponse {
  answerText: string;
  spokenText?: string;
  matchedCount: number;
}

export interface SaveCurrentLocationIntent {
  label: string;
}

/** Must run before question detection so “Can you log my current location as Office?” is an action. */
export function extractSaveCurrentLocationIntent(rawInput: string): SaveCurrentLocationIntent | null {
  const input = rawInput.trim();
  const patterns = [
    /^(?:can|could|would)\s+you\s+(?:please\s+)?(?:tag|save|log|name|mark)\s+(?:my\s+|the\s+)?current\s+location\s+(?:as|to)\s+(.+?)\s*[?.!]*$/i,
    /^(?:please\s+)?(?:tag|save|log|name|mark)\s+(?:this|my|the)\s+(?:current\s+)?location\s+(?:as|to)\s+(.+?)\s*[?.!]*$/i,
    /^(?:please\s+)?(?:tag|save|log|name|mark)\s+(?:my\s+|the\s+)?current\s+location\s+(?:as|to)\s+(.+?)\s*[?.!]*$/i,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    const label = match?.[1]?.trim().replace(/^["']|["']$/g, '');
    if (label) return { label };
  }
  return null;
}

/**
 * Normalizes input text for intent matching
 */
function cleanQueryText(text: string): string {
  return text.toLowerCase().trim().replace(/[?.!,]+$/, '');
}

/**
 * Top-level Intent Classifier
 * CRITICAL RULE: Runs BEFORE any state-modifying parser (like parseVoiceAutomations).
 * Detects questions and query intents so they NEVER mutate state.
 */
export function classifyUserIntent(
  rawInput: string,
  currentState?: DailyState,
  lastQueryContext?: { targetLocation?: { name: string; id?: string }; triggerType?: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'ANY' }
): ClassifiedIntent {
  const input = rawInput.trim();
  const lower = input.toLowerCase();
  const cleaned = cleanQueryText(input);

  if (extractSaveCurrentLocationIntent(input)) {
    return { type: 'SAVE_CURRENT_LOCATION', confidence: 0.99, isQuestion: false };
  }

  // 1. Explicit Query / Question Patterns
  const questionPrefixes = [
    /^what('s| is| are)\b/i,
    /^which\b/i,
    /^(do|did) i have\b/i,
    /^have i (got|done|completed|finished)\b/i,
    /^anything (pending|left|scheduled|due)\b/i,
    /^what('s| is) pending\b/i,
    /^what do i (need|have) to\b/i,
    /^what should i (do|focus on|work on)\b/i,
    /^what (reminder|reminders|task|tasks|event|events|automation|automations)\b/i,
    /^tell me (what|which|about|if)\b/i,
    /^remind me what\b/i, // "Remind me what I need to do" -> QUERY
    /^remind me which\b/i,
    /^what('s| is) next\b/i,
    /^what happens (when|if|after)\b/i,
    /^what (have i completed|did i do|was finished|is done)\b/i,
    /^(how many|are there any|is there any)\b/i,
    /^show me\b/i,
    /^list (all|my|the)?\b/i,
    /^check (reminders|tasks|automations|schedule)\b/i,
    /^can you (tell|show|check|list)\b/i,
    /^where (am i|should i)\b/i,
  ];

  // Check if starts with a question prefix
  const isQuestionPrefix = questionPrefixes.some(rx => rx.test(lower));

  // Check if ends with a question mark
  const endsWithQuestionMark = input.endsWith('?');

  // Check for follow-up query phrases like "and when I reach home?", "and at office?", "and leaving work?"
  const isFollowUpQuery =
    /^(and|what about|how about)\s+(when|on|at|if|after)\s+/i.test(lower) ||
    /^(and\s+)?(when reaching|when leaving|at home|at office|at work|on reaching)\s*\??$/i.test(lower);

  // Negative check for creation phrases:
  // E.g. "Remind me to buy medicines when I leave office" -> NOT a question (Creation)
  // E.g. "When I reach home remind me to hand over..." -> NOT a question (Creation)
  const isExplicitCreationPhrase =
    /\bremind me to\b/i.test(lower) ||
    /\bset a reminder (to|for)\b/i.test(lower) ||
    /\bcreate (a |an )?(task|reminder|automation)\b/i.test(lower) ||
    /\badd (a |an )?(task|reminder|todo)\b/i.test(lower) ||
    /\bi have to\b/i.test(lower) && !isQuestionPrefix && !endsWithQuestionMark ||
    /\bi need to\b/i.test(lower) && !isQuestionPrefix && !endsWithQuestionMark;

  const isQuery = (isQuestionPrefix || endsWithQuestionMark || isFollowUpQuery) && !isExplicitCreationPhrase;

  if (isQuery) {
    const queryDetails = extractQueryDetails(cleaned, currentState?.geofenceLocations, lastQueryContext);
    return {
      type: 'QUERY',
      confidence: 0.95,
      isQuestion: true,
      queryDetails,
    };
  }

  // 2. Task Completion Intent
  if (
    /^(done with|finished with|finished|completed|mark done|mark completed|i did|i completed|i finished)\s+/i.test(lower) &&
    !isQuestionPrefix
  ) {
    return {
      type: 'COMPLETE_TASK',
      confidence: 0.9,
      isQuestion: false,
    };
  }

  // 3. Task / Automation Deletion or Cancellation
  if (
    /^(delete|remove|cancel|dismiss|clear)\s+(task|reminder|automation|event|all)\b/i.test(lower) ||
    /\b(cancel reminder|delete automation|remove task)\b/i.test(lower)
  ) {
    return {
      type: 'CANCEL_TASK_OR_AUTOMATION',
      confidence: 0.9,
      isQuestion: false,
    };
  }

  // 4. Creation of Automation or Task
  if (
    /\b(when I leave|after I leave|on leaving|upon leaving|leaving)\b/i.test(lower) ||
    /\b(on reaching|when I reach|when I arrive at|arriving at|when I get to)\b/i.test(lower) ||
    /\bremind me to\b/i.test(lower) ||
    /\bset a reminder\b/i.test(lower) ||
    /\b(new task|add task|create task|todo:)\b/i.test(lower)
  ) {
    return {
      type: 'CREATE_AUTOMATION',
      confidence: 0.95,
      isQuestion: false,
    };
  }

  // 5. Activity Logging (e.g., check-in response: "Had lunch from 1:15 to 1:45")
  if (
    /\bfrom\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*to\b/i.test(lower) ||
    /\bfor the last\s+\d+/i.test(lower) ||
    /^(i was|i've been|working on|just|driving to|drove to)\b/i.test(lower)
  ) {
    return {
      type: 'LOG_ACTIVITY',
      confidence: 0.85,
      isQuestion: false,
    };
  }

  return {
    type: 'OTHER',
    confidence: 0.5,
    isQuestion: false,
  };
}

/**
 * Extracts fine-grained details from a query to inspect local DayTrace state
 */
function extractQueryDetails(
  cleaned: string,
  savedLocations?: GeofenceLocation[],
  lastQueryContext?: { targetLocation?: { name: string; id?: string }; triggerType?: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'ANY' }
): NonNullable<ClassifiedIntent['queryDetails']> {
  const lower = cleaned.toLowerCase();

  // 1. Time / Date queries
  if (/\b(what time|current time|what is the time|what's the time|what day|what's the date|what is the date|today's date)\b/i.test(lower)) {
    return { category: 'TIME_OR_DATE' };
  }

  // 2. "What's next?" / "What should I do?"
  if (/\b(what's next|what is next|whats next|what next|next task|next up|what should i do next|what to do next|what should i work on|what should i focus on)\b/i.test(lower)) {
    return { category: 'NEXT_UP' };
  }

  // 3. "What have I completed today?" / "What did I do today?"
  if (/\b(completed|done|finished|achieved)\b/i.test(lower) && /\b(today|so far|already)\b/i.test(lower)) {
    return { category: 'COMPLETED_TODAY' };
  }

  // 4. "Anything pending?" / "What's pending?" / "What do I have left?"
  if (
    /^(anything pending|what's pending|what is pending|whats pending|what do i have pending|list pending|show pending|pending items|all pending)\??$/i.test(lower) ||
    /\b(anything pending|what's pending|whats pending|what is pending)\b/i.test(lower) && !/\b(when|leave|reach|at|arrive)\b/i.test(lower)
  ) {
    return { category: 'PENDING_ALL' };
  }

  // 5. Geofence / Location-specific Queries
  // E.g.: "What's pending when I leave office?", "What do I need to do when I reach home?", "What reminders do I have at the office?"
  const isExit = /\b(leave|leaving|exit|exiting|depart|departing|after leaving)\b/i.test(lower);
  const isEnter = /\b(reach|reaching|arrive|arriving|arrive at|get to|getting to|on reaching|upon reaching|enter)\b/i.test(lower);

  let detectedTrigger: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'ANY' = 'ANY';
  if (isExit) detectedTrigger = 'GEOFENCE_EXIT';
  else if (isEnter) detectedTrigger = 'GEOFENCE_ENTER';

  // Extract location name (Office, Home, Gym, Supermarket, or custom)
  let targetLocation: { name: string; id?: string } | undefined = undefined;

  // Search for known location keywords in the query
  const locMatch = lower.match(/\b(office|work|workplace|home|house|gym|fitness|supermarket|grocery|store|market)\b/i);
  if (locMatch) {
    targetLocation = resolveLocationName(locMatch[1], savedLocations);
  } else if (savedLocations && savedLocations.length > 0) {
    // Check against custom saved locations
    const customMatch = savedLocations.find(l => lower.includes(l.name.toLowerCase()));
    if (customMatch) {
      targetLocation = { name: customMatch.name, id: customMatch.id };
    }
  }

  // If follow-up question with no explicit location, reuse context
  if (!targetLocation && lastQueryContext?.targetLocation) {
    targetLocation = lastQueryContext.targetLocation;
  }
  if (detectedTrigger === 'ANY' && lastQueryContext?.triggerType) {
    detectedTrigger = lastQueryContext.triggerType;
  }

  if (targetLocation || isExit || isEnter) {
    return {
      category: 'GEOFENCE_REMINDERS',
      targetLocation,
      triggerType: detectedTrigger,
    };
  }

  return {
    category: 'GENERAL_QUERY',
  };
}

/**
 * Pure Query Engine - Executes a read-only query against local DayTrace state.
 * GUARANTEE: ZERO side effects. No state mutations, no task creation.
 */
export function executeDayTraceQuery(
  rawInput: string,
  state: DailyState,
  currentTimeStr?: string,
  lastQueryContext?: { targetLocation?: { name: string; id?: string }; triggerType?: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'ANY' }
): QueryResponse {
  const intent = classifyUserIntent(rawInput, state, lastQueryContext);
  const now = currentTimeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const details = intent.queryDetails || { category: 'GENERAL_QUERY' };

  // 1. Time / Date Query
  if (details.category === 'TIME_OR_DATE') {
    const lower = rawInput.toLowerCase();
    if (lower.includes('date') || lower.includes('day')) {
      const d = new Date();
      const dateStr = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      return {
        answerText: `Today is ${dateStr}.`,
        spokenText: `Today is ${dateStr}.`,
        matchedCount: 1,
      };
    }
    const formattedTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    return {
      answerText: `Current time is ${formattedTime} (${now}).`,
      spokenText: `It's ${formattedTime}.`,
      matchedCount: 1,
    };
  }

  // 2. Completed Today Query
  if (details.category === 'COMPLETED_TODAY') {
    const completedTasks = (state.tasks || []).filter(t => t.status === 'DONE');
    const completedAutos = (state.automations || []).filter(a => a.status === 'COMPLETED');
    const completedTimeline = (state.timeline || []).filter(e => e.type === 'TASK_COMPLETED');

    const uniqueTitles: string[] = [];
    completedTasks.forEach(t => {
      if (!uniqueTitles.includes(t.title)) uniqueTitles.push(t.title);
    });
    completedAutos.forEach(a => {
      if (!uniqueTitles.includes(a.title)) uniqueTitles.push(a.title);
    });
    completedTimeline.forEach(e => {
      const cleanDesc = e.description.replace(/^✓\s*|Completed:\s*|Voice Completed:\s*/i, '').trim();
      if (cleanDesc && !uniqueTitles.includes(cleanDesc)) uniqueTitles.push(cleanDesc);
    });

    if (uniqueTitles.length === 0) {
      return {
        answerText: `No completed tasks logged yet today.`,
        spokenText: `You haven't completed any tasks yet today.`,
        matchedCount: 0,
      };
    }

    const listStr = uniqueTitles.map(t => `• ${t}`).join('\n');
    return {
      answerText: `Completed today (${uniqueTitles.length}):\n${listStr}`,
      spokenText: `You completed ${uniqueTitles.length} items today: ${uniqueTitles.slice(0, 3).join(', ')}.`,
      matchedCount: uniqueTitles.length,
    };
  }

  // 3. "What's next?" Query
  if (details.category === 'NEXT_UP') {
    const requestedMinutes = Number(rawInput.match(/\b(\d{1,3})\s*(?:minutes?|mins?)\b/i)?.[1] || 0);
    const nextAction = selectNextBestAction(state, { availableMinutes: requestedMinutes || undefined });
    if (nextAction) {
      const existingTask = (state.tasks || []).find((task) => task.id === nextAction.taskId);
      const heading = requestedMinutes ? `Best use of ${requestedMinutes} minutes` : 'Next up';
      return {
        answerText: `${heading}:\n• ${nextAction.title}${existingTask?.priority ? ` (Priority ${existingTask.priority})` : ''}${nextAction.estimatedMinutes ? ` • about ${nextAction.estimatedMinutes} min` : ''}\n\nWhy: ${nextAction.rationale || 'best available commitment for the current context'}.`,
        spokenText: `${heading} is ${nextAction.title}.`,
        matchedCount: 1,
      };
    }

    // No actionable task: fall back to the next pending reminder.
    const pendingReminders = (state.reminders || []).filter(r => !r.isDone && r.type === 'TIME_BASED');
    if (pendingReminders.length > 0) {
      const nextRem = pendingReminders[0];
      return {
        answerText: `Next reminder:\n• ${nextRem.message} (${nextRem.triggerCondition})`,
        spokenText: `Next reminder: ${nextRem.message} at ${nextRem.triggerCondition}.`,
        matchedCount: 1,
      };
    }

    // Otherwise surface an active automation.
    const pendingAutos = (state.automations || []).filter(a => a.status === 'PENDING' || a.status === 'TRIGGERED');
    if (pendingAutos.length > 0) {
      const nextAuto = pendingAutos[0];
      const trigLabel = nextAuto.triggerType === 'GEOFENCE_EXIT'
        ? `when leaving ${nextAuto.locationName || 'location'}`
        : nextAuto.triggerType === 'GEOFENCE_ENTER'
        ? `when arriving ${nextAuto.locationName || 'location'}`
        : nextAuto.triggerType === 'CONTEXT_EVENT'
        ? contextTriggerLabel(nextAuto.contextEvent).toLowerCase()
        : `at ${nextAuto.scheduledTime}`;
      return {
        answerText: `Next automation:\n• ${nextAuto.title} (${trigLabel})`,
        spokenText: `Next automation is ${nextAuto.title}, ${trigLabel}.`,
        matchedCount: 1,
      };
    }

    return {
      answerText: `No pending tasks or reminders right now. All caught up!`,
      spokenText: `All caught up! No pending tasks right now.`,
      matchedCount: 0,
    };
  }

  // 4. "Anything pending?" / "What's pending?" (All pending items summary)
  if (details.category === 'PENDING_ALL') {
    const items: string[] = [];

    // Automations (PENDING / TRIGGERED / SNOOZED)
    const activeAutos = (state.automations || []).filter(
      a => a.status === 'PENDING' || a.status === 'TRIGGERED' || a.status === 'SNOOZED'
    );
    activeAutos.forEach(a => {
      const trigDesc = a.triggerType === 'GEOFENCE_EXIT'
        ? `when leaving ${a.locationName || 'Location'}`
        : a.triggerType === 'GEOFENCE_ENTER'
        ? `when arriving ${a.locationName || 'Location'}`
        : a.triggerType === 'CONTEXT_EVENT'
        ? contextTriggerLabel(a.contextEvent)
        : `${a.scheduledTime || 'Scheduled Time'}`;
      items.push(`• ${a.title} — ${trigDesc}`);
    });

    // Reminders
    const activeReminders = (state.reminders || []).filter(r => !r.isDone);
    activeReminders.forEach(r => {
      items.push(`• ${r.message} — ${r.triggerCondition}`);
    });

    // High Priority Tasks
    const activeTasks = (state.tasks || []).filter(
      t => t.status === 'ACTIVE' || t.status === 'NEXT' || t.status === 'SCHEDULED'
    );
    activeTasks.slice(0, 3).forEach(t => {
      items.push(`• ${t.title} (${t.category})`);
    });

    if (items.length === 0) {
      return {
        answerText: `You have 0 pending items. All clear!`,
        spokenText: `You have no pending items.`,
        matchedCount: 0,
      };
    }

    return {
      answerText: `You have ${items.length} pending item${items.length > 1 ? 's' : ''}:\n${items.join('\n')}`,
      spokenText: `You have ${items.length} pending item${items.length > 1 ? 's' : ''}. First: ${items[0].replace(/^•\s*/, '')}.`,
      matchedCount: items.length,
    };
  }

  // 5. Geofence / Location-specific Reminders & Automations
  // E.g.: "What's pending when I leave office?", "What do I need to do when I reach home?", "What reminders at office?"
  const locName = details.targetLocation?.name;
  const trigType = details.triggerType || 'ANY';

  // Filter automations matching location & trigger
  const matchedAutomations = (state.automations || []).filter(a => {
    // Only active statuses
    if (a.status !== 'PENDING' && a.status !== 'TRIGGERED' && a.status !== 'SNOOZED') return false;

    // Check location
    if (locName) {
      const aLoc = (a.locationName || '').toLowerCase();
      const targetLoc = locName.toLowerCase();
      const locMatches = aLoc === targetLoc || aLoc.includes(targetLoc) || targetLoc.includes(aLoc);
      if (!locMatches) return false;
    }

    // Check trigger type
    if (trigType !== 'ANY' && a.triggerType !== trigType) {
      return false;
    }

    return true;
  });

  // Also check location-based reminders in state.reminders
  const matchedReminders = (state.reminders || []).filter(r => {
    if (r.isDone) return false;
    if (r.type === 'LOCATION_BASED' && locName) {
      return r.triggerCondition.toLowerCase().includes(locName.toLowerCase());
    }
    return false;
  });

  const totalMatched = matchedAutomations.length + matchedReminders.length;

  if (totalMatched === 0) {
    const locPrefix = locName ? ` for ${locName}` : '';
    const trigPrefix = trigType === 'GEOFENCE_EXIT' ? 'when leaving' : trigType === 'GEOFENCE_ENTER' ? 'when arriving at' : '';
    const fullPrefix = [trigPrefix, locName].filter(Boolean).join(' ');

    const msg = fullPrefix
      ? `No pending tasks or reminders ${fullPrefix}.`
      : `No pending reminders found${locPrefix}.`;

    return {
      answerText: msg,
      spokenText: msg,
      matchedCount: 0,
    };
  }

  // Format concise voice-friendly response
  const header = trigType === 'GEOFENCE_EXIT' && locName
    ? `When you leave ${locName}:`
    : trigType === 'GEOFENCE_ENTER' && locName
    ? `When you reach ${locName}:`
    : locName
    ? `Pending at ${locName}:`
    : `Pending items:`;

  const itemLines: string[] = [];
  matchedAutomations.forEach(a => {
    itemLines.push(`• ${a.title}`);
  });
  matchedReminders.forEach(r => {
    itemLines.push(`• ${r.message}`);
  });

  const answerText = `${header}\n${itemLines.join('\n')}`;
  const spokenText = `${header} ${itemLines.map(i => i.replace(/^•\s*/, '')).join(', ')}.`;

  return {
    answerText,
    spokenText,
    matchedCount: totalMatched,
  };
}

/**
 * Safe client-side Text-To-Speech (TTS) helper
 * Speaks response aloud for hands-free driving/moving without cloud dependencies
 */
export function speakQueryResponse(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // cancel previous utterance
    const cleanText = text
      .replace(/•/g, '')
      .replace(/✓/g, '')
      .replace(/\n+/g, '. ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('SpeechSynthesis unavailable:', e);
  }
}
