import { logAudit } from '../../../../_audit';
import { AppError } from '../../../../_errors';
import { json, getAuth } from '../../../../_utils';
import type { Env } from '../../../../_types';

const ALLOWED_TABLES = ['trips', 'trip_days', 'trip_entries', 'pois', 'trip_pois', 'poi_relations', 'trip_docs', 'trip_doc_entries', 'trip_requests', 'trip_permissions'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

const TABLE_COLUMNS: Record<AllowedTable, readonly string[]> = {
  trips:            ['id', 'name', 'owner', 'title', 'description', 'og_description', 'self_drive', 'countries', 'published', 'food_prefs', 'auto_scroll', 'footer', 'created_at', 'updated_at'],
  trip_days:        ['id', 'trip_id', 'day_num', 'date', 'day_of_week', 'label', 'updated_at'],
  trip_entries:     ['id', 'day_id', 'sort_order', 'time', 'title', 'description', 'source', 'maps', 'mapcode', 'google_rating', 'note', 'travel_type', 'travel_desc', 'travel_min', 'location', 'poi_id', 'updated_at'],
  pois:             ['id', 'type', 'name', 'description', 'note', 'address', 'phone', 'email', 'website', 'hours', 'google_rating', 'category', 'maps', 'mapcode', 'lat', 'lng', 'country', 'source', 'created_at', 'updated_at'],
  trip_pois:        ['id', 'trip_id', 'poi_id', 'context', 'day_id', 'entry_id', 'sort_order', 'description', 'note', 'hours', 'checkout', 'breakfast_included', 'breakfast_note', 'price', 'reservation', 'reservation_url', 'must_buy', 'source', 'created_at', 'updated_at'],
  poi_relations:    ['id', 'poi_id', 'related_poi_id', 'relation_type', 'note'],
  trip_docs:     ['id', 'trip_id', 'doc_type', 'title', 'updated_at'],
  trip_doc_entries: ['id', 'doc_id', 'sort_order', 'section', 'title', 'content', 'updated_at'],
  trip_requests:    ['id', 'trip_id', 'mode', 'message', 'submitted_by', 'reply', 'status', 'created_at'],
  trip_permissions: ['id', 'email', 'trip_id', 'role', 'created_at'],
};

interface AuditRow {
  id: number;
  trip_id: string;
  table_name: string;
  record_id: number | null;
  action: 'insert' | 'update' | 'delete';
  changed_by: string | null;
  request_id: number | null;
  diff_json: string | null;
  snapshot: string | null;
  created_at: string;
}

// POST /api/trips/:id/audit/:aid/rollback
// Only admin can rollback
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  if (!auth.isAdmin) throw new AppError('PERM_ADMIN_ONLY');

  const { id, aid } = context.params as { id: string; aid: string };
  const db = context.env.DB;
  const changedBy = auth.email;

  const auditRow = await db
    .prepare('SELECT * FROM audit_log WHERE id = ? AND trip_id = ?')
    .bind(Number(aid), id)
    .first() as AuditRow | null;

  if (!auditRow) throw new AppError('DATA_NOT_FOUND', '找不到此 audit 記錄');

  const { table_name, record_id, action, diff_json, snapshot } = auditRow;

  const safeTable = ALLOWED_TABLES.find(t => t === table_name);
  if (!safeTable) {
    throw new AppError('DATA_VALIDATION', '無效的表格名稱');
  }
  const allowedCols = TABLE_COLUMNS[safeTable];

  if (action === 'delete') {
    // Re-INSERT using the snapshot
    if (!snapshot) throw new AppError('DATA_VALIDATION', '無可用的快照進行回滾');

    let snapshotRow: Record<string, unknown>;
    try {
      snapshotRow = JSON.parse(snapshot);
    } catch {
      throw new AppError('DATA_VALIDATION', '快照 JSON 格式無效');
    }

    // Remove system-managed fields that should be auto-generated, keep the original id
    // Also validate column names against the whitelist
    const snapshotKeys = Object.keys(snapshotRow).filter(k => k !== 'updated_at' && k !== 'created_at');
    const invalidSnapshotCols = snapshotKeys.filter(k => !allowedCols.includes(k));
    if (invalidSnapshotCols.length > 0) {
      throw new AppError('DATA_VALIDATION', `Invalid column(s) in snapshot: ${invalidSnapshotCols.join(', ')}`);
    }
    const cols = snapshotKeys.join(', ');
    const placeholders = snapshotKeys.map(() => '?').join(', ');
    const values = snapshotKeys.map(k => snapshotRow[k] ?? null);

    // Check if a record with this id already exists to avoid overwriting newer data
    if (snapshotRow.id != null) {
      const existing = await db.prepare(`SELECT 1 FROM ${safeTable} WHERE id = ?`).bind(snapshotRow.id).first();
      if (existing) {
        throw new AppError('DATA_CONFLICT', '無法回滾：此 ID 的記錄已存在');
      }
    }
    await db.prepare(`INSERT INTO ${safeTable} (${cols}) VALUES (${placeholders})`).bind(...values).run();

    await logAudit(db, {
      tripId: id,
      tableName: safeTable,
      recordId: record_id,
      action: 'insert',
      changedBy,
      diffJson: JSON.stringify({ rollback_of: auditRow.id, original_action: 'delete' }),
    });

    return json({ ok: true, rolled_back: 'delete->re-insert' });
  }

  if (action === 'update') {
    // Revert fields using diff_json old values
    if (!diff_json) throw new AppError('DATA_VALIDATION', '無 diff 資料可回滾');
    if (record_id === null) throw new AppError('DATA_VALIDATION', '缺少 record_id 無法回滾');

    let diff: Record<string, { old: unknown; new: unknown }>;
    try {
      diff = JSON.parse(diff_json);
    } catch {
      throw new AppError('DATA_VALIDATION', 'diff JSON 格式無效');
    }

    const revertFields = Object.keys(diff);
    if (revertFields.length === 0) throw new AppError('DATA_VALIDATION', '無欄位可還原');

    const invalidDiffCols = revertFields.filter(f => !allowedCols.includes(f));
    if (invalidDiffCols.length > 0) {
      throw new AppError('DATA_VALIDATION', `Invalid column(s) in diff: ${invalidDiffCols.join(', ')}`);
    }

    const setClauses = [...revertFields.map(f => `${f} = ?`), 'updated_at = CURRENT_TIMESTAMP'].join(', ');
    const values = [...revertFields.map(f => diff[f]?.old ?? null), record_id];

    const result = await db
      .prepare(`UPDATE ${safeTable} SET ${setClauses} WHERE id = ?`)
      .bind(...values)
      .run();

    if (result.meta.changes === 0) throw new AppError('DATA_NOT_FOUND', '找不到要還原的記錄');

    const revertedFields = Object.fromEntries(revertFields.map(f => [f, diff[f]?.old]));
    await logAudit(db, {
      tripId: id,
      tableName: safeTable,
      recordId: record_id,
      action: 'update',
      changedBy,
      diffJson: JSON.stringify({ rollback_of: auditRow.id, reverted: revertedFields }),
    });

    return json({ ok: true, rolled_back: 'update->revert' });
  }

  if (action === 'insert') {
    // DELETE the record that was inserted
    if (record_id === null) throw new AppError('DATA_VALIDATION', '缺少 record_id 無法回滾');

    const oldRow = await db.prepare(`SELECT * FROM ${safeTable} WHERE id = ?`).bind(record_id).first() as Record<string, unknown> | null;

    await db.prepare(`DELETE FROM ${safeTable} WHERE id = ?`).bind(record_id).run();

    await logAudit(db, {
      tripId: id,
      tableName: safeTable,
      recordId: record_id,
      action: 'delete',
      changedBy,
      snapshot: oldRow ? JSON.stringify(oldRow) : undefined,
      diffJson: JSON.stringify({ rollback_of: auditRow.id, original_action: 'insert' }),
    });

    return json({ ok: true, rolled_back: 'insert->delete' });
  }

  throw new AppError('DATA_VALIDATION', `Unknown action: ${action}`);
};
