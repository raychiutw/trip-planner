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
  it('選擇時段時將起訖時間與目標日一併寫入', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    await moveEntry('t1', 7, { fromDayNum: 1, toDayNum: 3, toDayId: 300, time: { start: '12:00', end: '13:30' } });
    expect(JSON.parse(String((apiFetchRawMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ day_id: 300, start_time: '12:00', end_time: '13:30' });
  });

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

  it('寫入成功但目標日車程失敗時，只重試未完成 scope，不重送 PATCH', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    recomputeMock.mockRejectedValueOnce(new Error('target failed')).mockResolvedValue(null);
    const result = await moveEntry('t1', 7, { fromDayNum: 1, toDayNum: 3, toDayId: 300 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await result.recompute).toBe(false);
    expect(await result.retryRecompute()).toBe(true);
    expect(recomputeMock.mock.calls).toEqual([['t1', 3], ['t1', 1], ['t1', 3]]);
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
  });

  it('交通 API 回 200 但仍有未完成 pair 時，該日期可重試', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    recomputeMock.mockResolvedValueOnce({ errorsDetail: [{ entryId: 7, message: 'Google error' }] }).mockResolvedValue(null);
    const result = await copyEntry('t1', 7, { targetDayId: 300, targetDayNum: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await result.recompute).toBe(false);
    expect(await result.retryRecompute()).toBe(true);
    expect(recomputeMock).toHaveBeenCalledTimes(2);
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
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

  it('copyEntry 選擇時段時傳給現有 copy endpoint', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(200));
    await copyEntry('t1', 42, { targetDayId: 300, targetDayNum: 3, time: { start: '09:00', end: '11:30' } });
    expect(JSON.parse(String((apiFetchRawMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ targetDayId: 300, time: '09:00 - 11:30' });
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

describe('錯誤 body 的對外形狀（遷移 typedApiRaw 前後一致）', () => {
  it('空 body 的 5xx → message 空字串、無 code／payload，仍 emit resync', async () => {
    apiFetchRawMock.mockResolvedValueOnce(new Response(null, { status: 502 }));
    const L = listen();
    const r = await deleteEntry('t1', 7, 2);
    L.off();
    expect(r).toEqual({ ok: false, status: 502, message: '', code: undefined, payload: undefined });
    expect(L.events).toEqual([{ tripId: 't1', entryId: 7, dayNum: 2 }]);
  });

  it('非 JSON 文字 body → message 取前 200 字、無 code／payload', async () => {
    apiFetchRawMock.mockResolvedValueOnce(new Response('x'.repeat(300), { status: 500 }));
    const r = await deleteEntry('t1', 7, 2);
    expect(r).toEqual({ ok: false, status: 500, message: 'x'.repeat(200), code: undefined, payload: undefined });
  });

  it('error 為字串（{ error: "STALE_ENTRY" }）→ code 取該字串、message 空、payload 為整個 body', async () => {
    apiFetchRawMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'STALE_ENTRY' }), { status: 409 }));
    const r = await deleteEntry('t1', 7, 2);
    expect(r).toEqual({ ok: false, status: 409, message: '{"error":"STALE_ENTRY"}', code: 'STALE_ENTRY', payload: { error: 'STALE_ENTRY' } });
  });

  it('409 帶 conflictWith → payload 原樣保留，message 退到 detail', async () => {
    const body = { error: { code: 'TIME_CONFLICT', detail: '時段衝突' }, conflictWith: { entryId: 3 } };
    apiFetchRawMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 409 }));
    const r = await deleteEntry('t1', 7, 2);
    expect(r).toEqual({ ok: false, status: 409, message: '時段衝突', code: 'TIME_CONFLICT', payload: body });
  });

  it('2xx 但 body 不是 JSON → 仍算成功（data undefined），照常 emit 與重算', async () => {
    apiFetchRawMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const L = listen();
    const r = await deleteEntry('t1', 7, 2);
    L.off();
    expect(r.ok).toBe(true);
    expect(recomputeMock).toHaveBeenCalledWith('t1', 2);
    expect(L.events).toEqual([{ tripId: 't1', entryId: 7, dayNum: 2 }]);
  });

  it('204 無內容 → 成功', async () => {
    apiFetchRawMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect((await deleteEntry('t1', 7, 2)).ok).toBe(true);
  });

  it('dayNum 為 null 時路徑維持 /days/null/entries、emit 不帶 dayNum', async () => {
    apiFetchRawMock.mockResolvedValueOnce(res(201, { id: 1 }));
    const L = listen();
    await createEntry('t1', null, { name: 'X' });
    L.off();
    expect((apiFetchRawMock.mock.calls[0] as [string])[0]).toBe('/trips/t1/days/null/entries');
    expect(L.events).toEqual([{ tripId: 't1', entryId: 1 }]);
  });
});
