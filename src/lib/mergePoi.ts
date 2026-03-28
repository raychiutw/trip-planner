/**
 * Merges a pois master row with trip_pois override row.
 * Convention: NULL in trip_pois = inherit from master (C4).
 *
 * The API returns a single row from:
 *   SELECT p.*, tp.id AS trip_poi_id, tp.description AS tp_description, ...
 * This function merges them into a flat MergedPoi.
 */

import type { MergedPoi } from '../types/trip';

/**
 * Merge a raw API row (pois JOIN trip_pois) into a MergedPoi.
 * Fields with `tp_` prefix override the master value when non-null.
 */
export function mergePoi(row: Record<string, unknown>): MergedPoi {
  return {
    // POI master fields
    id: row.id as number,
    type: row.type as MergedPoi['type'],
    name: (row.name as string) || '',
    description: (row.tp_description ?? row.description) as string | null,
    note: (row.tp_note ?? row.note) as string | null,
    address: (row.address as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    website: (row.website as string) ?? null,
    hours: (row.tp_hours ?? row.hours) as string | null,
    googleRating: (row.google_rating ?? row.googleRating) as number | null,
    category: (row.category as string) ?? null,
    maps: (row.maps as string) ?? null,
    mapcode: (row.mapcode as string) ?? null,
    lat: (row.lat as number) ?? null,
    lng: (row.lng as number) ?? null,
    country: (row.country as string) ?? null,
    source: (row.source as string) ?? null,

    // trip_pois fields
    tripPoiId: row.trip_poi_id as number,
    context: row.context as MergedPoi['context'],
    sortOrder: (row.sort_order as number) ?? 0,
    dayId: (row.day_id as number) ?? null,
    entryId: (row.entry_id as number) ?? null,

    // Hotel-specific (flattened in trip_pois)
    checkout: (row.checkout as string) ?? null,
    breakfastIncluded: (row.breakfast_included as number) ?? null,
    breakfastNote: (row.breakfast_note as string) ?? null,

    // Restaurant-specific
    price: (row.price as string) ?? null,
    reservation: (row.reservation as string) ?? null,
    reservationUrl: (row.reservation_url ?? row.reservationUrl) as string | null,

    // Shopping-specific
    mustBuy: (row.must_buy ?? row.mustBuy) as string | null,
  };
}
