import { logAudit, computeDiff } from '../_audit';
import { hasWritePermission } from '../_auth';
import { AppError } from '../_errors';
import { json, getAuth, parseJsonBody, buildUpdateClause } from '../_utils';
import type { Env } from '../_types';

// Migration 0045: dropped og_description/self_drive/food_prefs/auto_scroll/footer/is_default.
// Added data_source/default_travel_mode/lang (Q1, Q2). `region` derived from
// trip_destinations join — not a writable column.
const ALLOWED_FIELDS = [
  'name', 'owner', 'title', 'description',
  'countries', 'published',
  'data_source', 'default_travel_mode', 'lang',
] as const;

interface TripDestRow {
  dest_order: number;
  name: string;
  lat: number | null;
  lng: number | null;
  day_quota: number | null;
  sub_areas: string | null;
  osm_id: number | null;
  osm_type: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };
  const db = context.env.DB;

  const row = await db.prepare('SELECT *, id AS tripId FROM trips WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!row) throw new AppError('DATA_NOT_FOUND');

  // Commit 8: include trip_destinations array in single-trip GET response.
  // sub_areas stored as JSON array string — parse for client convenience.
  const dests = await db
    .prepare(
      'SELECT dest_order, name, lat, lng, day_quota, sub_areas, osm_id, osm_type FROM trip_destinations WHERE trip_id = ? ORDER BY dest_order ASC',
    )
    .bind(id)
    .all<TripDestRow>();

  row.destinations = dests.results.map((d) => ({
    ...d,
    sub_areas: d.sub_areas ? safeParseJson(d.sub_areas) : null,
  }));

  return json(row);
};

function safeParseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * DELETE /api/trips/:id — 刪除整個行程。
 *
 * V2-P7 PR-Q：trips 列表卡片 ... 菜單的「刪除」入口。權限：僅 trip owner
 * 或 admin（hasPermission 把 co-editor 也放行，不適用 destructive 操作）。
 *
 * Cascade：trip_days / trip_entries / pois (via trip_pois) / trip_pois /
 * poi_relations / trip_docs / trip_doc_entries / trip_permissions / ideas /
 * trip_requests 都有 FK ON DELETE CASCADE references trips(id)，自動清。
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id } = context.params as { id: string };
  const db = context.env.DB;

  const existing = await db
    .prepare('SELECT * FROM trips WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  if (!existing) throw new AppError('DATA_NOT_FOUND');

  // Strict ownership check：只 owner 或 admin 可刪。Co-editor (trip_permissions
  // 列表上的) 雖然能編輯，但 destructive 操作必須 limit 到 owner。
  const ownerEmail = typeof existing.owner === 'string' ? existing.owner.toLowerCase() : '';
  if (!auth.isAdmin && ownerEmail !== auth.email.toLowerCase()) {
    throw new AppError('PERM_DENIED', '僅行程擁有者或管理者可刪除');
  }

  await db.prepare('DELETE FROM trips WHERE id = ?').bind(id).run();

  await logAudit(db, {
    tripId: id,
    tableName: 'trips',
    recordId: null,
    action: 'delete',
    changedBy: auth.email,
    snapshot: JSON.stringify(existing),
  });

  return json({ ok: true });
};

interface DestinationInput {
  name: string;
  lat?: number | null;
  lng?: number | null;
  day_quota?: number | null;
  sub_areas?: string[] | null;
  osm_id?: number | null;
  osm_type?: 'node' | 'way' | 'relation' | null;
}

function isValidDestination(d: unknown): d is DestinationInput {
  if (!d || typeof d !== 'object') return false;
  const obj = d as Record<string, unknown>;
  return typeof obj.name === 'string' && obj.name.trim().length > 0;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id } = context.params as { id: string };

  const db = context.env.DB;
  const [hasPerm, existing] = await Promise.all([
    hasWritePermission(db, auth.email, id, auth.isAdmin),
    db.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first() as Promise<Record<string, unknown> | null>,
  ]);
  if (!hasPerm) throw new AppError('PERM_DENIED');
  if (!existing) throw new AppError('DATA_NOT_FOUND');

  const body = await parseJsonBody<Record<string, unknown>>(context.request);

  // OSM PR (migration 0045)：destinations[] 為非 trips 欄位的特殊 nested resource，
  // 用 full-replacement 語意 — 給定 array 即 DELETE existing + INSERT all。
  // 無 destinations key → 不動 trip_destinations。空 array → 清光（user 想清空）。
  const hasDestinations = Array.isArray(body.destinations);
  const update = buildUpdateClause(body, ALLOWED_FIELDS);
  if (!update && !hasDestinations) throw new AppError('DATA_VALIDATION', '無有效欄位可更新');

  const changedBy = auth.email;

  if (update) {
    await db.prepare(`UPDATE trips SET ${update.setClauses} WHERE id = ?`).bind(...update.values, id).run();
  }

  if (hasDestinations) {
    const inputs = (body.destinations as unknown[]).filter(isValidDestination);
    await db.prepare('DELETE FROM trip_destinations WHERE trip_id = ?').bind(id).run();
    if (inputs.length > 0) {
      const inserts = inputs.map((d, idx) =>
        db.prepare(
          `INSERT INTO trip_destinations
            (trip_id, dest_order, name, lat, lng, day_quota, sub_areas, osm_id, osm_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          id,
          idx,
          d.name,
          d.lat ?? null,
          d.lng ?? null,
          d.day_quota ?? null,
          d.sub_areas ? JSON.stringify(d.sub_areas) : null,
          d.osm_id ?? null,
          d.osm_type ?? null,
        ),
      );
      await db.batch(inserts);
    }
  }

  const newFields: Record<string, unknown> = update
    ? Object.fromEntries(update.fields.map(f => [f, body[f]]))
    : {};
  if (hasDestinations) {
    newFields.destinations_count = (body.destinations as unknown[]).length;
  }

  await logAudit(db, {
    tripId: id,
    tableName: 'trips',
    recordId: null,
    action: 'update',
    changedBy,
    diffJson: computeDiff(existing, newFields),
  });

  return json({ ok: true });
};
