/**
 * Session helper — V2-P1 整合 cookies + session token module
 *
 * Caller convenience：把 _cookies.ts + src/server/session.ts 包成
 * Pages Function 友善的 API（getSessionUser / requireSessionUser / issueSession /
 * clearSession）。
 *
 * 用 SESSION_SECRET env 簽 token；env 缺少時 throw（fail loud avoid silent
 * security degrade）。
 */
import { AppError } from './_errors';
import {
  getSessionCookie,
  buildSessionSetCookie,
  buildClearSessionSetCookie,
  shouldSetSecure,
} from './_cookies';
import {
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from '../../src/server/session';

/**
 * 任何 env 物件含 SESSION_SECRET 都接受。Caller 通常傳 functions/api/_types.ts 的
 * `Env`（含 SESSION_SECRET? optional）。不用 [key: string]: unknown index sig
 * 否則 Env strict-typed 物件無法直接傳入。
 */
interface EnvWithSession {
  SESSION_SECRET?: string;
}

function requireSecret(env: EnvWithSession): string {
  const secret = env.SESSION_SECRET;
  if (!secret) {
    // SESSION_SECRET 缺少是 deployment config 缺失，500 SYS_INTERNAL
    throw new AppError('SYS_INTERNAL', 'SESSION_SECRET env 未設定');
  }
  return secret;
}

/**
 * Read session cookie + verify token → return payload or null。
 * 用於不強制 auth 的 endpoint（如 GET /api/trips）。
 */
export async function getSessionUser(
  request: Request,
  env: EnvWithSession,
): Promise<SessionPayload | null> {
  const token = getSessionCookie(request);
  if (!token) return null;
  const secret = requireSecret(env);
  return verifySessionToken(token, secret);
}

/**
 * Read session cookie + verify token → throw AUTH_REQUIRED if missing/invalid。
 * 用於強制 auth 的 endpoint。
 */
export async function requireSessionUser(
  request: Request,
  env: EnvWithSession,
): Promise<SessionPayload> {
  const payload = await getSessionUser(request, env);
  if (!payload) throw new AppError('AUTH_REQUIRED');
  return payload;
}

/**
 * Sign new session token + append Set-Cookie header to response。
 * 用於 OAuth callback / login success path。
 */
export async function issueSession(
  request: Request,
  response: Response,
  uid: string,
  env: EnvWithSession,
  ttlSeconds?: number,
): Promise<void> {
  const secret = requireSecret(env);
  const token = await signSessionToken(uid, secret, ttlSeconds);
  const cookie = buildSessionSetCookie(token, { secure: shouldSetSecure(request), maxAge: ttlSeconds });
  response.headers.append('Set-Cookie', cookie);
}

/**
 * Append clear-session Set-Cookie header → logout。
 */
export function clearSession(request: Request, response: Response): void {
  const cookie = buildClearSessionSetCookie(shouldSetSecure(request));
  response.headers.append('Set-Cookie', cookie);
}
