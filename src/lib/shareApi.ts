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
  anonymous: number;
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
  anonymous: number;
}

export interface ShareCreateOpts {
  visibleSections?: string[];
  label?: string;
  expiresAt?: number | null;
  anonymous?: boolean;
}

export async function listShares(tripId: string): Promise<ShareLinkRow[]> {
  const r = await apiFetch<{ shares: ShareLinkRow[] }>(`/trips/${encodeURIComponent(tripId)}/shares`);
  return r.shares ?? [];
}

export async function createShare(tripId: string, opts: ShareCreateOpts = {}): Promise<CreatedShare> {
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

/** Edit an active link's visible sections / label / expiry / anonymous WITHOUT a new URL. */
export async function updateShare(tripId: string, shareId: number, patch: ShareCreateOpts): Promise<void> {
  await apiFetch(`/trips/${encodeURIComponent(tripId)}/shares/${shareId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'update', ...patch }),
  });
}

/** Rotate the token — returns a NEW one-time URL; the old link immediately 404s. */
export async function rotateShare(tripId: string, shareId: number): Promise<{ token: string; url: string }> {
  return apiFetch<{ token: string; url: string }>(`/trips/${encodeURIComponent(tripId)}/shares/${shareId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'rotate' }),
  });
}

export async function deleteShare(tripId: string, shareId: number): Promise<void> {
  await apiFetch(`/trips/${encodeURIComponent(tripId)}/shares/${shareId}`, { method: 'DELETE' });
}

/** Clone a shared trip (the visible payload) into the caller's account. Auth required. */
export async function cloneShare(token: string): Promise<{ tripId: string }> {
  return apiFetch<{ tripId: string }>(`/share/${encodeURIComponent(token)}/clone`, { method: 'POST' });
}
