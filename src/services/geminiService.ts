import { GoogleGenAI } from '@google/genai';
import { requiresLiveGrounding } from '../utils/aiRouting';

export const PRIMARY_GEMINI_MODEL = 'gemini-3.7-flash';
export const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash';
const REQUEST_TIMEOUT_MS = 25_000;

export interface AppContextPayload {
  location?: string;
  coords?: { latitude?: number; longitude?: number };
  savedPlace?: string;
  locationPermission?: 'GRANTED' | 'DENIED' | 'UNAVAILABLE' | 'UNKNOWN';
  date?: string;
  time?: string;
  energy?: string;
  activeFocusTask?: string;
  memories?: Array<{ category: string; fact: string }>;
  tasksCount?: number;
  mode?: string;
  pendingTasks?: Array<{ title: string; category?: string; priority?: string }>;
  timetableSlots?: Array<{ time: string; title: string; status?: string }>;
  permissions?: Partial<Record<'notifications' | 'microphone' | 'location' | 'backgroundLocation' | 'exactAlarms', string>>;
  features?: string[];
}

export interface GeminiQueryResponse {
  answer: string;
  followUps: string[];
}

export interface CloudConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface GeminiQueryOptions {
  conversationTurns?: CloudConversationTurn[];
  forceLiveSearch?: boolean;
  assistantMode?: 'NORMAL_CHAT' | 'RESEARCH' | 'CREATIVE';
  now?: Date;
}

export interface GroundedReminderPlan {
  answer: string;
  eventName: string;
  eventDate: string;
  reminderTitle: string;
  reminderDate: string;
  scheduledAt?: string;
}

export const getStoredGeminiApiKey = (): string | null => {
  if (typeof localStorage !== 'undefined') {
    const savedKey = localStorage.getItem('daytrace_gemini_api_key');
    if (savedKey && savedKey.trim()) return savedKey.trim();
  }
  return null;
};

export const setGeminiApiKey = (key: string): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('daytrace_gemini_api_key', key.trim());
  }
};

export const clearGeminiApiKey = (): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('daytrace_gemini_api_key');
  }
};

export const getGeminiApiKey = (): string => {
  return getStoredGeminiApiKey() || '';
};

export const getGeminiClient = (): GoogleGenAI => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('No Gemini API key is configured.');
  return new GoogleGenAI({ apiKey });
};

const CANDIDATE_MODELS = [PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL];

const withTimeout = async <T>(promise: Promise<T>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> => {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error('Gemini request timed out. Check your connection and retry.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
};

const compactTurnText = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, 700);

export const buildDeviceTimeContext = (now = new Date()): string => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'device-local';
  const deviceDateTime = now.toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `[Trusted device date/time: ${deviceDateTime}; time zone=${timeZone}. Treat the year and date as authoritative.]`;
};

