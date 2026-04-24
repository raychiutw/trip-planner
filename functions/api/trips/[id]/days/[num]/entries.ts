import { logAudit } from '../../../../_audit';
import { hasPermission } from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { findOrCreatePoi } from '../../../../_poi';
import { validateEntryBody, detectGarbledText } from '../../../../_validate';
import { json, getAuth, parseJsonBody } from '../../../../_utils';
import type { Env } from '../../../../_types';

/**
 * POST /api/trips/:id/days/:num/entries — 新增 entry 到指定天
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, num } = context.params as { id: string; num: string };
  const dayNum = Number(num);
  if (!Number.isInteger(dayNum) || dayNum < 1) {
    throw new AppError('DATA_VALIDATION', 'day_num 格式錯誤');
  }

  const db = context.env.DB;
  const changedBy = auth.email;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  const day = await db
    .prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = ?')
    .bind(id, dayNum)
    .first() as { id: number } | null;

  if (!day) throw new AppError('DATA_NOT_FOUND');
  const dayId = day.id;

  const body = await parseJsonBody<Record<string, unknown>>(context.request);

  const validation = validateEntryBody(body);
  if (!validation.ok) throw new AppError('DATA_VALIDATION', validation.error);

  // 亂碼偵測
  for (const f of ['title', 'description', 'note', 'travel_desc']) {
    if (f in body && typeof body[f] === 'string' && detectGarbledText(body[f] as string)) {
      throw new AppError('DATA_ENCODING', `欄位 ${f} 包含疑似亂碼，請確認 encoding 為 UTF-8`);
    }
  }

  // Phase 2: poi_type 白名單（避免 pois.type CHECK 失敗）
  const ALLOWED_POI_TYPES = new Set(['hotel', 'restaurant', 'shopping', 'parking', 'attraction', 'transport', 'activity', 'other']);
  if (body.poi_type !== undefined && (typeof body.poi_type !== 'string' || !ALLOWED_POI_TYPES.has(body.poi_type))) {
    throw new AppError('DATA_VALIDATION', `poi_type 無效（允許：${[...ALLOWED_POI_TYPES].join(', ')}）`);
  }

  // sort_order：指定則用指定值，否則 append 到最後
  let sortOrder: number;
  if (typeof body.sort_order === 'number') {
    sortOrder = body.sort_order;
  } else {
    const max = await db
      .prepare('SELECT MAX(sort_order) as max_sort FROM trip_entries WHERE day_id = ?')
      .bind(dayId)
      .first() as { max_sort: number | null } | null;
    sortOrder = (max?.max_sort ?? -1) + 1;
  }

  // Phase 2：title 必須為非空白字串（validateEntryBody 只檢 falsiness，空白字串通過）
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) throw new AppError('DATA_VALIDATION', 'title 不可為空白');

  // Phase 2：entry 對應的 pois master（find-or-create），再回填 poi_id
  // 包在 try/catch 內統一 error path；POI 建成後若 INSERT 失敗，orphan POI
  // 由後續 `migrate-entries-to-pois.js --clean-orphans` 清理。
  let row;
  try {
    const poiId = await findOrCreatePoi(db, {
      name: title,
      type: (body.poi_type as string) || 'attraction',
      description: (body.description as string | undefined) ?? null,
      maps: (body.maps as string | undefined) ?? null,
      mapcode: (body.mapcode as string | undefined) ?? null,
      lat: (body.lat as number | undefined) ?? null,
      lng: (body.lng as number | undefined) ?? null,
      google_rating: (body.google_rating as number | undefined) ?? null,
      source: 'ai',
    });

    row = await db
      .prepare(`INSERT INTO trip_entries (day_id, sort_order, time, title, description, source, note, travel_type, travel_desc, travel_min, poi_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
      .bind(
        dayId, sortOrder,
        body.time ?? null,
        title,
        body.description ?? null,
        body.source ?? 'ai',
        body.note ?? null,
        body.travel_type ?? null,
        body.travel_desc ?? null,
        body.travel_min ?? null,
        poiId,
      )
      .first();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('SYS_DB_ERROR', 'DB 暫時無法處理，請稍後重試');
  }

  if (!row) throw new AppError('DATA_SAVE_FAILED', '新增 entry 失敗');

  await logAudit(db, {
    tripId: id,
    tableName: 'trip_entries',
    recordId: (row as Record<string, unknown>).id as number,
    action: 'insert',
    changedBy,
    diffJson: JSON.stringify({ day_num: dayNum, title: body.title, sort_order: sortOrder }),
  });

  return json(row, 201);
};
