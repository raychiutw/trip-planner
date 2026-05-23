/**
 * docKeys.ts — canonical trip doc type keys（v2.33.37 round 2 extract）
 *
 * 之前 `DOC_KEYS` 定在 `src/hooks/useTrip.ts`，但 `src/lib/tripExport.ts`
 * 也需要它。lib → hooks 是反向依賴（util layer 應為 leaf）。
 *
 * 拆到本檔後 hooks 與 lib 都從這裡取，沒有 React import。
 */

/**
 * 5 個 trip doc 類型 — 對應 D1 `trip_docs.doc_type` enum + UI tab 順序。
 * 與 backend `functions/api/trips/[id]/docs/[type].ts` `VALID_TYPES` 對齊。
 */
export const DOC_KEYS = ['flights', 'checklist', 'backup', 'emergency', 'suggestions'] as const;
export type DocKey = (typeof DOC_KEYS)[number];
