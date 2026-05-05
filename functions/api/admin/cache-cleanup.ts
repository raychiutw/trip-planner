/**
 * POST /api/admin/cache-cleanup — Delete expired pois_search_cache rows.
 *
 * Called by scripts/google-quota-monitor.ts daily so the 24h-TTL cache table
 * doesn't grow unbounded.
 *
 * Auth: admin only.
 * Response: { deleted: N }
 */
import { requireAdmin } from '../_auth';
import { cleanupExpiredCache } from '../../../src/lib/maps/cache';
import type { Env } from '../_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  requireAdmin(context);
  const deleted = await cleanupExpiredCache(context.env.DB);
  return new Response(JSON.stringify({ deleted }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
