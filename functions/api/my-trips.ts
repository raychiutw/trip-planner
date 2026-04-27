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
  // behind) never leak into /trips landing or ManagePage trip selector. Wildcard
  // '*' admin grant is filtered out — it's a sentinel, not a real tripId.
  let results;
  if (auth.isAdmin) {
    const { results: rows } = await env.DB
      .prepare(`SELECT DISTINCT p.trip_id AS tripId
                FROM trip_permissions p
                INNER JOIN trips t ON t.id = p.trip_id
                WHERE p.trip_id != ?
                ORDER BY p.trip_id`)
      .bind('*')
      .all();
    results = rows;
  } else {
    const { results: rows } = await env.DB
      .prepare(`SELECT p.trip_id AS tripId
                FROM trip_permissions p
                INNER JOIN trips t ON t.id = p.trip_id
                WHERE p.email = ? AND p.trip_id != ?
                ORDER BY p.trip_id`)
      .bind(auth.email.toLowerCase(), '*')
      .all();
    results = rows;
  }

  return json(results);
};
