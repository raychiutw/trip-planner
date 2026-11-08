/**
 * shareApi — client for the public share-link platform (v2.39.0).
 *
 * The raw token is returned ONLY by createShare (server stores a hash). list/revoke
 * never expose it — an existing link's URL cannot be re-displayed; rotate (PR2) issues
 * a fresh one.
 */
import { typedApi, unwrap } from './api/typed';

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
  /** 契約的 enum：打錯區段名稱編譯就會失敗 */
  visibleSections?: Array<'flights' | 'lodgings' | 'reservations' | 'pretrip' | 'emergency'>;
  label?: string;
  expiresAt?: number | null;
  anonymous?: boolean;
}

export async function listShares(tripId: string): Promise<ShareLinkRow[]> {
  const r = unwrap(await typedApi.get('/api/trips/{id}/shares', { path: { id: tripId } })) as unknown as { shares: ShareLinkRow[] };
  return r.shares ?? [];
}

export async function createShare(tripId: string, opts: ShareCreateOpts = {}): Promise<CreatedShare> {
  return unwrap(await typedApi.post('/api/trips/{id}/shares', {
    path: { id: tripId },
    // 契約的 expiresAt 只收 number；null（永不過期）與省略同義（契約：非未來一年內的值視為永不過期），這裡轉成省略
    body: { ...opts, expiresAt: opts.expiresAt ?? undefined },
  })) as unknown as CreatedShare;
}

export async function revokeShare(tripId: string, shareId: number): Promise<void> {
  await typedApi.patch('/api/trips/{id}/shares/{shareId}', {
    path: { id: tripId, shareId: String(shareId) },
    body: { action: 'revoke' },
  });
}

/** Edit an active link's visible sections / label / expiry / anonymous WITHOUT a new URL. */
export async function updateShare(tripId: string, shareId: number, patch: ShareCreateOpts): Promise<void> {
  await typedApi.patch('/api/trips/{id}/shares/{shareId}', {
    path: { id: tripId, shareId: String(shareId) },
    body: { action: 'update', ...patch },
  });
}

/** Rotate the token — returns a NEW one-time URL; the old link immediately 404s. */
export async function rotateShare(tripId: string, shareId: number): Promise<{ token: string; url: string }> {
  return unwrap(await typedApi.patch('/api/trips/{id}/shares/{shareId}', {
    path: { id: tripId, shareId: String(shareId) },
    body: { action: 'rotate' },
  })) as unknown as { token: string; url: string };
}

export async function deleteShare(tripId: string, shareId: number): Promise<void> {
  await typedApi.delete('/api/trips/{id}/shares/{shareId}', { path: { id: tripId, shareId: String(shareId) } });
}

/** Clone a shared trip (the visible payload) into the caller's account. Auth required. */
export async function cloneShare(token: string): Promise<{ tripId: string }> {
  return unwrap(await typedApi.post('/api/share/{token}/clone', { path: { token } })) as unknown as { tripId: string };
}
