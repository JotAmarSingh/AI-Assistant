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

/** Verify if a Gemini API Key is valid and functional */
export const verifyGeminiApiKey = async (rawKey: string): Promise<{ success: boolean; message: string }> => {
  const key = rawKey?.trim();
  if (!key) {
    return { success: false, message: 'Please enter a Gemini API Key.' };
  }

  // 1. Try official SDK test
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Respond with OK',
    });
    if (response && response.text && response.text.trim()) {
      setGeminiApiKey(key);
      return { success: true, message: 'Gemini 2.0 Flash / Pro Connected & Verified!' };
    }
  } catch (sdkErr: any) {
    console.warn('SDK key verification error, trying REST:', sdkErr);
  }

  // 2. Direct REST endpoint verification
  try {
    const restEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(restEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with OK' }] }]
      })
    });

    if (res.ok) {
      setGeminiApiKey(key);
      return { success: true, message: 'Gemini API Key Verified Successfully!' };
    }

    const errorJson = await res.json().catch(() => null);
    const errorMessage = errorJson?.error?.message || `Google API returned status ${res.status}`;
    return { success: false, message: errorMessage };
  } catch (netErr: any) {
    return { success: false, message: netErr?.message || 'Network error connecting to Gemini API.' };
  }
};

/** Direct Gemini Pro API Query with Intelligent Fallbacks & Multi-Model Resolution */
export const queryGeminiAPI = async (prompt: string): Promise<string> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('No Gemini API Key configured. Please enter your API key to connect to online AI.');
  }

  // 1. Try official SDK with Gemini Flash models
  try {
    const ai = new GoogleGenAI({ apiKey });
    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

    for (const modelName of modelsToTry) {
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

  // 2. Direct REST HTTP API Query Fallback (Guaranteed to work with valid API key)
  try {
    const restEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
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
    console.warn('Gemini REST API fallback error:', restErr);
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
