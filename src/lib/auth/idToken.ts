/**
 * id_token → 顯示用的使用者資料（只用於畫面，**不得**做授權決定；授權一律由 api 驗 access token）。
 *
 * 驗證對照 Flutter（lib/api/oauth/id_token.dart `verifiedIdTokenClaims`）：驗 sub 存在、aud 含本 client、exp 未過期（容忍 1 分鐘時鐘偏移）。
 * 不驗簽章：token 是經 TLS 由 token 端點直接取得（OIDC Core 3.1.3.7 第 6 點允許）；id_token 只活在記憶體，不落地。
 * 刻意不驗 iss：後端 discovery 宣告與實際簽發的 issuer 曾不一致（同 Flutter 的取捨），寫死任一邊都會在對方修正時讓登入全掛。
 * 任一項不合 → 回 null，呼叫端落回 userinfo。
 */
import type { CurrentUser } from '../../hooks/useCurrentUser';

const LEEWAY_SEC = 60;

function decodePayload(idToken: string): Record<string, unknown> | null {
  const part = idToken.split('.')[1];
  if (!part) return null;
  try {
    const bin = atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4));
    const json: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function userFromIdToken(idToken: string | null, clientId: string, nowMs = Date.now()): CurrentUser | null {
  if (!idToken) return null;
  const c = decodePayload(idToken);
  if (!c) return null;
  const { sub, aud, exp, email, name } = c;
  if (typeof sub !== 'string' || !sub) return null;
  if (!(aud === clientId || (Array.isArray(aud) && aud.includes(clientId)))) return null;
  if (typeof exp !== 'number' || nowMs / 1000 >= exp + LEEWAY_SEC) return null;
  if (typeof email !== 'string' || !email) return null;
  // id_token 的 name 在沒設顯示名稱時會退成 email 前綴；那等於「沒設」，還原成 null 以免編輯框被預填
  const displayName = typeof name === 'string' && name && name !== email.split('@')[0] ? name : null;
  // avatarUrl／createdAt 不在 id_token 裡，目前沒有畫面使用
  return { id: sub, email, emailVerified: c.email_verified === true, displayName, avatarUrl: null, createdAt: '' };
}
