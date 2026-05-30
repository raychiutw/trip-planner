/**
 * shareApi — client for the public share-link platform (v2.39.0).
 *
 * The raw token is returned ONLY by createShare (server stores a hash). list/revoke
 * never expose it — an existing link's URL cannot be re-displayed; rotate (PR2) issues
 * a fresh one.
 */
import { apiFetch } from './apiClient';

export interface ShareLinkRow {
  id: number;
  label: string;
  /** JSON array string of enabled section keys (server-camelled from visible_sections). */
  visibleSections: string;
  expiresAt: number | null;
  viewCount: number;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreatedShare {
  id: number;
  /** Raw token — shown ONCE; only its hash is persisted. */
  token: string;
  url: string;
  label: string;
  visibleSections: string[];
  expiresAt: number | null;
}

export async function listShares(tripId: string): Promise<ShareLinkRow[]> {
  const r = await apiFetch<{ shares: ShareLinkRow[] }>(`/trips/${encodeURIComponent(tripId)}/shares`);
  return r.shares ?? [];
}

export async function createShare(
  tripId: string,
  opts: { visibleSections?: string[]; label?: string; expiresAt?: number | null } = {},
): Promise<CreatedShare> {
  return apiFetch<CreatedShare>(`/trips/${encodeURIComponent(tripId)}/shares`, {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export async function revokeShare(tripId: string, shareId: number): Promise<void> {
  await apiFetch(`/trips/${encodeURIComponent(tripId)}/shares/${shareId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'revoke' }),
  });
}

export async function deleteShare(tripId: string, shareId: number): Promise<void> {
  await apiFetch(`/trips/${encodeURIComponent(tripId)}/shares/${shareId}`, { method: 'DELETE' });
}
