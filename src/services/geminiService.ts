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

/** Direct Gemini Pro API Query with Full App State Context Injection */
export const queryGeminiAPI = async (prompt: string, appContext?: AppContextPayload): Promise<string> => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error('No Gemini API Key configured. Please enter your API key to connect to online AI.');
  }

  // Construct Context Prompt to hand-shake app sensors & state with Gemini online AI
  let fullPrompt = prompt;
  if (appContext) {
    const locStr = appContext.location || 'Unknown';
    const memoriesStr = appContext.memories && appContext.memories.length > 0
      ? appContext.memories.map(m => `- [${m.category}] ${m.fact}`).join('\n')
      : 'None recorded yet';

    const tasksStr = appContext.pendingTasks && appContext.pendingTasks.length > 0
      ? appContext.pendingTasks.map(t => `- [${t.priority || 'NORMAL'}] ${t.title} (${t.category || 'GENERAL'})`).join('\n')
      : 'No active tasks';

    const timetableStr = appContext.timetableSlots && appContext.timetableSlots.length > 0
      ? appContext.timetableSlots.map(s => `- ${s.time}: ${s.title} (${s.status || 'SCHEDULED'})`).join('\n')
      : 'No fixed timetable items for today';

    fullPrompt = `
=== LIVE DAYTRACE APP & DEVICE SENSOR CONTEXT ===
• Current Location / Geofence: ${locStr}
• Current Local Time: ${appContext.time || new Date().toLocaleTimeString()}
• Date: ${appContext.date || new Date().toISOString().split('T')[0]}
• User Energy Level: ${appContext.energy || 'NORMAL'}
• Active App Mode: ${appContext.mode || 'ACCOUNTABILITY'}
• Active Focus Task: ${appContext.activeFocusTask || 'None'}

• Stored User Memories & Facts:
${memoriesStr}

• Current High-Priority Tasks:
${tasksStr}

• Today's Timetable Schedule:
${timetableStr}
==================================================

INSTRUCTIONS FOR GEMINI AI:
You are DayTrace AI — an intelligent, empathetic cybernetic AI partner embedded directly inside the user's Android phone.
You HAVE direct access to the app's real-time location sensor, geofence, timetable, memory vault, and task engine listed above.
The user asked: "${prompt}"

1. If the user asks "where am I?", "what is my location?", or "where am I right now?", answer directly stating their location (${locStr})! NEVER say "I don't have location access" or "I'm a text AI with no eyes/ears".
2. If asked about their tasks, schedule, energy, or memories, reference the actual live context.
3. Keep your response direct, clear, highly intelligent, and formatted with clean bullet points or bold text.
`;
  }

  // 1. Try official SDK with candidate models
  try {
    const ai = new GoogleGenAI({ apiKey });
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: fullPrompt,
        });
        if (response && response.text && response.text.trim()) {
          return response.text.trim();
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
            return answerText.trim();
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
