import { GoogleGenAI } from '@google/genai';

// Hardwired Gemini API Key for user's Google Pixel 10a
const HARDWIRED_GEMINI_API_KEY = 'AIzaSyCcHh0HQa5zILpus_BGjzZG1POqaNOZaBs';

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

/** Dynamic Ultra-Detailed Contextual Icon & Clipart Resolver */
export const resolveContextualIcon = (title: string, description?: string): string => {
  const text = `${title} ${description || ''}`.toLowerCase();

  // 1. Specific Food & Meals (e.g. 2 Chapati + Curd + Dal)
  if (text.includes('chapati') || text.includes('curd') || text.includes('dal')) {
    return '🫓🥣🍲'; // Exact Chapati + Curd + Dal Clipart combination
  }
  if (text.includes('breakfast') || text.includes('lunch') || text.includes('dinner') || text.includes('meal')) {
    return '🫓🥗🍲';
  }

  // 2. Coffee Break (Steaming Coffee Icon)
  if (text.includes('coffee') || text.includes('tea') || text.includes('espresso')) {
    return '☕♨️'; // Steaming Hot Coffee Cup
  }

  // 3. Video & Reel Editing (32yo Turbaned Man + PC Workstation + Reel Clipart)
  if (text.includes('editing') || text.includes('reel') || text.includes('video') || text.includes('youtube') || text.includes('render')) {
    return '👳‍♂️💻🎬'; // Turbaned Man with beard/mustache editing reels at computer
  }

  // 4. Growth Strategy Meeting (32yo Turbaned Man + Growth Chart + Handshake Clipart)
  if (text.includes('growth') || text.includes('strategy') || text.includes('revenue') || text.includes('scale')) {
    return '👳‍♂️📈🤝'; // Turbaned Man in Growth Strategy meeting
  }

  // 5. General Meetings / Client Sync
  if (text.includes('meeting') || text.includes('sync') || text.includes('client') || text.includes('call')) {
    return '👳‍♂️🤝💬';
  }

  // 6. Deep Work / Coding / Development (32yo Turbaned Man + PC + Lightning Clipart)
  if (text.includes('code') || text.includes('dev') || text.includes('deep work') || text.includes('programming') || text.includes('software')) {
    return '👳‍♂️💻⚡';
  }

  // 7. Gym & Workout (32yo Turbaned Man Lifting Clipart)
  if (text.includes('gym') || text.includes('workout') || text.includes('exercise') || text.includes('fitness') || text.includes('run')) {
    return '👳‍♂️🏋️‍♂️';
  }

  // 8. Morning Routine & Home (32yo Turbaned Man + Sunrise + Home Clipart)
  if (text.includes('morning routine') || text.includes('home') || text.includes('house')) {
    return '👳‍♂️🌅🏠';
  }

  // 9. Office & Day Started
  if (text.includes('office') || text.includes('work') || text.includes('job')) {
    return '🏢💼';
  }

  return '👳‍♂️⭐';
};
