import { GoogleGenAI } from '@google/genai';

export const getStoredGeminiApiKey = (): string => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('daytrace_gemini_api_key') || '';
  }
  return '';
};

export const hasValidGeminiApiKey = (): boolean => {
  return Boolean(getStoredGeminiApiKey().trim());
};

export const setGeminiApiKey = (key: string): void => {
  if (typeof localStorage !== 'undefined') {
    if (key && key.trim()) {
      localStorage.setItem('daytrace_gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('daytrace_gemini_api_key');
    }
  }
};

export const clearGeminiApiKey = (): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('daytrace_gemini_api_key');
  }
};

export const getGeminiApiKey = (): string => {
  return getStoredGeminiApiKey();
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
        lastErrorMessage = mErr?.message || '';
        console.warn(`SDK verify failed on ${modelName}, trying next:`, mErr);
      }
    }
  } catch (sdkErr: any) {
    lastErrorMessage = sdkErr?.message || '';
    console.warn('SDK init error:', sdkErr);
  }

  // 2. Direct REST endpoint verification across models & API versions (v1beta and v1)
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
          setGeminiApiKey(key);
          return { success: true, message: `Gemini Key Verified Successfully (${model})!` };
        }

        const errJson = await res.json().catch(() => null);
        if (errJson?.error?.message) {
          lastErrorMessage = errJson.error.message;
        }
      } catch (netErr: any) {
        lastErrorMessage = netErr?.message || 'Network error connecting to Gemini API.';
      }
    }
  }

  return { 
    success: false, 
    message: lastErrorMessage || 'Unable to connect to Gemini API. Please check your API key and internet connection.' 
  };
};

/** Direct Gemini Pro API Query with Intelligent Fallbacks & Multi-Model Resolution */
export const queryGeminiAPI = async (prompt: string): Promise<string> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('No Gemini API Key configured. Please enter your API key to connect to online AI.');
  }

  // 1. Try official SDK with candidate models
  try {
    const ai = new GoogleGenAI({ apiKey });
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
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
                  {
                    text: `You are Gemini Pro, an intelligent AI assistant embedded inside the DayTrace Android productivity app. Answer the user's question directly, clearly, and concisely with bullet points and friendly formatting:\n\nUser Question: ${prompt}`
                  }
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

/** Dynamic Ultra-Detailed Contextual Icon & Clipart Resolver */
export const resolveContextualIcon = (title: string, description?: string): string => {
  const text = `${title} ${description || ''}`.toLowerCase();

  // 1. Specific Food & Meals (e.g. 2 Chapati + Curd + Dal)
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
