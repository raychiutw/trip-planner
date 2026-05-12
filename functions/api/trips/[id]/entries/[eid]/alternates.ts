/**
 * POST /api/trips/:id/entries/:eid/alternates — 加 alternate POI
 *
 * Body:
 *   - poiId: number — alternate POI id（不可是現有 master 或已存在 alternate）
 *   - entryPoisVersion?: string — OCC token from prior GET; mismatch → 409 STALE_ENTRY
 *
 * Server 自動 assign sort_order = max + 1。
 * UNIQUE (entry_id, poi_id) 違反 → 409 DUPLICATE_POI。
 * Entry 無 master → 400 MISSING_MASTER（先設 master 再加 alternate）。
 */
import { logAudit } from '../../../../_audit';
import { hasWritePermission, verifyEntryBelongsToTrip } from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { addAlternate } from '../../../../_entry_pois';
import { json, getAuth, parseJsonBody, parseIntParam } from '../../../../_utils';
import type { Env } from '../../../../_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid: eidStr } = context.params as { id: string; eid: string };
  const eid = parseIntParam(eidStr);
  if (!eid) throw new AppError('DATA_VALIDATION', 'entry ID 格式錯誤');
  const db = context.env.DB;

  const [canWrite, belongsToTrip] = await Promise.all([
    hasWritePermission(db, auth, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, eid, id),
  ]);
  if (!canWrite) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('DATA_NOT_FOUND');

  const body = await parseJsonBody<{ poiId?: number; entryPoisVersion?: string }>(context.request);
  if (typeof body.poiId !== 'number' || !Number.isInteger(body.poiId) || body.poiId <= 0) {
    throw new AppError('DATA_VALIDATION', 'poiId 必須是 positive integer');
  }

  const poiExists = await db
    .prepare('SELECT id FROM pois WHERE id = ?')
    .bind(body.poiId)
    .first();
  if (!poiExists) throw new AppError('DATA_NOT_FOUND', `POI ${body.poiId} 不存在`);

  const result = await addAlternate(db, eid, body.poiId, body.entryPoisVersion);

  // Audit log (round 4 fix S1 — was missing on all alternates endpoints)
  await logAudit(db, {
    tripId: id,
    tableName: 'trip_entry_pois',
    recordId: eid,
    action: 'insert',
    changedBy: auth.email,
    diffJson: JSON.stringify({ alt_added: body.poiId, sort_order: result.sortOrder }),
  });

  return json({
    entryId: eid,
    poiId: body.poiId,
    sortOrder: result.sortOrder,
    entryPoisVersion: result.version,
  }, 201);
};
