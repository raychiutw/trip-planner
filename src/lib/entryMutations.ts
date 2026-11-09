/**
 * entry 變更（#1260）—— 前端改動 entry 的動詞 module。
 *
 * 以前每個 UI 動作自己走「fetch → 檢查 ok → dispatchEvent → requestTravelRecompute → toast」，
 * 6 檔 14 處各抄一份且每份不同（2026-07-06 車程重算缺口就是某個 caller 漏一步）。
 * 現在儀式只寫在這裡：呼叫 endpoint、把 4xx/5xx 與網路例外轉成 Result（不 throw）、
 * 成功後 emit `entryUpdated` 並以正確 day scope 觸發車程重算（跨天兩個 day 各一次）；
 * 失敗時 emit `entryUpdated` 讓畫面 resync（既有 LWW 行為），不重算。
 *
 * 不 toast、不 navigate —— 那是 UI 的決定，caller 拿 Result 自己做。
 * 車程重算 helper 本身（single-flight / gap-signature / 403 停用）不在此，只是被呼叫。
 */
import type { paths } from '../api/schema';
import { typedApiRaw } from './api/typed';
import type { CrossDayMoveUpdate } from './crossDayMove';
import { requestTravelRecompute } from './travelRecompute';
import { EVENT } from './events';

export type MutationResult<T = unknown> =
  | { ok: true; data: T; /** 車程重算是否成功；caller 可據此顯示 info toast。 */ recompute: Promise<boolean>; /** 只重試失敗的車程 scope，不重送 entry 寫入。 */ retryRecompute: () => Promise<boolean> }
  | { ok: false; status: number; message: string; /** 後端 error.code（STALE_ENTRY / DUPLICATE_POI…），caller 據此分流。 */ code?: string; /** 解析後的 error body（例：409 conflictWith）。 */ payload?: unknown };

type DayNum = number | string | null | undefined;

/** typedApiRaw 結果的共同形狀（各端點的契約聯集都可指派進來）。 */
type RawResult = { ok: boolean; status: number; data?: unknown; error?: unknown };

/** 契約中 POST /days/:num/entries 的 JSON body 型別（source、poi_type 是列舉，打錯字編譯期就擋）。 */
export type CreateEntryBody = NonNullable<NonNullable<paths['/api/trips/{id}/days/{num}/entries']['post']['requestBody']>['content']['application/json']>;

function emit(detail: { tripId: string; entryId?: number | string; dayNum?: DayNum }): void {
  const d: Record<string, unknown> = { tripId: detail.tripId };
  if (detail.entryId != null) d.entryId = detail.entryId;
  if (detail.dayNum != null) d.dayNum = detail.dayNum;
  window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: d }));
}

function recompute(tripId: string, dayNums: DayNum[]): { initial: Promise<boolean>; retry: () => Promise<boolean> } {
  let pending = dayNums;
  const retry = async () => {
    const scopes = pending;
    const results = await Promise.allSettled(scopes.map((d) => requestTravelRecompute(tripId, d)));
    pending = scopes.filter((_, i) => {
      const result = results[i];
      return result?.status === 'rejected' || (result?.status === 'fulfilled' && !!result.value?.errorsDetail?.length);
    });
    return pending.length === 0;
  };
  return { initial: retry(), retry };
}

const NO_RECOMPUTE = Promise.resolve(true);

async function call<T>(
  send: () => Promise<RawResult>,
  after: { tripId: string; entryId?: number | string; dayNums: DayNum[]; recompute: boolean; entryIdFrom?: (data: T) => number | string | undefined },
): Promise<MutationResult<T>> {
  let res: RawResult;
  try {
    res = await send();
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : String(err) };
  }
  if (!res.ok) {
    // error 是已解析的 body：JSON → 物件；非 JSON → 原文字串；無內容 → undefined
    const error = res.error;
    let code: string | undefined;
    let payload: unknown;
    let message = error === undefined ? '' : (typeof error === 'string' ? error : JSON.stringify(error)).slice(0, 200);
    if (error !== null && typeof error === 'object') {
      payload = error;
      const e = (error as { error?: { code?: string; message?: string; detail?: string } | string }).error;
      if (e && typeof e === 'object') {
        code = e.code;
        message = e.message ?? e.detail ?? message;
      } else if (typeof e === 'string') {
        code = e;
      }
    }
    // 失敗也 emit：LWW（未帶 version）不會 STALE 409，畫面 refetch resync。
    for (const dayNum of after.dayNums.length ? after.dayNums : [undefined]) emit({ tripId: after.tripId, entryId: after.entryId, dayNum });
    return { ok: false, status: res.status, message, code, payload };
  }
  // 2xx 但 body 不是 JSON（空 body、閘道純文字）也算成功：data 不是物件就當 undefined
  const data = (res.data !== null && typeof res.data === 'object' ? res.data : undefined) as T;
  const entryId = after.entryId ?? after.entryIdFrom?.(data);
  const rc = after.recompute ? recompute(after.tripId, after.dayNums) : { initial: NO_RECOMPUTE, retry: () => NO_RECOMPUTE };
  // 先觸發 recompute 再 emit：listener 的 refetch 才看得到 in-flight 狀態。
  for (const dayNum of after.dayNums.length ? after.dayNums : [undefined]) emit({ tripId: after.tripId, entryId, dayNum });
  return { ok: true, data, recompute: rc.initial, retryRecompute: rc.retry };
}

