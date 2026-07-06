// @vitest-environment jsdom
/**
 * travelRecompute helper — 2026-07-06 車程重算缺口修正的核心防護
 *
 * 驗證：
 *   - single-flight：同 scope 併發 → 只打一次 API，共用同一 promise
 *   - day scope → ?day=N query；無 day → 無 query
 *   - 成功 dispatch tp-segment-updated（觸發 useTripSegments refetch 閉環）
 *   - explicit 失敗 reject（caller 自己 toast）
 *   - auto 模式：每 scope 只自動嘗試一次；entryUpdated（= 新 mutation）重置
 *   - auto 模式：all-scope in-flight 涵蓋 day scope → 跳過不重打
 *   - auto 失敗 resolve null 不 reject（唯讀 403 / MAPS_LOCKED 靜默）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requestTravelRecompute,
  __resetTravelRecomputeState,
} from '../../src/lib/travelRecompute';
import { EVENT } from '../../src/lib/events';

const apiFetchRawMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetchRaw: (path: string, init?: RequestInit) => apiFetchRawMock(path, init),
}));

function okResponse(data: unknown = { pairsComputed: 1 }) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function failResponse(status = 500) {
  return { ok: false, status, json: () => Promise.resolve({}) };
}

/** 手動控制 resolve 時機的 deferred response（併發測試用） */
function deferred() {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  apiFetchRawMock.mockReset();
  __resetTravelRecomputeState();
});

describe('requestTravelRecompute — single-flight + scope', () => {
  it('同 scope 併發兩發 → 只打 1 次 API，兩邊拿到同一結果', async () => {
    const d = deferred();
    apiFetchRawMock.mockReturnValue(d.promise as Promise<unknown>);

    const p1 = requestTravelRecompute('t1', 3);
    const p2 = requestTravelRecompute('t1', 3);
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

    d.resolve(okResponse({ pairsComputed: 7 }));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1?.pairsComputed).toBe(7);
    expect(r2?.pairsComputed).toBe(7);
  });

  it('不同 day scope → 各自打各自的', async () => {
    apiFetchRawMock.mockResolvedValue(okResponse());
    await Promise.all([
      requestTravelRecompute('t1', 1),
      requestTravelRecompute('t1', 2),
    ]);
    expect(apiFetchRawMock).toHaveBeenCalledTimes(2);
  });

  it('day scope 帶 ?day=N；無 day → 無 query', async () => {
    apiFetchRawMock.mockResolvedValue(okResponse());
    await requestTravelRecompute('t1', 4);
    expect(apiFetchRawMock).toHaveBeenLastCalledWith(
      '/trips/t1/recompute-travel?day=4',
      expect.objectContaining({ method: 'POST' }),
    );
    await requestTravelRecompute('t1');
    expect(apiFetchRawMock).toHaveBeenLastCalledWith(
      '/trips/t1/recompute-travel',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('settle 後同 scope 再打 → 新的 API call（in-flight 已清）', async () => {
    apiFetchRawMock.mockResolvedValue(okResponse());
    await requestTravelRecompute('t1', 1);
    await requestTravelRecompute('t1', 1);
    expect(apiFetchRawMock).toHaveBeenCalledTimes(2);
  });

  it('成功 dispatch tp-segment-updated with tripId', async () => {
    apiFetchRawMock.mockResolvedValue(okResponse());
    const seen: unknown[] = [];
    const handler = (e: Event) => { seen.push((e as CustomEvent).detail); };
    window.addEventListener(EVENT.segmentUpdated, handler);
    try {
      await requestTravelRecompute('t9', 2);
    } finally {
      window.removeEventListener(EVENT.segmentUpdated, handler);
    }
    expect(seen).toEqual([{ tripId: 't9' }]);
  });

  it('explicit 失敗 → reject（caller 自己 toast）', async () => {
    apiFetchRawMock.mockResolvedValue(failResponse(503));
    await expect(requestTravelRecompute('t1', 1)).rejects.toThrow('recompute-travel 503');
  });
});

describe('requestTravelRecompute — auto 模式防護', () => {
  it('同 scope 第二次 auto → null 不打 API；entryUpdated 後重新可打', async () => {
    apiFetchRawMock.mockResolvedValue(okResponse());

    const r1 = await requestTravelRecompute('t1', 1, { auto: true });
    expect(r1?.pairsComputed).toBe(1);
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

    const r2 = await requestTravelRecompute('t1', 1, { auto: true });
    expect(r2).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

    // 新 mutation → 重置該 trip 的 auto 嘗試權
    window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId: 't1' } }));
    const r3 = await requestTravelRecompute('t1', 1, { auto: true });
    expect(r3?.pairsComputed).toBe(1);
    expect(apiFetchRawMock).toHaveBeenCalledTimes(2);
  });

  it('別的 trip 的 entryUpdated 不重置本 trip 的 auto 嘗試權', async () => {
    apiFetchRawMock.mockResolvedValue(okResponse());
    await requestTravelRecompute('t1', 1, { auto: true });
    window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId: 'OTHER' } }));
    const r = await requestTravelRecompute('t1', 1, { auto: true });
    expect(r).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
  });

  it('all-scope in-flight 時 day-scoped auto 跳過（不重複燒 quota）', async () => {
    const d = deferred();
    apiFetchRawMock.mockReturnValue(d.promise as Promise<unknown>);

    const pAll = requestTravelRecompute('t1'); // explicit all-trip in-flight
    const rAuto = await requestTravelRecompute('t1', 2, { auto: true });
    expect(rAuto).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

    d.resolve(okResponse());
    await pAll;
  });

  it('auto 失敗 → resolve null 不 reject（403 唯讀 / MAPS_LOCKED 靜默停）', async () => {
    apiFetchRawMock.mockResolvedValue(failResponse(403));
    const r = await requestTravelRecompute('t1', 1, { auto: true });
    expect(r).toBeNull();
    // 失敗後 attempted 保留 → 不重試
    const r2 = await requestTravelRecompute('t1', 1, { auto: true });
    expect(r2).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
  });
});
