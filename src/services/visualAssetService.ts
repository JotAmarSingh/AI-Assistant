import { getGeminiClient, getStoredGeminiApiKey } from './geminiService';

export type GeneratedVisualKind = 'TASK_STICKER' | 'CATEGORY_ISLAND';

interface CachedVisualAsset {
  key: string;
  kind: GeneratedVisualKind;
  dataUrl: string;
  createdAt: string;
}

const DB_NAME = 'daytrace-visual-assets';
const STORE_NAME = 'assets';
const DB_VERSION = 1;
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const memoryCache = new Map<string, CachedVisualAsset>();
const inFlight = new Map<string, Promise<string | null>>();
const failedThisSession = new Set<string>();
let generationQueue: Promise<unknown> = Promise.resolve();

const stableHash = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const compactPrivateText = (value: string, limit: number): string => value
  .replace(/https?:\/\/\S+/gi, '')
  .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '')
  .replace(/\b\+?\d[\d\s-]{7,}\d\b/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, limit);

export const taskVisualKey = (title: string, category: string): string =>
  `task:${stableHash(`${compactPrivateText(title, 180)}|${compactPrivateText(category, 60)}`)}`;

export const categoryVisualKey = (label: string, taskTitles: string[]): string =>
  `category:${stableHash(`${compactPrivateText(label, 60)}|${taskTitles.slice(0, 4).map((title) => compactPrivateText(title, 100)).join('|')}`)}`;

const openDatabase = (): Promise<IDBDatabase | null> => new Promise((resolve) => {
  if (typeof indexedDB === 'undefined') {
    resolve(null);
    return;
  }
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'key' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});

export const readGeneratedVisual = async (key: string): Promise<string | null> => {
  const memory = memoryCache.get(key);
  if (memory) return memory.dataUrl;
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => {
      const record = request.result as CachedVisualAsset | undefined;
      if (record?.dataUrl) memoryCache.set(key, record);
      resolve(record?.dataUrl || null);
    };
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => database.close();
  });
};

const persistGeneratedVisual = async (asset: CachedVisualAsset): Promise<void> => {
  memoryCache.set(asset.key, asset);
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(asset);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      resolve();
    };
  });
};

const buildPrompt = (kind: GeneratedVisualKind, subject: string, details: string[]): string => {
  const safeSubject = compactPrivateText(subject, 180);
  const safeDetails = details.map((item) => compactPrivateText(item, 100)).filter(Boolean).slice(0, 4);
  if (kind === 'CATEGORY_ISLAND') {
    return `Create one transparent-background 3D vector-sticker floating island for a productivity app category. Category concept: ${safeSubject}. Representative real task concepts: ${safeDetails.join(', ') || safeSubject}. Use only objects clearly related to those concepts, cohesive dark-fantasy game art, cyan rim light, compact centered composition. No people unless essential, no words, no letters, no labels, no UI, no watermark.`;
  }
  const sikhEditorCue = /\b(video|reel|editing|editor|render)\b/i.test(safeSubject)
    ? 'If a person is useful, depict a Punjabi Sikh man wearing a turban working at a computer.'
    : '';
  return `Create one transparent-background custom vector-sticker icon for this exact task: ${safeSubject}. Category: ${safeDetails[0] || 'uncategorised'}. Show the specific objects or activity named in the task, including exact food items when food is listed. ${sikhEditorCue} Compact centered composition, premium game icon, cyan-violet rim light. No unrelated sport or activity, no words, no letters, no UI, no watermark.`;
};

const generateVisual = async (
  key: string,
  kind: GeneratedVisualKind,
  subject: string,
  details: string[],
): Promise<string | null> => {
  if (!getStoredGeminiApiKey() || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;
  try {
    const ai = getGeminiClient();
    const request = ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: buildPrompt(kind, subject, details),
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    } as any);
    const response: any = await Promise.race([
      request,
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('Visual generation timed out')), 60_000)),
    ]);
    const parts = response?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part?.inlineData?.data && part?.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart) return null;
    const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    await persistGeneratedVisual({ key, kind, dataUrl, createdAt: new Date().toISOString() });
    return dataUrl;
  } catch (error) {
    console.warn(`DayTrace ${kind.toLowerCase()} generation unavailable; using local fallback.`, error);
    failedThisSession.add(key);
    return null;
  }
};

/**
 * Reads the local cache first, then queues at most one token-conscious Gemini
 * image request at a time. Task creation and navigation never wait for artwork.
 */
export const getOrCreateGeneratedVisual = async (
  key: string,
  kind: GeneratedVisualKind,
  subject: string,
  details: string[] = [],
): Promise<string | null> => {
  const cached = await readGeneratedVisual(key);
  if (cached) return cached;
  if (failedThisSession.has(key)) return null;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const queued = generationQueue
    .catch(() => undefined)
    .then(() => generateVisual(key, kind, subject, details));
  generationQueue = queued;
  inFlight.set(key, queued);
  try {
    return await queued;
  } finally {
    inFlight.delete(key);
  }
};
