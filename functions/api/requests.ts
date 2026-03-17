/**
 * GET /api/requests?tripId=xxx&status=open
 * POST /api/requests { tripId, mode, title, body }
 */

import { logAudit } from './_audit';

interface Env {
  DB: D1Database;
  ADMIN_EMAIL: string;
}

interface AuthData {
  email: string;
  isAdmin: boolean;
  isServiceToken: boolean;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function hasPermission(db: D1Database, email: string, tripId: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  const row = await db
    .prepare('SELECT 1 FROM permissions WHERE email = ? AND (trip_id = ? OR trip_id = ?)')
    .bind(email.toLowerCase(), tripId, '*')
    .first();
  return !!row;
}

// GET /api/requests
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const auth = (context.data as Record<string, unknown>).auth as AuthData;
  const url = new URL(request.url);
  const tripId = url.searchParams.get('tripId');
  const status = url.searchParams.get('status');

  // admin/service token 可不帶 tripId 查詢所有 requests
  if (!tripId && !auth.isAdmin) {
    return json({ error: '缺少 tripId 參數' }, 400);
  }

  if (tripId && !await hasPermission(env.DB, auth.email, tripId, auth.isAdmin)) {
    return json({ error: '無此行程權限' }, 403);
  }

  let sql = 'SELECT * FROM requests';
  const params: string[] = [];
  const conditions: string[] = [];

  if (tripId) {
    conditions.push('trip_id = ?');
    params.push(tripId);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  const webhookFailed = url.searchParams.get('webhook_failed');
  if (webhookFailed === '1') {
    conditions.push("(webhook_status = 'failed' OR webhook_status = 'no_tunnel' OR webhook_status IS NULL)");
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC LIMIT 50';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
};

// POST /api/requests
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const auth = (context.data as Record<string, unknown>).auth as AuthData;

  let body: { tripId?: string; mode?: string; title?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: '無效的 JSON' }, 400);
  }

  const { tripId, mode, title, body: requestBody } = body;

  if (!tripId || !mode || !title || !requestBody) {
    return json({ error: '缺少必要欄位：tripId, mode, title, body' }, 400);
  }

  if (mode !== 'trip-edit' && mode !== 'trip-plan') {
    return json({ error: 'mode 必須是 trip-edit 或 trip-plan' }, 400);
  }

  if (!await hasPermission(env.DB, auth.email, tripId, auth.isAdmin)) {
    return json({ error: '無此行程權限' }, 403);
  }

  const result = await env.DB
    .prepare(
      'INSERT INTO requests (trip_id, mode, title, body, submitted_by) VALUES (?, ?, ?, ?, ?) RETURNING *'
    )
    .bind(tripId, mode, title, requestBody, auth.email)
    .first();

  const newRow = result as Record<string, unknown>;
  await logAudit(env.DB, {
    tripId,
    tableName: 'requests',
    recordId: newRow ? (newRow.id as number) : null,
    action: 'insert',
    changedBy: auth.email,
    diffJson: JSON.stringify({ mode, title }),
  });

  return json(result, 201);
};
