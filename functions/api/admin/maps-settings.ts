/**
 * GET /api/admin/maps-settings
 *
 * Returns current Google Maps kill-switch settings (budget + thresholds + lock state).
 * Used by scripts/google-quota-monitor.ts to make lock/unlock decisions.
 *
 * Auth: admin only.
 *
 * Response: {
 *   budget_usd: number,
 *   lock_threshold_pct: number,
 *   unlock_threshold_pct: number,
 *   is_locked: boolean,
 *   locked_reason: string,
 *   locked_at: string | null
 * }
 */

import { requireAdmin } from '../_auth';
import type { Env } from '../_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  requireAdmin(context);
  const { results } = await context.env.DB.prepare(
    `SELECT key, value FROM app_settings
     WHERE key IN (
       'google_maps_budget_usd',
       'google_maps_lock_threshold_pct',
       'google_maps_unlock_threshold_pct',
       'google_maps_locked',
       'google_maps_locked_reason',
       'google_maps_locked_at'
     )`,
  ).all<{ key: string; value: string }>();

  const map = new Map((results || []).map((r) => [r.key, r.value]));
  return new Response(
    JSON.stringify({
      budget_usd: parseFloat(map.get('google_maps_budget_usd') || '200') || 200,
      lock_threshold_pct: parseFloat(map.get('google_maps_lock_threshold_pct') || '90') || 90,
      unlock_threshold_pct: parseFloat(map.get('google_maps_unlock_threshold_pct') || '50') || 50,
      is_locked: map.get('google_maps_locked') === 'true',
      locked_reason: map.get('google_maps_locked_reason') || '',
      locked_at: map.get('google_maps_locked_at') || null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
