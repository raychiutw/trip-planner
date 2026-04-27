/**
 * PATCH /api/trips/:id/entries/batch — 一次更新多個 entries 的 sort_order /
 * day_id / time，drag-drop reorder 結束後背景 commit 用。
 *
 * Spec: openspec/changes/ideas-drag-to-itinerary/specs/drag-to-reorder/spec.md
 *   "Batch update 優化 D1 寫入" — 用單一 transaction batch update，避免 N+1。
 *
 * Naming: spec 用 `order_in_day`，DB 是 `sort_order`；endpoint 接 DB 名稱以
 * 對齊 PATCH /entries/:eid 既有 contract，前端 mapper 在 IdeasTab/Timeline 處理。
 *
 * 安全：
 *   - 認證 + trip permission 必驗
 *   - 每個 update.id 必須屬於 path tripId（join trip_days）
 *   - 任一 day_id 跨天 move 必須屬於同 tripId（防越權）
 *   - 全 atomic 透過 db.batch() — 一筆失敗整批 rollback
 */
import { logAudit } from '../../../_audit';
import { hasPermission, requireAuth } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json, parseJsonBody, buildUpdateClause } from '../../../_utils';
import type { Env } from '../../../_types';

const ALLOWED_FIELDS = ['sort_order', 'day_id', 'time'] as const;

interface BatchUpdateItem {
  id: number;
  fields: Record<string, unknown>;
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  const { id: tripId } = context.params as { id: string };
  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, tripId, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  const body = await parseJsonBody<{ updates?: unknown }>(context.request);
  const rawUpdates = body.updates;
  if (!Array.isArray(rawUpdates) || rawUpdates.length === 0) {
    throw new AppError('DATA_VALIDATION', 'updates 必須是非空陣列');
  }

  const validated: BatchUpdateItem[] = [];
  for (const raw of rawUpdates) {
    if (!raw || typeof raw !== 'object') {
      throw new AppError('DATA_VALIDATION', 'updates[] 必須是物件');
    }
    const item = raw as Record<string, unknown>;
    const id = item.id;
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
      throw new AppError('DATA_VALIDATION', 'updates[].id 必須是正整數');
    }
    const fields: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in item) fields[key] = item[key];
    }
    if (Object.keys(fields).length === 0) {
      throw new AppError('DATA_VALIDATION', `updates[id=${id}] 無可更新欄位`);
    }
    if ('sort_order' in fields && (typeof fields.sort_order !== 'number' || !Number.isInteger(fields.sort_order))) {
      throw new AppError('DATA_VALIDATION', `updates[id=${id}].sort_order 必須是整數`);
    }
    if ('day_id' in fields && (typeof fields.day_id !== 'number' || !Number.isInteger(fields.day_id) || (fields.day_id as number) <= 0)) {
      throw new AppError('DATA_VALIDATION', `updates[id=${id}].day_id 必須是正整數`);
    }
    if ('time' in fields && fields.time != null && typeof fields.time !== 'string') {
      throw new AppError('DATA_VALIDATION', `updates[id=${id}].time 必須是字串或 null`);
    }
    validated.push({ id, fields });
  }

  const ids = validated.map((u) => u.id);
  const idPlaceholders = ids.map(() => '?').join(',');
  const ownership = await db
    .prepare(`SELECT e.id FROM trip_entries e JOIN trip_days d ON e.day_id = d.id WHERE e.id IN (${idPlaceholders}) AND d.trip_id = ?`)
    .bind(...ids, tripId)
    .all<{ id: number }>();
  const ownedIds = new Set(ownership.results.map((r) => r.id));
  for (const u of validated) {
    if (!ownedIds.has(u.id)) {
      throw new AppError('DATA_NOT_FOUND', `entry ${u.id} 不屬於 trip ${tripId}`);
    }
  }

  const targetDayIds = Array.from(new Set(
    validated
      .map((u) => u.fields.day_id)
      .filter((d): d is number => typeof d === 'number'),
  ));
  if (targetDayIds.length > 0) {
    const dayPlaceholders = targetDayIds.map(() => '?').join(',');
    const dayCheck = await db
      .prepare(`SELECT id FROM trip_days WHERE id IN (${dayPlaceholders}) AND trip_id = ?`)
      .bind(...targetDayIds, tripId)
      .all<{ id: number }>();
    const okDays = new Set(dayCheck.results.map((r) => r.id));
    for (const d of targetDayIds) {
      if (!okDays.has(d)) {
        throw new AppError('PERM_DENIED', `day ${d} 不屬於 trip ${tripId}`);
      }
    }
  }

  const statements = validated.map((u) => {
    const clause = buildUpdateClause(u.fields, ALLOWED_FIELDS);
    if (!clause) throw new AppError('DATA_VALIDATION', `updates[id=${u.id}] 無有效欄位`);
    return db.prepare(`UPDATE trip_entries SET ${clause.setClauses} WHERE id = ?`).bind(...clause.values, u.id);
  });

  try {
    await db.batch(statements);
  } catch {
    throw new AppError('SYS_DB_ERROR', 'DB 暫時無法處理，請稍後重試');
  }

  await Promise.all(validated.map((u) =>
    logAudit(db, {
      tripId,
      tableName: 'trip_entries',
      recordId: u.id,
      action: 'update',
      changedBy: auth.email,
      diffJson: JSON.stringify(u.fields),
    }),
  ));

  return json({ ok: true, updated: validated.length });
};