const id = (v: number | string) => String(v);

/** POST /trips/:id/days/:n/entries —— 新增 entry（搜尋結果、自訂地點）。 */
export function createEntry(tripId: string, dayNum: DayNum, body: CreateEntryBody): Promise<MutationResult<{ id?: number }>> {
  return call<{ id?: number }>(() => typedApiRaw.post('/api/trips/{id}/days/{num}/entries', { path: { id: tripId, num: String(dayNum) }, body }),
    { tripId, dayNums: [dayNum], recompute: true, entryIdFrom: (d) => d?.id });
}

/** PATCH /trips/:id/entries/:eid/master —— 備選升正選。 */
export function setMaster(tripId: string, entryId: number | string, dayNum: DayNum, poiId: number, entryPoisVersion?: string | null): Promise<MutationResult> {
  return call(() => typedApiRaw.patch('/api/trips/{id}/entries/{eid}/master', {
    path: { id: tripId, eid: id(entryId) },
    body: { poiId, ...(entryPoisVersion != null && entryPoisVersion !== '' ? { entryPoisVersion } : {}) },
  }), { tripId, entryId, dayNums: [dayNum], recompute: true });
}

/** DELETE /trips/:id/entries/:eid —— 刪除後新相鄰 pair 缺 segment，必重算。 */
export function deleteEntry(tripId: string, entryId: number | string, dayNum: DayNum): Promise<MutationResult> {
  return call(() => typedApiRaw.delete('/api/trips/{id}/entries/{eid}', { path: { id: tripId, eid: id(entryId) } }),
    { tripId, entryId, dayNums: [dayNum], recompute: true });
}

/** PATCH /trips/:id/entries/:eid —— 時間／描述等 entry 欄位（同日）。 */
export function updateEntry<T = Record<string, unknown>>(tripId: string, entryId: number | string, dayNum: DayNum, body: Record<string, unknown>): Promise<MutationResult<T>> {
  return call<T>(() => typedApiRaw.patch('/api/trips/{id}/entries/{eid}', { path: { id: tripId, eid: id(entryId) }, body }),
    { tripId, entryId, dayNums: [dayNum], recompute: true });
}

/** PATCH /trips/:id/entries/:eid { day_id } —— 跨天搬移：來源日與目標日都要重算。 */
export function moveEntry(tripId: string, entryId: number | string, to: { fromDayNum: DayNum; toDayNum: DayNum; toDayId: number; sortOrder?: number; time?: { start: string; end: string } }): Promise<MutationResult> {
  const body: { day_id: number; sort_order?: number; start_time?: string; end_time?: string } = { day_id: to.toDayId };
  if (to.sortOrder !== undefined) body.sort_order = to.sortOrder;
  if (to.time) {
    body.start_time = to.time.start;
    body.end_time = to.time.end;
  }
  return call(() => typedApiRaw.patch('/api/trips/{id}/entries/{eid}', { path: { id: tripId, eid: id(entryId) }, body }),
    { tripId, entryId, dayNums: to.fromDayNum === to.toDayNum ? [to.toDayNum] : [to.toDayNum, to.fromDayNum], recompute: true });
}

/** PATCH /trips/:id/entries/batch —— 拖拉重排整日。 */
export function reorderEntries(tripId: string, dayNum: DayNum, orderedIds: number[]): Promise<MutationResult> {
  const updates = orderedIds.map((entryId, idx) => ({ id: entryId, sort_order: idx }));
  return call(() => typedApiRaw.patch('/api/trips/{id}/entries/batch', { path: { id: tripId }, body: { updates } }),
    { tripId, dayNums: [dayNum], recompute: true });
}

/** PATCH /trips/:id/entries/:eid/pois/:poiId —— per-POI 備註／分類／訂位；不影響車程。 */
export function updateEntryPoi<T = Record<string, unknown>>(tripId: string, entryId: number | string, dayNum: DayNum, poiId: number, body: Record<string, unknown>): Promise<MutationResult<T>> {
  return call<T>(() => typedApiRaw.patch('/api/trips/{id}/entries/{eid}/pois/{poiId}', { path: { id: tripId, eid: id(entryId), poiId: String(poiId) }, body }),
    { tripId, entryId, dayNums: [dayNum], recompute: false });
}

