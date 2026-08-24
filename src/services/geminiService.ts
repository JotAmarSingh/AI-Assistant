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

/** Dynamic Contextual Icon Resolver based on event text & AI intent */
export const resolveContextualIcon = (title: string, description?: string): string => {
  const text = `${title} ${description || ''}`.toLowerCase();

  // Food / Meal / Breakfast
  if (text.includes('chapati') || text.includes('curd') || text.includes('dal') || text.includes('breakfast') || text.includes('lunch') || text.includes('dinner') || text.includes('meal') || text.includes('food') || text.includes('eat')) {
    return '🍲';
  }

  // Growth / Strategy / Business Meeting
  if (text.includes('growth') || text.includes('strategy') || text.includes('scale') || text.includes('metrics') || text.includes('revenue')) {
    return '🚀';
  }

  if (text.includes('meeting') || text.includes('sync') || text.includes('client') || text.includes('call') || text.includes('discussion')) {
    return '🤝';
  }

  // Coffee / Break / Rest
  if (text.includes('coffee') || text.includes('tea') || text.includes('break') || text.includes('snack') || text.includes('rest')) {
    return '☕';
  }

  // Editing / Video / Reel / Content
  if (text.includes('editing') || text.includes('reel') || text.includes('video') || text.includes('design') || text.includes('media')) {
    return '🎬';
  }

  // Deep Work / Coding / Development
  if (text.includes('code') || text.includes('dev') || text.includes('deep work') || text.includes('programming') || text.includes('build')) {
    return '💻';
  }

  // Gym / Exercise / Health
  if (text.includes('gym') || text.includes('workout') || text.includes('exercise') || text.includes('run') || text.includes('fitness')) {
    return '🏋️';
  }

  // Home / Routine
  if (text.includes('home') || text.includes('morning routine') || text.includes('house')) {
    return '🏠';
  }

  // Office / Day Started
  if (text.includes('office') || text.includes('work') || text.includes('job')) {
    return '🏢';
  }

  return '⭐';
};
