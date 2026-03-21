import { logAudit } from '../../../../_audit';
import { hasPermission, verifyHotelBelongsToTrip } from '../../../../_auth';
import { json } from '../../../../_utils';
import type { Env } from '../../../../_types';

const ALLOWED_FIELDS = ['name', 'category', 'hours', 'must_buy', 'note', 'rating', 'maps', 'mapcode', 'source'] as const;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, hid } = context.params as { id: string; hid: string };
  const db = context.env.DB;
  const changedBy = auth?.email || 'anonymous';

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyHotelBelongsToTrip(db, Number(hid), id)) {
    return json({ error: 'Not found' }, 404);
  }

  let body: Record<string, unknown>;
  try {
    body = await context.request.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const fields = Object.keys(body).filter(k => (ALLOWED_FIELDS as readonly string[]).includes(k));
  if (fields.length === 0) return json({ error: 'No valid fields to insert' }, 400);

  const cols = ['parent_type', 'parent_id', ...fields].join(', ');
  const placeholders = ['?', '?', ...fields.map(() => '?')].join(', ');
  const values = ['hotel', Number(hid), ...fields.map(f => body[f] ?? null)];

  const row = await db
    .prepare(`INSERT INTO shopping (${cols}) VALUES (${placeholders}) RETURNING *`)
    .bind(...values)
    .first();

  const newRow = row as Record<string, unknown>;
  await logAudit(db, {
    tripId: id,
    tableName: 'shopping',
    recordId: newRow ? (newRow.id as number) : null,
    action: 'insert',
    changedBy,
    diffJson: JSON.stringify({ parent_type: 'hotel', parent_id: Number(hid), ...Object.fromEntries(fields.map(f => [f, body[f]])) }),
  });

  return json(row, 201);
};
