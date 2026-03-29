import { logAudit } from '../../../_audit';
import { hasPermission } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json, getAuth, parseJsonBody } from '../../../_utils';
import type { Env } from '../../../_types';

const VALID_TYPES = new Set(['flights', 'checklist', 'backup', 'suggestions', 'emergency']);

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id, type } = context.params as { id: string; type: string };

  if (!VALID_TYPES.has(type)) throw new AppError('DATA_VALIDATION', 'Invalid doc type');

  const row = await context.env.DB
    .prepare('SELECT doc_type, content, updated_at FROM trip_docs WHERE trip_id = ? AND doc_type = ?')
    .bind(id, type)
    .first();

  if (!row) throw new AppError('DATA_NOT_FOUND');
  return json(row);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, type } = context.params as { id: string; type: string };

  if (!VALID_TYPES.has(type)) throw new AppError('DATA_VALIDATION', 'Invalid doc type');

  if (!await hasPermission(context.env.DB, auth.email, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  const bodyOrError = await parseJsonBody<{ content?: string }>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;
  const content = body.content ?? '';
  const changedBy = auth.email;

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
