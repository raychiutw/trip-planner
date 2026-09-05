/**
 * #1260 entry 變更 module —— 動詞 interface 回 Result；成功路徑固定 emit entryUpdated +
 * 以正確 day scope 觸發車程重算；失敗路徑 emit resync、不重算、不 throw。
 * 從 interface 進：mock apiFetchRaw 與 requestTravelRecompute，驗呼叫與事件。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiFetchRawMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({ apiFetchRaw: (...a: unknown[]) => apiFetchRawMock(...a) }));
const recomputeMock = vi.fn(() => Promise.resolve(null));
vi.mock('../../src/lib/travelRecompute', () => ({ requestTravelRecompute: (...a: unknown[]) => recomputeMock(...a) }));

import { setMaster, deleteEntry, updateEntry, reorderEntries, updateEntryPoi, moveEntry, createEntry, addAlternate, removeAlternate, reorderAlternates, replaceMasterPoi, copyEntry, moveEntriesBatch, addFavoriteToTrip } from '../../src/lib/entryMutations';
import { EVENT } from '../../src/lib/events';

function res(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function listen() {
  const events: Array<Record<string, unknown>> = [];
  const h = (e: Event) => events.push((e as CustomEvent).detail as Record<string, unknown>);
  window.addEventListener(EVENT.entryUpdated, h);
  return { events, off: () => window.removeEventListener(EVENT.entryUpdated, h) };
}

beforeEach(() => { apiFetchRawMock.mockReset(); recomputeMock.mockClear(); });

describe('setMaster', () => {
  it('PATCH /master → emit entryUpdated(tripId, entryId, dayNum) + recompute(tripId, dayNum)', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    const L = listen();
    const r = await setMaster('t1', 42, 3, 99);
    L.off();
    expect(r.ok).toBe(true);
    const [url, opts] = apiFetchRawMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/trips/t1/entries/42/master');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(String(opts.body))).toEqual({ poiId: 99 });
    expect(recomputeMock).toHaveBeenCalledWith('t1', 3);
    expect(L.events).toEqual([{ tripId: 't1', entryId: 42, dayNum: 3 }]);
  });

  it('4xx → ok:false 帶 status/message，emit resync，不重算，不 throw', async () => {
    apiFetchRawMock.mockResolvedValueOnce(new Response('bad', { status: 409 }));
    const L = listen();
    const r = await setMaster('t1', 42, 3, 99);
    L.off();
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(recomputeMock).not.toHaveBeenCalled();
    expect(L.events).toEqual([{ tripId: 't1', entryId: 42, dayNum: 3 }]);
  });

  it('網路例外 → ok:false status 0，不 throw', async () => {
    apiFetchRawMock.mockRejectedValueOnce(new Error('offline'));
    const r = await setMaster('t1', 42, 3, 99);
    expect(r).toMatchObject({ ok: false, status: 0, message: 'offline' });
  });
});

describe('deleteEntry', () => {
  it('DELETE /entries/:id → emit + recompute 同 day', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    const L = listen();
    const r = await deleteEntry('t1', 7, 2);
    L.off();
    expect(r.ok).toBe(true);
    expect((apiFetchRawMock.mock.calls[0] as [string, RequestInit])[1].method).toBe('DELETE');
    expect(recomputeMock).toHaveBeenCalledWith('t1', 2);
    expect(L.events).toEqual([{ tripId: 't1', entryId: 7, dayNum: 2 }]);
  });
});

describe('updateEntry（時間等欄位）', () => {
  it('PATCH /entries/:id body 原樣、成功回 data', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200, { id: 7, start_time: '09:00' }));
    const r = await updateEntry('t1', 7, 2, { start_time: '09:00' });
    expect(r).toMatchObject({ ok: true, data: { id: 7 } });
    expect(JSON.parse(String((apiFetchRawMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ start_time: '09:00' });
    expect(recomputeMock).toHaveBeenCalledWith('t1', 2);
  });
  it('recompute 失敗 → Result.recompute resolve false（caller 決定 info toast）', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200, {}));
    recomputeMock.mockRejectedValueOnce(new Error('403'));
    const r = await updateEntry('t1', 7, 2, { start_time: '09:00' });
    expect(r.ok && await r.recompute).toBe(false);
  });
});

describe('reorderEntries', () => {
  it('PATCH /entries/batch updates=[{id,sort_order}]，emit 帶 dayNum', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    const L = listen();
    const r = await reorderEntries('t1', 2, [30, 10, 20]);
    L.off();
    expect(r.ok).toBe(true);
    const [url, opts] = apiFetchRawMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/trips/t1/entries/batch');
    expect(JSON.parse(String(opts.body))).toEqual({ updates: [{ id: 30, sort_order: 0 }, { id: 10, sort_order: 1 }, { id: 20, sort_order: 2 }] });
    expect(recomputeMock).toHaveBeenCalledWith('t1', 2);
    expect(L.events).toEqual([{ tripId: 't1', dayNum: 2 }]);
  });
});

describe('updateEntryPoi（備註／分類／訂位，不動車程）', () => {
  it('PATCH /entries/:id/pois/:poiId → emit，不 recompute', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200, { note: 'x' }));
    const L = listen();
    const r = await updateEntryPoi('t1', 7, 2, 55, { note: 'x' });
    L.off();
    expect(r).toMatchObject({ ok: true, data: { note: 'x' } });
    expect((apiFetchRawMock.mock.calls[0] as [string])[0]).toBe('/trips/t1/entries/7/pois/55');
    expect(recomputeMock).not.toHaveBeenCalled();
    expect(L.events).toEqual([{ tripId: 't1', entryId: 7, dayNum: 2 }]);
  });
});

describe('moveEntry（跨天）', () => {
  it('PATCH day_id → 來源日與目標日各 recompute 一次，emit 兩個 day', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    const L = listen();
    const r = await moveEntry('t1', 7, { fromDayNum: 1, toDayNum: 3, toDayId: 300 });
    L.off();
    expect(r.ok).toBe(true);
    expect(JSON.parse(String((apiFetchRawMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ day_id: 300 });
    expect(recomputeMock.mock.calls).toEqual([['t1', 3], ['t1', 1]]);
    expect(L.events).toEqual([{ tripId: 't1', entryId: 7, dayNum: 3 }, { tripId: 't1', entryId: 7, dayNum: 1 }]);
  });
});

describe('createEntry', () => {
  it('POST /days/:n/entries → data.id、emit dayNum、recompute', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(201, { id: 88 }));
    const L = listen();
    const r = await createEntry('t1', 2, { name: 'X', lat: 1, lng: 2 });
    L.off();
    expect(r).toMatchObject({ ok: true, data: { id: 88 } });
    expect((apiFetchRawMock.mock.calls[0] as [string])[0]).toBe('/trips/t1/days/2/entries');
    expect(recomputeMock).toHaveBeenCalledWith('t1', 2);
    expect(L.events).toEqual([{ tripId: 't1', entryId: 88, dayNum: 2 }]);
  });
});

describe('#1261 新增動詞', () => {
  it('setMaster 帶 entryPoisVersion → body 含 OCC token；409 STALE_ENTRY → Result.code', async () => {
    apiFetchRawMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'STALE_ENTRY', message: '版本過期' } }), { status: 409 }));
    const r = await setMaster('t1', 42, 3, 99, '7');
    expect(JSON.parse(String((apiFetchRawMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ poiId: 99, entryPoisVersion: '7' });
    expect(r).toMatchObject({ ok: false, status: 409, code: 'STALE_ENTRY', message: '版本過期' });
  });

  it('addAlternate：POST /alternates，不重算；DUPLICATE_POI 進 code', async () => {
    apiFetchRawMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'DUPLICATE_POI' } }), { status: 409 }));
    const r = await addAlternate('t1', 42, null, { poiId: 5, entryPoisVersion: 1 });
    expect((apiFetchRawMock.mock.calls[0] as [string])[0]).toBe('/trips/t1/entries/42/alternates');
    expect(r).toMatchObject({ ok: false, code: 'DUPLICATE_POI' });
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it('removeAlternate：DELETE 帶 ?entryPoisVersion query；無 version 不帶', async () => {
    apiFetchRawMock.mockResolvedValue(res(200));
    await removeAlternate('t1', 42, 3, 5, 9);
    await removeAlternate('t1', 42, 3, 5, null);
    expect((apiFetchRawMock.mock.calls[0] as [string])[0]).toBe('/trips/t1/entries/42/alternates/5?entryPoisVersion=9');
    expect((apiFetchRawMock.mock.calls[1] as [string])[0]).toBe('/trips/t1/entries/42/alternates/5');
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it('reorderAlternates：PATCH /alternates/reorder { order, entryPoisVersion }', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    await reorderAlternates('t1', 42, 3, [5, 6], 2);
    const [url, opts] = apiFetchRawMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/trips/t1/entries/42/alternates/reorder');
    expect(JSON.parse(String(opts.body))).toEqual({ order: [5, 6], entryPoisVersion: 2 });
  });

  it('replaceMasterPoi：PUT /poi-id → 重算（dayNum null = 全行程 scope）', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    const r = await replaceMasterPoi('t1', 42, null, { poiId: 5 });
    expect(r.ok).toBe(true);
    expect((apiFetchRawMock.mock.calls[0] as [string, RequestInit])[1].method).toBe('PUT');
    expect(recomputeMock).toHaveBeenCalledWith('t1', null);
  });

  it('copyEntry：POST /copy 只重算目標天', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200, { id: 77 }));
    const r = await copyEntry('t1', 42, { targetDayId: 300, targetDayNum: 3 });
    expect(r).toMatchObject({ ok: true, data: { id: 77 } });
    expect(JSON.parse(String((apiFetchRawMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ targetDayId: 300 });
    expect(recomputeMock.mock.calls).toEqual([['t1', 3]]);
  });

  it('moveEntriesBatch：PATCH /entries/batch，來源日與目標日各重算一次、各 emit 一次', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    const L = listen();
    await moveEntriesBatch('t1', [{ id: 1, day_id: 300, sort_order: 0 }], { fromDayNum: 1, toDayNum: 3 });
    L.off();
    expect(recomputeMock.mock.calls).toEqual([['t1', 3], ['t1', 1]]);
    expect(L.events).toEqual([{ tripId: 't1', dayNum: 3 }, { tripId: 't1', dayNum: 1 }]);
  });

  it('addFavoriteToTrip：POST /poi-favorites/:id/add-to-trip，重算該日、emit 帶 entryId', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(201, { ok: true, entryId: 91 }));
    const L = listen();
    const r = await addFavoriteToTrip(12, 't1', 2, { startTime: '10:00', endTime: '11:00' });
    L.off();
    expect(r.ok).toBe(true);
    const [url, opts] = apiFetchRawMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/poi-favorites/12/add-to-trip');
    expect(JSON.parse(String(opts.body))).toEqual({ tripId: 't1', dayNum: 2, startTime: '10:00', endTime: '11:00' });
    expect(recomputeMock).toHaveBeenCalledWith('t1', 2);
    expect(L.events).toEqual([{ tripId: 't1', entryId: 91, dayNum: 2 }]);
  });
});
