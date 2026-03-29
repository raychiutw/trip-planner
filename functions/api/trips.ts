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

  const bodyOrError = await parseJsonBody<Record<string, unknown>>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  const id = body.id as string | undefined;
  const name = body.name as string | undefined;
  const owner = body.owner as string | undefined;
  const startDate = body.startDate as string | undefined;
  const endDate = body.endDate as string | undefined;

  if (!id || !name || !owner || !startDate || !endDate) {
    throw new AppError('DATA_VALIDATION', '缺必填欄位：id, name, owner, startDate, endDate');
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

  stmts.push(
    db.prepare(
      'INSERT INTO trip_permissions (email, trip_id, role) VALUES (?, ?, ?)'
    ).bind(auth.email, id, 'admin')
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

  let sql: string;
  if (showAll && auth?.isAdmin) {
    sql = 'SELECT id AS tripId, name, owner, title, self_drive, countries, published, auto_scroll, footer, is_default FROM trips ORDER BY name ASC';
  } else {
    sql = 'SELECT id AS tripId, name, owner, title, self_drive, countries, published, auto_scroll, footer, is_default FROM trips WHERE published = 1 ORDER BY name ASC';
  }

  const { results } = await context.env.DB.prepare(sql).all();
  return json(results);
};
