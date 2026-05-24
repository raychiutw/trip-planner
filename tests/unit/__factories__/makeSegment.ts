/**
 * makeSegment — trip_segments fixture.
 * Canonical shape: backend GET /api/trips/:id/segments response (deepCamel'd).
 */
import type { TripSegment } from '../../../src/hooks/useTripSegments';

export interface MakeSegmentInput extends Partial<TripSegment> {
  /** Helper: 提供 from + to entry id 不用每次寫 fromEntryId / toEntryId */
  from?: number;
  to?: number;
}

let segCounter = 0;

export function makeSegment(input: MakeSegmentInput = {}): TripSegment {
  segCounter += 1;
  const fromId = input.fromEntryId ?? input.from ?? segCounter;
  const toId = input.toEntryId ?? input.to ?? segCounter + 1;
  return {
    id: segCounter,
    tripId: 'trip-test-1',
    fromEntryId: fromId,
    toEntryId: toId,
    mode: 'driving',
    min: 10,
    distanceM: 5000,
    source: 'google',
    computedAt: Date.now(),
    updatedAt: Date.now(),
    ...input,
  };
}
