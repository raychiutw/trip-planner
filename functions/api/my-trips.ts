/**
 * GET /api/my-trips — 回傳使用者有權限的 tripId 列表
 */

import { AppError } from './_errors';
import { json, getAuth } from './_utils';
import type { Env } from './_types';

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
      .prepare(`SELECT DISTINCT p.trip_id AS tripId
                FROM trip_permissions p
                INNER JOIN trips t ON t.id = p.trip_id
                ORDER BY p.trip_id`)
      .all();
    results = rows;
  } else {
    if (!auth.userId) return json([]);
    const { results: rows } = await env.DB
      .prepare(`SELECT p.trip_id AS tripId
                FROM trip_permissions p
                INNER JOIN trips t ON t.id = p.trip_id
                WHERE p.user_id = ?
                ORDER BY p.trip_id`)
      .bind(auth.userId)
      .all();
    results = rows;
  }

  return json(results);
};
