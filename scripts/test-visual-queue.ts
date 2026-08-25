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

const { queueGeneratedVisuals } = await import('../src/services/visualAssetService');

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

console.log('Deferred visual queue tests passed.');
