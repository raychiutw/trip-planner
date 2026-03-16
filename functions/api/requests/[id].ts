/**
 * PATCH /api/requests/:id  { reply, status }
 */

interface Env {
  DB: D1Database;
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

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = (context.data as Record<string, unknown>).auth as AuthData;
  const id = params.id as string;

  // 僅 admin / service token 可 PATCH（Claude CLI 回覆用）
  if (!auth.isAdmin) {
    return json({ error: '僅管理者可更新請求' }, 403);
  }

  let body: { reply?: string; status?: string };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: '無效的 JSON' }, 400);
  }

  const updates: string[] = [];
  const values: string[] = [];

  if (body.reply !== undefined) {
    updates.push('reply = ?');
    values.push(body.reply);
  }
  if (body.status !== undefined) {
    if (body.status !== 'open' && body.status !== 'closed') {
      return json({ error: 'status 必須是 open 或 closed' }, 400);
    }
    updates.push('status = ?');
    values.push(body.status);
  }

  if (updates.length === 0) {
    return json({ error: '沒有要更新的欄位' }, 400);
  }

  values.push(id);
  const result = await env.DB
    .prepare(`UPDATE requests SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
    .bind(...values)
    .first();

  if (!result) {
    return json({ error: '找不到該請求' }, 404);
  }

  return json(result);
};
