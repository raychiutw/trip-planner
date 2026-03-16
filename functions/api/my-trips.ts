/**
 * GET /api/my-trips — 回傳使用者有權限的 tripId 列表
 */

interface Env {
  DB: D1Database;
}

interface AuthData {
  email: string;
  isAdmin: boolean;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const auth = (context.data as Record<string, unknown>).auth as AuthData;

  let results;
  if (auth.isAdmin) {
    // admin 可看所有行程（從 permissions 中取 distinct trip_id）
    const { results: rows } = await env.DB
      .prepare('SELECT DISTINCT trip_id AS tripId FROM permissions WHERE trip_id != ? ORDER BY trip_id')
      .bind('*')
      .all();
    results = rows;
  } else {
    const { results: rows } = await env.DB
      .prepare('SELECT trip_id AS tripId FROM permissions WHERE email = ? AND trip_id != ? ORDER BY trip_id')
      .bind(auth.email.toLowerCase(), '*')
      .all();
    results = rows;
  }

  return json(results);
};