const buildConversationContext = (turns?: CloudConversationTurn[]): string => {
  const recent = (turns || []).slice(-4);
  if (recent.length === 0) return '';
  return `[Relevant recent conversation only]\n${recent
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${compactTurnText(turn.text)}`)
    .join('\n')}\n`;
};

/** Token-optimized context builder. It never attaches unrelated app state. */
export const buildSmartTokenContext = (
  prompt: string,
  appContext?: AppContextPayload,
  options: GeminiQueryOptions = {},
): string => {
  const text = prompt.toLowerCase().trim();
  const followUpInstruction = '\n(At the end of your reply, suggest 2-3 short, relevant follow-up questions on one line formatted as: [FOLLOW_UPS: question 1 | question 2 | question 3])';
  const temporalContext = buildDeviceTimeContext(options.now);
  const conversationContext = buildConversationContext(options.conversationTurns);
  const modeInstruction = options.assistantMode === 'RESEARCH'
    ? '\nMode instruction: Research only. Analyze evidence carefully, distinguish verified facts from inference, and do not create or modify DayTrace data.'
    : options.assistantMode === 'CREATIVE'
      ? '\nMode instruction: Creative only. Help brainstorm, draft, and explore ideas; do not create or modify DayTrace data.'
      : options.assistantMode === 'NORMAL_CHAT'
        ? '\nMode instruction: Normal chat only. Answer conversationally without accountability coaching and do not create or modify DayTrace data.'
        : '';
  const liveInstruction = options.forceLiveSearch || requiresLiveGrounding(prompt)
    ? '\nInstruction: This is time-sensitive. Verify the answer with live Google Search, use the current year above, state the relevant exact date/time when available, correct false premises, and never answer from stale model memory.'
    : '';
  const medicalInstruction = /\b(medicine|medication|drug|dose|dosage|cough syrup|side effects?|safe for|symptoms?)\b/i.test(text)
    ? '\nMedical safety instruction: Ask for any missing medicine/ingredient, age, weight, dose, symptoms, allergies, and conditions needed for a useful answer. Use current authoritative medical sources, distinguish verified facts from uncertainty, and clearly advise professional medical confirmation.'
    : '';

  if (!appContext) {
    return `${temporalContext}\n${conversationContext}User Question: ${prompt}${liveInstruction}${medicalInstruction}${modeInstruction}${followUpInstruction}`;
  }

  const needsCapabilities = text.includes('permission') || text.includes('what can you do') || text.includes('feature') || text.includes('access do you have') || text.includes('can you access');
  const needsOutfit = /\b(what should i wear|what to wear|outfit|dress suggestion|clothes for today)\b/i.test(text);
  const needsNearbySearch = /\b(nearest|nearby|near me|closest)\b/i.test(text);

  // 1. Location / Geofence Intent
  const needsLocation = !needsCapabilities && (text.includes('where am i') || text.includes('where i am') || text.includes('my current location') || text.includes('where are we') || text.includes('what city') || text.includes('where is this') || needsNearbySearch);
  
  // 2. Schedule / Task Intent
  const needsSchedule = text.includes('schedule') || text.includes('timetable') || text.includes('what next') || text.includes('what should i do') || text.includes('my tasks') || text.includes('agenda');

  // 3. Memory / Preference Intent
  const needsMemory = text.includes('remember') || text.includes('preference') || text.includes('about me') || text.includes('memory');

  if (needsOutfit) {
    const coords = typeof appContext.coords?.latitude === 'number' && typeof appContext.coords?.longitude === 'number'
      ? `latitude=${appContext.coords.latitude.toFixed(4)}, longitude=${appContext.coords.longitude.toFixed(4)}`
      : `location label=${appContext.location || 'Unknown'}`;
    const schedule = (appContext.timetableSlots || []).slice(0, 6).map((slot) => `${slot.time} ${slot.title}`).join('; ') || 'No occasion identified';
    const preferences = (appContext.memories || []).slice(0, 8).map((memory) => memory.fact).join('; ') || 'No saved clothing preferences';
    return `${temporalContext}\n${conversationContext}[Relevant local context only: ${coords}; today schedule=${schedule}; saved clothing/preferences=${preferences}]\nUser Question: ${prompt}\nInstruction: Use live Google Search for current weather at the supplied location. Infer whether the schedule indicates an official meeting, party, casual meetup, or family time. If the occasion is still unknown, ask for it instead of guessing. Otherwise give 2-3 distinct outfit options.${followUpInstruction}`;
  }

  if (needsNearbySearch) {
    const latitude = appContext.coords?.latitude;
    const longitude = appContext.coords?.longitude;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      return `${temporalContext}\n${conversationContext}[Trusted device location: GPS latitude=${latitude.toFixed(6)}, longitude=${longitude.toFixed(6)}; permission=${appContext.locationPermission || 'GRANTED'}]\nUser Question: ${prompt}\nInstruction: Use live Google Search to find currently relevant nearby choices and verify opening status when requested. Give a short ranked list with enough location detail to distinguish the choices. Never invent distance, opening status, or availability.${followUpInstruction}`;
    }
    return `${temporalContext}\n${conversationContext}[Live GPS unavailable; permission=${appContext.locationPermission || 'UNKNOWN'}]\nUser Question: ${prompt}\nInstruction: Explain that live location is required before ranking nearby choices. Do not guess the user's location.${followUpInstruction}`;
  }

  // Case 1: Location question -> send GPS coordinates for live cloud map reverse-geocoding
  if (needsLocation) {
    if (appContext.savedPlace) {
      return `${temporalContext}\n${conversationContext}[Trusted device location: saved place match="${appContext.savedPlace}"; location permission=${appContext.locationPermission || 'GRANTED'}]\nUser Question: ${prompt}\nInstruction: Answer with the saved place name. Do not reverse-geocode or invent a street address because the user has already named this place.${followUpInstruction}`;
    }
    const latitude = appContext.coords?.latitude;
    const longitude = appContext.coords?.longitude;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      return `${temporalContext}\n${conversationContext}[Trusted device location: untagged GPS latitude=${latitude.toFixed(6)}, longitude=${longitude.toFixed(6)}; permission=${appContext.locationPermission || 'GRANTED'}]\nUser Question: ${prompt}\nInstruction: Use Google Search grounding to identify the closest verifiable road, neighborhood, and city. Be explicit about uncertainty and never invent a house number or exact address.${followUpInstruction}`;
    }
    return `${temporalContext}\n${conversationContext}[Device location unavailable; permission=${appContext.locationPermission || 'UNKNOWN'}; last saved app label="${appContext.location || 'Unknown'}"]\nUser Question: ${prompt}\nInstruction: Explain that live location could not be read and do not claim a precise address.${followUpInstruction}`;
  }

  // Case 2: Schedule / Task question -> send ONLY active task & top 3 pending tasks (~20 tokens)
  if (needsSchedule) {
    const focusStr = appContext.activeFocusTask ? `Active Task = "${appContext.activeFocusTask}"; ` : '';
    const topTasks = appContext.pendingTasks?.slice(0, 3).map(t => t.title).join(', ');
    return `${temporalContext}\n${conversationContext}[Device Context: Location = "${appContext.location || 'Home'}"; ${focusStr}Pending Tasks = "${topTasks || 'None'}"]\nUser Question: ${prompt}${followUpInstruction}`;
  }

  // Case 3: Personal Memory question -> send ONLY 2-3 relevant memory facts (~20 tokens)
  if (needsMemory && appContext.memories?.length) {
    const memStr = appContext.memories.slice(0, 3).map(m => m.fact).join('; ');
    return `${temporalContext}\n${conversationContext}[Device Context: Stored Facts = "${memStr}"]\nUser Question: ${prompt}${followUpInstruction}`;
  }

  if (needsCapabilities) {
    const featureText = (appContext.features || []).join(', ') || 'local tasks, reminders, JSON backup and restore';
    const permissionText = Object.entries(appContext.permissions || {})
      .map(([name, status]) => `${name}=${status}`)
      .join(', ') || 'not checked for this question';
    return `${temporalContext}\n${conversationContext}[DayTrace capabilities: ${featureText}. Current permission status: ${permissionText}.]\nUser Question: ${prompt}\nInstruction: Describe only capabilities actually listed here; never claim unsupported access.${followUpInstruction}`;
  }

  // General questions receive no personal, location, task, or permission data.
  return `${temporalContext}\n${conversationContext}User Question: ${prompt}${liveInstruction}${medicalInstruction}${modeInstruction}${followUpInstruction}`;
};

