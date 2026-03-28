import { logAudit, computeDiff } from '../../../_audit';
import { hasPermission, verifyRestaurantBelongsToTrip } from '../../../_auth';
import { validateRestaurantBody } from '../../../_validate';
import { json, getAuth, parseJsonBody, parseIntParam, buildUpdateClause } from '../../../_utils';
import type { Env } from '../../../_types';

const ALLOWED_FIELDS = ['sort_order', 'name', 'category', 'hours', 'price', 'reservation', 'reservation_url', 'description', 'note', 'google_rating', 'maps', 'mapcode', 'source'] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, rid: ridStr } = context.params as { id: string; rid: string };
  const rid = parseIntParam(ridStr);
  if (!rid) return json({ error: 'Invalid id' }, 400);
  const db = context.env.DB;
  const changedBy = auth.email;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyRestaurantBelongsToTrip(db, rid, id)) {
    return json({ error: 'Not found' }, 404);
  }

  const oldRow = await db.prepare('SELECT * FROM restaurants WHERE id = ?').bind(rid).first() as Record<string, unknown> | null;
  if (!oldRow) return json({ error: 'Not found' }, 404);

  const bodyOrError = await parseJsonBody<Record<string, unknown>>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  // 驗證必填欄位（name 若包含在更新欄位中則不得為空）
  if ('name' in body) {
    const validation = validateRestaurantBody(body);
    if (!validation.ok) return json({ error: validation.error }, validation.status);
  }

  const update = buildUpdateClause(body, ALLOWED_FIELDS);
  if (!update) return json({ error: 'No valid fields to update' }, 400);

  const row = await db
    .prepare(`UPDATE restaurants SET ${update.setClauses} WHERE id = ? RETURNING *`)
    .bind(...update.values, rid)
    .first();

  if (!row) return json({ error: 'Not found' }, 404);

  const newFields = Object.fromEntries(update.fields.map(f => [f, body[f]]));
  await logAudit(db, {
    tripId: id,
    tableName: 'restaurants',
    recordId: rid,
    action: 'update',
    changedBy,
    diffJson: computeDiff(oldRow, newFields),
  });

  return json(row);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, rid: ridStr } = context.params as { id: string; rid: string };
  const rid = parseIntParam(ridStr);
  if (!rid) return json({ error: 'Invalid id' }, 400);
  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyRestaurantBelongsToTrip(db, rid, id)) {
    return json({ error: 'Not found' }, 404);
  }

  const changedBy = auth.email;

  const oldRow = await db.prepare('SELECT * FROM restaurants WHERE id = ?').bind(rid).first() as Record<string, unknown> | null;

  await db.prepare('DELETE FROM restaurants WHERE id = ?').bind(rid).run();

  await logAudit(db, {
    tripId: id,
    tableName: 'restaurants',
    recordId: rid,
    action: 'delete',
    changedBy,
    snapshot: oldRow ? JSON.stringify(oldRow) : undefined,
  });

  return json({ ok: true });
};
