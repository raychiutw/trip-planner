import { logAudit, computeDiff } from '../../../_audit';

interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, sid } = context.params as { id: string; sid: string };
  const db = context.env.DB;
  const changedBy = auth?.email || 'anonymous';

  const oldRow = await db.prepare('SELECT * FROM shopping WHERE id = ?').bind(Number(sid)).first() as Record<string, unknown> | null;
  if (!oldRow) return json({ error: 'Not found' }, 404);

  const body = await context.request.json() as Record<string, unknown>;
  const fields = Object.keys(body).filter(k => k !== 'id' && k !== 'updated_at');
  if (fields.length === 0) return json({ error: 'No fields to update' }, 400);

  const setClauses = [...fields.map(f => `${f} = ?`), 'updated_at = CURRENT_TIMESTAMP'].join(', ');
  const values = [...fields.map(f => body[f]), Number(sid)];

  const row = await db
    .prepare(`UPDATE shopping SET ${setClauses} WHERE id = ? RETURNING *`)
    .bind(...values)
    .first();

  if (!row) return json({ error: 'Not found' }, 404);

  const newFields = Object.fromEntries(fields.map(f => [f, body[f]]));
  await logAudit(db, {
    tripId: id,
    tableName: 'shopping',
    recordId: Number(sid),
    action: 'update',
    changedBy,
    diffJson: computeDiff(oldRow, newFields),
  });

  return json(row);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, sid } = context.params as { id: string; sid: string };
  const db = context.env.DB;
  const changedBy = auth?.email || 'anonymous';

  const oldRow = await db.prepare('SELECT * FROM shopping WHERE id = ?').bind(Number(sid)).first() as Record<string, unknown> | null;

  await db.prepare('DELETE FROM shopping WHERE id = ?').bind(Number(sid)).run();

  await logAudit(db, {
    tripId: id,
    tableName: 'shopping',
    recordId: Number(sid),
    action: 'delete',
    changedBy,
    snapshot: oldRow ? JSON.stringify(oldRow) : undefined,
  });

  return json({ ok: true });
};
