/**
 * POST /api/admin/cache-cleanup — Delete expired pois_search_cache rows.
 *
 * Called by scripts/google-quota-monitor.ts daily so the 24h-TTL cache table
 * doesn't grow unbounded.
 *
 * Auth: admin only.
 * Response: { deleted: N }
 */
import { requireScope } from '../_auth';
import { cleanupExpiredCache } from '../../../src/lib/maps/cache';
import { json } from '../_utils';
import type { Env } from '../_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  requireScope(context, 'ops:cache');
  const deleted = await cleanupExpiredCache(context.env.DB);
  return json({ deleted });
};
