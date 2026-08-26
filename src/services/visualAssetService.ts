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
  failureCode?: VisualGenerationFailureCode;
  failureMessage?: string;
}

export type VisualGenerationFailureCode =
  | 'NO_API_KEY'
  | 'OFFLINE'
  | 'IMAGE_ACCESS_REQUIRED'
  | 'RATE_LIMITED'
  | 'MODEL_UNAVAILABLE'
  | 'REQUEST_FAILED';

export type VisualGenerationState =
  | 'IDLE'
  | 'QUEUED'
  | 'GENERATING'
  | 'READY'
  | VisualGenerationFailureCode;

export interface VisualGenerationStatus {
  state: VisualGenerationState;
  message: string;
  pendingCount: number;
  activeModel?: string;
  lastErrorAt?: string;
  retryAfter?: number;
}

interface VisualGenerationFailure {
  code: VisualGenerationFailureCode;
  message: string;
  retryAfter: number;
}

interface VisualGenerationResult {
  dataUrl: string | null;
  model?: string;
  failure?: VisualGenerationFailure;
}

const DB_NAME = 'daytrace-visual-assets';
const STORE_NAME = 'assets';
const DB_VERSION = 1;
export const IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
] as const;
const VISUAL_MODEL_REVISION = 'ai-studio-free-tier-image-first-2026-08';
const VISUAL_MODEL_REVISION_KEY = 'daytrace_visual_model_revision_v1';
const PENDING_QUEUE_KEY = 'daytrace_pending_visuals_v1';
const COMPLETED_KEYS_KEY = 'daytrace_completed_visual_keys_v1';
const VISUAL_STATUS_KEY = 'daytrace_visual_generation_status_v1';
export const VISUAL_READY_EVENT = 'daytrace-visual-ready';
export const VISUAL_STATUS_EVENT = 'daytrace-visual-status';
const memoryCache = new Map<string, CachedVisualAsset>();
const inFlight = new Map<string, Promise<VisualGenerationResult>>();
let generationQueue: Promise<unknown> = Promise.resolve();
let pendingQueueRunner: Promise<void> | null = null;
let retryTimer: number | null = null;
let lifecycleListenersInstalled = false;

const defaultVisualStatus = (): VisualGenerationStatus => ({
  state: getStoredGeminiApiKey()
    ? (typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'IDLE')
    : 'NO_API_KEY',
  message: getStoredGeminiApiKey()
    ? (typeof navigator !== 'undefined' && !navigator.onLine
      ? 'Waiting for internet before generating custom artwork.'
      : 'Custom artwork has not been tested yet.')
    : 'Add a Gemini API key to generate custom artwork.',
  pendingCount: 0,
});

export const getVisualGenerationStatus = (): VisualGenerationStatus => {
  const fallback = defaultVisualStatus();
  if (typeof localStorage === 'undefined') return fallback;
  if (!getStoredGeminiApiKey() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { ...fallback, pendingCount: readPendingQueue().length };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(VISUAL_STATUS_KEY) || 'null');
    if (!parsed || typeof parsed.state !== 'string' || typeof parsed.message !== 'string') return fallback;
    return {
      ...parsed,
      pendingCount: readPendingQueue().length,
    } as VisualGenerationStatus;
  } catch {
    return fallback;
  }
};

const publishVisualStatus = (status: Omit<VisualGenerationStatus, 'pendingCount'> & { pendingCount?: number }) => {
  const next: VisualGenerationStatus = {
    ...status,
    pendingCount: status.pendingCount ?? readPendingQueue().length,
  };
  if (typeof localStorage !== 'undefined') localStorage.setItem(VISUAL_STATUS_KEY, JSON.stringify(next));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VISUAL_STATUS_EVENT, { detail: next }));
  }
};

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

export const classifyVisualGenerationError = (
  error: unknown,
  now = Date.now(),
): VisualGenerationFailure => {
  const status = typeof error === 'object' && error && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : 0;
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const message = rawMessage.toLowerCase();

  if (status === 429 || /rate.?limit|resource_exhausted|too many requests|daily request limit/.test(message)) {
    return {
      code: 'RATE_LIMITED',
      message: 'Gemini image quota is temporarily exhausted. The icons remain queued and will retry automatically.',
      retryAfter: now + 15 * 60_000,
    };
  }
  if (
    status === 403
    || /billing|paid tier|payment required|permission denied|does not have access|image generation is not enabled/.test(message)
  ) {
    return {
      code: 'IMAGE_ACCESS_REQUIRED',
      message: 'Text AI is connected, but this Gemini project/key did not authorize image generation. DayTrace will keep task-specific local artwork and retain the generated-icon queue.',
      retryAfter: now + 6 * 60 * 60_000,
    };
  }
  if (status === 401 || /api key not valid|invalid api key|unauthenticated/.test(message)) {
    return {
      code: 'NO_API_KEY',
      message: 'The saved Gemini API key was rejected for image generation. Verify or replace it in Settings.',
      retryAfter: now + 6 * 60 * 60_000,
    };
  }
  if (status === 404 || /model.*not found|unsupported model|not supported|not available for generatecontent/.test(message)) {
    return {
      code: 'MODEL_UNAVAILABLE',
      message: 'That Gemini image model is not available for this key. DayTrace is trying its compatible fallback model.',
      retryAfter: now + 60_000,
    };
  }
  return {
    code: 'REQUEST_FAILED',
    message: 'Gemini image generation could not finish. The artwork remains queued and will retry automatically.',
    retryAfter: now + 5 * 60_000,
  };
};

