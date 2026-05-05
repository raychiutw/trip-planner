/**
 * POST /api/admin/maps-unlock — Manually release Google Maps kill switch.
 *
 * Daily-check auto-unlock also calls this when MTD drops below unlock threshold.
 *
 * Auth: admin only.
 * Response: { "locked": false, "unlocked_at": ISO timestamp, "previous_reason": string }
 */

import { requireAdmin } from '../_auth';
import { setLockState } from '../_maps_lock';
import { logAudit } from '../_audit';
import type { Env } from '../_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAdmin(context);

  const { at, previousReason } = await setLockState(context.env.DB, false, {
    actor: auth.email,
    reason: '',
  });

  await logAudit(context.env.DB, {
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
    JSON.stringify({ locked: false, unlocked_at: at, previous_reason: previousReason }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
