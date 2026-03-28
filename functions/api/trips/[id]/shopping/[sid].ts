import { logAudit, computeDiff } from '../../../_audit';
import { hasPermission, verifyShoppingBelongsToTrip } from '../../../_auth';
import { json, getAuth, parseJsonBody, parseIntParam, buildUpdateClause } from '../../../_utils';
import type { Env } from '../../../_types';

const ALLOWED_FIELDS = ['sort_order', 'name', 'category', 'hours', 'must_buy', 'note', 'google_rating', 'maps', 'mapcode', 'source'] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, sid: sidStr } = context.params as { id: string; sid: string };
  const sid = parseIntParam(sidStr);
  if (!sid) return json({ error: 'Invalid id' }, 400);
  const db = context.env.DB;
  const changedBy = auth.email;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyShoppingBelongsToTrip(db, sid, id)) {
    return json({ error: 'Not found' }, 404);
  }

  const oldRow = await db.prepare('SELECT * FROM shopping WHERE id = ?').bind(sid).first() as Record<string, unknown> | null;
  if (!oldRow) return json({ error: 'Not found' }, 404);

  const bodyOrError = await parseJsonBody<Record<string, unknown>>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  const update = buildUpdateClause(body, ALLOWED_FIELDS);
  if (!update) return json({ error: 'No valid fields to update' }, 400);

  const row = await db
    .prepare(`UPDATE shopping SET ${update.setClauses} WHERE id = ? RETURNING *`)
    .bind(...update.values, sid)
    .first();

  if (!row) return json({ error: 'Not found' }, 404);

  const newFields = Object.fromEntries(update.fields.map(f => [f, body[f]]));
  await logAudit(db, {
    tripId: id,
    tableName: 'shopping',
    recordId: sid,
    action: 'update',
    changedBy,
    diffJson: computeDiff(oldRow, newFields),
  });

  return json(row);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, sid: sidStr } = context.params as { id: string; sid: string };
  const sid = parseIntParam(sidStr);
  if (!sid) return json({ error: 'Invalid id' }, 400);
  const db = context.env.DB;
  const changedBy = auth.email;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyShoppingBelongsToTrip(db, sid, id)) {
    return json({ error: 'Not found' }, 404);
  }

  const oldRow = await db.prepare('SELECT * FROM shopping WHERE id = ?').bind(sid).first() as Record<string, unknown> | null;

  await db.prepare('DELETE FROM shopping WHERE id = ?').bind(sid).run();

  await logAudit(db, {
    tripId: id,
    tableName: 'shopping',
    recordId: sid,
    action: 'delete',
    changedBy,
    snapshot: oldRow ? JSON.stringify(oldRow) : undefined,
  });

  return json({ ok: true });
};
