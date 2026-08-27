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

const { classifyVisualGenerationError, IMAGE_MODELS, queueGeneratedVisuals } = await import('../src/services/visualAssetService');
const { resolveLocalVisualConcept } = await import('../src/utils/visualFallback');

assert.equal(IMAGE_MODELS[0], 'gemini-3.1-flash-lite-image', 'the current cost-efficient native image model must be attempted first');
assert(IMAGE_MODELS.includes('gemini-2.5-flash-image'), 'Nano Banana must remain as a compatible image fallback');
assert(IMAGE_MODELS.includes('gemini-3.1-flash-image'), 'Nano Banana 2 must remain as a compatible image fallback');

const rateLimit = classifyVisualGenerationError(Object.assign(new Error('RESOURCE_EXHAUSTED: daily request limit'), { status: 429 }), 1_000);
assert.equal(rateLimit.code, 'RATE_LIMITED');
assert(rateLimit.retryAfter > 1_000, 'rate-limited artwork must receive a future retry time');

const imageAccess = classifyVisualGenerationError(Object.assign(new Error('Permission denied for image generation'), { status: 403 }), 1_000);
assert.equal(imageAccess.code, 'IMAGE_ACCESS_REQUIRED');

const zeroFreeQuota = classifyVisualGenerationError(Object.assign(new Error('RESOURCE_EXHAUSTED: generate_content_free_tier_requests limit: 0'), { status: 429 }), 1_000);
assert.equal(zeroFreeQuota.code, 'IMAGE_ACCESS_REQUIRED', 'a zero free-tier image quota is an access requirement, not a temporary rate limit');

const medicine = resolveLocalVisualConcept("Get my son's medicine from the chemist", 'Family');
assert.equal(medicine.primary, 'medicine', 'medicine tasks must never fall back to a generic person/star icon');
assert.equal(medicine.secondary, 'family', 'the local fallback must preserve the family context');

const workout = resolveLocalVisualConcept('3 sets of push-ups, 2 pull-ups and yoga', 'Gym');
assert.equal(workout.primary, 'fitness');
assert.equal(workout.quantityBadge, '3•2', 'task quantities should remain visible in the local artwork');

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