/** Extracts [FOLLOW_UPS: ...] tag and provides intelligent contextual fallback questions */
export const extractFollowUpsAndCleanText = (rawText: string, prompt: string): GeminiQueryResponse => {
  let cleanAnswer = rawText.trim();
  let followUps: string[] = [];

  const followUpRegex = /\[FOLLOW_UPS:\s*([^\]]+)\]/i;
  const match = cleanAnswer.match(followUpRegex);

  if (match && match[1]) {
    followUps = match[1]
      .split('|')
      .map(q => q.trim().replace(/^["']|["']$/g, '').replace(/^\d+[\.\)]\s*/, ''))
      .filter(q => q.length > 3);
    cleanAnswer = cleanAnswer.replace(match[0], '').trim();
  }

  // If no follow-ups were generated or parsed, generate intelligent contextual defaults (ChatGPT-style)
  if (followUps.length === 0) {
    const text = prompt.toLowerCase();
    if (text.includes('banana') || text.includes('orange') || text.includes('fruit') || text.includes('nutrition') || text.includes('child')) {
      followUps = [
        'What about apples vs bananas for toddlers?',
        'Best fruits for toddler immunity & digestion',
        'Add fruit snack to today\'s timetable'
      ];
    } else if (text.includes('where am i') || text.includes('location') || text.includes('where are we')) {
      followUps = [
        'Save this spot as a custom Geofence',
        'What tasks can I do near this location?',
        'Check travel time & route to Home'
      ];
    } else if (text.includes('festival') || text.includes('holiday')) {
      followUps = [
        'Add upcoming festivals to my timetable',
        'Check gift & celebration preparation checklist',
        'Traditional festive recipes & meals'
      ];
    } else if (text.includes('task') || text.includes('routine') || text.includes('schedule') || text.includes('what next')) {
      followUps = [
        'Break this task into 15-minute subtasks',
        'Start a Pomodoro focus timer for this',
        'What is my next top priority today?'
      ];
    } else {
      followUps = [
        'Can you explain this in simpler terms?',
        'Give me practical real-world examples',
        'How can I apply this to my daily productivity?'
      ];
    }
  }

  return {
    answer: cleanAnswer,
    followUps: followUps.slice(0, 3)
  };
};

/** Verify if a Gemini API Key is valid and functional across all current Gemini models */
export const verifyGeminiApiKey = async (rawKey: string): Promise<{ success: boolean; message: string }> => {
  const key = rawKey?.trim();
  if (!key) {
    return { success: false, message: 'Please enter a Gemini API Key.' };
  }

  let lastErrorMessage = '';

  // Verify against only the current primary and one stable fallback model. This
  // avoids burning quota by probing a long list of obsolete model names.
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await withTimeout(ai.models.generateContent({
          model: modelName,
          contents: 'Respond with OK',
        }));
        if (response && response.text && response.text.trim()) {
          setGeminiApiKey(key);
          return { success: true, message: `Gemini Connected & Verified (${modelName})!` };
        }
      } catch (mErr: any) {
        lastErrorMessage = mErr?.message || String(mErr);
      }
    }
  } catch (sdkErr: any) {
    lastErrorMessage = sdkErr?.message || String(sdkErr);
  }

  return {
    success: false,
    message: `Gemini Connection Failed: ${lastErrorMessage || 'Invalid API Key or network issue'}`
  };
};

