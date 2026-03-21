import { logAudit } from '../../../_audit';
import { hasPermission } from '../../../_auth';
import { json } from '../../../_utils';
import type { Env } from '../../../_types';

const VALID_TYPES = new Set(['flights', 'checklist', 'backup', 'suggestions', 'emergency']);

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id, type } = context.params as { id: string; type: string };

  if (!VALID_TYPES.has(type)) return json({ error: 'Invalid doc type' }, 400);

  const row = await context.env.DB
    .prepare('SELECT doc_type, content, updated_at FROM trip_docs WHERE trip_id = ? AND doc_type = ?')
    .bind(id, type)
    .first();

  if (!row) return json({ error: 'Not found' }, 404);
  return json(row);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, type } = context.params as { id: string; type: string };

  if (!VALID_TYPES.has(type)) return json({ error: 'Invalid doc type' }, 400);

  if (!await hasPermission(context.env.DB, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  let body: { content?: string };
  try {
    body = await context.request.json() as { content?: string };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const content = body.content ?? '';
  const changedBy = auth?.email || 'anonymous';

  await context.env.DB
    .prepare('INSERT OR REPLACE INTO trip_docs (trip_id, doc_type, content, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
    .bind(id, type, content)
    .run();

  await logAudit(context.env.DB, {
    tripId: id,
    tableName: 'trip_docs',
    recordId: null,
    action: 'update',
    changedBy,
    diffJson: JSON.stringify({ doc_type: type }),
  });

  return json({ ok: true });
};
