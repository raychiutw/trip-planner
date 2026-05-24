/**
 * makeEntry — shared timeline entry fixture.
 * Canonical shape: backend GET /api/trips/:id/days/:num response (deepCamel'd).
 */
import type { Entry, EntryPoiInfo, EntryPoiAlternate } from '../../../src/types/trip';

export interface MakeEntryInput extends Partial<Entry> {
  master?: Partial<EntryPoiInfo>;
  alternates?: Partial<EntryPoiAlternate>[];
}

let entryCounter = 0;
let poiCounter = 0;

function makePoiInfo(input: Partial<EntryPoiInfo> = {}): EntryPoiInfo {
  poiCounter += 1;
  return {
    poiId: 1000 + poiCounter,
    name: `Test POI ${poiCounter}`,
    lat: 26.2125,
    lng: 127.6792,
    type: 'attraction',
    category: 'tourist_attraction',
    hours: null,
    rating: null,
    price: null,
    reservation: null,
    reservationUrl: null,
    description: null,
    note: null,
    ...input,
  };
}

export function makeStopPoi(
  sortOrder: number,
  input: Partial<EntryPoiAlternate> = {},
): EntryPoiAlternate {
  return {
    sortOrder,
    ...makePoiInfo(input),
  } as EntryPoiAlternate;
}

export function makeEntry(input: MakeEntryInput = {}): Entry {
  entryCounter += 1;
  const id = input.id ?? entryCounter;
  const master = input.master ? makePoiInfo(input.master) : makePoiInfo({ name: `Stop ${entryCounter}` });
  const alternates = (input.alternates ?? []).map((alt, i) => ({
    sortOrder: i + 2,
    ...makePoiInfo(alt),
  })) as EntryPoiAlternate[];
  return {
    id,
    dayId: 1,
    sortOrder: entryCounter,
    time: null,
    startTime: null,
    endTime: null,
    title: master.name ?? `Stop ${entryCounter}`,
    description: null,
    source: 'ai',
    note: null,
    travel: null,
    master,
    alternates,
    stopPois: [
      { sortOrder: 1, ...master } as EntryPoiAlternate,
      ...alternates,
    ],
    entryPoisVersion: '1',
    updatedAt: '2026-05-24T00:00:00.000Z',
    shopping: [],
    ...input,
  };
}
