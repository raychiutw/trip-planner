import { logAudit } from '../../../../_audit';

interface Env {
  DB: D1Database;
}

const ALLOWED_TABLES = ['trips', 'days', 'hotels', 'entries', 'restaurants', 'shopping', 'trip_docs'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

const TABLE_COLUMNS: Record<AllowedTable, readonly string[]> = {
  trips:       ['id', 'name', 'owner', 'title', 'description', 'og_description', 'self_drive', 'countries', 'published', 'food_prefs', 'auto_scroll', 'footer_json', 'created_at', 'updated_at'],
  days:        ['id', 'trip_id', 'day_num', 'date', 'day_of_week', 'label', 'weather_json', 'updated_at'],
  hotels:      ['id', 'day_id', 'name', 'checkout', 'source', 'details', 'breakfast', 'note', 'parking_json'],
  entries:     ['id', 'day_id', 'sort_order', 'time', 'title', 'body', 'source', 'maps', 'mapcode', 'rating', 'note', 'travel_type', 'travel_desc', 'travel_min', 'location_json', 'updated_at'],
  restaurants: ['id', 'entry_id', 'sort_order', 'name', 'category', 'hours', 'price', 'reservation', 'reservation_url', 'description', 'note', 'rating', 'maps', 'mapcode', 'source'],
  shopping:    ['id', 'parent_type', 'parent_id', 'sort_order', 'name', 'category', 'hours', 'must_buy', 'note', 'rating', 'maps', 'mapcode', 'source'],
  trip_docs:   ['id', 'trip_id', 'doc_type', 'content', 'updated_at'],
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// POST /api/trips/:id/audit/:aid/rollback
// Only admin can rollback
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);
  if (!auth.isAdmin) return json({ error: '僅管理者可執行回滾' }, 403);

  const { id, aid } = context.params as { id: string; aid: string };
  const db = context.env.DB;
  const changedBy = auth?.email || 'anonymous';

  const auditRow = await db
    .prepare('SELECT * FROM audit_log WHERE id = ? AND trip_id = ?')
    .bind(Number(aid), id)
    .first() as AuditRow | null;

  if (!auditRow) return json({ error: 'Audit log entry not found' }, 404);

  const { table_name, record_id, action, diff_json, snapshot } = auditRow;

  const safeTable = ALLOWED_TABLES.find(t => t === table_name);
  if (!safeTable) {
    return json({ error: 'Invalid table name' }, 400);
  }
  const allowedCols = TABLE_COLUMNS[safeTable];

  if (action === 'delete') {
    // Re-INSERT using the snapshot
    if (!snapshot) return json({ error: 'No snapshot available for rollback' }, 400);

    let snapshotRow: Record<string, unknown>;
    try {
      snapshotRow = JSON.parse(snapshot);
    } catch {
      return json({ error: 'Invalid snapshot JSON' }, 400);
    }

    // Remove system-managed fields that should be auto-generated, keep the original id
    // Also validate column names against the whitelist
    const snapshotKeys = Object.keys(snapshotRow).filter(k => k !== 'updated_at' && k !== 'created_at');
    const invalidSnapshotCols = snapshotKeys.filter(k => !allowedCols.includes(k));
    if (invalidSnapshotCols.length > 0) {
      return json({ error: `Invalid column(s) in snapshot: ${invalidSnapshotCols.join(', ')}` }, 400);
    }
    const cols = snapshotKeys.join(', ');
    const placeholders = snapshotKeys.map(() => '?').join(', ');
    const values = snapshotKeys.map(k => snapshotRow[k] ?? null);

    // Check if a record with this id already exists to avoid overwriting newer data
    if (snapshotRow.id != null) {
      const existing = await db.prepare(`SELECT 1 FROM ${safeTable} WHERE id = ?`).bind(snapshotRow.id).first();
      if (existing) {
        return json({ error: 'Cannot rollback: a record with this id already exists' }, 409);
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
    if (!diff_json) return json({ error: 'No diff_json available for rollback' }, 400);
    if (record_id === null) return json({ error: 'No record_id for update rollback' }, 400);

    let diff: Record<string, { old: unknown; new: unknown }>;
    try {
      diff = JSON.parse(diff_json);
    } catch {
      return json({ error: 'Invalid diff_json' }, 400);
    }

    const revertFields = Object.keys(diff);
    if (revertFields.length === 0) return json({ error: 'No fields to revert' }, 400);

    const invalidDiffCols = revertFields.filter(f => !allowedCols.includes(f));
    if (invalidDiffCols.length > 0) {
      return json({ error: `Invalid column(s) in diff: ${invalidDiffCols.join(', ')}` }, 400);
    }

    const setClauses = [...revertFields.map(f => `${f} = ?`), 'updated_at = CURRENT_TIMESTAMP'].join(', ');
    const values = [...revertFields.map(f => diff[f].old ?? null), record_id];

    const result = await db
      .prepare(`UPDATE ${safeTable} SET ${setClauses} WHERE id = ?`)
      .bind(...values)
      .run();

    if (result.meta.changes === 0) return json({ error: 'Record not found for revert' }, 404);

    const revertedFields = Object.fromEntries(revertFields.map(f => [f, diff[f].old]));
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
    if (record_id === null) return json({ error: 'No record_id for insert rollback' }, 400);

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

  return json({ error: `Unknown action: ${action}` }, 400);
};
