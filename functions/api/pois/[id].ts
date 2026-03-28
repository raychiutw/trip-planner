/**
 * PATCH /api/pois/:id — Admin only: fix factual errors in master POI (C2)
 * Only admin can edit pois master. Regular users override via trip_pois.
 */

import { logAudit, computeDiff } from '../_audit';
import { json, getAuth, parseJsonBody, buildUpdateClause } from '../_utils';
import type { Env } from '../_types';

const ALLOWED_FIELDS = [
  'name', 'description', 'note', 'address', 'phone', 'email', 'website',
  'hours', 'google_rating', 'category', 'maps', 'mapcode', 'lat', 'lng',
  'country', 'source',
] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);
  if (!auth.isAdmin) return json({ error: '僅管理者可修改 POI master' }, 403);

  const poiId = Number(context.params.id);
  if (!poiId || isNaN(poiId)) return json({ error: 'Invalid POI id' }, 400);

  const db = context.env.DB;
  const oldRow = await db.prepare('SELECT * FROM pois WHERE id = ?').bind(poiId).first();
  if (!oldRow) return json({ error: 'POI not found' }, 404);

  const bodyOrError = await parseJsonBody<Record<string, unknown>>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;

  const { clause, values } = buildUpdateClause(bodyOrError, ALLOWED_FIELDS as unknown as string[]);
  if (!clause) return json({ error: '無有效欄位可更新' }, 400);

  await db.prepare(`UPDATE pois SET ${clause}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...values, poiId).run();

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
