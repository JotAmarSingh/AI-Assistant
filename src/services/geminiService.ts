import { GoogleGenAI } from '@google/genai';

// Hardwired Gemini API Key for user's Google Pixel 10a
const HARDWIRED_GEMINI_API_KEY = 'AIzaSyCcHh0HQa5zILpus_BGjzZG1POqaNOZaBs';

export interface AppContextPayload {
  location?: string;
  coords?: { latitude?: number; longitude?: number };
  date?: string;
  time?: string;
  energy?: string;
  activeFocusTask?: string;
  memories?: Array<{ category: string; fact: string }>;
  tasksCount?: number;
  mode?: string;
  pendingTasks?: Array<{ title: string; category?: string; priority?: string }>;
  timetableSlots?: Array<{ time: string; title: string; status?: string }>;
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
  return getStoredGeminiApiKey() || HARDWIRED_GEMINI_API_KEY;
};

export const getGeminiClient = (): GoogleGenAI => {
  const apiKey = getGeminiApiKey();
  return new GoogleGenAI({ apiKey });
};

const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro'
];

/** Token-Optimized Intent-Selective Context Builder with GPS & Follow-up Instructions */
export const buildSmartTokenContext = (prompt: string, appContext?: AppContextPayload): string => {
  const text = prompt.toLowerCase().trim();
  const followUpInstruction = '\n(At the end of your reply, suggest 2-3 short, relevant follow-up questions on one line formatted as: [FOLLOW_UPS: question 1 | question 2 | question 3])';

  if (!appContext) {
    return `${prompt}${followUpInstruction}`;
  }

  // 1. Location / Geofence Intent
  const needsLocation = text.includes('where am i') || text.includes('where i am') || text.includes('location') || text.includes('where are we') || text.includes('what city') || text.includes('where is this');
  
  // 2. Schedule / Task Intent
  const needsSchedule = text.includes('schedule') || text.includes('timetable') || text.includes('what next') || text.includes('what should i do') || text.includes('my tasks') || text.includes('agenda');

  // 3. Memory / Preference Intent
  const needsMemory = text.includes('remember') || text.includes('preference') || text.includes('about me') || text.includes('memory');

  // Case 1: Location question -> send GPS coordinates for live cloud map reverse-geocoding
  if (needsLocation) {
    if (appContext.coords?.latitude && appContext.coords?.longitude) {
      const isTagged = appContext.location && appContext.location !== 'Unknown' && appContext.location !== 'Current Location';
      const tagInfo = isTagged ? `Tagged Geofence Place: "${appContext.location}", ` : 'App Location: Untagged/Unknown, ';
      return `[Device Context: ${tagInfo}GPS Axis = Latitude ${appContext.coords.latitude.toFixed(6)}, Longitude ${appContext.coords.longitude.toFixed(6)}]\nUser Question: ${prompt}\n(Instruction: Identify the physical place, neighborhood, and city for these exact GPS coordinates. Tell the user clearly in warm, plain English where they are!)${followUpInstruction}`;
    }
    return `[Device Context: Current Location = "${appContext.location || 'Unknown'}"]\nUser Question: ${prompt}\n(Instruction: State the user's location clearly in plain English)${followUpInstruction}`;
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

  // Case 4: General Knowledge / Advice / Default queries -> ultra-compact 1-line tag (~6 tokens total!)
  return `[Context: Location = "${appContext.location || 'Home'}"]\nUser Question: ${prompt}${followUpInstruction}`;
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

  // 1. Try official SDK with candidate models
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: 'Respond with OK',
        });
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

  // 2. Direct REST HTTP API Query Fallback across API versions & candidate models
  const apiVersions = ['v1beta', 'v1'];
  for (const version of apiVersions) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const restEndpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const res = await fetch(restEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Respond with OK' }] }]
          })
        });

        if (res.ok) {
          const data = await res.json();
          const answerText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (answerText && answerText.trim()) {
            setGeminiApiKey(key);
            return { success: true, message: `Gemini Connected & Verified via REST (${model})!` };
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          lastErrorMessage = errData?.error?.message || `HTTP ${res.status}`;
        }
      } catch (restErr: any) {
        lastErrorMessage = restErr?.message || String(restErr);
      }
    }
  }

  return {
    success: false,
    message: `Gemini Connection Failed: ${lastErrorMessage || 'Invalid API Key or network issue'}`
  };
};

/** Direct Gemini Pro API Query returning Answer and Intelligent Follow-Up Questions */
export const queryGeminiAPI = async (prompt: string, appContext?: AppContextPayload): Promise<GeminiQueryResponse> => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error('No Gemini API Key configured. Please enter your API key to connect to online AI.');
  }

  const text = prompt.toLowerCase().trim();
  const needsLocation = text.includes('where am i') || text.includes('where i am') || text.includes('location') || text.includes('where are we') || text.includes('what city') || text.includes('where is this');

  // Build minimal, token-efficient smart context tag based strictly on query intent
  const fullPrompt = buildSmartTokenContext(prompt, appContext);

  // 1. Try official SDK with candidate models
  try {
    const ai = new GoogleGenAI({ apiKey });
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const config = needsLocation ? { tools: [{ googleSearch: {} }] } : undefined;
        const response = await ai.models.generateContent({
          model: modelName,
          contents: fullPrompt,
          config: config as any
        });
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

  // 2. Direct REST HTTP API Query Fallback across API versions & candidate models
  const apiVersions = ['v1beta', 'v1'];
  for (const version of apiVersions) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const restEndpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(restEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: fullPrompt }
                ]
              }
            ]
          })
        });

        if (res.ok) {
          const data = await res.json();
          const answerText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (answerText && answerText.trim()) {
            return extractFollowUpsAndCleanText(answerText.trim(), prompt);
          }
        }
      } catch (restErr) {
        console.warn(`Gemini REST fallback (${version}/${model}) error:`, restErr);
      }
    }
  }

  throw new Error('Gemini API query failed across SDK and REST endpoints');
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
