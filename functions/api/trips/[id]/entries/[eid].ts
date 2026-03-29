import { logAudit, computeDiff } from '../../../_audit';
import { hasPermission, verifyEntryBelongsToTrip } from '../../../_auth';
import { AppError } from '../../../_errors';
import { validateEntryBody, detectGarbledText } from '../../../_validate';
import { json, getAuth, parseJsonBody, parseIntParam, buildUpdateClause } from '../../../_utils';
import type { Env } from '../../../_types';

const ALLOWED_FIELDS = ['sort_order', 'time', 'title', 'description', 'source', 'maps', 'mapcode', 'google_rating', 'note', 'travel_type', 'travel_desc', 'travel_min', 'location'] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid: eidStr } = context.params as { id: string; eid: string };
  const eid = parseIntParam(eidStr);
  if (!eid) throw new AppError('DATA_VALIDATION', 'ID 格式錯誤');
  const db = context.env.DB;
  const changedBy = auth.email;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  if (!await verifyEntryBelongsToTrip(db, eid, id)) {
    throw new AppError('DATA_NOT_FOUND');
  }

  const oldRow = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(eid).first() as Record<string, unknown> | null;
  if (!oldRow) throw new AppError('DATA_NOT_FOUND');

  const bodyOrError = await parseJsonBody<Record<string, unknown>>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  // 驗證必填欄位（title 若包含在更新欄位中則不得為空）
  if ('title' in body) {
    const validation = validateEntryBody(body);
    if (!validation.ok) throw new AppError('DATA_VALIDATION', validation.error);
  }

  // 亂碼偵測：寫入 DB 前檢查文字欄位
  const textFields = ['title', 'description', 'note', 'travel_desc'];
  for (const f of textFields) {
    if (f in body && typeof body[f] === 'string' && detectGarbledText(body[f] as string)) {
      throw new AppError('DATA_ENCODING', `欄位 ${f} 包含疑似亂碼，請確認 encoding 為 UTF-8`);
    }
  }

  const update = buildUpdateClause(body, ALLOWED_FIELDS);
  if (!update) throw new AppError('DATA_VALIDATION', '無有效欄位可更新');

  let row;
  try {
    row = await db
      .prepare(`UPDATE trip_entries SET ${update.setClauses} WHERE id = ? RETURNING *`)
      .bind(...update.values, eid)
      .first();
  } catch (err: any) {
    throw new AppError('SYS_DB_ERROR', 'DB 暫時無法處理，請稍後重試');
  }

  if (!row) throw new AppError('DATA_NOT_FOUND');

  const newFields = Object.fromEntries(update.fields.map(f => [f, body[f]]));
  await logAudit(db, {
    tripId: id,
    tableName: 'trip_entries',
    recordId: eid,
    action: 'update',
    changedBy,
    diffJson: computeDiff(oldRow, newFields),
  });

  return json(row);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid: eidStr } = context.params as { id: string; eid: string };
  const eid = parseIntParam(eidStr);
  if (!eid) throw new AppError('DATA_VALIDATION', 'ID 格式錯誤');
  const db = context.env.DB;
  const changedBy = auth.email;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  if (!await verifyEntryBelongsToTrip(db, eid, id)) {
    throw new AppError('DATA_NOT_FOUND');
  }

  // T11: null guard before delete
  const oldRow = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(eid).first() as Record<string, unknown> | null;
  if (!oldRow) throw new AppError('DATA_NOT_FOUND');

  // Cascade delete trip_pois referencing this entry, then the entry itself
  try {
    await db.batch([
      db.prepare('DELETE FROM trip_pois WHERE entry_id = ?').bind(eid),
      db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(eid),
    ]);
  } catch (err: any) {
    throw new AppError('SYS_DB_ERROR', 'DB 暫時無法處理，請稍後重試');
  }

  await logAudit(db, {
    tripId: id,
    tableName: 'trip_entries',
    recordId: eid,
    action: 'delete',
    changedBy,
    snapshot: JSON.stringify(oldRow),
  });

  return json({ ok: true });
};
