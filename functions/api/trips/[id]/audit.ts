
interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// GET /api/trips/:id/audit
// Query params: limit (default 20), request_id (optional filter)
// Only admin can access
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);
  if (!auth.isAdmin) return json({ error: '僅管理者可存取' }, 403);

  const { id } = context.params as { id: string };
  const db = context.env.DB;

  const url = new URL(context.request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || '20'), 100);
  const requestId = url.searchParams.get('request_id');

  let sql = 'SELECT * FROM audit_log WHERE trip_id = ?';
  const params: (string | number)[] = [id];

  if (requestId) {
    sql += ' AND request_id = ?';
    params.push(Number(requestId));
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await db.prepare(sql).bind(...params).all();
  return json(results);
};
