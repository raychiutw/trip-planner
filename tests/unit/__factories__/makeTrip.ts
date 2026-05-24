/**
 * makeTrip / makeTripListItem — shared trip fixture builder.
 *
 * Canonical shape: backend GET /api/trips/:id response (deepCamel'd).
 * 對齊 src/types/trip.ts Trip + TripListItem。
 */
import type { Trip, TripListItem, TripDestination } from '../../../src/types/trip';

export interface MakeTripInput extends Partial<Trip> {
  destinations?: Partial<TripDestination>[];
}

let counter = 0;

export function makeTrip(input: MakeTripInput = {}): Trip {
  counter += 1;
  const id = input.id ?? input.tripId ?? `trip-test-${counter}`;
  return {
    id,
    tripId: id,
    name: `Test Trip ${counter}`,
    owner: 'test-user@example.com',
    title: null,
    description: null,
    countries: 'JP',
    published: 0,
    dataSource: 'ai',
    lang: 'zh-TW',
    destinations: [],
    createdAt: '2026-05-24T00:00:00.000Z',
    updatedAt: '2026-05-24T00:00:00.000Z',
    ...input,
    destinations: (input.destinations ?? []).map((d, i) => ({
      destOrder: i + 1,
      name: `Destination ${i + 1}`,
      lat: null,
      lng: null,
      dayQuota: null,
      subAreas: null,
      ...d,
    })) as TripDestination[],
  };
}

export function makeTripListItem(input: Partial<TripListItem> = {}): TripListItem {
  counter += 1;
  const id = input.tripId ?? `trip-test-${counter}`;
  return {
    tripId: id,
    name: `Test Trip ${counter}`,
    owner: 'test-user@example.com',
    title: null,
    countries: 'JP',
    published: 0,
    dataSource: 'ai',
    lang: 'zh-TW',
    ...input,
  };
}
