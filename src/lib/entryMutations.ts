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
import { apiFetchRaw } from './apiClient';
import { requestTravelRecompute } from './travelRecompute';
import { EVENT } from './events';

export type MutationResult<T = unknown> =
  | { ok: true; data: T; /** 車程重算是否成功；caller 可據此顯示 info toast。 */ recompute: Promise<boolean> }
  | { ok: false; status: number; message: string; /** 後端 error.code（STALE_ENTRY / DUPLICATE_POI…），caller 據此分流。 */ code?: string; /** 解析後的 error body（例：409 conflictWith）。 */ payload?: unknown };

type DayNum = number | string | null | undefined;

function emit(detail: { tripId: string; entryId?: number | string; dayNum?: DayNum }): void {
  const d: Record<string, unknown> = { tripId: detail.tripId };
  if (detail.entryId != null) d.entryId = detail.entryId;
  if (detail.dayNum != null) d.dayNum = detail.dayNum;
  window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: d }));
}

function recompute(tripId: string, dayNums: DayNum[]): Promise<boolean> {
  return Promise.all(dayNums.map((d) => requestTravelRecompute(tripId, d)))
    .then(() => true)
    .catch(() => false);
}

const NO_RECOMPUTE = Promise.resolve(true);

async function call<T>(
  path: string,
  init: RequestInit,
  after: { tripId: string; entryId?: number | string; dayNums: DayNum[]; recompute: boolean; entryIdFrom?: (data: T) => number | string | undefined },
): Promise<MutationResult<T>> {
  let res: Response;
  try {
    res = await apiFetchRaw(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...init });
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : String(err) };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let code: string | undefined;
    let message = text.slice(0, 200);
    let payload: unknown;
    try {
      const parsed = JSON.parse(text) as { error?: { code?: string; message?: string; detail?: string } | string };
      payload = parsed;
      if (parsed && typeof parsed.error === 'object') {
        code = parsed.error.code;
        message = parsed.error.message ?? parsed.error.detail ?? message;
      } else if (typeof parsed?.error === 'string') {
        code = parsed.error;
      }
    } catch { /* 非 JSON body */ }
    // 失敗也 emit：LWW（未帶 version）不會 STALE 409，畫面 refetch resync。
    for (const dayNum of after.dayNums.length ? after.dayNums : [undefined]) emit({ tripId: after.tripId, entryId: after.entryId, dayNum });
    return { ok: false, status: res.status, message, code, payload };
  }
  let data = undefined as unknown as T;
  if (res.status !== 204) {
    try { data = (await res.json()) as T; } catch { /* 空 body 也算成功 */ }
  }
  const entryId = after.entryId ?? after.entryIdFrom?.(data);
  const rc = after.recompute ? recompute(after.tripId, after.dayNums) : NO_RECOMPUTE;
  // 先觸發 recompute 再 emit：listener 的 refetch 才看得到 in-flight 狀態。
  for (const dayNum of after.dayNums.length ? after.dayNums : [undefined]) emit({ tripId: after.tripId, entryId, dayNum });
  return { ok: true, data, recompute: rc };
}

const enc = encodeURIComponent;

/** POST /trips/:id/days/:n/entries —— 新增 entry（搜尋結果、自訂地點）。 */
export function createEntry(tripId: string, dayNum: DayNum, body: Record<string, unknown>): Promise<MutationResult<{ id?: number }>> {
  return call<{ id?: number }>(`/trips/${enc(tripId)}/days/${dayNum}/entries`, { method: 'POST', body: JSON.stringify(body) },
    { tripId, dayNums: [dayNum], recompute: true, entryIdFrom: (d) => d?.id });
}

/** PATCH /trips/:id/entries/:eid/master —— 備選升正選。 */
export function setMaster(tripId: string, entryId: number | string, dayNum: DayNum, poiId: number, entryPoisVersion?: number | string | null): Promise<MutationResult> {
  const body: Record<string, unknown> = { poiId };
  if (entryPoisVersion != null && entryPoisVersion !== '') body.entryPoisVersion = entryPoisVersion;
  return call(`/trips/${enc(tripId)}/entries/${entryId}/master`, { method: 'PATCH', body: JSON.stringify(body) },
    { tripId, entryId, dayNums: [dayNum], recompute: true });
}

/** DELETE /trips/:id/entries/:eid —— 刪除後新相鄰 pair 缺 segment，必重算。 */
export function deleteEntry(tripId: string, entryId: number | string, dayNum: DayNum): Promise<MutationResult> {
  return call(`/trips/${enc(tripId)}/entries/${entryId}`, { method: 'DELETE' },
    { tripId, entryId, dayNums: [dayNum], recompute: true });
}

/** PATCH /trips/:id/entries/:eid —— 時間／描述等 entry 欄位（同日）。 */
export function updateEntry<T = Record<string, unknown>>(tripId: string, entryId: number | string, dayNum: DayNum, body: Record<string, unknown>): Promise<MutationResult<T>> {
  return call<T>(`/trips/${enc(tripId)}/entries/${entryId}`, { method: 'PATCH', body: JSON.stringify(body) },
    { tripId, entryId, dayNums: [dayNum], recompute: true });
}

