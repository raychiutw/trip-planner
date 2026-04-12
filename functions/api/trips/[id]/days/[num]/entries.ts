import { logAudit } from '../../../../_audit';
import { hasPermission } from '../../../../_auth';
import { AppError } from '../../../../_errors';
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

  let row;
  try {
    row = await db
      .prepare(`INSERT INTO trip_entries (day_id, sort_order, time, title, description, source, maps, mapcode, google_rating, note, travel_type, travel_desc, travel_min, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
      .bind(
        dayId, sortOrder,
        body.time ?? null,
        body.title as string,
        body.description ?? null,
        body.source ?? 'ai',
        body.maps ?? null,
        body.mapcode ?? null,
        body.google_rating ?? null,
        body.note ?? null,
        body.travel_type ?? null,
        body.travel_desc ?? null,
        body.travel_min ?? null,
        body.location ?? null,
      )
      .first();
  } catch {
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
