/**
 * DELETE /api/permissions/:id — 移除權限 + 條件式 Access 同步
 */

import { removeEmailFromAccessPolicy } from '../permissions';
import { logAudit } from '../_audit';

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

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = (context.data as Record<string, unknown>).auth as AuthData;
  if (!auth.isAdmin) return json({ error: '僅管理者可操作' }, 403);

  const id = context.params.id as string;

  // 先查要刪的記錄
  const record = await context.env.DB
    .prepare('SELECT * FROM permissions WHERE id = ?')
    .bind(id)
    .first<{ id: number; email: string; trip_id: string; role: string }>();

  if (!record) {
    return json({ error: '找不到該權限記錄' }, 404);
  }

  // 刪除 D1 記錄
  await context.env.DB.prepare('DELETE FROM permissions WHERE id = ?').bind(id).run();

  // 檢查該 email 是否還有其他行程權限
  const remaining = await context.env.DB
    .prepare('SELECT 1 FROM permissions WHERE email = ? AND trip_id != ?')
    .bind(record.email, '*')
    .first();

  if (!remaining) {
    // 無其他權限，從 Access policy 移除
    try {
      await removeEmailFromAccessPolicy(context.env, record.email);
    } catch (err) {
      // 回滾：重新 INSERT
      await context.env.DB
        .prepare('INSERT INTO permissions (id, email, trip_id, role) VALUES (?, ?, ?, ?)')
        .bind(record.id, record.email, record.trip_id, record.role)
        .run();
      return json({ error: '同步 Access policy 失敗，已回滾', detail: String(err) }, 500);
    }
  }

  await logAudit(context.env.DB, {
    tripId: record.trip_id,
    tableName: 'permissions',
    recordId: record.id,
    action: 'delete',
    changedBy: auth.email,
    snapshot: JSON.stringify(record),
    diffJson: JSON.stringify({ email: record.email, role: record.role }),
  });

  return json({ ok: true });
};
