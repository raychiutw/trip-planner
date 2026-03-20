/**
 * GET  /api/permissions?tripId=xxx  — 列出行程權限
 * POST /api/permissions { email, tripId, role } — 新增權限 + Access 同步
 */

import { logAudit } from './_audit';

interface Env {
  DB: D1Database;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  CF_ACCESS_APP_ID: string;
  CF_ACCESS_POLICY_ID: string;
  ADMIN_EMAIL: string;
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

/** 取得目前 Access policy 的 include email 列表 */
async function getAccessPolicyEmails(env: Env): Promise<string[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/apps/${env.CF_ACCESS_APP_ID}/policies/${env.CF_ACCESS_POLICY_ID}`,
    { headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' } }
  );
  if (!res.ok) throw new Error(`Access API GET failed: ${res.status}`);
  const data = await res.json() as { result: { include: Array<{ email?: { email: string } }> } };
  return data.result.include
    .filter((rule: { email?: { email: string } }) => rule.email)
    .map((rule: { email?: { email: string } }) => rule.email!.email.toLowerCase());
}

/** 更新 Access policy 的 include email 列表 */
async function updateAccessPolicyEmails(env: Env, emails: string[]): Promise<void> {
  const include = emails.map(email => ({ email: { email } }));
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/apps/${env.CF_ACCESS_APP_ID}/policies/${env.CF_ACCESS_POLICY_ID}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '允許的旅伴', decision: 'allow', include }),
    }
  );
  if (!res.ok) throw new Error(`Access API PUT failed: ${res.status}`);
}

/** 將 email 加入 Access policy（若尚未存在） */
export async function addEmailToAccessPolicy(env: Env, email: string): Promise<void> {
  const emails = await getAccessPolicyEmails(env);
  const lower = email.toLowerCase();
  if (emails.includes(lower)) return; // 已在白名單
  emails.push(lower);
  await updateAccessPolicyEmails(env, emails);
}

/** 從 Access policy 移除 email（若存在） */
export async function removeEmailFromAccessPolicy(env: Env, email: string): Promise<void> {
  const emails = await getAccessPolicyEmails(env);
  const lower = email.toLowerCase();
  const filtered = emails.filter(e => e !== lower);
  if (filtered.length === emails.length) return; // 本來就不在
  await updateAccessPolicyEmails(env, filtered);
}

// GET /api/permissions?tripId=xxx
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = (context.data as Record<string, unknown>).auth as AuthData;
  if (!auth.isAdmin) return json({ error: '僅管理者可操作' }, 403);

  const url = new URL(context.request.url);
  const tripId = url.searchParams.get('tripId');

  if (!tripId) {
    return json({ error: '缺少 tripId 參數' }, 400);
  }

  const { results } = await context.env.DB
    .prepare('SELECT * FROM permissions WHERE trip_id = ? ORDER BY email')
    .bind(tripId)
    .all();

  return json(results);
};

// POST /api/permissions { email, tripId, role? }
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = (context.data as Record<string, unknown>).auth as AuthData;
  if (!auth.isAdmin) return json({ error: '僅管理者可操作' }, 403);

  let body: { email?: string; tripId?: string; role?: string };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: '無效的 JSON' }, 400);
  }

  const { email, tripId, role = 'member' } = body;
  if (!email || !tripId) {
    return json({ error: '缺少必要欄位：email, tripId' }, 400);
  }

  const lowerEmail = email.toLowerCase();

  // 檢查重複
  const existing = await context.env.DB
    .prepare('SELECT 1 FROM permissions WHERE email = ? AND trip_id = ?')
    .bind(lowerEmail, tripId)
    .first();
  if (existing) {
    return json({ error: '此 email 已有此行程的權限' }, 409);
  }

  // 寫入 D1
  const result = await context.env.DB
    .prepare('INSERT INTO permissions (email, trip_id, role) VALUES (?, ?, ?) RETURNING *')
    .bind(lowerEmail, tripId, role)
    .first();

  // 同步 Access policy
  try {
    await addEmailToAccessPolicy(context.env, lowerEmail);
  } catch (err) {
    // 回滾 D1
    await context.env.DB
      .prepare('DELETE FROM permissions WHERE email = ? AND trip_id = ?')
      .bind(lowerEmail, tripId)
      .run();
    return json({ error: '同步 Access policy 失敗，已回滾', detail: String(err) }, 500);
  }

  await logAudit(context.env.DB, {
    tripId,
    tableName: 'permissions',
    recordId: (result as any)?.id ?? null,
    action: 'insert',
    changedBy: auth.email,
    diffJson: JSON.stringify({ email: lowerEmail, role }),
  });

  return json(result, 201);
};
