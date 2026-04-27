/**
 * Demote strategy — drag entry → Ideas section 的 API orchestration。
 *
 * Spec: openspec/changes/ideas-drag-to-itinerary/specs/drag-to-reorder/spec.md
 *   "Entry 拖回 Ideas 觸發 demote"。
 *
 * 兩種 entry 來源：
 *   1. promoted entry（idea 曾被 drag → entry）→ DELETE entry + PATCH
 *      idea { promotedToEntryId: null } 還原 ideas list 中的原 idea
 *   2. native entry（直接建的 trip_entries，無對應 idea）→ DELETE entry +
 *      POST /trip-ideas 建新 idea，保留 poi_id / title / note
 *
 * 純函式接 fetcher 注入，可單元測試。實作 cross-component drag 啟動時由
 * TimelineRail/IdeasTabContent 在 dropEnd handler 呼叫。
 */

export interface DemoteEntryInput {
  tripId: string;
  entryId: number;
  /** Promote 來源 idea id；無則代表 native entry，需 POST 建新 idea */
  sourceIdeaId?: number | null;
  /** 建新 idea 用的欄位（sourceIdeaId 缺時必帶 title） */
  title?: string | null;
  poiId?: number | null;
  note?: string | null;
}

export interface DemoteApi {
  deleteEntry(tripId: string, entryId: number): Promise<void>;
  clearPromotedIdea(ideaId: number): Promise<void>;
  createIdea(input: { tripId: string; title: string; poiId?: number | null; note?: string | null }): Promise<void>;
}

export class DemoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoteValidationError';
  }
}

export async function demoteEntry(input: DemoteEntryInput, api: DemoteApi): Promise<void> {
  if (!input.tripId) throw new DemoteValidationError('tripId 必填');
  if (!Number.isInteger(input.entryId) || input.entryId <= 0) {
    throw new DemoteValidationError('entryId 必須是正整數');
  }

  if (input.sourceIdeaId != null) {
    await api.deleteEntry(input.tripId, input.entryId);
    await api.clearPromotedIdea(input.sourceIdeaId);
    return;
  }

  const title = input.title?.trim();
  if (!title) {
    throw new DemoteValidationError('native entry 需提供 title 才能 demote 為 idea');
  }
  await api.deleteEntry(input.tripId, input.entryId);
  await api.createIdea({
    tripId: input.tripId,
    title,
    poiId: input.poiId ?? null,
    note: input.note ?? null,
  });
}
