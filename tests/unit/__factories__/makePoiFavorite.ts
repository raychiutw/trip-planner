/**
 * makePoiFavorite — POI favorite fixture aligned with /api/poi-favorites response.
 */
import type { PoiFavorite, PoiFavoriteUsage } from '../../../src/types/api';

export interface MakePoiFavoriteInput extends Partial<PoiFavorite> {
  usages?: Partial<PoiFavoriteUsage>[];
}

let favCounter = 0;

export function makePoiFavorite(input: MakePoiFavoriteInput = {}): PoiFavorite {
  favCounter += 1;
  return {
    id: favCounter,
    userId: input.userId ?? `user-uuid-${favCounter}`,
    poiId: input.poiId ?? 1000 + favCounter,
    favoritedAt: '2026-05-24T00:00:00.000Z',
    note: null,
    poiName: `POI Favorite ${favCounter}`,
    poiAddress: null,
    poiLat: 26.2125,
    poiLng: 127.6792,
    poiType: 'attraction',
    poiRating: null,
    ...input,
    usages: (input.usages ?? []).map((u, i) => ({
      tripId: `trip-${i + 1}`,
      tripName: `Trip ${i + 1}`,
      dayNum: null,
      dayDate: null,
      entryId: null,
      ...u,
    })) as PoiFavoriteUsage[],
  };
}
