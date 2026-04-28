/**
 * GET /api/account/stats — Account hub Profile hero 3 stats aggregate
 *
 * Section 2 (terracotta-account-hub-page Requirement 2)：mockup line
 * 7437-7448 規範 hero「N 個行程 / N 天旅程 / N 位旅伴」三 stats，避免 client
 * 端 N+1 fetch。
 *
 * 用 user.email 比對 trip_permissions（owner + 共編都算），SUM trip_days
 * 拿總天數，COUNT distinct collaborator email（排除 user 自己）拿旅伴數。
 */
import { requireAuth } from '../_auth';
import { json } from '../_utils';
import type { Env } from '../_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  const email = auth.email.toLowerCase();
  const db = context.env.DB;

  // Trip count + total days：JOIN trip_permissions + trip_days，user 為 owner
  // 或共編都算入。GROUP BY trip 算 days 再 SUM。
  const tripStats = await db
    .prepare(
      `SELECT COUNT(DISTINCT t.id) AS trip_count,
              COALESCE(SUM(day_counts.day_count), 0) AS total_days
       FROM trips t
       INNER JOIN trip_permissions tp ON tp.trip_id = t.id
       LEFT JOIN (
         SELECT trip_id, COUNT(*) AS day_count
         FROM trip_days
         GROUP BY trip_id
       ) day_counts ON day_counts.trip_id = t.id
       WHERE tp.email = ? OR tp.email = '*'`,
    )
    .bind(email)
    .first<{ trip_count: number; total_days: number }>();

  // Collaborator count：跨 user 所有 trip 的 distinct email 數（不含自己 + 不含 wildcard '*'）
  const collabStats = await db
    .prepare(
      `SELECT COUNT(DISTINCT tp2.email) AS collab_count
       FROM trip_permissions tp1
       INNER JOIN trip_permissions tp2 ON tp1.trip_id = tp2.trip_id
       WHERE tp1.email = ?
         AND tp2.email != ?
         AND tp2.email != '*'`,
    )
    .bind(email, email)
    .first<{ collab_count: number }>();

  return json({
    tripCount: tripStats?.trip_count ?? 0,
    totalDays: tripStats?.total_days ?? 0,
    collaboratorCount: collabStats?.collab_count ?? 0,
  });
};
