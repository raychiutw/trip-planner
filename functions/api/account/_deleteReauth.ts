import { getSessionCookie } from '../_cookies';
import { sha256Base64 } from '../_utils';
import { generateOpaqueToken } from '../_utils';
import { AppError } from '../_errors';

const PROOF_NAME = 'AccountDeleteProof';
const PROOF_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_NAME = 'AccountDeleteChallenge';

export function mobileCallbackUrl(env: { MOBILE_OAUTH_CALLBACK_URL?: string }): URL {
  let url: URL;
  try { url = new URL(env.MOBILE_OAUTH_CALLBACK_URL ?? ''); } catch { throw new AppError('SERVER_MISCONFIG', 'Mobile OAuth callback 未設定'); }
  if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) {
    throw new AppError('SERVER_MISCONFIG', 'Mobile OAuth callback 設定無效');
  }
  return url;
}

interface MobileChallenge {
  uid: string;
  clientId: string;
  grantId: string;
  status: 'pending' | 'started' | 'verified' | 'failed' | 'cancelled' | 'used';
}

export async function createMobileDeleteChallenge(db: D1Database, uid: string, grantId: string, clientId: string): Promise<string> {
  const id = generateOpaqueToken();
  await db.prepare('INSERT INTO oauth_models (name, id, payload, expires_at) VALUES (?, ?, ?, ?)')
    .bind(CHALLENGE_NAME, id, JSON.stringify({ uid, grantId, clientId, status: 'pending' }), Date.now() + PROOF_TTL_MS).run();
  return id;
}

export async function readMobileDeleteChallenge(db: D1Database, id: string): Promise<(MobileChallenge & { expired: boolean }) | null> {
  const row = await db.prepare('SELECT payload, expires_at FROM oauth_models WHERE name = ? AND id = ?')
    .bind(CHALLENGE_NAME, id).first<{ payload: string; expires_at: number }>();
  if (!row) return null;
  return { ...JSON.parse(row.payload) as MobileChallenge, expired: row.expires_at < Date.now() };
}

export async function transitionMobileDeleteChallenge(
  db: D1Database, id: string, uid: string, grantId: string, from: MobileChallenge['status'], to: MobileChallenge['status'],
): Promise<boolean> {
  const result = await db.prepare(`UPDATE oauth_models SET payload = json_set(payload, '$.status', ?)
    WHERE name = ? AND id = ? AND expires_at >= ? AND json_extract(payload, '$.uid') = ?
      AND json_extract(payload, '$.grantId') = ? AND json_extract(payload, '$.status') = ?`)
    .bind(to, CHALLENGE_NAME, id, Date.now(), uid, grantId, from).run();
  return (result.meta?.changes ?? 0) === 1;
}

export async function deleteReauthSessionId(request: Request): Promise<string | null> {
  const cookie = getSessionCookie(request);
  return cookie ? sha256Base64(cookie) : null;
}

/** Google callback alone can grant this proof after verifying the same account. */
export async function grantDeleteReauth(db: D1Database, request: Request, userId: string): Promise<boolean> {
  const id = await deleteReauthSessionId(request);
  if (!id) return false;
  await db.prepare('INSERT OR REPLACE INTO oauth_models (name, id, payload, expires_at) VALUES (?, ?, ?, ?)')
    .bind(PROOF_NAME, id, JSON.stringify({ uid: userId }), Date.now() + PROOF_TTL_MS)
    .run();
  return true;
}

/** Atomic one-use check: expiry, account and browser session all belong to the proof. */
export async function consumeDeleteReauth(db: D1Database, request: Request, userId: string): Promise<boolean> {
  const id = await deleteReauthSessionId(request);
  if (!id) return false;
  const result = await db.prepare(`UPDATE oauth_models SET payload = json_set(payload, '$.consumed', ?)
    WHERE name = ? AND id = ? AND expires_at >= ?
      AND json_extract(payload, '$.uid') = ? AND json_extract(payload, '$.consumed') IS NULL`)
    .bind(Date.now(), PROOF_NAME, id, Date.now(), userId)
    .run();
  return (result.meta?.changes ?? 0) === 1;
}

/** A failed atomic erasure leaves the account intact, so its one-use proof can be retried. */
export async function restoreDeleteReauth(db: D1Database, request: Request, userId: string): Promise<void> {
  const id = await deleteReauthSessionId(request);
  if (!id) return;
  await db.prepare(`UPDATE oauth_models SET payload = json_remove(payload, '$.consumed')
    WHERE name = ? AND id = ? AND expires_at >= ? AND json_extract(payload, '$.uid') = ?
      AND json_extract(payload, '$.consumed') IS NOT NULL`)
    .bind(PROOF_NAME, id, Date.now(), userId).run();
}

export async function hasDeleteReauth(db: D1Database, request: Request, userId: string): Promise<boolean> {
  const id = await deleteReauthSessionId(request);
  if (!id) return false;
  const row = await db.prepare(`SELECT 1 FROM oauth_models WHERE name = ? AND id = ? AND expires_at >= ?
    AND json_extract(payload, '$.uid') = ? AND json_extract(payload, '$.consumed') IS NULL`)
    .bind(PROOF_NAME, id, Date.now(), userId).first();
  return !!row;
}
