import { logAudit, computeDiff } from '../_audit';
import { hasPermission } from '../_auth';
import { json } from '../_utils';
import type { Env } from '../_types';

const ALLOWED_FIELDS = ['name', 'owner', 'title', 'description', 'og_description', 'self_drive', 'countries', 'published', 'food_prefs', 'auto_scroll', 'footer_json'] as const;

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
  if (!auth) return json({ error: '未認證' }, 401);

  const { id } = context.params as { id: string };

  if (!await hasPermission(context.env.DB, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  const existing = await context.env.DB.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first() as Record<string, unknown> | null;
  if (!existing) return json({ error: 'Not found' }, 404);

  let body: Record<string, unknown>;
  try {
    body = await context.request.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const fields = Object.keys(body).filter(k => (ALLOWED_FIELDS as readonly string[]).includes(k));
  if (fields.length === 0) return json({ error: 'No valid fields to update' }, 400);

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
