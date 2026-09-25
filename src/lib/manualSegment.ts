import { apiFetchRaw } from './apiClient';
import { EVENT } from './events';
import { captureSegmentScope } from './segmentScope';

interface ManualSegmentWrite {
  tripId: string;
  segmentId?: number;
  fromEntryId?: number;
  toEntryId?: number;
  body: Record<string, unknown>;
  expectedVersion?: number;
}

/** Keep the write and its visible refresh in the same trip lifetime. */
export async function saveManualSegment({ tripId, segmentId, fromEntryId, toEntryId, body, expectedVersion }: ManualSegmentWrite) {
  const isCurrent = captureSegmentScope(tripId);
  const create = segmentId == null;
  const payload = create
    ? { ...body, from_entry_id: fromEntryId, to_entry_id: toEntryId }
    : typeof expectedVersion === 'number' ? { ...body, expectedVersion } : body;
  const response = await apiFetchRaw(
    create ? `/trips/${encodeURIComponent(tripId)}/segments` : `/trips/${encodeURIComponent(tripId)}/segments/${segmentId}`,
    { method: create ? 'POST' : 'PATCH', body: JSON.stringify(payload) },
  );
  if (response.ok && isCurrent()) {
    window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, { detail: { tripId, segmentId } }));
  }
  return { response, isCurrent };
}