const generateVisual = async (
  key: string,
  kind: GeneratedVisualKind,
  subject: string,
  details: string[],
): Promise<VisualGenerationResult> => {
  if (!getStoredGeminiApiKey()) {
    return {
      dataUrl: null,
      failure: {
        code: 'NO_API_KEY',
        message: 'Add a Gemini API key to generate custom artwork.',
        retryAfter: Number.MAX_SAFE_INTEGER,
      },
    };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      dataUrl: null,
      failure: {
        code: 'OFFLINE',
        message: 'Waiting for internet before generating custom artwork.',
        retryAfter: Number.MAX_SAFE_INTEGER,
      },
    };
  }
  const ai = getGeminiClient();
  const prompt = buildPrompt(kind, subject, details);
  let lastFailure: VisualGenerationFailure | undefined;
  for (const model of IMAGE_MODELS) {
    try {
      publishVisualStatus({
        state: 'GENERATING',
        message: `Generating task-specific artwork with ${model}.`,
        activeModel: model,
      });
      const request = ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseModalities: ['TEXT', 'IMAGE'] },
      } as any);
      const response: any = await Promise.race([
        request,
        new Promise((_, reject) => globalThis.setTimeout(() => reject(new Error(`${model} timed out`)), 60_000)),
      ]);
      const parts = response?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((part: any) => part?.inlineData?.data && part?.inlineData?.mimeType?.startsWith('image/'));
      if (!imagePart) {
        lastFailure = classifyVisualGenerationError(new Error(`${model} returned no image`));
      } else {
        const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        await persistGeneratedVisual({ key, kind, dataUrl, createdAt: new Date().toISOString() });
        return { dataUrl, model };
      }
    } catch (error) {
      lastFailure = classifyVisualGenerationError(error);
    }
    if (lastFailure.code !== 'MODEL_UNAVAILABLE') break;
  }
  console.warn(`DayTrace ${kind.toLowerCase()} generation unavailable; retaining task-specific local artwork.`, lastFailure?.code);
  return {
    dataUrl: null,
    failure: lastFailure || classifyVisualGenerationError(new Error('No compatible image response')),
  };
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

const revivePendingVisuals = () => {
  writePendingQueue(readPendingQueue().map((request) => ({
    ...request,
    attempts: 0,
    nextAttemptAt: 0,
    failureCode: undefined,
    failureMessage: undefined,
  })));
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
  const pendingCount = byKey.size;
  if (pendingCount > 0) {
    const current = getVisualGenerationStatus();
    if (!['GENERATING', 'IMAGE_ACCESS_REQUIRED', 'RATE_LIMITED'].includes(current.state)) {
      publishVisualStatus({
        state: getStoredGeminiApiKey()
          ? (typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'QUEUED')
          : 'NO_API_KEY',
        message: getStoredGeminiApiKey()
          ? (typeof navigator !== 'undefined' && !navigator.onLine
            ? 'Artwork is queued and will generate when internet returns.'
            : 'Task-specific artwork is queued for Gemini image generation.')
          : 'Artwork is queued. Add a Gemini API key to generate it.',
        pendingCount,
      });
    }
  }
};

const notifyVisualReady = (key: string, dataUrl: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(VISUAL_READY_EVENT, { detail: { key, dataUrl } }));
};

const removePendingVisual = (key: string) => {
  writePendingQueue(readPendingQueue().filter((request) => request.key !== key));
};

const deferPendingVisual = (key: string, failure: VisualGenerationFailure) => {
  const now = Date.now();
  writePendingQueue(readPendingQueue().map((request) => {
    if (request.key !== key) return request;
    const attempts = Math.min(6, (request.attempts || 0) + 1);
    const transientRetry = now + Math.min(30 * 60_000, 60_000 * (5 ** Math.max(0, attempts - 1)));
    return {
      ...request,
      attempts,
      nextAttemptAt: Math.max(failure.retryAfter, transientRetry),
      failureCode: failure.code,
      failureMessage: failure.message,
    };
  }));
  publishVisualStatus({
    state: failure.code,
    message: failure.message,
    lastErrorAt: new Date().toISOString(),
    retryAfter: failure.retryAfter,
  });
};

