/**
 * DELETE /api/trips/:id/entries/:eid/alternates/:poiId — remove alternate POI
 *
 * Master 不能透過此 endpoint 移除（會 throw DATA_VALIDATION）；
 * 刪 master = 刪整個 entry，走 DELETE /api/trips/:id/entries/:eid。
 *
 * POI 不在此 entry → 404 POI_NOT_ALTERNATE。
 */
import { hasWritePermission, verifyEntryBelongsToTrip } from '../../../../../_auth';
import { AppError } from '../../../../../_errors';
import { removeAlternate } from '../../../../../_entry_pois';
import { json, getAuth, parseIntParam } from '../../../../../_utils';
import type { Env } from '../../../../../_types';

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid: eidStr, poiId: poiIdStr } = context.params as {
    id: string;
    eid: string;
    poiId: string;
  };
  const eid = parseIntParam(eidStr);
  const poiId = parseIntParam(poiIdStr);
  if (!eid) throw new AppError('DATA_VALIDATION', 'entry ID 格式錯誤');
  if (!poiId) throw new AppError('DATA_VALIDATION', 'poi ID 格式錯誤');
  const db = context.env.DB;

  const [canWrite, belongsToTrip] = await Promise.all([
    hasWritePermission(db, auth, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, eid, id),
  ]);
  if (!canWrite) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('DATA_NOT_FOUND');

  const result = await removeAlternate(db, eid, poiId);

  return json({
    entryId: eid,
    poiId,
    entryPoisVersion: result.version,
  });
};
