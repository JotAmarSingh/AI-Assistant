import { getGeminiClient, getStoredGeminiApiKey } from './geminiService';

export type GeneratedVisualKind = 'TASK_STICKER' | 'CATEGORY_ISLAND';

export interface GeneratedVisualRequest {
  kind: GeneratedVisualKind;
  subject: string;
  details?: string[];
}

interface CachedVisualAsset {
  key: string;
  kind: GeneratedVisualKind;
  dataUrl: string;
  createdAt: string;
}

interface PendingVisualAsset extends GeneratedVisualRequest {
  key: string;
  details: string[];
  attempts: number;
  nextAttemptAt: number;
}

const DB_NAME = 'daytrace-visual-assets';
const STORE_NAME = 'assets';
const DB_VERSION = 1;
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const PENDING_QUEUE_KEY = 'daytrace_pending_visuals_v1';
const COMPLETED_KEYS_KEY = 'daytrace_completed_visual_keys_v1';
export const VISUAL_READY_EVENT = 'daytrace-visual-ready';
const memoryCache = new Map<string, CachedVisualAsset>();
const inFlight = new Map<string, Promise<string | null>>();
let generationQueue: Promise<unknown> = Promise.resolve();
let pendingQueueRunner: Promise<void> | null = null;
let retryTimer: number | null = null;
let lifecycleListenersInstalled = false;

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

const visualKey = (kind: GeneratedVisualKind, subject: string, details: string[]): string =>
  kind === 'TASK_STICKER'
    ? taskVisualKey(subject, details[0] || '')
    : categoryVisualKey(subject, details);

const readCompletedKeys = (): Set<string> => {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPLETED_KEYS_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
};

const rememberCompletedKey = (key: string) => {
  if (typeof localStorage === 'undefined') return;
  const keys = readCompletedKeys();
  keys.add(key);
  localStorage.setItem(COMPLETED_KEYS_KEY, JSON.stringify(Array.from(keys).slice(-2000)));
};

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
      if (record?.dataUrl) {
        memoryCache.set(key, record);
        rememberCompletedKey(key);
      }
      resolve(record?.dataUrl || null);
    };
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => database.close();
  });
};

const persistGeneratedVisual = async (asset: CachedVisualAsset): Promise<void> => {
  memoryCache.set(asset.key, asset);
  rememberCompletedKey(asset.key);
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
    return null;
  }
};

const readPendingQueue = (): PendingVisualAsset[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_QUEUE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PendingVisualAsset => Boolean(
        item
        && typeof item.key === 'string'
        && (item.kind === 'TASK_STICKER' || item.kind === 'CATEGORY_ISLAND')
        && typeof item.subject === 'string',
      ))
      .slice(0, 300);
  } catch {
    return [];
  }
};

const writePendingQueue = (queue: PendingVisualAsset[]) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue.slice(0, 300)));
};

const toPendingRequest = (request: GeneratedVisualRequest): PendingVisualAsset => {
  const details = (request.details || [])
    .map((detail) => compactPrivateText(detail, 100))
    .filter(Boolean)
    .slice(0, 4);
  const subject = compactPrivateText(request.subject, 180);
  return {
    key: visualKey(request.kind, subject, details),
    kind: request.kind,
    subject,
    details,
    attempts: 0,
    nextAttemptAt: 0,
  };
};

const enqueuePendingVisuals = (requests: GeneratedVisualRequest[]) => {
  const completed = readCompletedKeys();
  const queue = readPendingQueue();
  const byKey = new Map(queue.map((request) => [request.key, request]));
  requests
    .map(toPendingRequest)
    .filter((request) => request.subject && !completed.has(request.key) && !memoryCache.has(request.key))
    .forEach((request) => {
      if (!byKey.has(request.key)) byKey.set(request.key, request);
    });
  writePendingQueue(Array.from(byKey.values()));
};

const notifyVisualReady = (key: string, dataUrl: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(VISUAL_READY_EVENT, { detail: { key, dataUrl } }));
};

