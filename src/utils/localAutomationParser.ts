import { Automation, DailyState, GeofenceLocation, TimelineEvent, EventSource } from '../types';
import { extractExplicitTime } from './offlineParser';
import { classifyUserIntent, extractCompoundCheckInIntent } from './intentClassifier';
import { detectContextEvent } from './accountabilityEngine';
import { isDirectActivityCheckInStatement } from './activityIntent';

export { isDirectActivityCheckInStatement } from './activityIntent';

export interface ParsedAutomationResult {
  isAutomation: boolean;
  automations: Omit<Automation, 'id'>[];
  timelineLogs: Omit<TimelineEvent, 'id'>[];
  summaryText: string;
  confirmationCard?: {
    count: number;
    items: {
      action: string;
      trigger: string;
      location?: string;
      time?: string;
    }[];
  };
}

export interface ActivitySegment {
  startTime: string;
  endTime?: string;
  description: string;
  category?: string;
  source: EventSource;
}

/**
 * Normalizes location names to standard or saved places
 */
export function resolveLocationName(
  rawLoc: string, 
  savedLocations?: GeofenceLocation[]
): { name: string; id?: string } {
  const clean = rawLoc.toLowerCase().trim();
  
  if (savedLocations && savedLocations.length > 0) {
    const match = savedLocations.find(l => 
      l.name.toLowerCase() === clean || 
      clean.includes(l.name.toLowerCase()) || 
      (clean === 'work' && l.name.toLowerCase() === 'office') ||
      (clean === 'house' && l.name.toLowerCase() === 'home')
    );
    if (match) {
      return { name: match.name, id: match.id };
    }
  }

  if (/\b(office|work|workplace)\b/i.test(clean)) {
    return { name: 'Office', id: 'geo-office' };
  }
  if (/\b(home|house)\b/i.test(clean)) {
    return { name: 'Home', id: 'geo-home' };
  }
  if (/\b(gym|fitness)\b/i.test(clean)) {
    return { name: 'Gym', id: 'geo-gym' };
  }
  if (/\b(supermarket|grocery|store|market)\b/i.test(clean)) {
    return { name: 'Supermarket', id: 'geo-supermarket' };
  }

  // Capitalize custom name
  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
  return { name: capitalized, id: `geo-${clean.replace(/\s+/g, '-').toLowerCase()}` };
}

/**
 * Parses single or compound voice commands into Automations
 */