const runVisualRequest = async (request: PendingVisualAsset): Promise<VisualGenerationResult> => {
  const cached = await readGeneratedVisual(request.key);
  if (cached) return { dataUrl: cached };
  if (!getStoredGeminiApiKey()) {
    return {
      dataUrl: null,
      failure: { code: 'NO_API_KEY', message: 'Add a Gemini API key to generate custom artwork.', retryAfter: Number.MAX_SAFE_INTEGER },
    };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      dataUrl: null,
      failure: { code: 'OFFLINE', message: 'Waiting for internet before generating custom artwork.', retryAfter: Number.MAX_SAFE_INTEGER },
    };
  }
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
    .filter((value) => value > Date.now() && value - Date.now() < 2_147_000_000)
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
  if (!getStoredGeminiApiKey()) {
    publishVisualStatus({ state: 'NO_API_KEY', message: 'Artwork is queued. Add a Gemini API key to generate it.' });
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    publishVisualStatus({ state: 'OFFLINE', message: 'Artwork is queued and will generate when internet returns.' });
    return;
  }
  const health = getVisualGenerationStatus();
  if (
    health.retryAfter
    && health.retryAfter > Date.now()
    && ['IMAGE_ACCESS_REQUIRED', 'RATE_LIMITED', 'REQUEST_FAILED'].includes(health.state)
  ) {
    schedulePendingRetry();
    return;
  }
  pendingQueueRunner = (async () => {
    let processed = 0;
    while (processed < 20) {
      const request = readPendingQueue().find((item) => (item.nextAttemptAt || 0) <= Date.now());
      if (!request) break;
      const result = await runVisualRequest(request);
      if (result.dataUrl) {
        removePendingVisual(request.key);
        notifyVisualReady(request.key, result.dataUrl);
        publishVisualStatus({
          state: 'READY',
          message: 'Gemini custom artwork is working.',
          activeModel: result.model,
        });
      } else if (result.failure) {
        deferPendingVisual(request.key, result.failure);
        if (['IMAGE_ACCESS_REQUIRED', 'RATE_LIMITED', 'NO_API_KEY', 'OFFLINE'].includes(result.failure.code)) break;
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
  const resumeWhenOnline = () => {
    const status = getVisualGenerationStatus();
    if (status.state === 'OFFLINE') revivePendingVisuals();
    void resumePendingVisualGeneration();
  };
  const resumeWithNewKey = () => {
    revivePendingVisuals();
    if (typeof localStorage !== 'undefined') localStorage.removeItem(VISUAL_STATUS_KEY);
    void resumePendingVisualGeneration();
  };
  window.addEventListener('online', resumeWhenOnline);
  window.addEventListener('daytrace-online-ai-ready', resumeWithNewKey);
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
  const health = getVisualGenerationStatus();
  if (
    health.retryAfter
    && health.retryAfter > Date.now()
    && ['NO_API_KEY', 'OFFLINE', 'IMAGE_ACCESS_REQUIRED', 'RATE_LIMITED', 'REQUEST_FAILED'].includes(health.state)
  ) {
    schedulePendingRetry();
    return null;
  }
  const result = await runVisualRequest(request);
  if (result.dataUrl) {
    removePendingVisual(key);
    notifyVisualReady(key, result.dataUrl);
    publishVisualStatus({ state: 'READY', message: 'Gemini custom artwork is working.', activeModel: result.model });
  } else if (result.failure) {
    deferPendingVisual(key, result.failure);
  }
  schedulePendingRetry();
  return result.dataUrl;
};

export const retryPendingVisualGeneration = async (): Promise<VisualGenerationStatus> => {
  revivePendingVisuals();
  if (typeof localStorage !== 'undefined') localStorage.removeItem(VISUAL_STATUS_KEY);
  await resumePendingVisualGeneration();
  return getVisualGenerationStatus();
};

if (typeof localStorage !== 'undefined' && localStorage.getItem(VISUAL_MODEL_REVISION_KEY) !== VISUAL_MODEL_REVISION) {
  revivePendingVisuals();
  localStorage.setItem(VISUAL_MODEL_REVISION_KEY, VISUAL_MODEL_REVISION);
}
ensureVisualLifecycleListeners();
if (typeof window !== 'undefined') window.setTimeout(() => void resumePendingVisualGeneration(), 0);
