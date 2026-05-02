import { logAudit } from './_audit';
import { AppError } from './_errors';
import { json, getAuth, parseJsonBody } from './_utils';
import type { Env } from './_types';

const TRIPID_RE = /^[a-z0-9-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MAX_DAYS = 30;
const MS_PER_DAY = 86400000;

const TRIP_DOC_TYPES = ['flights', 'checklist', 'backup', 'suggestions', 'emergency'] as const;

interface DestinationInput {
  name?: string;
  lat?: number;
  lng?: number;
  day_quota?: number;
  sub_areas?: string[];
  osm_id?: number;
  osm_type?: 'node' | 'way' | 'relation';
}

function str(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (val != null && typeof val === 'object') return JSON.stringify(val);
  return fallback;
}

function nullableStr(val: unknown): string | null {
  if (typeof val === 'string' && val.length > 0) return val;
  return null;
}

function nullableInt(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  return null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const body = await parseJsonBody<Record<string, unknown>>(context.request);

  const id = body.id as string | undefined;
  const name = body.name as string | undefined;
  const startDate = body.startDate as string | undefined;
  const endDate = body.endDate as string | undefined;

  // PR-CC 2026-04-26：owner 強制 = auth.email，不再讀 body.owner（防偽造）。
  const owner = auth.email;

  if (!id || !name || !startDate || !endDate) {
    throw new AppError('DATA_VALIDATION', '缺必填欄位：id, name, startDate, endDate');
  }
  if (!TRIPID_RE.test(id) || id.length > 100) {
    throw new AppError('DATA_VALIDATION', 'tripId 格式錯誤：僅允許小寫英數字與連字號，最長 100 字元');
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    throw new AppError('DATA_VALIDATION', '日期格式錯誤：須為 YYYY-MM-DD');
  }
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError('DATA_VALIDATION', '日期無效');
  }
  if (end < start) {
    throw new AppError('DATA_VALIDATION', 'endDate 必須 ≥ startDate');
  }
  const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  if (totalDays > MAX_DAYS) {
    throw new AppError('DATA_VALIDATION', `行程天數不可超過 ${MAX_DAYS} 天`);
  }

  // Validate optional destinations array (commit 7)
  const destsRaw = body.destinations;
  let destinations: DestinationInput[] = [];
  if (Array.isArray(destsRaw)) {
    destinations = destsRaw.filter((d): d is DestinationInput =>
      d != null && typeof d === 'object' && typeof (d as DestinationInput).name === 'string',
    );
  }

  const db = context.env.DB;
  const existing = await db.prepare('SELECT 1 FROM trips WHERE id = ?').bind(id).first();
  if (existing) throw new AppError('DATA_CONFLICT', 'tripId 已存在');

  const stmts: D1PreparedStatement[] = [];

  // Migration 0045: dropped self_drive/og_description/footer/food_prefs/auto_scroll/is_default.
  // Added data_source/default_travel_mode/lang. `region` not added — derived from
  // trip_destinations join in /api/trips/:id (commit 8).
  stmts.push(
    db.prepare(
      'INSERT INTO trips (id, name, owner, title, description, countries, published, data_source, default_travel_mode, lang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      id, name, owner,
      str(body.title),
      str(body.description),
      str(body.countries, 'JP'),
      body.published != null ? Number(body.published) : 0,
      str(body.data_source, 'manual'),
      str(body.default_travel_mode, 'driving'),
      str(body.lang, 'zh-TW'),
    ),
  );

  // trip_days
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start.getTime() + i * MS_PER_DAY);
    const date = d.toISOString().slice(0, 10);
    const dayOfWeek = WEEKDAYS[d.getUTCDay()];
    stmts.push(
      db.prepare(
        'INSERT INTO trip_days (trip_id, day_num, date, day_of_week, label) VALUES (?, ?, ?, ?, ?)',
      ).bind(id, i + 1, date, dayOfWeek, ''),
    );
  }

  // trip_permissions: owner row (PR-CC 2026-04-26 owner role replaces admin)
  stmts.push(
    db.prepare(
      'INSERT INTO trip_permissions (email, trip_id, role) VALUES (?, ?, ?)',
    ).bind(auth.email, id, 'owner'),
  );

  // trip_destinations: write each dest with dest_order (commit 7)
  destinations.forEach((d, idx) => {
    stmts.push(
      db.prepare(
        `INSERT INTO trip_destinations (trip_id, dest_order, name, lat, lng, day_quota, sub_areas, osm_id, osm_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        idx + 1,
        d.name ?? '',
        nullableInt(d.lat),
        nullableInt(d.lng),
        nullableInt(d.day_quota),
        Array.isArray(d.sub_areas) ? JSON.stringify(d.sub_areas) : null,
        nullableInt(d.osm_id),
        nullableStr(d.osm_type),
      ),
    );
  });

  // Auto-create 5 trip_docs stubs (commit 9). Empty title; tp-create skill or
  // user fills in later. Avoids "UI-built trip has no docs tab content" gap.
  for (const docType of TRIP_DOC_TYPES) {
    stmts.push(
      db.prepare(
        'INSERT INTO trip_docs (trip_id, doc_type, title) VALUES (?, ?, ?)',
      ).bind(id, docType, ''),
    );
  }

  await db.batch(stmts);

  await logAudit(db, {
    tripId: id,
    tableName: 'trips',
    recordId: null,
    action: 'insert',
    changedBy: auth.email,
    diffJson: JSON.stringify(body),
  });

  return json({ ok: true, tripId: id, daysCreated: totalDays, destinationsCreated: destinations.length }, 201);
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const showAll = url.searchParams.get('all') === '1';
  const auth = getAuth(context);

  // Migration 0045: dropped self_drive/auto_scroll/footer/is_default from baseCols.
  // Added data_source/default_travel_mode/lang for client awareness.
  // Note: `is_default` GONE — frontend fallback path (TripPage) updated to use
  // "user's first published=1 trip" (commit 18).
  const baseCols = `t.id AS tripId, t.name, t.owner, t.title,
                    t.countries, t.published, t.data_source, t.default_travel_mode, t.lang,
                    (SELECT COUNT(*) FROM trip_days d WHERE d.trip_id = t.id) AS day_count,
                    (SELECT MIN(date) FROM trip_days d WHERE d.trip_id = t.id AND date IS NOT NULL) AS start_date,
                    (SELECT MAX(date) FROM trip_days d WHERE d.trip_id = t.id AND date IS NOT NULL) AS end_date,
                    (SELECT COUNT(DISTINCT email) FROM trip_permissions p WHERE p.trip_id = t.id) AS member_count`;

  const sql = showAll && auth?.isAdmin
    ? `SELECT ${baseCols} FROM trips t ORDER BY t.name ASC`
    : `SELECT ${baseCols} FROM trips t WHERE t.published = 1 ORDER BY t.name ASC`;

  const { results } = await context.env.DB.prepare(sql).all();
  return json(results);
};