export function parseVoiceAutomations(
  input: string,
  currentState?: DailyState,
  currentTimeStr?: string
): ParsedAutomationResult {
  const rawInput = input.trim();
  const lower = rawInput.toLowerCase();
  const now = currentTimeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const savedLocations = currentState?.geofenceLocations;

  // 0. QUERY INTENT INTERCEPTION: If the user is asking a question, NEVER create or parse an automation!
  const classified = classifyUserIntent(rawInput, currentState);
  if (classified.type === 'QUERY' || classified.isQuestion) {
    return {
      isAutomation: false,
      automations: [],
      timelineLogs: [],
      summaryText: '',
    };
  }

  // A check-in can contain trigger-like words such as “after lunch” without
  // requesting an automation. Resolve explicit past/present activity before
  // interpreting contextual trigger phrases, unless the user actually asks
  // to remind, notify, alert, schedule, or set an alarm.
  const hasAutomationDirective = /\b(?:remind|notify|alert|schedule|set\s+(?:an?\s+)?alarm)\b/i.test(rawInput);
  if (!hasAutomationDirective && isDirectActivityCheckInStatement(rawInput)) {
    const directTimelineLogs = parseActivityLogUtterance(rawInput, now);
    if (directTimelineLogs.length > 0) {
      const summaryItems = directTimelineLogs.map((log) => `${log.time}: ${log.description}`).join('. ');
      return {
        isAutomation: false,
        automations: [],
        timelineLogs: directTimelineLogs,
        summaryText: `Added to timeline: ${summaryItems}`,
      };
    }
  }

  // Split compound commands by connectors
  // E.g.: "Remind me when I leave office to get medicines and on reaching home I have to hand over the medicines to my wife."
  // Connectors: "and on reaching", "and when", "and then", "and after", "and", "then", "also", "after that"
  const rawClauses = splitCompoundUtterance(rawInput);
  const detectedAutomations: Omit<Automation, 'id'>[] = [];
  let lastSeenLocation: { name: string; id?: string } | null = null;
  let sharedContext: string | undefined = undefined;

  // Detect shared context keywords (e.g. "medicines", "milk", "report", "protein")
  const contextKeywords = extractContextKeywords(rawInput);
  if (contextKeywords.length > 0) {
    sharedContext = contextKeywords.join(', ');
  }

  const timedAgenda = parseTimedAgendaAutomations(rawInput, now);
  if (timedAgenda.length >= 2) {
    detectedAutomations.push(...timedAgenda);
  } else {
    for (let i = 0; i < rawClauses.length; i++) {
      const clause = rawClauses[i].trim();
      if (!clause) continue;

      const parsedClause = parseSingleAutomationClause(clause, lastSeenLocation, savedLocations, now, rawInput, currentState);
      if (parsedClause) {
        if (parsedClause.locationName) {
          lastSeenLocation = { name: parsedClause.locationName, id: parsedClause.locationId };
        }
        if (sharedContext) {
          parsedClause.relatedContext = sharedContext;
        }
        detectedAutomations.push(parsedClause);
      }
    }
  }

  if (detectedAutomations.length === 0) {
    // Check if it's a multi-activity timeline log instead (e.g. check-in response)
    const timelineLogs = parseActivityLogUtterance(rawInput, now);
    if (timelineLogs.length > 0) {
      const summaryItems = timelineLogs.map(l => `${l.time}: ${l.description}`).join('. ');
      return {
        isAutomation: false,
        automations: [],
        timelineLogs,
        summaryText: `Added to timeline: ${summaryItems}`,
      };
    }

    return {
      isAutomation: false,
      automations: [],
      timelineLogs: [],
      summaryText: '',
    };
  }

  // Link related automations
  const confirmationItems = detectedAutomations.map(auto => {
    let triggerDesc = '';
    if (auto.triggerType === 'CONTEXT_EVENT') {
      triggerDesc = contextTriggerLabel(auto.contextEvent);
    } else if (auto.triggerType === 'GEOFENCE_EXIT') {
      triggerDesc = `Leaving ${auto.locationName || 'Location'}`;
    } else if (auto.triggerType === 'GEOFENCE_ENTER') {
      triggerDesc = `Arriving ${auto.locationName || 'Location'}`;
    } else {
      triggerDesc = `At ${auto.scheduledTime || 'Scheduled Time'}`;
    }
    return {
      action: auto.title,
      trigger: triggerDesc,
      location: auto.locationName,
      time: auto.scheduledTime,
    };
  });

  const summary = `✓ ${detectedAutomations.length} automation${detectedAutomations.length > 1 ? 's' : ''} created:\n` +
    confirmationItems.map(item => `${item.trigger} → ${item.action}`).join('\n');

  return {
    isAutomation: true,
    automations: detectedAutomations,
    timelineLogs: [],
    summaryText: summary,
    confirmationCard: {
      count: detectedAutomations.length,
      items: confirmationItems,
    },
  };
}

export const contextTriggerLabel = (event?: Automation['contextEvent']): string => {
  switch (event) {
    case 'LEAVING_DESK': return 'When leaving the desk';
    case 'RENDERING_STARTED': return 'When rendering starts';
    case 'RENDERING_FINISHED': return 'When rendering finishes';
    case 'WORK_FINISHED': return 'When work finishes';
    case 'LUNCH_WINDOW': return 'During the lunch window';
    case 'CLIENT_DUE_TONIGHT': return 'When a client deadline is due tonight';
    default: return 'When the saved context occurs';
  }
};

interface TimedAgendaMatch {
  index: number;
  endIndex: number;
  raw: string;
  startHour: number;
  startMinute: number;
  startMeridiem?: string;
  endHour?: number;
  endMinute?: number;
  endMeridiem?: string;
}

