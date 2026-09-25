import { beforeEach, expect, it, vi } from 'vitest';
import { copyEntry, moveEntry } from '../../src/lib/entryMutations';
import { __resetTravelRecomputeState } from '../../src/lib/travelRecompute';
import { EVENT } from '../../src/lib/events';

const http = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/apiClient', () => ({ apiFetchRaw: http }));
const response = (status = 200, body: unknown = {}) => new Response(JSON.stringify(body), { status });
beforeEach(() => { http.mockReset(); __resetTravelRecomputeState(); });

it('move keeps the accepted write and retries only the failed source day, sharing concurrent retries', async () => {
  let sourceAttempts = 0;
  http.mockImplementation(async (path: string) => {
    if (path.endsWith('?day=1') && ++sourceAttempts === 1) return response(503);
    return response(200, { id: 42 });
  });
  const result = await moveEntry('t1', 42, { fromDayNum: 1, toDayNum: 2, toDayId: 72 });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('write failed');
  expect(await result.recompute).toBe(false);
  expect(await Promise.all([result.retryRecompute(), result.retryRecompute()])).toEqual([true, true]);
  expect(await result.retryRecompute()).toBe(true);
  expect(http.mock.calls.map(([path]) => path)).toEqual([
    '/trips/t1/entries/42', '/trips/t1/recompute-travel?day=2',
    '/trips/t1/recompute-travel?day=1', '/trips/t1/recompute-travel?day=1',
  ]);
});

it('copy announces the new entry and retains HTTP 200 partial travel failures for recovery', async () => {
  let attempts = 0;
  http.mockImplementation(async (path: string) => path.endsWith('/copy')
    ? response(201, { id: 77 })
    : response(200, ++attempts === 1 ? { errorsDetail: [{ entryId: 77, message: 'maps unavailable' }] } : {}));
  const events: unknown[] = [];
  const listener = (e: Event) => events.push((e as CustomEvent).detail);
  window.addEventListener(EVENT.entryUpdated, listener);
  try {
    const result = await copyEntry('t1', 42, { targetDayId: 71, targetDayNum: 1 });
    if (!result.ok) throw new Error('write failed');
    expect(await result.recompute).toBe(false);
    expect(await result.retryRecompute()).toBe(true);
    expect(events).toEqual([{ tripId: 't1', entryId: 77, dayNum: 1 }]);
    expect(http.mock.calls.filter(([path]) => path.endsWith('/copy'))).toHaveLength(1);
  } finally { window.removeEventListener(EVENT.entryUpdated, listener); }
});

it('a rejected write refreshes both days without starting traffic or offering write-success recovery', async () => {
  http.mockResolvedValue(response(409, { error: { code: 'STALE_ENTRY', message: '請重新載入' } }));
  const result = await moveEntry('t1', 42, { fromDayNum: 1, toDayNum: 2, toDayId: 72 });
  expect(result).toMatchObject({ ok: false, status: 409, code: 'STALE_ENTRY' });
  expect(http).toHaveBeenCalledTimes(1);
});
