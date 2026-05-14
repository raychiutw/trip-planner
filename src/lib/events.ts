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
} as const;

export type EventName = typeof EVENT[keyof typeof EVENT];
