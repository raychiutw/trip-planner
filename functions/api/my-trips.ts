/**
 * GET /api/my-trips — 回傳使用者有權限的 trip 摘要（id / name / title / totalDays）
 *
 * v2.22.1: 加 name / title / totalDays 給 AddPoiFavoriteToTripPage dropdown 顯示
 *   trip 名稱用（之前只回 tripId，dropdown 看到「選擇行程…」之後 options 空白）。
 *   totalDays 從 trip_days COUNT subquery 算。Backwards-compatible：既有 callers
 *   只 read tripId 仍 work。
 */

import { AppError } from './_errors';
import { json, getAuth } from './_utils';
import type { Env } from './_types';

const SELECT_BASE = `
  SELECT DISTINCT
    p.trip_id AS tripId,
    t.name AS name,
    t.title AS title,
    COALESCE((SELECT COUNT(*) FROM trip_days td WHERE td.trip_id = t.id), 0) AS totalDays
  FROM trip_permissions p
  INNER JOIN trips t ON t.id = p.trip_id
`;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  // INNER JOIN trips so orphan permission rows (trip deleted but permission left
  // behind) never leak into /trips landing or ManagePage trip selector.
  // V2 cutover phase 2: 純 user_id-keyed query (email column dropped, '*' wildcard 也走了)
  let results;
  if (auth.isAdmin) {
    const { results: rows } = await env.DB
      .prepare(`${SELECT_BASE} ORDER BY p.trip_id`)
      .all();
    results = rows;
  } else {
    if (!auth.userId) return json([]);
    const { results: rows } = await env.DB
      .prepare(`${SELECT_BASE} WHERE p.user_id = ? ORDER BY p.trip_id`)
      .bind(auth.userId)
      .all();
    results = rows;
  }

  return json(results);
};
