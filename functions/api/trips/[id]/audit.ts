
import { AppError } from '../../_errors';
import { requireAuth } from '../../_auth';
import { json } from '../../_utils';
import type { Env } from '../../_types';

// GET /api/trips/:id/audit
// Query params: limit (default 20), request_id (optional filter)
// Only admin can access
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  if (!auth.isAdmin) throw new AppError('PERM_ADMIN_ONLY');

  const { id } = context.params as { id: string };
  const db = context.env.DB;

  const url = new URL(context.request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || '20'), 100));
  const requestId = url.searchParams.get('request_id');

  let sql = 'SELECT * FROM audit_log WHERE trip_id = ?';
  const params: (string | number)[] = [id];

  if (requestId) {
    const rid = Number(requestId);
    if (!Number.isFinite(rid) || rid < 1) {
      throw new AppError('DATA_VALIDATION', 'request_id must be a positive integer');
    }
    sql += ' AND request_id = ?';
    params.push(rid);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await db.prepare(sql).bind(...params).all();
  return json(results);
};
