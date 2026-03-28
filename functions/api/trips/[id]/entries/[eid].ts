import { logAudit, computeDiff } from '../../../_audit';
import { hasPermission, verifyEntryBelongsToTrip } from '../../../_auth';
import { validateEntryBody, detectGarbledText } from '../../../_validate';
import { json, getAuth, parseJsonBody, parseIntParam, buildUpdateClause } from '../../../_utils';
import type { Env } from '../../../_types';

const ALLOWED_FIELDS = ['sort_order', 'time', 'title', 'description', 'source', 'maps', 'mapcode', 'google_rating', 'note', 'travel_type', 'travel_desc', 'travel_min', 'location'] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, eid: eidStr } = context.params as { id: string; eid: string };
  const eid = parseIntParam(eidStr);
  if (!eid) return json({ error: 'Invalid id' }, 400);
  const db = context.env.DB;
  const changedBy = auth.email;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyEntryBelongsToTrip(db, eid, id)) {
    return json({ error: 'Not found' }, 404);
  }

  const oldRow = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(eid).first() as Record<string, unknown> | null;
  if (!oldRow) return json({ error: 'Not found' }, 404);

  const bodyOrError = await parseJsonBody<Record<string, unknown>>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  // 驗證必填欄位（title 若包含在更新欄位中則不得為空）
  if ('title' in body) {
    const validation = validateEntryBody(body);
    if (!validation.ok) return json({ error: validation.error }, validation.status);
  }

  // 亂碼偵測：寫入 DB 前檢查文字欄位
  const textFields = ['title', 'description', 'note', 'travel_desc'];
  for (const f of textFields) {
    if (f in body && typeof body[f] === 'string' && detectGarbledText(body[f] as string)) {
      return json({ error: `欄位 ${f} 包含疑似亂碼，請確認 encoding 為 UTF-8` }, 400);
    }
  }

  const update = buildUpdateClause(body, ALLOWED_FIELDS);
  if (!update) return json({ error: 'No valid fields to update' }, 400);

  let row;
  try {
    row = await db
      .prepare(`UPDATE trip_entries SET ${update.setClauses} WHERE id = ? RETURNING *`)
      .bind(...update.values, eid)
      .first();
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'DB 暫時無法處理，請稍後重試' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '2' },
    });
  }

  if (!row) return json({ error: 'Not found' }, 404);

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
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, eid: eidStr } = context.params as { id: string; eid: string };
  const eid = parseIntParam(eidStr);
  if (!eid) return json({ error: 'Invalid id' }, 400);
  const db = context.env.DB;
  const changedBy = auth.email;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyEntryBelongsToTrip(db, eid, id)) {
    return json({ error: 'Not found' }, 404);
  }

  // T11: null guard before delete
  const oldRow = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(eid).first() as Record<string, unknown> | null;
  if (!oldRow) return json({ error: 'Not found' }, 404);

  // Cascade delete trip_pois referencing this entry, then the entry itself
  try {
    await db.batch([
      db.prepare('DELETE FROM trip_pois WHERE entry_id = ?').bind(eid),
      db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(eid),
    ]);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'DB 暫時無法處理，請稍後重試' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '2' },
    });
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