/** Direct Gemini API query returning an answer and relevant follow-up questions. */
export const queryGeminiAPI = async (
  prompt: string,
  appContext?: AppContextPayload,
  options: GeminiQueryOptions = {},
): Promise<GeminiQueryResponse> => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error('No Gemini API Key configured. Please enter your API key to connect to online AI.');
  }

  const text = prompt.toLowerCase().trim();
  const needsCapabilities = text.includes('permission') || text.includes('what can you do') || text.includes('feature') || text.includes('access do you have') || text.includes('can you access');
  const needsLocation = !needsCapabilities && (text.includes('where am i') || text.includes('where i am') || text.includes('my current location') || text.includes('where are we') || text.includes('what city') || text.includes('where is this'));
  const needsFreshGrounding = options.forceLiveSearch || requiresLiveGrounding(prompt);

  // Build minimal, token-efficient smart context tag based strictly on query intent
  const fullPrompt = buildSmartTokenContext(prompt, appContext, {
    ...options,
    forceLiveSearch: needsFreshGrounding,
  });

  // Use the current Interactions API for grounded location lookup. Other
  // questions use generateContent, which avoids invoking a billable search tool.
  try {
    const ai = new GoogleGenAI({ apiKey });
    const needsGroundedInteraction = needsFreshGrounding
      || (needsLocation && !appContext?.savedPlace && typeof appContext?.coords?.latitude === 'number' && typeof appContext?.coords?.longitude === 'number');

    if (needsGroundedInteraction) {
      for (const modelName of CANDIDATE_MODELS) {
        try {
          const interaction = await withTimeout(ai.interactions.create({
            model: modelName,
            input: fullPrompt,
            tools: [{ type: 'google_search' }],
          }));
          if (interaction.output_text?.trim()) {
            return extractFollowUpsAndCleanText(interaction.output_text.trim(), prompt);
          }
        } catch (groundingError) {
          console.warn(`Gemini grounded model ${modelName} error, trying next:`, groundingError);
        }
      }
      throw new Error('Live verification could not be completed. DayTrace will not substitute an unverified answer.');
    }

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await withTimeout(ai.models.generateContent({
          model: modelName,
          contents: fullPrompt,
        }));
        if (response && response.text && response.text.trim()) {
          return extractFollowUpsAndCleanText(response.text.trim(), prompt);
        }
      } catch (mErr) {
        console.warn(`Gemini SDK model ${modelName} error, trying next:`, mErr);
      }
    }
  } catch (sdkErr) {
    console.warn('Gemini SDK initialization error:', sdkErr);
  }

  throw new Error('Gemini could not answer. Check the API key and internet connection, then retry.');
};

