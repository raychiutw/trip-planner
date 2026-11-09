/**
 * 行程層級的變更 —— 封存／取消封存、刪除行程、刪除某一天。
 *
 * 與 entryMutations（entry 層）同一個慣例：呼叫 endpoint、把非 2xx 與網路例外轉成 Result（不 throw），
 * 成功後 emit `tripUpdated` 讓列表／行程頁 resync。不 toast、不導覽、不還原焦點 —— 那是 UI 的決定，
 * caller 拿 Result 自己做。使用者看到的錯誤文字（狀態碼 → 哪句話）屬於這裡的行為。
 *
 * 時序：`tripUpdated` 在 HTTP 成功後立刻 emit（早於 caller 自己的 refetch）。deleteDay 以前是 refetchDays 之後才 emit；
 * 現在兩者並行，因為 listener（useMyTrips）只是重新抓清單、與天數資料無關，不影響正確性。
 *
 * 以前 TripsListPage（封存、刪除行程）與 EditTripPage（刪除某一天）各自走
 * 「fetch → 檢查 ok → 組錯誤訊息 → dispatchEvent」，儀式各抄一份。
 */
import { apiErrorMessage, typedApiRaw } from './api/typed';
import { EVENT } from './events';

export type TripResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

/** typedApiRaw 結果的共同形狀（各端點的契約聯集都可指派進來）。 */
type RawResult = { ok: boolean; status: number; data?: unknown; error?: unknown };

function emitTripUpdated(tripId: string): void {
  window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId } }));
}

/** 送出請求；非 2xx 用 messageFor(status, 已解析的 error body) 組訊息；網路例外 → status 0。 */
async function call<T>(
  tripId: string,
  send: () => Promise<RawResult>,
  messageFor: (status: number, error: unknown) => string,
  parse: (data: unknown) => T,
): Promise<TripResult<T>> {
  let res: RawResult;
  try {
    res = await send();
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : String(err) };
  }
  if (!res.ok) return { ok: false, status: res.status, message: messageFor(res.status, res.error) };
  const data = parse(res.data);
  emitTripUpdated(tripId);
  return { ok: true, data };
}

const noData = () => undefined;

const archiveMessage = (status: number) => (status === 403 ? '只有行程擁有者能變更歸檔狀態。' : '更新歸檔狀態失敗，請再試一次。');

/** 歸檔（PUT /trips/:id/archive）。 */
export function archiveTrip(tripId: string): Promise<TripResult> {
  return call(tripId, () => typedApiRaw.put('/api/trips/{id}/archive', { path: { id: tripId } }), archiveMessage, noData);
}

/** 取消歸檔（DELETE /trips/:id/archive）。 */
export function unarchiveTrip(tripId: string): Promise<TripResult> {
  return call(tripId, () => typedApiRaw.delete('/api/trips/{id}/archive', { path: { id: tripId } }), archiveMessage, noData);
}

/** 刪除整個行程。 */
export function deleteTrip(tripId: string): Promise<TripResult> {
  return call(tripId, () => typedApiRaw.delete('/api/trips/{id}', { path: { id: tripId } }),
    (status) => (status === 403 ? '僅行程擁有者或管理者可刪除' : status === 404 ? '行程不存在' : '刪除失敗，請稍後再試'),
    noData);
}

/** 刪除某一天（連同當天 entries）。回傳被連帶刪掉的 entry 數。 */
export function deleteDay(tripId: string, dayNum: number): Promise<TripResult<{ removedEntryCount: number }>> {
  return call(tripId, () => typedApiRaw.delete('/api/trips/{id}/days/{num}', { path: { id: tripId, num: String(dayNum) } }),
    (_status, error) => apiErrorMessage(error, '刪除天數失敗，請稍後再試。'),
    // 2xx 但 body 不是 JSON：後端已刪除，不能誤報失敗 → 數量 0
    (data) => {
      const body = (data && typeof data === 'object' ? data : {}) as { removedEntryCount?: number };
      return { removedEntryCount: body.removedEntryCount ?? 0 };
    });
}
