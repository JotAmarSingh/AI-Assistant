import { isDirectActivityCheckInStatement } from './activityIntent';

export type AIAgentRoute =
  | 'LOCAL_ACTION'
  | 'LOCAL_QUERY'
  | 'ONLINE_KNOWLEDGE'
  | 'ONLINE_FOLLOW_UP'
  | 'HYBRID_GROUNDED_REMINDER'
  | 'PENDING_MEMORY';

export interface AIAgentRouteContext {
  hasRecentOnlineTurn?: boolean;
  hasRecentLocalAction?: boolean;
  forcedOnlineFollowUp?: boolean;
}

const LOCAL_ACTION_PREFIX = /^(add|remind|schedule|create|log|note|record|track|jot|capture|register|start|stop|mark|save|set|move|reschedule|plan|buy|call|email|complete|finish|cancel|delete|remove|pause|resume|skip|remember)\b/i;
const POLITE_LOCAL_ACTION = /^(?:(?:please\s+)(?:add|remind|schedule|create|log|note|record|track|jot|capture|register|start|stop|mark|save|set|move|reschedule|plan|complete|finish|cancel|delete|remove|pause|resume|skip|remember)|(?:please\s+)?(?:can|could|would)\s+you\s+(?:please\s+)?(?:add|remind|schedule|create|log|note|record|track|jot|capture|register|start|stop|mark|save|set|move|reschedule|plan|complete|finish|cancel|delete|remove|pause|resume|skip|remember))\b/i;
const PERSONAL_ACTIVITY = /^(?:(?:i\s+(?:am|was|have|had|reached|arrived|left|went|came|started|stopped|finished|completed|bought|ate|drank|worked|did|made|sent|submitted|feel|felt|need|want)|we\s+(?:are|were|have|had|reached|arrived|left|went|came|started|finished|bought|ate|did))|(?:working on|starting|doing|editing|rendering|writing|reviewing|calling|travelling|traveling))\b/i;
const QUESTION_OR_ADVICE = /^(what|why|how|which|who|where|when|should|can|could|would|is|are|do|does|did|tell me|explain|compare|recommend|find|check|look up|search|give me advice)\b/i;
const CONVERSATION_CONTINUATION = /^(no\b|nope\b|yes\b|actually\b|i mean\b|that(?:'s| is) (?:wrong|incorrect)|you(?:'re| are) wrong\b|not that\b|but\b|however\b|instead\b|rather\b|what about\b|how about\b|and\b|also\b|make it\b|move it\b|change it\b|edit it\b)/i;
const LOCAL_STATE_QUERY = /\b(my|today(?:'s)?|pending|completed|active|next)\s+(tasks?|reminders?|schedule|timetable|agenda)|\b(?:what|which|show|list|check)\b[^?]{0,40}\b(tasks?|reminders?|schedule|timetable|agenda)\b|\bwhat(?:'s| is) next\b|\bwhat should i (?:do|work on|focus on)\b|\bhow much time did i\b|\bwhat have i (?:done|completed)\b/i;
const REMINDER_ACTION = /\b(remind me|(?:set|make|create) (?:me )?(?:a )?reminder|notify me|alert me)\b/i;
const RELATIVE_EXTERNAL_TIME = /\b(before|after|when|once|if)\b/i;
const MAKE_LOCAL_ACTION = /^(?:(?:please\s+)?make|(?:please\s+)?(?:can|could|would)\s+you\s+(?:please\s+)?make)\s+(?:me\s+)?(?:a\s+)?(?:task|reminder|timeline\s+(?:entry|log)|note)\b/i;
const LOCATION_TRIGGER = /\b(?:when(?:ever)?|once|after|on|upon)?\s*(?:i\s+)?(?:leave|leaving|depart|departing|exit|exiting|arrive|arriving|reach|reaching|enter|entering)\b[^.!?]{0,60}\b(?:location|place|spot|here|home|office|desk|gym)\b/i;

/** Facts that can change must be verified with live grounding rather than model memory. */
export const requiresLiveGrounding = (input: string): boolean => {
  const text = input.toLowerCase();
  return /\b(festival|festivals|holiday|holidays|weather|forecast|news|headlines?|price|prices|fare|fares|rate|rates|opening hours?|closing time|open now|closed now|traffic|flight status|train status|sports score|election results?|stock price|exchange rate)\b/i.test(text)
    || /\b(upcoming|latest|live|currently)\b/i.test(text)
    || /\b(what should i wear|what to wear|outfit|dress suggestion|clothes for today)\b/i.test(text)
    || /\b(nearest|nearby|near me|closest)\b[^?]{0,60}\b(pharmacy|chemist|hospital|clinic|store|shop|restaurant|cafe|place)\b/i.test(text)
    || /\b(?:find|check|verify|look up|search|when is|what date)\b[^?]{0,80}\b(?:date|day)\b/i.test(text)
    || /\b(dose|dosage|side effects?|contraindications?|drug interactions?|symptoms?|diagnosis|safe for|medicine for|medication for|which medicine|which medication|can my (?:child|son|daughter|baby) (?:take|use)|cough syrup for)\b/i.test(text)
    || /\b(?:medicine|medication|drug)\b[^.?]{0,60}\b(?:safe|safety|instructions?|dose|dosage|use|take|current)\b/i.test(text);
};

export const isHybridGroundedReminder = (input: string): boolean => {
  // A geofence reminder is a device command, even when its reminder text
  // contains a medical noun such as “medicine”. It must never be sent to a
  // general knowledge/medical answer path.
  if (LOCATION_TRIGGER.test(input)) return false;
  return REMINDER_ACTION.test(input)
    && requiresLiveGrounding(input)
    && (RELATIVE_EXTERNAL_TIME.test(input) || /\b(date|find|check|verify|search|look up)\b/i.test(input));
};

export const isConversationalFollowUp = (input: string, hasRecentOnlineTurn: boolean): boolean =>
  hasRecentOnlineTurn && (CONVERSATION_CONTINUATION.test(input.trim()) || input.trim().length < 32);

/**
 * Selects the token-efficient cloud planner only when one utterance spans
 * multiple action domains or is structurally complex. Simple, well-understood
 * commands continue through the deterministic offline path.
 */
export const shouldUseCloudActionPlanner = (input: string): boolean => {
  const text = input.trim();
  if (!text || text.endsWith('?')) return false;

  const actionDomains = [
    /\b(?:tag|name|mark|save|call)\b[^.!?]{0,50}\b(?:current\s+)?(?:location|place|spot|here)\b|\b(?:location|place|spot)\b[^.!?]{0,50}\b(?:as|to)\b/i,
    /\b(?:i(?:'m| am| was)|we(?:'re| are| were))\b[^.!?]{0,30}\b(?:working|doing|editing|writing|reviewing|building|developing|meeting|travelling|traveling|exercising|studying|researching)\b|\b(?:currently\s+)?working\s+on\b/i,
    /\b(?:add|create|assign|schedule|plan)\b[^.!?]{0,35}\b(?:task|todo|work)\b|\b(?:i need to|i have to)\b/i,
    /\b(?:remind me|set (?:a )?reminder|notify me|alert me)\b/i,
    /\b(?:remember|save)\b[^.!?]{0,30}\b(?:preference|rule|fact|that)\b/i,
    /\b(?:complete|completed|finish|finished|done with|mark done)\b/i,
  ].filter((pattern) => pattern.test(text)).length;

  if (actionDomains >= 2) return true;
  const clauses = text
    .split(/(?:[.!?;]+|\b(?:and then|then|also|plus)\b)/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const hasExplicitCommand = LOCAL_ACTION_PREFIX.test(text)
    || MAKE_LOCAL_ACTION.test(text)
    || /\b(?:please|can you|could you|would you)\b/i.test(text);
  const hasPersonalStatus = isDirectActivityCheckInStatement(text)
    || /\b(?:i(?:'m| am| was)|we(?:'re| are| were))\b/i.test(text);
  if (clauses.length >= 2 && (hasExplicitCommand || hasPersonalStatus)) return true;
  return POLITE_LOCAL_ACTION.test(text)
    || /^(?:please\s+)?(?:note|record|track|jot|capture|register)\b/i.test(text);
};

export const classifyAIAgentRoute = (
  input: string,
  context: AIAgentRouteContext = {},
): AIAgentRoute => {
  const text = input.trim();
  const lower = text.toLowerCase();
  if (!text) return 'LOCAL_ACTION';

  if (context.forcedOnlineFollowUp) return 'ONLINE_FOLLOW_UP';
  if (isHybridGroundedReminder(text)) return 'HYBRID_GROUNDED_REMINDER';

  if (context.hasRecentLocalAction && CONVERSATION_CONTINUATION.test(text)) {
    return 'LOCAL_ACTION';
  }

  // Personal status/activity statements keep their explicit local meaning even
  // when an unrelated cloud conversation happened recently.
  if (
    LOCAL_ACTION_PREFIX.test(lower)
    || POLITE_LOCAL_ACTION.test(lower)
    || MAKE_LOCAL_ACTION.test(lower)
    || PERSONAL_ACTIVITY.test(lower)
    || isDirectActivityCheckInStatement(text)
  ) return 'LOCAL_ACTION';

  // Corrections take precedence over the default statement logger. This is the
  // exact boundary that prevents “No, it is Rakhi” becoming a timeline entry.
  if (isConversationalFollowUp(text, Boolean(context.hasRecentOnlineTurn))) {
    return 'ONLINE_FOLLOW_UP';
  }

  if (LOCAL_STATE_QUERY.test(lower)) return 'LOCAL_QUERY';
  if (text.endsWith('?') || QUESTION_OR_ADVICE.test(lower) || requiresLiveGrounding(lower)) {
    return 'ONLINE_KNOWLEDGE';
  }

  // A non-personal statement with no instruction may be half-delivered. Save it
  // to the local pending-memory inbox and ask the user what it should become.
  return 'PENDING_MEMORY';
};