const extractJsonPayload = (raw: string): Record<string, unknown> | null => {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * Resolves a changing real-world date before a local reminder is created.
 * The result contains a date only when the user omitted the time; the UI then
 * asks for the missing time rather than silently inventing 09:00.
 */
export const queryGroundedReminderPlan = async (
  request: string,
  options: GeminiQueryOptions = {},
): Promise<GroundedReminderPlan> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Online verification requires the saved Gemini API key.');

  const currentContext = buildDeviceTimeContext(options.now);
  const conversationContext = buildConversationContext(options.conversationTurns);
  const hasExplicitTime = /\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:am|pm)?\b/i.test(request)
    && /\b(?:at|by)\s+(?:[01]?\d|2[0-3])/i.test(request);
  const prompt = `${currentContext}\n${conversationContext}User request: ${request}\nUse live Google Search to verify the next relevant real-world event/date. Resolve relative wording such as “two days before”. Return JSON only with keys answer, eventName, eventDate (YYYY-MM-DD), reminderTitle, reminderDate (YYYY-MM-DD), and scheduledAt. ${hasExplicitTime ? 'scheduledAt must be a future ISO-8601 timestamp using the device time zone.' : 'The user did not give a clock time, so scheduledAt must be null. Do not invent a time.'} Never return an event from an earlier year when the user asks for the upcoming occurrence.`;

  const ai = new GoogleGenAI({ apiKey });
  let lastError = '';
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const interaction = await withTimeout(ai.interactions.create({
        model: modelName,
        input: prompt,
        tools: [{ type: 'google_search' }],
      }));
      const payload = extractJsonPayload(interaction.output_text || '');
      const eventDate = typeof payload?.eventDate === 'string' ? payload.eventDate : '';
      const reminderDate = typeof payload?.reminderDate === 'string' ? payload.reminderDate : '';
      const answer = typeof payload?.answer === 'string' ? payload.answer.trim() : '';
      const eventName = typeof payload?.eventName === 'string' ? payload.eventName.trim() : '';
      const reminderTitle = typeof payload?.reminderTitle === 'string' ? payload.reminderTitle.trim() : '';
      const scheduledAt = typeof payload?.scheduledAt === 'string' ? payload.scheduledAt : undefined;
      if (
        answer
        && eventName
        && reminderTitle
        && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)
        && /^\d{4}-\d{2}-\d{2}$/.test(reminderDate)
        && (!scheduledAt || Number.isFinite(Date.parse(scheduledAt)))
      ) {
        return { answer, eventName, eventDate, reminderTitle, reminderDate, scheduledAt };
      }
      lastError = 'The grounded response did not contain a safe reminder date.';
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || 'Could not verify the event date. No reminder was created.');
};

/** Dynamic Contextual Icon & Clipart Resolver */
export const resolveContextualIcon = (title: string, description?: string): string => {
  const text = `${title} ${description || ''}`.toLowerCase();

  // 1. Specific Food & Meals
  if (text.includes('chapati') || text.includes('curd') || text.includes('dal')) {
    return '🫓🥣🍲';
  }
  if (text.includes('breakfast') || text.includes('lunch') || text.includes('dinner') || text.includes('meal')) {
    return '🫓🥗🍲';
  }

  // 2. Coffee Break
  if (text.includes('coffee') || text.includes('tea') || text.includes('espresso')) {
    return '☕♨️';
  }

  // 3. Video & Reel Editing
  if (text.includes('editing') || text.includes('reel') || text.includes('video') || text.includes('youtube') || text.includes('render')) {
    return '👳‍♂️💻🎬';
  }

  // 4. Growth Strategy Meeting
  if (text.includes('growth') || text.includes('strategy') || text.includes('revenue') || text.includes('scale')) {
    return '👳‍♂️📈🤝';
  }

  return '👳‍♂️⭐';
};

/** Dynamic Category Island Icon Resolver */
export const resolveCategoryIslandIcon = (label: string): string => {
  const name = label.toLowerCase().trim();

  if (name.includes('family') || name.includes('parent') || name.includes('kid') || name.includes('child')) {
    return '👪';
  }
  if (name.includes('work') || name.includes('office') || name.includes('job') || name.includes('business') || name.includes('career')) {
    return '🏢';
  }
  if (name.includes('health') || name.includes('fitness') || name.includes('gym') || name.includes('wellness')) {
    return '🌳';
  }
  if (name.includes('learn') || name.includes('study') || name.includes('skill') || name.includes('book') || name.includes('course')) {
    return '📖';
  }
  if (name.includes('personal') || name.includes('home') || name.includes('house')) {
    return '🏠';
  }
  if (name.includes('travel') || name.includes('trip') || name.includes('vacation') || name.includes('tour')) {
    return '✈️';
  }
  if (name.includes('finance') || name.includes('money') || name.includes('tax') || name.includes('bank') || name.includes('budget')) {
    return '💰';
  }
  if (name.includes('vehicle') || name.includes('car') || name.includes('bike') || name.includes('auto')) {
    return '🚗';
  }

  return '🏝️';
};
