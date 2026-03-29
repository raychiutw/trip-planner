/**
 * PATCH /api/pois/:id — Admin only: fix factual errors in master POI (C2)
 * Only admin can edit pois master. Regular users override via trip_pois.
 */

import { logAudit, computeDiff } from '../_audit';
import { AppError } from '../_errors';
import { json, getAuth, parseJsonBody, buildUpdateClause } from '../_utils';
import type { Env } from '../_types';

const ALLOWED_FIELDS = [
  'name', 'description', 'note', 'address', 'phone', 'email', 'website',
  'hours', 'google_rating', 'category', 'maps', 'mapcode', 'lat', 'lng',
  'country', 'source',
] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  if (!auth.isAdmin) throw new AppError('PERM_ADMIN_ONLY');

  const poiId = Number(context.params.id);
  if (!poiId || isNaN(poiId)) throw new AppError('DATA_VALIDATION', 'Invalid POI id');

  const db = context.env.DB;
  const oldRow = await db.prepare('SELECT * FROM pois WHERE id = ?').bind(poiId).first();
  if (!oldRow) throw new AppError('DATA_NOT_FOUND', 'POI not found');

  const bodyOrError = await parseJsonBody<Record<string, unknown>>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;

  const update = buildUpdateClause(bodyOrError, ALLOWED_FIELDS as unknown as string[]);
  if (!update) throw new AppError('DATA_VALIDATION', '無有效欄位可更新');

  await db.prepare(`UPDATE pois SET ${update.setClauses} WHERE id = ?`)
    .bind(...update.values, poiId).run();

  const newRow = await db.prepare('SELECT * FROM pois WHERE id = ?').bind(poiId).first();
  const diffJson = computeDiff(oldRow as Record<string, unknown>, newRow as Record<string, unknown>);

  await logAudit(db, {
    tripId: 'global',
    tableName: 'pois',
    recordId: poiId,
    action: 'update',
    changedBy: auth.email,
    diffJson,
  });

  return json(newRow);
};
