/**
 * DELETE /api/permissions/:id — 移除權限 + 條件式 Access 同步
 *
 * V2-P7 PR-O: 從「admin only」放寬為「admin OR trip owner」。
 * Trip ID 從 permission 記錄反查，再驗 owner。
 */

import { ensureCanManageTripPerms, removeEmailFromAccessPolicy } from '../permissions';
import { logAudit } from '../_audit';
import { AppError } from '../_errors';
import { json, getAuth } from '../_utils';
import type { Env } from '../_types';

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const id = context.params.id as string;

  // 先查要刪的記錄
  const record = await context.env.DB
    .prepare('SELECT * FROM trip_permissions WHERE id = ?')
    .bind(id)
    .first<{ id: number; email: string; trip_id: string; role: string }>();

  if (!record) {
    throw new AppError('DATA_NOT_FOUND', '找不到該權限記錄');
  }

  await ensureCanManageTripPerms(context, auth, record.trip_id);

  // 刪除 D1 記錄
  await context.env.DB.prepare('DELETE FROM trip_permissions WHERE id = ?').bind(id).run();

  // 檢查該 email 是否還有其他行程權限
  const remaining = await context.env.DB
    .prepare('SELECT 1 FROM trip_permissions WHERE email = ? AND trip_id != ?')
    .bind(record.email, '*')
    .first();

  if (!remaining) {
    // 無其他權限，從 Access policy 移除
    try {
      await removeEmailFromAccessPolicy(context.env, record.email);
    } catch (err) {
      // 回滾：重新 INSERT
      await context.env.DB
        .prepare('INSERT INTO trip_permissions (id, email, trip_id, role) VALUES (?, ?, ?, ?)')
        .bind(record.id, record.email, record.trip_id, record.role)
        .run();
      throw new AppError('DATA_SAVE_FAILED', '同步 Access policy 失敗，已回滾');
    }
  }

  await logAudit(context.env.DB, {
    tripId: record.trip_id,
    tableName: 'trip_permissions',
    recordId: record.id,
    action: 'delete',
    changedBy: auth.email,
    snapshot: JSON.stringify(record),
    diffJson: JSON.stringify({ email: record.email, role: record.role }),
  });

  return json({ ok: true });
};