/** Splits agenda dictation containing repeated time markers into one automation per marker. */
export function parseTimedAgendaAutomations(input: string, now: string): Omit<Automation, 'id'>[] {
  const matcher = /\b(?:(?:today|tomorrow)\s+)?(?:(?:at|from)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/gi;
  const matches: TimedAgendaMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(input)) !== null) {
    const raw = match[0];
    const hasTriggerShape = /\b(?:at|from)\b/i.test(raw) || !!match[3] || !!match[4];
    if (!hasTriggerShape) continue;
    const startHour = Number(match[1]);
    const endHour = match[4] ? Number(match[4]) : undefined;
    if (startHour > 23 || (endHour !== undefined && endHour > 23)) continue;
    matches.push({
      index: match.index,
      endIndex: matcher.lastIndex,
      raw,
      startHour,
      startMinute: Number(match[2] || 0),
      startMeridiem: match[3]?.toLowerCase(),
      endHour,
      endMinute: match[5] ? Number(match[5]) : undefined,
      endMeridiem: match[6]?.toLowerCase(),
    });
  }
  if (matches.length < 2) return [];

  const sharedMeridiem = matches.find((item) => item.startMeridiem)?.startMeridiem
    || matches.find((item) => item.endMeridiem)?.endMeridiem;
  const to24Hour = (hour: number, minute: number, meridiem?: string) => {
    let normalizedHour = hour;
    const effectiveMeridiem = meridiem || sharedMeridiem;
    if (effectiveMeridiem === 'pm' && normalizedHour < 12) normalizedHour += 12;
    if (effectiveMeridiem === 'am' && normalizedHour === 12) normalizedHour = 0;
    return `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  return matches.map((item, index) => {
    const nextIndex = matches[index + 1]?.index ?? input.length;
    let description = input.slice(item.endIndex, nextIndex)
      .replace(/^[\s,;:–—-]*(?:we\s+have\s+|it(?:'|’)s\s+|is\s+)?/i, '')
      .replace(/[\s,;:–—-]*(?:and|then|and\s+then|from)\s*$/i, '')
      .trim();
    if (!description) description = `Scheduled item at ${item.raw.trim()}`;
    description = description.charAt(0).toUpperCase() + description.slice(1);
    const scheduledTime = to24Hour(item.startHour, item.startMinute, item.startMeridiem);
    const endTime = item.endHour === undefined
      ? undefined
      : to24Hour(item.endHour, item.endMinute || 0, item.endMeridiem || item.startMeridiem);
    const reminderText = endTime ? `${description} (${scheduledTime}–${endTime})` : description;
    return {
      title: generateCleanTitle(description),
      originalVoiceText: input,
      triggerType: 'TIME' as const,
      scheduledTime,
      reminderText,
      status: 'PENDING' as const,
      createdAt: now,
    };
  });
}

/**
 * Splits a complex voice sentence into distinct automation clauses
 */
function splitCompoundUtterance(text: string): string[] {
  // Regex to split on major task connectors while preserving the trigger phrases
  // E.g.: "Remind me when I leave office to get medicines and on reaching home I have to hand over the medicines to my wife."
  // Splitting points:
  // " and on reaching " -> ["Remind me when I leave office to get medicines", "on reaching home I have to hand over the medicines to my wife."]
  // " and when I "
  // " and after I "
  // " and then "
  // " and at "
  // " , then "
  // " , and "
  
  const regex = /\s+(?:and\s+(?:on\s+reaching|when\s+I|after\s+I|at\s+\d|then|also|afterwards|once)|then|after\s+that|afterwards|also)\s+/i;
  
  // Custom smart split that preserves the connector keyword for trigger detection
  const parts: string[] = [];
  let remaining = text;

  const delimiterPattern = /(,\s*and\s+|,?\s+and\s+(?:on\s+reaching|when\s+I|after\s+I|at\s+\d+|when\s+leaving|upon\s+reaching)|,\s*then\s+|;\s*|\s+then\s+|\s+after\s+that\s+|\s+afterwards\s+)/gi;
  
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = delimiterPattern.exec(text)) !== null) {
    const segment = text.slice(lastIndex, match.index).trim();
    if (segment) {
      parts.push(segment);
    }
    
    // Check if the delimiter itself contained trigger info (e.g. "and on reaching")
    const delim = match[0].trim().toLowerCase();
    if (delim.includes('on reaching') || delim.includes('when i') || delim.includes('after i') || delim.includes('at ')) {
      // Re-attach the trigger keyword to the start of the next segment
      const cleanDelim = delim.replace(/^,\s*and\s+|^and\s+|^,\s*/i, '').trim();
      lastIndex = match.index + match[0].length;
      const nextSegmentEnd = text.indexOf('\n', lastIndex);
      // We will let the next iteration pick up the rest with the trigger prepended
      remaining = cleanDelim + ' ' + text.slice(lastIndex);
      lastIndex = text.length; // finish outer loop and split remainder
      const subSplits = splitCompoundUtterance(remaining);
      parts.push(...subSplits);
      return parts.filter(p => p.trim().length > 0);
    }

    lastIndex = match.index + match[0].length;
  }

  const finalSegment = text.slice(lastIndex).trim();
  if (finalSegment) {
    parts.push(finalSegment);
  }

  // If no delimiter was found, fallback to simple clause or "and" split if two distinct triggers exist
  if (parts.length <= 1) {
    const andMatch = text.match(/(.*?\b(?:office|home|gym|work|supermarket|\d+\s*(?:am|pm)?)\b.*?)\s+and\s+(.*)/i);
    if (andMatch && (andMatch[2].includes('reaching') || andMatch[2].includes('leave') || andMatch[2].includes('home') || andMatch[2].includes('office') || andMatch[2].includes('gym') || andMatch[2].includes('at '))) {
      return [andMatch[1].trim(), andMatch[2].trim()];
    }
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Parses a single clause for trigger type, location/time, and reminder text
 */
function parseSingleAutomationClause(
  clause: string,
  lastSeenLocation: { name: string; id?: string } | null,
  savedLocations?: GeofenceLocation[],
  now?: string,
  fullOriginalText?: string,
  currentState?: DailyState,
): Omit<Automation, 'id'> | null {
  const lower = clause.toLowerCase().trim();

  // 1. Check GEOFENCE EXIT
  // e.g. "when I leave office to get medicines", "After I leave work remind me to buy milk", "when I leave the gym", "when I leave"
  const isExit = /\b(when(?:ever)? I leave|after I leave|on leaving|upon leaving|leaving|leave|exit|exiting|after leaving|departing from|departing)\b/i.test(lower);
  
  // 2. Check GEOFENCE ENTER
  // e.g. "on reaching home I have to hand over medicines", "when I reach home", "when I arrive at gym", "when I get to the supermarket", "on reaching", "reaching", "arrive at", "get to", "enter"
  const isEnter = /\b(on reaching|when I reach|when I arrive at|arriving at|arriving|when I get to|getting to|when I enter|entering|on arrival at|upon reaching|reach|get to|arrive at)\b/i.test(lower);

  // 3. Check TIME TRIGGER
  const timeMatch = extractExplicitTime(clause);
  const hasTimeTrigger = Boolean(timeMatch) || /\b(at \d{1,2}(?::\d{2})?\s*(?:am|pm)?|in the evening|in the morning|tonight)\b/i.test(lower);
  const contextEvent = detectContextEvent(clause);

  if (!isExit && !isEnter && !hasTimeTrigger && !contextEvent && !/\bremind me\b/i.test(lower)) {
    return null;
  }

  let triggerType: Automation['triggerType'] = 'TIME';
  let resolvedLocation: { name: string; id?: string } | null = null;
  let scheduledTime: string | undefined = undefined;

  if (contextEvent) {
    triggerType = 'CONTEXT_EVENT';
  } else if (isExit) {
    triggerType = 'GEOFENCE_EXIT';
    const currentReference = /\b(?:(?:my|the|this)\s+)?current\s+(?:location|place|spot)\b|\b(?:from\s+)?here\b/i.test(clause);
    const currentLabel = currentState?.current?.location?.trim();
    const currentSavedPlace = currentLabel && !/^(unknown|current location)$/i.test(currentLabel)
      ? savedLocations?.find((location) => location.name.toLowerCase() === currentLabel.toLowerCase())
      : undefined;
    const locMatch = clause.match(/\b(?:leave|leaving|exit|exiting|departing(?:\s+from)?)\s+(?:the\s+)?([a-zA-Z][a-zA-Z'-]*(?:\s+[a-zA-Z][a-zA-Z'-]*)?)\b/i);
    if (currentReference && currentLabel && !/^(unknown|current location)$/i.test(currentLabel)) {
      resolvedLocation = currentSavedPlace
        ? { name: currentSavedPlace.name, id: currentSavedPlace.id }
        : { name: currentLabel };
    } else if (locMatch && !['to', 'and', 'remind', 'my', 'it', 'current location', 'current place', 'current spot'].includes(locMatch[1].toLowerCase())) {
      resolvedLocation = resolveLocationName(locMatch[1], savedLocations);
    } else if (lastSeenLocation) {
      resolvedLocation = lastSeenLocation;
    } else {
      resolvedLocation = currentSavedPlace
        ? { name: currentSavedPlace.name, id: currentSavedPlace.id }
        : currentLabel && !/^unknown$/i.test(currentLabel) ? { name: currentLabel } : null;
    }
  } else if (isEnter) {
    triggerType = 'GEOFENCE_ENTER';
    const locMatch = clause.match(/\b(?:reaching|reach|arriving at|arrive at|arriving|get to|getting to|enter|entering)\s+(?:the\s+)?([a-zA-Z]+)\b/i);
    if (locMatch && !['to', 'and', 'remind', 'my', 'it', 'there'].includes(locMatch[1].toLowerCase())) {
      resolvedLocation = resolveLocationName(locMatch[1], savedLocations);
    } else if (lastSeenLocation) {
      resolvedLocation = lastSeenLocation;
    } else {
      resolvedLocation = resolveLocationName('Home', savedLocations);
    }
  } else if (hasTimeTrigger) {
    triggerType = 'TIME';
    scheduledTime = timeMatch || (lower.includes('morning') ? '08:30' : '19:00');
  }

  // Extract Clean Reminder / Task Text
  let reminderText = extractCleanReminderText(clause);
  if (!reminderText || reminderText.length < 2) {
    reminderText = clause;
  }

  const title = generateCleanTitle(reminderText);

  return {
    title,
    originalVoiceText: fullOriginalText || clause,
    triggerType,
    locationId: resolvedLocation?.id,
    locationName: resolvedLocation?.name,
    scheduledTime,
    reminderText,
    status: 'PENDING',
    createdAt: now || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    contextEvent: contextEvent || undefined,
  };
}

/**
 * Extracts and cleans the core action from a voice clause
 */
export function extractCleanReminderText(clause: string): string {
  const triggeredAction = clause.match(
    /\b(?:when(?:ever)?\s+i\s+(?:leave|exit|depart(?:\s+from)?)|after\s+i\s+leave|on\s+leaving|upon\s+leaving|when(?:ever)?\s+i\s+(?:reach|arrive|enter)|on\s+reaching|upon\s+reaching)\b[\s\S]*?\b(?:remind\s+me\s+to|i\s+(?:have|need)\s+to|to)\s+(.+?)\s*[.!?]*$/i,
  );
  if (triggeredAction?.[1]?.trim()) {
    const action = triggeredAction[1].trim();
    return action.charAt(0).toUpperCase() + action.slice(1);
  }
  let cleaned = clause
    // Remove prefixes like "remind me when I leave office to", "on reaching home I have to", "after I leave work remind me to"
    .replace(/^.*?\b(?:remind me to|remind me that|remind me|set a reminder to|don't forget to|i have to|i need to|have to|need to|must)\s+/i, '')
    .replace(/^(?:please\s+)?(?:make|create|set)\s+(?:me\s+)?(?:a\s+)?reminder(?:\s+for\s+me)?\s*/i, '')
    // Remove "when I leave [location] to" or "on reaching [location]"
    .replace(/^.*?\b(?:when I leave|after I leave|on reaching|when I reach|when I arrive at|arriving at|when I get to)\s+(?:the\s+)?[a-zA-Z]+\s+(?:to|i have to|i need to|remind me to)?\s*/i, '')
    .replace(/^.*?\b(?:when|after|once)\s+(?:the\s+)?(?:render|rendering|export|work)\s+(?:starts?|finishes?|is done|completes?)\s+(?:to|remind me to)?\s*/i, '')
    // Remove trailing punctuation
    .replace(/[.!?]+$/, '')
    .trim();

  // If starts with "to ", remove "to "
  if (/^to\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^to\s+/i, '').trim();
  }

  // If starts with "I have to ", clean it
  if (/^I have to\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^I have to\s+/i, '').trim();
  }

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Generates a concise title for the automation task
 */
export function generateCleanTitle(reminderText: string): string {
  let title = reminderText
    .replace(/^(please\s+|just\s+)/i, '')
    .trim();

  if (title.length > 60) {
    title = title.slice(0, 57) + '...';
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}

/**
 * Extracts key domain context words to link related tasks (e.g. "medicines", "milk", "report")
 */
function extractContextKeywords(text: string): string[] {
  const commonNouns = text.match(/\b(medicines?|pills?|milk|groceries|report|presentation|doctor|raj|wife|keys|laptop|charger|gym|package|parcel|curd|pillow)\b/gi);
  if (!commonNouns) return [];
  const unique = Array.from(new Set(commonNouns.map(w => w.toLowerCase())));
  return unique.map(w => w.charAt(0).toUpperCase() + w.slice(1));
}

/**
 * Parses multi-activity check-in phrases
 * e.g. "Had lunch from 1:15 to 1:45 and then worked on emails."
 * e.g. "I've been working on the quarterly report for the last hour."
 */
export function parseActivityLogUtterance(
  text: string, 
  currentTimeStr?: string
): Omit<TimelineEvent, 'id'>[] {
  const lower = text.toLowerCase().trim();
  const now = currentTimeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const today = new Date().toISOString().split('T')[0];

  const results: Omit<TimelineEvent, 'id'>[] = [];

  // A compound check-in may mention location first and the current work later.
  // Keep the activity even when another local action appears in the same voice message.
  const compoundActivity = extractCompoundCheckInIntent(text)?.activityDescription;
  if (compoundActivity) {
    results.push({
      date: today,
      time: now,
      type: 'TASK_STARTED',
      description: compoundActivity,
      source: 'CHECK_IN',
      syncStatus: 'PENDING',
    });
    return results;
  }

  // Pattern 1: "from [start] to [end] [activity] and then [activity 2]"
  // e.g. "Had lunch from 1:15 to 1:45 and then worked on emails."
  const rangeMatch = text.match(/(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  
  if (rangeMatch) {
    const rawStart = rangeMatch[1];
    const rawEnd = rangeMatch[2];
    const startTime = formatTimeTo24h(rawStart);
    const endTime = formatTimeTo24h(rawEnd);

    // Extract first activity before / around the time range
    let act1 = text.replace(rangeMatch[0], '').split(/\band then\b|\bthen\b|\band\b/i)[0].trim();
    act1 = act1.replace(/^(had|was having|did|was|i was|have been)\s+/i, '').trim();
    if (!act1) act1 = 'Activity';
    act1 = act1.charAt(0).toUpperCase() + act1.slice(1);

    results.push({
      date: today,
      time: `${startTime}–${endTime}`,
      startTime,
      endTime,
      type: 'EVENT',
      description: act1,
      source: 'CHECK_IN',
      syncStatus: 'PENDING',
    });

    // Check if there is a second activity after "and then"
    const afterMatch = text.split(/\band then\b|\bthen\b/i);
    if (afterMatch.length > 1) {
      let act2 = afterMatch[1].replace(/[.!?]+$/, '').trim();
      act2 = act2.replace(/^(i\s+|i was\s+|worked on\s+|did\s+)?/i, (m) => m.toLowerCase().includes('worked') ? 'Worked on ' : '').trim();
      act2 = act2.charAt(0).toUpperCase() + act2.slice(1);

      results.push({
        date: today,
        time: `${endTime}–${now}`,
        startTime: endTime,
        endTime: now,
        type: 'TASK_STARTED',
        description: act2,
        source: 'CHECK_IN',
        syncStatus: 'PENDING',
      });
    }

    return results;
  }

  // Pattern 2: "for the last [X] hours/minutes [activity]"
  // e.g. "I've been working on the quarterly report for the last hour."
  const durationMatch = lower.match(/(?:for the last|in the last|for the past|over the past|past|for the)\s+(\d+|an?|one|half an?)?\s*(hours?|hrs?|minutes?|mins?)/i);
  if (durationMatch) {
    let minutes = 60;
    const numStr = durationMatch[1] ? durationMatch[1].trim() : '1';
    const unit = durationMatch[2];

    if (numStr === 'a' || numStr === 'an' || numStr === 'one' || !numStr) {
      minutes = unit.startsWith('h') ? 60 : 1;
    } else if (numStr.includes('half')) {
      minutes = 30;
    } else {
      const parsed = parseInt(numStr, 10);
      minutes = unit.startsWith('h') ? (isNaN(parsed) ? 60 : parsed * 60) : (isNaN(parsed) ? 30 : parsed);
    }

    const calculatedStart = calculatePastTime(now, minutes);
    let act = text
      .replace(durationMatch[0], '')
      .replace(/^(i've been|i have been|was|i was)\s+/i, '')
      .replace(/[.!?]+$/, '')
      .trim();

    act = act.charAt(0).toUpperCase() + act.slice(1);

    results.push({
      date: today,
      time: `${calculatedStart}–${now}`,
      startTime: calculatedStart,
      endTime: now,
      type: 'TASK_STARTED',
      description: act,
      source: 'CHECK_IN',
      syncStatus: 'PENDING',
    });

    return results;
  }

  // Pattern 3: Direct activity/status statement e.g. "I was driving home",
  // "I'm working on app development", or "I am still on the bed". In
  // Accountability mode these are check-ins, never future tasks. Resolving this
  // deterministically also prevents an available on-device model from turning
  // a passive status into a commitment the user never made.
  if (isDirectActivityCheckInStatement(text)) {
    let act = text
      .replace(/^(i was|i've been|i have been|i'm|i am|just)\s+/i, '')
      .replace(/[.!?]+$/, '')
      .trim();
    act = act.charAt(0).toUpperCase() + act.slice(1);

    results.push({
      date: today,
      time: now,
      type: 'EVENT',
      description: act,
      source: 'CHECK_IN',
      syncStatus: 'PENDING',
    });
  }

  return results;
}

function formatTimeTo24h(timeStr: string): string {
  const clean = timeStr.trim();
  const ampm = clean.match(/(am|pm)/i);
  const parts = clean.replace(/(am|pm)/i, '').trim().split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] ? parts[1].padStart(2, '0') : '00';

  if (ampm) {
    if (ampm[1].toLowerCase() === 'pm' && hours < 12) hours += 12;
    if (ampm[1].toLowerCase() === 'am' && hours === 12) hours = 0;
  } else {
    // If hour between 1 and 7 and no am/pm specified in afternoon context, assume PM
    if (hours >= 1 && hours <= 7) hours += 12;
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function calculatePastTime(currentTimeStr: string, minutesAgo: number): string {
  const [h, m] = currentTimeStr.split(':').map(Number);
  const totalMins = (h * 60 + m) - minutesAgo;
  const clamped = totalMins < 0 ? totalMins + 24 * 60 : totalMins;
  const newH = Math.floor(clamped / 60) % 24;
  const newM = clamped % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}
