import type { PagesFunction } from '@cloudflare/workers-types';
import { logAudit } from '../../../../../_audit';

interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, hid } = context.params as { id: string; hid: string };
  const db = context.env.DB;
  const changedBy = auth?.email || 'anonymous';

  const body = await context.request.json() as Record<string, unknown>;

  const fields = Object.keys(body).filter(k => k !== 'id' && k !== 'parent_type' && k !== 'parent_id' && k !== 'updated_at');
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
    diffJson: JSON.stringify({ parent_type: 'hotel', parent_id: Number(hid), ...body }),
  });

  return json(row, 201);
};
