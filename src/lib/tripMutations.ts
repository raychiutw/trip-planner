/**
 * 行程層級的變更 —— 封存／取消封存、刪除行程、刪除某一天。
 *
 * 與 entryMutations（entry 層）同一個慣例：呼叫 endpoint、把非 2xx 與網路例外轉成 Result（不 throw），
 * 成功後 emit `tripUpdated` 讓列表／行程頁 resync。不 toast、不導覽、不還原焦點 —— 那是 UI 的決定，
 * caller 拿 Result 自己做。使用者看到的錯誤文字（狀態碼 → 哪句話）屬於這裡的行為。
 *
 * 以前 TripsListPage（封存、刪除行程）與 EditTripPage（刪除某一天）各自走
 * 「fetch → 檢查 ok → 組錯誤訊息 → dispatchEvent」，儀式各抄一份。
 */
import { apiFetchRaw } from './apiClient';
import { EVENT } from './events';

export type TripResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

const enc = encodeURIComponent;

function emitTripUpdated(tripId: string): void {
  window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId } }));
}

/** 送出請求；非 2xx 用 messageFor(status, 解析後的 body) 組訊息；網路例外 → status 0。 */
async function call<T>(
  tripId: string,
  path: string,
  init: RequestInit,
  messageFor: (status: number, bodyText: string) => string,
  parse: (res: Response) => Promise<T>,
): Promise<TripResult<T>> {
  let res: Response;
  try {
    res = await apiFetchRaw(path, init);
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : String(err) };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, message: messageFor(res.status, text) };
  }
  const data = await parse(res);
  emitTripUpdated(tripId);
  return { ok: true, data };
}

const noData = async () => undefined;

/** 歸檔（archived=false → PUT）或取消歸檔（archived=true → DELETE）。 */
export function archiveTrip(tripId: string, currentlyArchived: boolean): Promise<TripResult> {
  return call(tripId, `/trips/${enc(tripId)}/archive`, { method: currentlyArchived ? 'DELETE' : 'PUT' },
    (status) => (status === 403 ? '只有行程擁有者能變更歸檔狀態。' : '更新歸檔狀態失敗，請再試一次。'),
    noData);
}

/** 刪除整個行程。 */
export function deleteTrip(tripId: string): Promise<TripResult> {
  return call(tripId, `/trips/${enc(tripId)}`, { method: 'DELETE' },
    (status) => (status === 403 ? '僅行程擁有者或管理者可刪除' : status === 404 ? '行程不存在' : '刪除失敗，請稍後再試'),
    noData);
}

/** 刪除某一天（連同當天 entries）。回傳被連帶刪掉的 entry 數。 */
export function deleteDay(tripId: string, dayNum: number): Promise<TripResult<{ removedEntryCount: number }>> {
  return call(tripId, `/trips/${enc(tripId)}/days/${dayNum}`, { method: 'DELETE', credentials: 'same-origin' },
    (_status, text) => {
      try {
        const message = (JSON.parse(text) as { error?: { message?: string } })?.error?.message;
        if (message) return message;
      } catch { /* 非 JSON body */ }
      return '刪除天數失敗，請稍後再試。';
    },
    async (res) => {
      const body = (await res.json().catch(() => ({}))) as { removedEntryCount?: number };
      return { removedEntryCount: body.removedEntryCount ?? 0 };
    });
}
