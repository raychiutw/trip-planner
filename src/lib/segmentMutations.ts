/** 手動 segment 寫入；兩個編輯入口共用 HTTP、結果與成功後刷新通知。 */
import { typedApiRaw } from './api/typed';
import { ApiError } from './errors';
import { EVENT } from './events';

/** 契約的 segments 寫入欄位（POST／PATCH 共用；型別由下面的 typedApiRaw 呼叫對契約檢查）。 */
export interface SegmentBody {
  mode?: 'driving' | 'walking' | 'transit';
  min?: number;
  submode?: string | null;
  noTravel?: boolean;
}

export async function saveSegment(
  tripId: string,
  target: { segmentId?: number; fromEntryId?: number; toEntryId?: number },
  body: SegmentBody,
  expectedVersion?: number,
): Promise<Record<string, unknown>> {
  const res = target.segmentId == null
    // 新增必帶 entry id；缺時欄位被 JSON 序列化丟棄、後端回 400（與舊行為相同）
    ? await typedApiRaw.post('/api/trips/{id}/segments', { path: { id: tripId }, body: { ...body, from_entry_id: target.fromEntryId as number, to_entry_id: target.toEntryId as number } })
    : await typedApiRaw.patch('/api/trips/{id}/segments/{sid}', { path: { id: tripId, sid: String(target.segmentId) }, body: { ...body, ...(expectedVersion === undefined ? {} : { expectedVersion }) } });
  if (!res.ok) throw ApiError.fromResult(res);
  // 2xx 但內容不是 JSON 物件時視為 {}（舊行為：json() 失敗落到 {}）
  const updated = (res.data && typeof res.data === 'object' ? res.data : {}) as Record<string, unknown>;
  window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, {
    detail: { tripId, segmentId: target.segmentId ?? updated.id },
  }));
  return updated;
}
