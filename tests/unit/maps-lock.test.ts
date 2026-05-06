/**
 * _maps_lock kill switch tests — verify cache + lock state behavior.
 *
 * Tests focus on:
 *   - readLockState reads app_settings + caches 10s (autoplan T6 fix)
 *   - assertGoogleAvailable throws MAPS_LOCKED when locked=true
 *   - invalidateLockCache forces re-read on next call
 *   - fail-open when D1 query throws (migration not applied)
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readLockState,
  assertGoogleAvailable,
  invalidateLockCache,
} from '../../functions/api/_maps_lock';

interface MockD1 {
  prepare: ReturnType<typeof vi.fn>;
}

function makeDb(rows: Array<{ key: string; value: string }> = []): MockD1 {
  return {
    prepare: vi.fn(() => ({
      all: async <T>() => ({ results: rows as T[] }),
    })),
  };
}

beforeEach(() => {
  invalidateLockCache(); // clean cache between tests
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

describe('readLockState', () => {
  it('returns locked=false when app_settings.google_maps_locked = "false"', async () => {
    const db = makeDb([
      { key: 'google_maps_locked', value: 'false' },
      { key: 'google_maps_locked_reason', value: '' },
    ]);
    const state = await readLockState(db as unknown as D1Database);
    expect(state.locked).toBe(false);
  });

  it('returns locked=true when app_settings.google_maps_locked = "true"', async () => {
    const db = makeDb([
      { key: 'google_maps_locked', value: 'true' },
      { key: 'google_maps_locked_reason', value: 'MTD 91 percent' },
    ]);
    const state = await readLockState(db as unknown as D1Database);
    expect(state.locked).toBe(true);
    expect(state.reason).toBe('MTD 91 percent');
  });

  it('app_settings 表不存在（D1 throw）→ fail-open（locked=false）', async () => {
    const db: MockD1 = {
      prepare: vi.fn(() => ({ all: async () => { throw new Error('no such table'); } })),
    };
    const state = await readLockState(db as unknown as D1Database);
    expect(state.locked).toBe(false);
    expect(state.reason).toBe('');
  });

  it('cache 10s — second call within window does NOT hit D1', async () => {
    const db = makeDb([{ key: 'google_maps_locked', value: 'false' }]);
    await readLockState(db as unknown as D1Database);
    expect(db.prepare).toHaveBeenCalledTimes(1);
    vi.setSystemTime(5000); // 5s later
    await readLockState(db as unknown as D1Database);
    expect(db.prepare).toHaveBeenCalledTimes(1); // still cached
  });

  it('cache expires after 10s — third call re-fetches', async () => {
    const db = makeDb([{ key: 'google_maps_locked', value: 'false' }]);
    await readLockState(db as unknown as D1Database);
    vi.setSystemTime(11_000); // 11s later, past TTL
    await readLockState(db as unknown as D1Database);
    expect(db.prepare).toHaveBeenCalledTimes(2);
  });

  it('invalidateLockCache forces re-read on next call', async () => {
    const db = makeDb([{ key: 'google_maps_locked', value: 'false' }]);
    await readLockState(db as unknown as D1Database);
    expect(db.prepare).toHaveBeenCalledTimes(1);
    invalidateLockCache();
    await readLockState(db as unknown as D1Database);
    expect(db.prepare).toHaveBeenCalledTimes(2);
  });
});

describe('assertGoogleAvailable', () => {
  it('locked=false → noop (no throw)', async () => {
    const db = makeDb([{ key: 'google_maps_locked', value: 'false' }]);
    await expect(assertGoogleAvailable(db as unknown as D1Database)).resolves.toBeUndefined();
  });

  it('locked=true → throws MAPS_LOCKED 503', async () => {
    const db = makeDb([
      { key: 'google_maps_locked', value: 'true' },
      { key: 'google_maps_locked_reason', value: 'budget 90 percent' },
    ]);
    try {
      await assertGoogleAvailable(db as unknown as D1Database);
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as { code: string; status: number; detail?: string };
      expect(e.code).toBe('MAPS_LOCKED');
      expect(e.status).toBe(503);
      expect(e.detail).toBe('budget 90 percent');
    }
  });

  it('migration not applied → fail-open (no throw)', async () => {
    const db: MockD1 = {
      prepare: vi.fn(() => ({ all: async () => { throw new Error('no such table'); } })),
    };
    await expect(assertGoogleAvailable(db as unknown as D1Database)).resolves.toBeUndefined();
  });
});
