/**
 * `/s/:token`、`/trip/*` 的 OG meta 注入所需的最小共用部分。
 *
 * 舊入口（functions/api）已於 #1627 刪除；這兩支 Pages Function 不是 API，仍要查舊 D1
 * （wrangler.toml 的 `DB` binding，不可移除），所以把原本從 functions/api/_types、_share 取用的
 * 部分複製到這裡。token 規則與 hash 必須與 api repo 的分享功能一致（DB 存的是 SHA-256 hex）。
 */

/** Pages Function 實際用到的 binding。 */
export interface Env {
  DB: D1Database;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** 在碰 DB／做 hash 之前先擋掉明顯的垃圾請求。 */
export function isValidShareToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

/** SHA-256 hex — 唯一會進 DB 的 token 形式。 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ShareRow {
  id: number;
  trip_id: string;
  token_hash: string;
  expires_at: number | null;
  revoked_at: string | null;
}

/** raw token → 有效的 share row，否則 null（不存在／已撤銷／已過期不可區分）。 */
export async function resolveActiveShare(db: D1Database, token: string): Promise<ShareRow | null> {
  if (!isValidShareToken(token)) return null;
  const tokenHash = await hashToken(token);
  const row = await db
    .prepare('SELECT * FROM trip_shares WHERE token_hash = ?')
    .bind(tokenHash)
    .first<ShareRow>();
  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at != null && row.expires_at < Date.now()) return null;
  return row;
}