const removePendingVisual = (key: string) => {
  writePendingQueue(readPendingQueue().filter((request) => request.key !== key));
};

const deferPendingVisual = (key: string) => {
  const now = Date.now();
  writePendingQueue(readPendingQueue().map((request) => {
    if (request.key !== key) return request;
    const attempts = Math.min(6, (request.attempts || 0) + 1);
    const retryDelay = Math.min(30 * 60_000, 60_000 * (5 ** Math.max(0, attempts - 1)));
    return { ...request, attempts, nextAttemptAt: now + retryDelay };
  }));
};

const runVisualRequest = async (request: PendingVisualAsset): Promise<string | null> => {
  const cached = await readGeneratedVisual(request.key);
  if (cached) return cached;
  if (!getStoredGeminiApiKey() || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;
  const pending = inFlight.get(request.key);
  if (pending) return pending;
  const queued = generationQueue
    .catch(() => undefined)
    .then(() => generateVisual(request.key, request.kind, request.subject, request.details));
  generationQueue = queued;
  inFlight.set(request.key, queued);
  try {
    return await queued;
  } finally {
    inFlight.delete(request.key);
  }
};

const schedulePendingRetry = () => {
  if (typeof window === 'undefined') return;
  if (retryTimer !== null) window.clearTimeout(retryTimer);
  const pending = readPendingQueue();
  const hasReadyWork = pending.some((request) => (request.nextAttemptAt || 0) <= Date.now());
  const nextAttemptAt = pending
    .map((request) => request.nextAttemptAt || 0)
    .filter((value) => value > Date.now())
    .sort((left, right) => left - right)[0];
  if (!hasReadyWork && !nextAttemptAt) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void resumePendingVisualGeneration();
  }, hasReadyWork ? 1_000 : Math.max(1_000, nextAttemptAt - Date.now()));
};

/**
 * Reconciles icons that were requested while offline. The queue stores only a
 * compact subject/category prompt, never the rest of the user's DayTrace data.
 */
export const resumePendingVisualGeneration = async (): Promise<void> => {
  if (pendingQueueRunner) return pendingQueueRunner;
  if (!getStoredGeminiApiKey() || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  pendingQueueRunner = (async () => {
    let processed = 0;
    while (processed < 20) {
      const request = readPendingQueue().find((item) => (item.nextAttemptAt || 0) <= Date.now());
      if (!request) break;
      const generated = await runVisualRequest(request);
      if (generated) {
        removePendingVisual(request.key);
        notifyVisualReady(request.key, generated);
      } else if (getStoredGeminiApiKey() && (typeof navigator === 'undefined' || navigator.onLine)) {
        deferPendingVisual(request.key);
      } else {
        break;
      }
      processed += 1;
    }
  })().finally(() => {
    pendingQueueRunner = null;
    schedulePendingRetry();
  });
  return pendingQueueRunner;
};

export const queueGeneratedVisuals = (requests: GeneratedVisualRequest[]): void => {
  if (!requests.length) return;
  enqueuePendingVisuals(requests);
  ensureVisualLifecycleListeners();
  void resumePendingVisualGeneration();
};

const ensureVisualLifecycleListeners = () => {
  if (lifecycleListenersInstalled || typeof window === 'undefined') return;
  lifecycleListenersInstalled = true;
  const resume = () => void resumePendingVisualGeneration();
  window.addEventListener('online', resume);
  window.addEventListener('daytrace-online-ai-ready', resume);
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
  const request = toPendingRequest({ kind, subject, details });
  enqueuePendingVisuals([{ kind, subject, details }]);
  ensureVisualLifecycleListeners();
  const generated = await runVisualRequest(request);
  if (generated) {
    removePendingVisual(key);
    notifyVisualReady(key, generated);
  } else if (getStoredGeminiApiKey() && (typeof navigator === 'undefined' || navigator.onLine)) {
    deferPendingVisual(key);
  }
  schedulePendingRetry();
  return generated;
};

ensureVisualLifecycleListeners();
if (typeof window !== 'undefined') window.setTimeout(() => void resumePendingVisualGeneration(), 0);