/** PATCH /trips/:id/entries/:eid { day_id } —— 跨天搬移：來源日與目標日都要重算。 */
export function moveEntry(tripId: string, entryId: number | string, to: { fromDayNum: DayNum; toDayNum: DayNum; toDayId: number; sortOrder?: number }): Promise<MutationResult> {
  const body: Record<string, unknown> = { day_id: to.toDayId };
  if (to.sortOrder !== undefined) body.sort_order = to.sortOrder;
  return call(`/trips/${enc(tripId)}/entries/${entryId}`, { method: 'PATCH', body: JSON.stringify(body) },
    { tripId, entryId, dayNums: to.fromDayNum === to.toDayNum ? [to.toDayNum] : [to.toDayNum, to.fromDayNum], recompute: true });
}

/** PATCH /trips/:id/entries/batch —— 拖拉重排整日。 */
export function reorderEntries(tripId: string, dayNum: DayNum, orderedIds: Array<number | string>): Promise<MutationResult> {
  const updates = orderedIds.map((id, idx) => ({ id, sort_order: idx }));
  return call(`/trips/${enc(tripId)}/entries/batch`, { method: 'PATCH', body: JSON.stringify({ updates }) },
    { tripId, dayNums: [dayNum], recompute: true });
}

/** PATCH /trips/:id/entries/:eid/pois/:poiId —— per-POI 備註／分類／訂位；不影響車程。 */
export function updateEntryPoi<T = Record<string, unknown>>(tripId: string, entryId: number | string, dayNum: DayNum, poiId: number, body: Record<string, unknown>): Promise<MutationResult<T>> {
  return call<T>(`/trips/${enc(tripId)}/entries/${entryId}/pois/${poiId}`, { method: 'PATCH', body: JSON.stringify(body) },
    { tripId, entryId, dayNums: [dayNum], recompute: false });
}

/** POST /trips/:id/entries/:eid/alternates —— 加備選（body 可帶 poiId 或搜尋結果 + entryPoisVersion）。不影響車程。 */
export function addAlternate(tripId: string, entryId: number | string, dayNum: DayNum, body: Record<string, unknown>): Promise<MutationResult> {
  return call(`/trips/${enc(tripId)}/entries/${entryId}/alternates`, { method: 'POST', body: JSON.stringify(body) },
    { tripId, entryId, dayNums: [dayNum], recompute: false });
}

/** DELETE /trips/:id/entries/:eid/alternates/:poiId —— 移除備選（OCC 用 query entryPoisVersion）。 */
export function removeAlternate(tripId: string, entryId: number | string, dayNum: DayNum, poiId: number, entryPoisVersion?: number | string | null): Promise<MutationResult> {
  const q = entryPoisVersion != null && entryPoisVersion !== '' ? `?entryPoisVersion=${enc(String(entryPoisVersion))}` : '';
  return call(`/trips/${enc(tripId)}/entries/${entryId}/alternates/${poiId}${q}`, { method: 'DELETE' },
    { tripId, entryId, dayNums: [dayNum], recompute: false });
}

/** PATCH /trips/:id/entries/:eid/alternates/reorder —— 備選排序。 */
export function reorderAlternates(tripId: string, entryId: number | string, dayNum: DayNum, order: number[], entryPoisVersion?: number | string | null): Promise<MutationResult> {
  return call(`/trips/${enc(tripId)}/entries/${entryId}/alternates/reorder`, { method: 'PATCH', body: JSON.stringify({ order, entryPoisVersion: entryPoisVersion ?? undefined }) },
    { tripId, entryId, dayNums: [dayNum], recompute: false });
}

/** PUT /trips/:id/entries/:eid/poi-id —— 置換正選為另一個 POI（搜尋結果／收藏／自訂）。 */
export function replaceMasterPoi(tripId: string, entryId: number | string, dayNum: DayNum, body: Record<string, unknown>): Promise<MutationResult> {
  return call(`/trips/${enc(tripId)}/entries/${entryId}/poi-id`, { method: 'PUT', body: JSON.stringify(body) },
    { tripId, entryId, dayNums: [dayNum], recompute: true });
}

/** POST /trips/:id/entries/:eid/copy —— 複製到目標天。只重算目標天。 */
export function copyEntry(tripId: string, entryId: number | string, to: { targetDayId: number; targetDayNum: DayNum }): Promise<MutationResult<{ id?: number }>> {
  return call<{ id?: number }>(`/trips/${enc(tripId)}/entries/${entryId}/copy`, { method: 'POST', body: JSON.stringify({ targetDayId: to.targetDayId }) },
    { tripId, entryId, dayNums: [to.targetDayNum], recompute: true });
}

/** PATCH /trips/:id/entries/batch 帶 day_id —— 跨天拖拉：來源日與目標日各重算一次。 */
export function moveEntriesBatch(tripId: string, updates: readonly object[], days: { fromDayNum: DayNum; toDayNum: DayNum }): Promise<MutationResult> {
  return call(`/trips/${enc(tripId)}/entries/batch`, { method: 'PATCH', body: JSON.stringify({ updates }) },
    { tripId, dayNums: days.fromDayNum == null || days.fromDayNum === days.toDayNum ? [days.toDayNum] : [days.toDayNum, days.fromDayNum], recompute: true });
}

/** POST /poi-favorites/:id/add-to-trip —— 收藏加入行程 fast-path（後端建 entry），同樣要重算該日。 */
export function addFavoriteToTrip(favoriteId: number | string, tripId: string, dayNum: DayNum, body: Record<string, unknown>): Promise<MutationResult<{ entryId?: number }>> {
  return call<{ entryId?: number }>(`/poi-favorites/${favoriteId}/add-to-trip`, { method: 'POST', body: JSON.stringify({ tripId, dayNum: Number(dayNum), ...body }) },
    { tripId, dayNums: [dayNum], recompute: true, entryIdFrom: (d) => d?.entryId });
}
