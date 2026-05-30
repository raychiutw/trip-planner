/**
 * /api/trips/:id/shares — owner/co-editor share-link management (v2.39.0).
 *   GET  → list this trip's share links (NO token / token_hash ever returned).
 *   POST → create a new share link; returns the raw token ONCE (only chance to copy).
 *
 * Auth: requireAuth + hasWritePermission(tripId) — re-checked LIVE on every call
 * (never trusts created_by as a standing grant). PR2 adds PATCH section/expiry edits;
 * revoke/delete live in shares/[shareId].ts.
 */
import { requireAuth, hasWritePermission } from '../../_auth';
import { AppError } from '../../_errors';
import { json } from '../../_utils';
import {
  generateShareToken,
  hashToken,
  sanitizeVisibleSections,
  DEFAULT_SHARE_SECTIONS,
} from '../../_share';
import type { Env } from '../../_types';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Owner-supplied expires_at (epoch ms): must be a future time within 1 year, else null (= never). */
function validateExpiresAt(input: unknown): number | null {
  if (typeof input !== 'number' || !Number.isFinite(input)) return null;
  const now = Date.now();
  if (input <= now || input > now + ONE_YEAR_MS) return null;
  return Math.floor(input);
}

async function requireTripWrite(context: Parameters<PagesFunction<Env>>[0], tripId: string) {
  const auth = requireAuth(context);
  const ok = await hasWritePermission(context.env.DB, auth, tripId, auth.isAdmin);
  if (!ok) throw new AppError('PERM_DENIED');
  return auth;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };
  const db = context.env.DB;
  await requireTripWrite(context, id);

  // Includes revoked-but-not-deleted rows so retained view_count analytics stay reachable.
  const { results } = await db
    .prepare(
      `SELECT id, label, visible_sections, expires_at, view_count, created_by, created_at, revoked_at
       FROM trip_shares WHERE trip_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .bind(id)
    .all();
  return json({ shares: results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };
  const db = context.env.DB;
  const auth = await requireTripWrite(context, id);

  const body = (await context.request.json().catch(() => ({}))) as Record<string, unknown>;
  const visible = sanitizeVisibleSections(
    Array.isArray(body.visibleSections) ? body.visibleSections : DEFAULT_SHARE_SECTIONS,
  );
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : '';
  const expiresAt = validateExpiresAt(body.expiresAt);

  // INSERT with UNIQUE(token_hash) collision retry (astronomically rare; defensive).
  for (let attempt = 0; ; attempt++) {
    const token = generateShareToken();
    const tokenHash = await hashToken(token);
    try {
      const row = await db
        .prepare(
          `INSERT INTO trip_shares (trip_id, token_hash, label, visible_sections, expires_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
        )
        .bind(id, tokenHash, label, JSON.stringify(visible), expiresAt, auth.userId ?? '')
        .first<{ id: number }>();
      // raw token returned ONCE — only the hash is persisted.
      return json({
        id: row?.id,
        token,
        url: `/s/${token}`,
        label,
        visibleSections: visible,
        expiresAt,
      });
    } catch (e) {
      if (attempt >= 2) throw e;
    }
  }
};
