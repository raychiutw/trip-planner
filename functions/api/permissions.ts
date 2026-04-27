/**
 * GET  /api/permissions?tripId=xxx  — 列出行程權限
 * POST /api/permissions { email, tripId, role } — 新增權限 + Access 同步
 *
 * V2-P7 PR-O: 從「admin only」放寬為「admin OR trip owner」。
 * 一般使用者可管自己 owner = 自己 email 的行程共編；admin 仍對所有行程有權。
 */

import { logAudit } from './_audit';
import { AppError } from './_errors';
import { json, getAuth, parseJsonBody } from './_utils';
import type { Env } from './_types';

/** 檢查 auth user 是否為該 trip 的 owner（admin 自動 pass）。 */
export async function ensureCanManageTripPerms(
  context: { env: Env },
  auth: { email: string; isAdmin: boolean },
  tripId: string,
): Promise<void> {
  if (auth.isAdmin) return;
  const owner = await context.env.DB
    .prepare('SELECT owner FROM trips WHERE id = ?')
    .bind(tripId)
    .first<{ owner: string | null }>();
  if (!owner) throw new AppError('DATA_NOT_FOUND', '找不到該行程');
  if ((owner.owner ?? '').toLowerCase() !== auth.email.toLowerCase()) {
    throw new AppError('PERM_ADMIN_ONLY', '僅行程擁有者或管理者可操作共編');
  }
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
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const url = new URL(context.request.url);
  const tripId = url.searchParams.get('tripId');

  if (!tripId) {
    throw new AppError('DATA_VALIDATION', '缺少 tripId 參數');
  }

  await ensureCanManageTripPerms(context, auth, tripId);

  const { results } = await context.env.DB
    .prepare('SELECT * FROM trip_permissions WHERE trip_id = ? ORDER BY email')
    .bind(tripId)
    .all();

  return json(results);
};

// POST /api/permissions { email, tripId, role? }
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const body = await parseJsonBody<{ email?: string; tripId?: string; role?: string }>(context.request);

  const { email, tripId, role = 'member' } = body;
  if (!email || !tripId) {
    throw new AppError('DATA_VALIDATION', '缺少必要欄位：email, tripId');
  }

  await ensureCanManageTripPerms(context, auth, tripId);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('DATA_VALIDATION', 'email 格式不正確');
  }

  const lowerEmail = email.toLowerCase();

  // 寫入 D1（UNIQUE index 保護 race condition）
  let result: Record<string, unknown> & { id: number };
  try {
    const row = await context.env.DB
      .prepare('INSERT INTO trip_permissions (email, trip_id, role) VALUES (?, ?, ?) RETURNING *')
      .bind(lowerEmail, tripId, role)
      .first<Record<string, unknown> & { id: number }>();
    if (!row) throw new AppError('SYS_INTERNAL', 'INSERT RETURNING 未回傳資料');
    result = row;
  } catch (err) {
    if (err instanceof AppError) throw err;
    // UNIQUE constraint violation → already exists
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      throw new AppError('DATA_CONFLICT', '此 email 已有此行程的權限');
    }
    throw err;
  }

  // 同步 Access policy（best-effort：失敗不 rollback D1，回傳 warning）
  let accessSyncFailed = false;
  try {
    await addEmailToAccessPolicy(context.env, lowerEmail);
  } catch (err) {
    accessSyncFailed = true;
    const accessErr = err instanceof Error ? err.message : String(err);
    console.error('Access policy sync failed:', accessErr);
    await logAudit(context.env.DB, {
      tripId, tableName: 'trip_permissions', recordId: result.id,
      action: 'error', changedBy: auth.email,
      diffJson: JSON.stringify({ warning: 'Access policy sync failed', message: accessErr }),
    });
  }

  await logAudit(context.env.DB, {
    tripId,
    tableName: 'trip_permissions',
    recordId: result.id,
    action: 'insert',
    changedBy: auth.email,
    diffJson: JSON.stringify({ email: lowerEmail, role }),
  });

  return json({ ...result, _accessSyncFailed: accessSyncFailed }, 201);
};
