import { logAudit, computeDiff } from '../../../_audit';
import { hasPermission, verifyRestaurantBelongsToTrip } from '../../../_auth';
import { validateRestaurantBody } from '../../../_validate';
import { json } from '../../../_utils';
import type { Env } from '../../../_types';

const ALLOWED_FIELDS = ['sort_order', 'name', 'category', 'hours', 'price', 'reservation', 'reservation_url', 'description', 'note', 'rating', 'maps', 'mapcode', 'source'] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, rid } = context.params as { id: string; rid: string };
  const db = context.env.DB;
  const changedBy = auth?.email || 'anonymous';

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyRestaurantBelongsToTrip(db, Number(rid), id)) {
    return json({ error: 'Not found' }, 404);
  }

  const oldRow = await db.prepare('SELECT * FROM restaurants WHERE id = ?').bind(Number(rid)).first() as Record<string, unknown> | null;
  if (!oldRow) return json({ error: 'Not found' }, 404);

  let body: Record<string, unknown>;
  try {
    body = await context.request.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  // 驗證必填欄位（name 若包含在更新欄位中則不得為空）
  if ('name' in body) {
    const validation = validateRestaurantBody(body);
    if (!validation.ok) return json({ error: validation.error }, validation.status);
  }

  const fields = Object.keys(body).filter(k => (ALLOWED_FIELDS as readonly string[]).includes(k));
  if (fields.length === 0) return json({ error: 'No valid fields to update' }, 400);

  const setClauses = [...fields.map(f => `${f} = ?`), 'updated_at = CURRENT_TIMESTAMP'].join(', ');
  const values = [...fields.map(f => body[f]), Number(rid)];

  const row = await db
    .prepare(`UPDATE restaurants SET ${setClauses} WHERE id = ? RETURNING *`)
    .bind(...values)
    .first();

  if (!row) return json({ error: 'Not found' }, 404);

  const newFields = Object.fromEntries(fields.map(f => [f, body[f]]));
  await logAudit(db, {
    tripId: id,
    tableName: 'restaurants',
    recordId: Number(rid),
    action: 'update',
    changedBy,
    diffJson: computeDiff(oldRow, newFields),
  });

  return json(row);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, rid } = context.params as { id: string; rid: string };
  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyRestaurantBelongsToTrip(db, Number(rid), id)) {
    return json({ error: 'Not found' }, 404);
  }

  const changedBy = auth?.email || 'anonymous';

  const oldRow = await db.prepare('SELECT * FROM restaurants WHERE id = ?').bind(Number(rid)).first() as Record<string, unknown> | null;

  await db.prepare('DELETE FROM restaurants WHERE id = ?').bind(Number(rid)).run();

  await logAudit(db, {
    tripId: id,
    tableName: 'restaurants',
    recordId: Number(rid),
    action: 'delete',
    changedBy,
    snapshot: oldRow ? JSON.stringify(oldRow) : undefined,
  });

  return json({ ok: true });
};
