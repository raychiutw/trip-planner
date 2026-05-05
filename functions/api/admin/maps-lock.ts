/**
 * POST /api/admin/maps-lock
 *
 * Manually engage Google Maps kill switch (sets app_settings.google_maps_locked='true').
 * Used in incident response when Google API misbehaves outside normal quota check.
 *
 * Auth: admin only (env.ADMIN_EMAIL = lean.lean@gmail.com per CLAUDE.md).
 *
 * Body (optional): { "reason": "string" }
 * Response: { "locked": true, "reason": string, "locked_at": ISO timestamp }
 *
 * Side effects:
 *   - INSERT app_settings row update（key: google_maps_locked / google_maps_locked_reason / google_maps_locked_at）
 *   - INSERT audit_log（trip_id=null because not trip-scoped; record_id=null）
 *   - invalidateLockCache() so calling isolate sees fresh state immediately
 */
import { AppError } from '../_errors';
import { requireAuth } from '../_auth';
import { invalidateLockCache } from '../_maps_lock';
import { logAudit } from '../_audit';
import type { Env } from '../_types';

interface LockBody {
  reason?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  if (!auth.isAdmin) {
    throw new AppError('PERM_ADMIN_ONLY');
  }

  const body = (await context.request.json().catch(() => ({}))) as LockBody;
  const reason = (body.reason || 'manual lock by admin').slice(0, 200);
  const lockedAt = new Date().toISOString();

  const db = context.env.DB;
  await db.batch([
    db.prepare(
      `UPDATE app_settings SET value='true', updated_at=?, updated_by=?, note=?
       WHERE key='google_maps_locked'`,
    ).bind(lockedAt, auth.email, reason),
    db.prepare(
      `UPDATE app_settings SET value=?, updated_at=?, updated_by=? WHERE key='google_maps_locked_reason'`,
    ).bind(reason, lockedAt, auth.email),
    db.prepare(
      `UPDATE app_settings SET value=?, updated_at=?, updated_by=? WHERE key='google_maps_locked_at'`,
    ).bind(lockedAt, lockedAt, auth.email),
  ]);

  invalidateLockCache();

  await logAudit(db, {
    tripId: '',
    tableName: 'app_settings',
    recordId: null,
    action: 'update',
    changedBy: auth.email,
    diffJson: JSON.stringify({ key: 'google_maps_locked', from: 'false', to: 'true', reason }),
  });

  return new Response(
    JSON.stringify({ locked: true, reason, locked_at: lockedAt }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
