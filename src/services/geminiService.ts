import { GoogleGenAI } from '@google/genai';

// Hardwired Gemini API Key for user's Google Pixel 10a
const HARDWIRED_GEMINI_API_KEY = 'AIzaSyCcHh0HQa5zILpus_BGjzZG1POqaNOZaBs';

export const getStoredGeminiApiKey = (): string => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('daytrace_gemini_api_key') || '';
  }
  return '';
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
  if (typeof localStorage !== 'undefined') {
    const savedKey = localStorage.getItem('daytrace_gemini_api_key');
    if (savedKey && savedKey.trim()) return savedKey.trim();
  }
  return HARDWIRED_GEMINI_API_KEY;
};

export const getGeminiClient = (): GoogleGenAI => {
  const apiKey = getGeminiApiKey();
  return new GoogleGenAI({ apiKey });
};

/** Direct Gemini Pro API Query with Intelligent Fallbacks & Multi-Model Resolution */
export const queryGeminiAPI = async (prompt: string): Promise<string> => {
  const apiKey = getGeminiApiKey();

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
    const restEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
