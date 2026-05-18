/**
 * GET /api/places/resolve?placeId=...
 *
 * v2.31.94 custom-stop-location-picker: lightweight Place Details wrapper for
 * typeahead pick → map flyTo flow. Closes Google autocomplete session per
 * billing semantics — caller should rotate the sessionToken on the frontend
 * once this returns.
 *
 * Response: { placeId, lat, lng, name, address }
 *
 * Failures:
 *   - missing placeId → 400 DATA_VALIDATION
 *   - getPlaceDetails null (POI delisted) → 404 DATA_NOT_FOUND
 *   - kill switch / upstream → 503 MAPS_LOCKED / 502 MAPS_UPSTREAM_FAILED
 */
import { AppError } from '../_errors';
import { requireAuth } from '../_auth';
import { json } from '../_utils';
import { assertGoogleAvailable } from '../_maps_lock';
import { getPlaceDetails } from '../../../src/server/maps/google-client';
import type { Env } from '../_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  requireAuth(context);

  const url = new URL(context.request.url);
  const placeId = url.searchParams.get('placeId')?.trim();
  if (!placeId) {
    throw new AppError('DATA_VALIDATION', 'placeId 必填');
  }
  // v2.31.94: forward optional sessionToken so the autocomplete + this details
  // call count as one billable Google session, not two.
  const sessionToken = url.searchParams.get('sessionToken')?.trim() || undefined;

  const apiKey = context.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new AppError('MAPS_UPSTREAM_FAILED', 'GOOGLE_MAPS_API_KEY not configured');
  }

  await assertGoogleAvailable(context.env.DB);

  const details = await getPlaceDetails(apiKey, placeId, sessionToken);
  if (!details) {
    throw new AppError('DATA_NOT_FOUND', 'Google 找不到此景點');
  }

  return json({
    placeId: details.place_id,
    lat: details.lat,
    lng: details.lng,
    name: details.name,
    address: details.address,
  });
};
