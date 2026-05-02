/**
 * mapsUrl — build map URLs for Google / Apple / Naver from a POI.
 *
 * Replaces the old `pois.maps` column (dropped in migration 0045) with a
 * derive-on-render helper. Same POI can launch any of three map apps; the
 * URL is generated client-side from name + lat/lng without storing a
 * vendor-specific URL in the DB.
 *
 * Used by MapsButtonGroup (src/components/shared/MapsButtonGroup.tsx).
 *
 * URL conventions:
 *   - Google Maps: prefer lat,lng (precise). Fall back to ?q=name+address.
 *   - Apple Maps:  ?ll=lat,lng + ?q=name (label). Fall back to ?q=...
 *   - Naver Map :  no documented coordinate URL; use keyword search.
 */

export type MapProvider = 'google' | 'apple' | 'naver';

export interface MapsUrlInput {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export function buildMapsUrl(poi: MapsUrlInput, provider: MapProvider = 'google'): string {
  const label = encodeURIComponent([poi.name, poi.address].filter(Boolean).join(' ').trim());
  const hasCoords = isFiniteNum(poi.lat) && isFiniteNum(poi.lng);
  const ll = hasCoords ? `${poi.lat},${poi.lng}` : '';

  switch (provider) {
    case 'google':
      // Google maps `query=lat,lng` opens drop-pin with reverse-geocoded label.
      // Without coords, `query=name+address` does keyword search.
      return ll
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ll)}`
        : `https://www.google.com/maps/search/?api=1&query=${label}`;
    case 'apple':
      // Apple Maps URL Scheme: ll= sets center, q= sets search/label pin.
      return ll
        ? `https://maps.apple.com/?ll=${encodeURIComponent(ll)}&q=${label}`
        : `https://maps.apple.com/?q=${label}`;
    case 'naver':
      // Naver lacks documented coordinate URL — fall back to keyword search.
      return `https://map.naver.com/v5/search/${label}`;
  }
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
