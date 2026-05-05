/**
 * POST /api/admin/maps-unlock
 *
 * Manually release Google Maps kill switch. Daily-check auto-unlock will also
 * trigger this code path when MTD drops below unlock threshold (50%).
 *
 * Auth: admin only.
 *
 * Body: none
 * Response: { "locked": false, "unlocked_at": ISO timestamp, "previous_reason": string }
 */
import { AppError } from '../_errors';
import { requireAuth } from '../_auth';
import { invalidateLockCache } from '../_maps_lock';
import { logAudit } from '../_audit';
import type { Env } from '../_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  if (!auth.isAdmin) {
    throw new AppError('PERM_ADMIN_ONLY');
  }

  const db = context.env.DB;
  const prev = await db
    .prepare(`SELECT value FROM app_settings WHERE key='google_maps_locked_reason'`)
    .first<{ value: string }>();
  const previousReason = prev?.value || '';
  const unlockedAt = new Date().toISOString();

  await db.batch([
    db.prepare(
      `UPDATE app_settings SET value='false', updated_at=?, updated_by=?, note=?
       WHERE key='google_maps_locked'`,
    ).bind(unlockedAt, auth.email, 'manual unlock'),
    db.prepare(
      `UPDATE app_settings SET value='', updated_at=?, updated_by=? WHERE key='google_maps_locked_reason'`,
    ).bind(unlockedAt, auth.email),
  ]);

  invalidateLockCache();

  await logAudit(db, {
    tripId: '',
    tableName: 'app_settings',
    recordId: null,
    action: 'update',
    changedBy: auth.email,
    diffJson: JSON.stringify({
      key: 'google_maps_locked',
      from: 'true',
      to: 'false',
      previous_reason: previousReason,
    }),
  });

  return new Response(
    JSON.stringify({ locked: false, unlocked_at: unlockedAt, previous_reason: previousReason }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
