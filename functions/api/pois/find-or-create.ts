/**
 * POST /api/pois/find-or-create
 *
 * Takes POI data (from Nominatim search result or manual form), upserts into
 * `pois` table via shared findOrCreatePoi helper, returns the poi id.
 *
 * Used by /explore save button flow: search → pick → find-or-create → saved-pois POST.
 */
import { AppError } from '../_errors';
import { requireAuth } from '../_auth';
import { json, parseJsonBody } from '../_utils';
import { findOrCreatePoi, type FindOrCreatePoiData } from '../_poi';
import type { Env } from '../_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  requireAuth(context);

  const body = await parseJsonBody<Partial<FindOrCreatePoiData>>(context.request);

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    throw new AppError('DATA_VALIDATION', '缺少或無效的 name');
  }
  if (!body.type || typeof body.type !== 'string') {
    throw new AppError('DATA_VALIDATION', '缺少或無效的 type');
  }

  const data: FindOrCreatePoiData = {
    name: body.name.trim(),
    type: body.type.trim(),
    description: body.description ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    address: body.address ?? null,
    category: body.category ?? null,
    source: body.source ?? 'user-explore',
    country: body.country ?? null,
  };

  const poiId = await findOrCreatePoi(context.env.DB, data);

  return json({ id: poiId });
};
