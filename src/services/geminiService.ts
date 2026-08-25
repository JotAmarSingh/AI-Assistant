import { GoogleGenAI } from '@google/genai';

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

/** Token-Optimized Intent-Selective Context Builder with GPS & Follow-up Instructions */
export const buildSmartTokenContext = (prompt: string, appContext?: AppContextPayload): string => {
  const text = prompt.toLowerCase().trim();
  const followUpInstruction = '\n(At the end of your reply, suggest 2-3 short, relevant follow-up questions on one line formatted as: [FOLLOW_UPS: question 1 | question 2 | question 3])';

  if (!appContext) {
    return `${prompt}${followUpInstruction}`;
  }

  const needsCapabilities = text.includes('permission') || text.includes('what can you do') || text.includes('feature') || text.includes('access do you have') || text.includes('can you access');

  // 1. Location / Geofence Intent
  const needsLocation = !needsCapabilities && (text.includes('where am i') || text.includes('where i am') || text.includes('my current location') || text.includes('where are we') || text.includes('what city') || text.includes('where is this'));
  
  // 2. Schedule / Task Intent
  const needsSchedule = text.includes('schedule') || text.includes('timetable') || text.includes('what next') || text.includes('what should i do') || text.includes('my tasks') || text.includes('agenda');

  // 3. Memory / Preference Intent
  const needsMemory = text.includes('remember') || text.includes('preference') || text.includes('about me') || text.includes('memory');

  // Case 1: Location question -> send GPS coordinates for live cloud map reverse-geocoding
  if (needsLocation) {
    if (appContext.savedPlace) {
      return `[Trusted device location: saved place match="${appContext.savedPlace}"; location permission=${appContext.locationPermission || 'GRANTED'}]\nUser Question: ${prompt}\nInstruction: Answer with the saved place name. Do not reverse-geocode or invent a street address because the user has already named this place.${followUpInstruction}`;
    }
    const latitude = appContext.coords?.latitude;
    const longitude = appContext.coords?.longitude;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      return `[Trusted device location: untagged GPS latitude=${latitude.toFixed(6)}, longitude=${longitude.toFixed(6)}; permission=${appContext.locationPermission || 'GRANTED'}]\nUser Question: ${prompt}\nInstruction: Use Google Search grounding to identify the closest verifiable road, neighborhood, and city. Be explicit about uncertainty and never invent a house number or exact address.${followUpInstruction}`;
    }
    return `[Device location unavailable; permission=${appContext.locationPermission || 'UNKNOWN'}; last saved app label="${appContext.location || 'Unknown'}"]\nUser Question: ${prompt}\nInstruction: Explain that live location could not be read and do not claim a precise address.${followUpInstruction}`;
  }

  // Case 2: Schedule / Task question -> send ONLY active task & top 3 pending tasks (~20 tokens)
  if (needsSchedule) {
    const focusStr = appContext.activeFocusTask ? `Active Task = "${appContext.activeFocusTask}"; ` : '';
    const topTasks = appContext.pendingTasks?.slice(0, 3).map(t => t.title).join(', ');
    return `[Device Context: Location = "${appContext.location || 'Home'}"; ${focusStr}Pending Tasks = "${topTasks || 'None'}"]\nUser Question: ${prompt}${followUpInstruction}`;
  }

  // Case 3: Personal Memory question -> send ONLY 2-3 relevant memory facts (~20 tokens)
  if (needsMemory && appContext.memories?.length) {
    const memStr = appContext.memories.slice(0, 3).map(m => m.fact).join('; ');
    return `[Device Context: Stored Facts = "${memStr}"]\nUser Question: ${prompt}${followUpInstruction}`;
  }

  if (needsCapabilities) {
    const featureText = (appContext.features || []).join(', ') || 'local tasks, reminders, JSON backup and restore';
    const permissionText = Object.entries(appContext.permissions || {})
      .map(([name, status]) => `${name}=${status}`)
      .join(', ') || 'not checked for this question';
    return `[DayTrace capabilities: ${featureText}. Current permission status: ${permissionText}.]\nUser Question: ${prompt}\nInstruction: Describe only capabilities actually listed here; never claim unsupported access.${followUpInstruction}`;
  }

  // General questions receive no personal, location, task, or permission data.
  return `User Question: ${prompt}${followUpInstruction}`;
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
export const queryGeminiAPI = async (prompt: string, appContext?: AppContextPayload): Promise<GeminiQueryResponse> => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error('No Gemini API Key configured. Please enter your API key to connect to online AI.');
  }

  const text = prompt.toLowerCase().trim();
  const needsCapabilities = text.includes('permission') || text.includes('what can you do') || text.includes('feature') || text.includes('access do you have') || text.includes('can you access');
  const needsLocation = !needsCapabilities && (text.includes('where am i') || text.includes('where i am') || text.includes('my current location') || text.includes('where are we') || text.includes('what city') || text.includes('where is this'));

  // Build minimal, token-efficient smart context tag based strictly on query intent
  const fullPrompt = buildSmartTokenContext(prompt, appContext);

  // Use the current Interactions API for grounded location lookup. Other
  // questions use generateContent, which avoids invoking a billable search tool.
  try {
    const ai = new GoogleGenAI({ apiKey });
    if (needsLocation && !appContext?.savedPlace && typeof appContext?.coords?.latitude === 'number' && typeof appContext?.coords?.longitude === 'number') {
      const interaction = await withTimeout(ai.interactions.create({
        model: PRIMARY_GEMINI_MODEL,
        input: fullPrompt,
        tools: [{ type: 'google_search' }],
      }));
      if (interaction.output_text?.trim()) {
        return extractFollowUpsAndCleanText(interaction.output_text.trim(), prompt);
      }
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
