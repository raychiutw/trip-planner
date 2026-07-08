/**
 * Centralized window CustomEvent names — dispatch / listen sites share one source.
 *
 * Why: ~37 dispatch / listener sites previously used string literals, with no
 * compile-time check that a typo on the dispatcher matches the listener.
 *
 * Each entry below names the event + payload contract observed in dispatch sites.
 * Listeners read `(event as CustomEvent).detail` per the contract.
 */

export const EVENT = {
  /** dispatch detail: `{ tripId, entryId?, dayNum?, segmentId? }` — entry created, edited, deleted, moved, or master/alts changed. */
  entryUpdated: 'tp-entry-updated',
  /** dispatch detail: `{ tripId, segmentId? }` — travel segment mode / min / source changed. */
  segmentUpdated: 'tp-segment-updated',
  /** dispatch detail: `{ tripId }` — trip metadata edit (PUT /trips/:id). */
  tripUpdated: 'tp-trip-updated',
  /** dispatch detail: `{ tripId }` — trip just created (NewTripPage success). */
  tripCreated: 'tp-trip-created',
  /** no detail — developer console app just created (DeveloperAppNewPage success). */
  developerAppCreated: 'tp-developer-app-created',
  /** v2.31.81 #5：dispatch detail `{ entryId: number }` — TimelineRail row 點下去
   *  時觸發，TripMapRail listen 後 panTo + zoom 到該 entry pin。跨檔互動避免
   *  TimelineRail 直接 import map ref。 */
  entryFocused: 'tp-entry-focused',
  /** dispatch detail: `{ tripId }` — auto 車程重算終端失敗（403 唯讀 viewer /
   *  持續 API 錯，本 signature 不再重試）。TimelineRail 監聽 → re-render 讓
   *  TravelPill 由「重新計算中」改顯「待更新」。 */
  segmentRecomputeFailed: 'tp-segment-recompute-failed',
} as const;

export type EventName = typeof EVENT[keyof typeof EVENT];
