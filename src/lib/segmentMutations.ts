/** 手動 segment 寫入；兩個編輯入口共用 HTTP、結果與成功後刷新通知。 */
import { apiFetchRaw } from './apiClient';
import { ApiError } from './errors';
import { EVENT } from './events';

export async function saveSegment(
  tripId: string,
  target: { segmentId?: number; fromEntryId?: number; toEntryId?: number },
  body: Record<string, unknown>,
  expectedVersion?: number,
): Promise<Record<string, unknown>> {
  const create = target.segmentId == null;
  const payload = create
    ? { ...body, from_entry_id: target.fromEntryId, to_entry_id: target.toEntryId }
    : { ...body, ...(expectedVersion === undefined ? {} : { expectedVersion }) };
  const path = `/trips/${encodeURIComponent(tripId)}/segments${create ? '' : `/${target.segmentId}`}`;
  const res = await apiFetchRaw(path, { method: create ? 'POST' : 'PATCH', body: JSON.stringify(payload) });
  if (!res.ok) throw await ApiError.fromResponse(res);
  const updated = await res.json?.().catch(() => ({})) as Record<string, unknown> | undefined ?? {};
  window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, {
    detail: { tripId, segmentId: target.segmentId ?? updated.id },
  }));
  return updated;
}
