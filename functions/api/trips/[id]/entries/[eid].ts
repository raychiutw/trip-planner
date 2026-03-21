import { logAudit, computeDiff } from '../../../_audit';
import { hasPermission, verifyEntryBelongsToTrip } from '../../../_auth';
import { validateEntryBody } from '../../../_validate';
import { json } from '../../../_utils';
import type { Env } from '../../../_types';

const ALLOWED_FIELDS = ['sort_order', 'time', 'title', 'body', 'source', 'maps', 'mapcode', 'rating', 'note', 'travel_type', 'travel_desc', 'travel_min', 'location_json'] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, eid } = context.params as { id: string; eid: string };
  const db = context.env.DB;
  const changedBy = auth?.email || 'anonymous';

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyEntryBelongsToTrip(db, Number(eid), id)) {
    return json({ error: 'Not found' }, 404);
  }

  const oldRow = await db.prepare('SELECT * FROM entries WHERE id = ?').bind(Number(eid)).first() as Record<string, unknown> | null;
  if (!oldRow) return json({ error: 'Not found' }, 404);

  let body: Record<string, unknown>;
  try {
    body = await context.request.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  // 驗證必填欄位（title 若包含在更新欄位中則不得為空）
  if ('title' in body) {
    const validation = validateEntryBody(body);
    if (!validation.ok) return json({ error: validation.error }, validation.status);
  }

  const fields = Object.keys(body).filter(k => (ALLOWED_FIELDS as readonly string[]).includes(k));
  if (fields.length === 0) return json({ error: 'No valid fields to update' }, 400);

  const setClauses = [...fields.map(f => `${f} = ?`), 'updated_at = CURRENT_TIMESTAMP'].join(', ');
  const values = [...fields.map(f => body[f]), Number(eid)];

  const row = await db
    .prepare(`UPDATE entries SET ${setClauses} WHERE id = ? RETURNING *`)
    .bind(...values)
    .first();

  if (!row) return json({ error: 'Not found' }, 404);

  const newFields = Object.fromEntries(fields.map(f => [f, body[f]]));
  await logAudit(db, {
    tripId: id,
    tableName: 'entries',
    recordId: Number(eid),
    action: 'update',
    changedBy,
    diffJson: computeDiff(oldRow, newFields),
  });

  return json(row);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, eid } = context.params as { id: string; eid: string };
  const db = context.env.DB;
  const changedBy = auth?.email || 'anonymous';

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyEntryBelongsToTrip(db, Number(eid), id)) {
    return json({ error: 'Not found' }, 404);
  }

  const oldRow = await db.prepare('SELECT * FROM entries WHERE id = ?').bind(Number(eid)).first() as Record<string, unknown> | null;

  // Cascade delete restaurants and shopping before deleting the entry
  await db.batch([
    db.prepare("DELETE FROM restaurants WHERE entry_id = ?").bind(Number(eid)),
    db.prepare("DELETE FROM shopping WHERE parent_type = 'entry' AND parent_id = ?").bind(Number(eid)),
    db.prepare('DELETE FROM entries WHERE id = ?').bind(Number(eid)),
  ]);

  await logAudit(db, {
    tripId: id,
    tableName: 'entries',
    recordId: Number(eid),
    action: 'delete',
    changedBy,
    snapshot: oldRow ? JSON.stringify(oldRow) : undefined,
  });

  return json({ ok: true });
};
