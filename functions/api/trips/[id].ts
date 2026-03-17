import { logAudit, computeDiff } from '../_audit';

interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };

  const row = await context.env.DB.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Not found' }, 404);

  (row as any).tripId = (row as any).id;

  if (row.footer_json && typeof row.footer_json === 'string') {
    try {
      (row as any).footer_json = JSON.parse(row.footer_json as string);
    } catch {
      // leave as-is if parse fails
    }
  }

  return json(row);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return new Response(JSON.stringify({ error: '未認證' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const { id } = context.params as { id: string };

  const existing = await context.env.DB.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first() as Record<string, unknown> | null;
  if (!existing) return json({ error: 'Not found' }, 404);

  const body = await context.request.json() as Record<string, unknown>;
  const fields = Object.keys(body).filter(k => k !== 'id' && k !== 'updated_at');
  if (fields.length === 0) return json({ error: 'No fields to update' }, 400);

  const setClauses = [...fields.map(f => `${f} = ?`), 'updated_at = CURRENT_TIMESTAMP'].join(', ');
  const values = [...fields.map(f => body[f]), id];

  const changedBy = (context.data as any)?.auth?.email || 'anonymous';
  const newFields = Object.fromEntries(fields.map(f => [f, body[f]]));

  await context.env.DB.prepare(`UPDATE trips SET ${setClauses} WHERE id = ?`).bind(...values).run();

  await logAudit(context.env.DB, {
    tripId: id,
    tableName: 'trips',
    recordId: null,
    action: 'update',
    changedBy,
    diffJson: computeDiff(existing, newFields),
  });

  return json({ ok: true });
};
