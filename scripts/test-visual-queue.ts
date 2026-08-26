import assert from 'node:assert/strict';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() { return values.size; },
  },
});

const { IMAGE_MODELS, queueGeneratedVisuals } = await import('../src/services/visualAssetService');

assert.equal(IMAGE_MODELS[0], 'gemini-3.1-flash-image', 'Nano Banana 2 must be the primary image model');
assert(IMAGE_MODELS.includes('gemini-3.1-flash-lite-image'), 'Nano Banana 2 Lite fallback is required');
assert(IMAGE_MODELS.includes('gemini-2.5-flash-image'), 'legacy image fallback must remain for API compatibility');

queueGeneratedVisuals([
  {
    kind: 'TASK_STICKER',
    subject: 'Edit the client reel for person@example.com at https://private.example/test',
    details: ['Client Work'],
  },
  {
    kind: 'TASK_STICKER',
    subject: 'Edit the client reel for person@example.com at https://private.example/test',
    details: ['Client Work'],
  },
]);

const pending = JSON.parse(values.get('daytrace_pending_visuals_v1') || '[]');
assert.equal(pending.length, 1, 'Duplicate visual requests must be queued once');
assert.equal(pending[0].kind, 'TASK_STICKER');
assert.match(pending[0].subject, /Edit the client reel/);
assert.doesNotMatch(pending[0].subject, /person@example\.com|private\.example/, 'Obvious contact/link data must not enter image prompts');
assert.equal(pending[0].details[0], 'Client Work');
assert.equal(pending[0].attempts, 0, 'a model revision must revive pending work');
assert.equal(pending[0].nextAttemptAt, 0, 'revived pending work must retry immediately');

console.log('Deferred visual queue tests passed.');