/** POST /trips/:id/entries/:eid/alternates —— 加備選（body 可帶 poiId 或搜尋結果 + entryPoisVersion）。不影響車程。 */
export function addAlternate(tripId: string, entryId: number | string, dayNum: DayNum, body: Record<string, unknown>): Promise<MutationResult> {
  return call(() => typedApiRaw.post('/api/trips/{id}/entries/{eid}/alternates', { path: { id: tripId, eid: id(entryId) }, body }),
    { tripId, entryId, dayNums: [dayNum], recompute: false });
}

/** DELETE /trips/:id/entries/:eid/alternates/:poiId —— 移除備選（OCC 用 query entryPoisVersion）。 */
export function removeAlternate(tripId: string, entryId: number | string, dayNum: DayNum, poiId: number, entryPoisVersion?: string | null): Promise<MutationResult> {
  const query = entryPoisVersion != null && entryPoisVersion !== '' ? { entryPoisVersion } : undefined;
  return call(() => typedApiRaw.delete('/api/trips/{id}/entries/{eid}/alternates/{poiId}', { path: { id: tripId, eid: id(entryId), poiId: String(poiId) }, query }),
    { tripId, entryId, dayNums: [dayNum], recompute: false });
}

/** PATCH /trips/:id/entries/:eid/alternates/reorder —— 備選排序。 */
export function reorderAlternates(tripId: string, entryId: number | string, dayNum: DayNum, order: number[], entryPoisVersion?: string | null): Promise<MutationResult> {
  return call(() => typedApiRaw.patch('/api/trips/{id}/entries/{eid}/alternates/reorder', { path: { id: tripId, eid: id(entryId) }, body: { order, entryPoisVersion: entryPoisVersion ?? undefined } }),
    { tripId, entryId, dayNums: [dayNum], recompute: false });
}

/** PUT /trips/:id/entries/:eid/poi-id —— 置換正選為另一個 POI（搜尋結果／收藏／自訂）。 */
export function replaceMasterPoi(tripId: string, entryId: number | string, dayNum: DayNum, body: Record<string, unknown>): Promise<MutationResult> {
  return call(() => typedApiRaw.put('/api/trips/{id}/entries/{eid}/poi-id', { path: { id: tripId, eid: id(entryId) }, body }),
    { tripId, entryId, dayNums: [dayNum], recompute: true });
}

/** POST /trips/:id/entries/:eid/copy —— 複製到目標天。只重算目標天。 */
export function copyEntry(tripId: string, entryId: number | string, to: { targetDayId: number; targetDayNum: DayNum; time?: { start: string; end: string } }): Promise<MutationResult<{ id?: number }>> {
  const body = { targetDayId: to.targetDayId, ...(to.time ? { time: `${to.time.start} - ${to.time.end}` } : {}) };
  return call<{ id?: number }>(() => typedApiRaw.post('/api/trips/{id}/entries/{eid}/copy', { path: { id: tripId, eid: id(entryId) }, body }),
    { tripId, entryId, dayNums: [to.targetDayNum], recompute: true });
}

/** PATCH /trips/:id/entries/batch 帶 day_id —— 跨天拖拉：來源日與目標日各重算一次。 */
export function moveEntriesBatch(tripId: string, updates: readonly CrossDayMoveUpdate[], days: { fromDayNum: DayNum; toDayNum: DayNum }): Promise<MutationResult> {
  return call(() => typedApiRaw.patch('/api/trips/{id}/entries/batch', { path: { id: tripId }, body: { updates: [...updates] } }),
    { tripId, dayNums: days.fromDayNum == null || days.fromDayNum === days.toDayNum ? [days.toDayNum] : [days.toDayNum, days.fromDayNum], recompute: true });
}

/** POST /poi-favorites/:id/add-to-trip —— 收藏加入行程 fast-path（後端建 entry），同樣要重算該日。startTime／endTime 後端必填。 */
export function addFavoriteToTrip(favoriteId: number | string, tripId: string, dayNum: DayNum, body: { startTime: string; endTime: string }): Promise<MutationResult<{ entryId?: number }>> {
  return call<{ entryId?: number }>(() => typedApiRaw.post('/api/poi-favorites/{id}/add-to-trip', { path: { id: id(favoriteId) }, body: { tripId, dayNum: Number(dayNum), ...body } }),
    { tripId, dayNums: [dayNum], recompute: true, entryIdFrom: (d) => d?.entryId });
}
