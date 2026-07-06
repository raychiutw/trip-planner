// @vitest-environment jsdom
/**
 * travelRecompute helper — 2026-07-06 車程重算缺口修正的核心防護
 *
 * 驗證：
 *   - single-flight：同 scope 併發 → 只打一次 API，共用同一 promise
 *   - day scope → ?day=N query；無 day / 無效 / <1 → 無 query（全 trip）
 *   - 成功 dispatch tp-segment-updated（觸發 useTripSegments refetch 閉環）
 *   - explicit 失敗 reject（caller 自己 toast）
 *   - auto 模式：gap signature 防重 — 同 signature 只試一次、signature 變化
 *     re-arm、unhealable gap 不受無關 mutation 影響
 *   - auto 模式：in-flight（同 key 或 all-scope）→ 記 signature 後跳過
 *   - auto 失敗 resolve null 不 reject；403 → 該 trip auto 全停（唯讀 viewer）
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

  it('day 收 string（route param）→ normalize 成 ?day=N；無效 string → 全 trip', async () => {
    apiFetchRawMock.mockResolvedValue(okResponse());
    await requestTravelRecompute('t1', '5');
    expect(apiFetchRawMock).toHaveBeenLastCalledWith(
      '/trips/t1/recompute-travel?day=5',
      expect.objectContaining({ method: 'POST' }),
    );
    await requestTravelRecompute('t2', 'abc');
    expect(apiFetchRawMock).toHaveBeenLastCalledWith(
      '/trips/t2/recompute-travel',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it("空字串 / 0 / 負數 day → 全 trip（後端 day 驗證要求 ≥1，?day=0 只會 400）", async () => {
    apiFetchRawMock.mockResolvedValue(okResponse());
    for (const bad of ['', 0, -1] as const) {
      apiFetchRawMock.mockClear();
      await requestTravelRecompute('t1', bad);
      expect(apiFetchRawMock).toHaveBeenLastCalledWith(
        '/trips/t1/recompute-travel',
        expect.objectContaining({ method: 'POST' }),
      );
    }
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

describe('requestTravelRecompute — auto 模式防護（gap signature）', () => {
  it('同 signature 第二次 auto → null 不打 API；signature 變化 → re-arm', async () => {
    apiFetchRawMock.mockResolvedValue(okResponse());

    const r1 = await requestTravelRecompute('t1', 1, { auto: true, signature: '1-2' });
    expect(r1?.pairsComputed).toBe(1);
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

    const r2 = await requestTravelRecompute('t1', 1, { auto: true, signature: '1-2' });
    expect(r2).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

    // adjacency 真的變了（新 mutation 產生不同缺口）→ signature 不同 → re-arm
    const r3 = await requestTravelRecompute('t1', 1, { auto: true, signature: '1-2,2-3' });
    expect(r3?.pairsComputed).toBe(1);
    expect(apiFetchRawMock).toHaveBeenCalledTimes(2);
  });

  it('unhealable gap（signature 不變）不受無關 mutation 影響 — entryUpdated 不 re-arm', async () => {
    apiFetchRawMock.mockResolvedValue(okResponse());
    await requestTravelRecompute('t1', 1, { auto: true, signature: '1-2' });
    // 改 note 等無關 mutation 會 dispatch entryUpdated — signature 防重不受影響
    window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId: 't1' } }));
    const r = await requestTravelRecompute('t1', 1, { auto: true, signature: '1-2' });
    expect(r).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
  });

  it('all-scope in-flight 時 day-scoped auto 跳過且記 signature（in-flight 即本次嘗試）', async () => {
    const d = deferred();
    apiFetchRawMock.mockReturnValue(d.promise as Promise<unknown>);

    const pAll = requestTravelRecompute('t1'); // explicit all-trip in-flight
    const rAuto = await requestTravelRecompute('t1', 2, { auto: true, signature: '9-10' });
    expect(rAuto).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

    d.resolve(okResponse());
    await pAll;

    // settle 後同 signature 再 auto → 已記 attempted → 不重打（perf review：
    // 防 refetch race 的一次性 duplicate）
    const rAgain = await requestTravelRecompute('t1', 2, { auto: true, signature: '9-10' });
    expect(rAgain).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
  });

  it('同 key explicit in-flight 時 auto 跳過 → auto 永不拿到會 reject 的 raw promise', async () => {
    const d = deferred();
    apiFetchRawMock.mockReturnValue(d.promise as Promise<unknown>);

    const pExplicit = requestTravelRecompute('t1', 3); // 同 day-scope explicit in-flight
    const rAuto = await requestTravelRecompute('t1', 3, { auto: true, signature: '5-6' });
    expect(rAuto).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

    // explicit 那發失敗 → 只有 explicit caller reject，auto 已 settle 為 null
    d.resolve(failResponse(500));
    await expect(pExplicit).rejects.toThrow('recompute-travel 500');
  });

  it('auto 失敗 → resolve null 不 reject；同 signature 不重試', async () => {
    apiFetchRawMock.mockResolvedValue(failResponse(500));
    const r = await requestTravelRecompute('t1', 1, { auto: true, signature: '1-2' });
    expect(r).toBeNull();
    const r2 = await requestTravelRecompute('t1', 1, { auto: true, signature: '1-2' });
    expect(r2).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
  });

  it('auto 收 403（唯讀 viewer）→ 該 trip auto 全停，連不同 scope/signature 都不再打', async () => {
    apiFetchRawMock.mockResolvedValue(failResponse(403));
    const r = await requestTravelRecompute('t1', 1, { auto: true, signature: '1-2' });
    expect(r).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

    // 不同 day、不同 signature — 一樣 skip（no-write trip）
    const r2 = await requestTravelRecompute('t1', 2, { auto: true, signature: '7-8' });
    expect(r2).toBeNull();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

    // 別的 trip 不受影響
    apiFetchRawMock.mockResolvedValue(okResponse());
    const r3 = await requestTravelRecompute('t2', 1, { auto: true, signature: '1-2' });
    expect(r3?.pairsComputed).toBe(1);
  });

  it('403 只停 auto — explicit（手動 ⚠）不受 noWrite flag 影響', async () => {
    apiFetchRawMock.mockResolvedValue(failResponse(403));
    await requestTravelRecompute('t1', 1, { auto: true, signature: '1-2' });
    // 手動重算仍會打（reject 給 caller toast）
    await expect(requestTravelRecompute('t1', 1)).rejects.toThrow('recompute-travel 403');
    expect(apiFetchRawMock).toHaveBeenCalledTimes(2);
  });
});
