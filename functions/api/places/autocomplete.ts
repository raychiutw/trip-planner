/**
 * POST /api/places/autocomplete — v2.31.94 custom-stop-location-picker
 *
 * Typeahead suggestions for /trip/:id/day/:n/add-custom-stop UI and
 * AddStopPage 自訂 tab. Wraps Google Places API (New) `/v1/places:autocomplete`.
 *
 * Body: { q: string (2-200), sessionToken: string, regionCode?: string }
 * Response: { predictions: Array<{ placeId, primaryText, secondaryText }> }
 *
 * Session token semantics per Google billing: caller (frontend hook) generates
 * a UUID per typeahead session, rotates on suggestion-pick / clear / unmount.
 * One Place Details follow-up call after pick = one billable session.
 *
 * Failure modes:
 *   - kill switch active → 503 MAPS_LOCKED (via assertGoogleAvailable)
 *   - GOOGLE_MAPS_API_KEY missing → 502 MAPS_UPSTREAM_FAILED
 *   - Google upstream 5xx / timeout / parse error → 502 MAPS_UPSTREAM_FAILED
 */
import { AppError } from '../_errors';
import { requireAuth } from '../_auth';
import { json, parseJsonBody } from '../_utils';
import { assertGoogleAvailable } from '../_maps_lock';
import { autocompletePlaces } from '../../../src/server/maps/google-client';
import type { Env } from '../_types';

interface AutocompleteBody {
  q?: unknown;
  sessionToken?: unknown;
  regionCode?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  requireAuth(context);

  const body = await parseJsonBody<AutocompleteBody>(context.request);

  const q = typeof body.q === 'string' ? body.q.trim() : '';
  if (!q || q.length < 2) {
    throw new AppError('DATA_VALIDATION', 'query (q) 至少 2 個字元');
  }
  if (q.length > 200) {
    throw new AppError('DATA_VALIDATION', 'query (q) 過長（max 200）');
  }

  if (typeof body.sessionToken !== 'string' || !body.sessionToken) {
    throw new AppError('DATA_VALIDATION', 'sessionToken 必填');
  }
  const sessionToken = body.sessionToken;

  const regionCode = typeof body.regionCode === 'string' && body.regionCode
    ? body.regionCode
    : undefined;

  const apiKey = context.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // Misconfiguration treated as upstream failure — operations sees 502 + alert.
    throw new AppError('MAPS_UPSTREAM_FAILED', 'GOOGLE_MAPS_API_KEY not configured');
  }

  await assertGoogleAvailable(context.env.DB);

  const predictions = await autocompletePlaces(apiKey, q, sessionToken, regionCode);

  return json({ predictions });
};
