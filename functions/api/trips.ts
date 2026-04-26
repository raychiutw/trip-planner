import { logAudit } from './_audit';
import { AppError } from './_errors';
import { json, getAuth, parseJsonBody } from './_utils';
import type { Env } from './_types';

const TRIPID_RE = /^[a-z0-9-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MAX_DAYS = 30;
const MS_PER_DAY = 86400000;

function str(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (val != null && typeof val === 'object') return JSON.stringify(val);
  return fallback;
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
  // User 指示「之後的誰建立就是誰是 owner」 — 從 server-side auth 取唯一可信來源。
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

  const db = context.env.DB;
  const existing = await db.prepare('SELECT 1 FROM trips WHERE id = ?').bind(id).first();
  if (existing) throw new AppError('DATA_CONFLICT', 'tripId 已存在');

  const stmts: D1PreparedStatement[] = [];

  stmts.push(
    db.prepare(
      'INSERT INTO trips (id, name, owner, title, description, og_description, self_drive, countries, published, food_prefs, auto_scroll, footer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id, name, owner,
      str(body.title),
      str(body.description),
      str(body.og_description),
      body.self_drive != null ? Number(body.self_drive) : 0,
      str(body.countries, 'JP'),
      body.published != null ? Number(body.published) : 0,
      str(body.food_prefs),
      str(body.auto_scroll),
      str(body.footer),
    )
  );

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start.getTime() + i * MS_PER_DAY);
    const date = d.toISOString().slice(0, 10);
    const dayOfWeek = WEEKDAYS[d.getUTCDay()];
    stmts.push(
      db.prepare(
        'INSERT INTO trip_days (trip_id, day_num, date, day_of_week, label) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, i + 1, date, dayOfWeek, '')
    );
  }

  // PR-CC 2026-04-26：自動加 owner 進 trip_permissions role='owner'（取代舊
  // 'admin' 角色）。`hasPermission` 三種 role 都認，前端 CollabSheet 可區分
  // 顯示 owner row 不可移除。
  stmts.push(
    db.prepare(
      'INSERT INTO trip_permissions (email, trip_id, role) VALUES (?, ?, ?)'
    ).bind(auth.email, id, 'owner')
  );

  await db.batch(stmts);

  await logAudit(db, {
    tripId: id,
    tableName: 'trips',
    recordId: null,
    action: 'insert',
    changedBy: auth.email,
    diffJson: JSON.stringify(body),
  });

  return json({ ok: true, tripId: id, daysCreated: totalDays }, 201);
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const showAll = url.searchParams.get('all') === '1';
  const auth = getAuth(context);

  // Enriched fields for /trips landing card meta:
  //   day_count    — number of days in trip (rendered as "JAPAN · 5 DAYS" eyebrow)
  //   start_date   — earliest day.date (rendered as "7/26 – 7/30" range)
  //   end_date     — latest day.date
  //   member_count — distinct emails on trip_permissions excluding wildcard
  //                  (rendered as "2 旅伴" — the count includes the owner)
  const baseCols = `t.id AS tripId, t.name, t.owner, t.title, t.self_drive,
                    t.countries, t.published, t.auto_scroll, t.footer, t.is_default,
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
