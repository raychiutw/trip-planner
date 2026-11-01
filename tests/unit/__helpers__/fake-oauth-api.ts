/**
 * 假 api：在測試裡以 fetch stub 實作新 api（trip-planner-api）的 OAuth 契約。
 * 只為驗證 web 端 auth client 的往返行為；契約來源：api repo 的
 * src/routes/login.ts、src/routes/token.ts、src/lib/dpop.ts、src/lib/token-lifecycle.ts。
 * 不連任何外部服務。
 */

export const FAKE_API_BASE = 'https://api.test';
export const FAKE_EMAIL = 'ray@example.test';
export const FAKE_PASSWORD = 'correct-horse-battery';

const B64URL_43 = /^[A-Za-z0-9_-]{43}$/;

function b64uToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function bytesToB64u(bytes: ArrayBuffer | Uint8Array): string {
  let s = '';
  for (const b of bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256B64u(input: string): Promise<string> {
  return bytesToB64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
}
const randomToken = () => bytesToB64u(crypto.getRandomValues(new Uint8Array(32)));
const parseJson = (s: string) => JSON.parse(new TextDecoder().decode(b64uToBytes(s)));

function normalizeHtu(raw: string): string {
  const u = new URL(raw);
  return `${u.protocol}//${u.host}${u.pathname}`;
}

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  dpopClaims?: Record<string, unknown>;
  dpopHeader?: Record<string, unknown>;
}

interface Grant { family: string; jkt: string | null; email: string }

export function createFakeOAuthApi() {
  const codes = new Map<string, { challenge: string; jkt: string | null; email: string; used: boolean }>();
  const refreshTokens = new Map<string, Grant & { used: boolean }>();
  const accessTokens = new Map<string, Grant & { expired: boolean }>();
  const revokedFamilies = new Set<string>();
  const seenJti = new Set<string>();
  const requests: RecordedRequest[] = [];
  const state = { tokenDelayMs: 0, refreshCalls: 0, failRefreshWith503: false, rejectResource: false };

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  const oauthErr = (error: string, description: string, status = 400) => json(status, { error, error_description: description });

  /** 驗 DPoP proof；回 jkt 或錯誤原因。 */
  async function verifyProof(
    method: string, url: string, headers: Record<string, string>, accessToken?: string,
  ): Promise<{ ok: true; jkt: string } | { ok: false; reason: string }> {
    const raw = headers['dpop'];
    if (!raw) return { ok: false, reason: 'missing' };
    const [h, p, s] = raw.split('.');
    if (!h || !p || !s) return { ok: false, reason: 'not a JWT' };
    const header = parseJson(h) as Record<string, unknown>;
    const claims = parseJson(p) as Record<string, unknown>;
    if (header.typ !== 'dpop+jwt') return { ok: false, reason: 'typ' };
    if (header.alg !== 'ES256') return { ok: false, reason: 'alg' };
    const jwk = header.jwk as Record<string, string> | undefined;
    if (!jwk || 'd' in jwk) return { ok: false, reason: 'jwk' };
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y) return { ok: false, reason: 'jwk' };
    const pub = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
    const key = await crypto.subtle.importKey('jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64uToBytes(s), new TextEncoder().encode(`${h}.${p}`));
    if (!valid) return { ok: false, reason: 'signature' };
    if (typeof claims.jti !== 'string' || !claims.jti) return { ok: false, reason: 'jti' };
    if (claims.htm !== method) return { ok: false, reason: 'htm' };
    if (typeof claims.htu !== 'string' || normalizeHtu(claims.htu) !== normalizeHtu(url)) return { ok: false, reason: 'htu' };
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof claims.iat !== 'number' || Math.abs(nowSec - claims.iat) > 60) return { ok: false, reason: 'iat' };
    if (accessToken !== undefined && claims.ath !== (await sha256B64u(accessToken))) return { ok: false, reason: 'ath' };
    const jkt = await sha256B64u(JSON.stringify({ crv: pub.crv, kty: pub.kty, x: pub.x, y: pub.y }));
    const jtiKey = `${jkt}:${claims.jti}`;
    if (seenJti.has(jtiKey)) return { ok: false, reason: 'replay' };
    seenJti.add(jtiKey);
    return { ok: true, jkt };
  }

  function issue(grant: Grant) {
    const access = randomToken();
    const refresh = randomToken();
    accessTokens.set(access, { ...grant, expired: false });
    refreshTokens.set(refresh, { ...grant, used: false });
    return {
      access_token: access, refresh_token: refresh, token_type: grant.jkt ? 'DPoP' : 'Bearer',
      expires_in: 900, scope: 'openid profile email',
    };
  }

  async function handler(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const body = typeof init.body === 'string' ? init.body : init.body instanceof URLSearchParams ? init.body.toString() : '';
    const rec: RecordedRequest = { method, url, headers, body };
    requests.push(rec);
    if (headers['dpop']) {
      try {
        const [h, p] = headers['dpop'].split('.');
        rec.dpopHeader = parseJson(h!);
        rec.dpopClaims = parseJson(p!);
      } catch { /* 留給驗證回報 */ }
    }
    const path = new URL(url).pathname;

    if (path === '/api/oauth/login' && method === 'POST') {
      let b: Record<string, unknown>;
      try { b = JSON.parse(body); } catch { return json(400, { error: { code: 'LOGIN_INVALID_INPUT', message: 'bad' } }); }
      const bad = () => json(400, { error: { code: 'LOGIN_INVALID_INPUT', message: 'bad' } });
      if (typeof b.email !== 'string' || typeof b.password !== 'string' || b.client_id !== 'tripline-web') return bad();
      if (b.code_challenge_method !== 'S256' || typeof b.code_challenge !== 'string' || !B64URL_43.test(b.code_challenge)) return bad();
      if (b.dpop_jkt !== undefined && (typeof b.dpop_jkt !== 'string' || !B64URL_43.test(b.dpop_jkt))) return bad();
      if (b.email === 'locked@example.test') {
        return json(429, { error: { code: 'LOGIN_RATE_LIMITED', message: 'locked' } }, { 'Retry-After': '600' });
      }
      if (b.email !== FAKE_EMAIL || b.password !== FAKE_PASSWORD) {
        return json(401, { error: { code: 'LOGIN_INVALID', message: 'invalid' } });
      }
      const code = randomToken();
      codes.set(code, { challenge: b.code_challenge, jkt: (b.dpop_jkt as string | undefined) ?? null, email: b.email, used: false });
      return json(200, { code, expires_in: 60 });
    }

    if (path === '/api/oauth/token' && method === 'POST') {
      const ct = headers['content-type'] ?? '';
      const params: Record<string, string> = ct.includes('json')
        ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
      if (params.client_id !== 'tripline-web') return oauthErr('invalid_client', 'unknown client', 401);
      let jkt: string | null = null;
      if (headers['dpop']) {
        const v = await verifyProof(method, url, headers);
        if (!v.ok) return oauthErr('invalid_dpop_proof', v.reason);
        jkt = v.jkt;
      }
      if (params.grant_type === 'authorization_code') {
        if ('redirect_uri' in params) return oauthErr('invalid_grant', 'redirect_uri mismatch');
        const c = codes.get(params.code ?? '');
        if (!c || c.used) return oauthErr('invalid_grant', 'Authorization code expired or invalid');
        c.used = true;
        if (c.jkt && c.jkt !== jkt) return oauthErr('invalid_grant', 'DPoP key does not match the authorization request');
        if (!params.code_verifier) return oauthErr('invalid_grant', 'code_verifier required (PKCE)');
        if ((await sha256B64u(params.code_verifier)) !== c.challenge) return oauthErr('invalid_grant', 'code_verifier does not match code_challenge');
        return json(200, issue({ family: crypto.randomUUID(), jkt, email: c.email }));
      }
      if (params.grant_type === 'refresh_token') {
        state.refreshCalls++;
        // 先在 api 端處理（輪替已生效），再延遲回應：模擬「回應還在路上時 client 就登出」
        const respond = async (res: Response) => {
          if (state.tokenDelayMs) await new Promise((r) => setTimeout(r, state.tokenDelayMs));
          return res;
        };
        if (state.failRefreshWith503) return respond(json(503, { error: 'temporarily_unavailable' }));
        const r = refreshTokens.get(params.refresh_token ?? '');
        if (!r || revokedFamilies.has(r.family)) return respond(oauthErr('invalid_grant', 'refresh_token expired or invalid'));
        if (r.jkt && r.jkt !== jkt) return respond(oauthErr('invalid_grant', 'DPoP proof required for this refresh_token'));
        if (r.used) {
          revokedFamilies.add(r.family);
          return respond(oauthErr('invalid_grant', 'refresh_token reuse detected — token family revoked'));
        }
        r.used = true;
        return respond(json(200, issue({ family: r.family, jkt: r.jkt, email: r.email })));
      }
      return oauthErr('unsupported_grant_type', 'x');
    }

    // 資源端點與登出：Authorization: DPoP <token> + proof（含 ath）
    const auth = headers['authorization'] ?? '';
    const [scheme, token] = auth.split(' ');
    const at = token ? accessTokens.get(token) : undefined;
    if (state.rejectResource || !at || at.expired || revokedFamilies.has(at.family)) return json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } });
    if (at.jkt) {
      if (scheme !== 'DPoP') return json(401, { error: { code: 'UNAUTHORIZED', message: 'dpop required' } });
      const v = await verifyProof(method, url, headers, token);
      if (!v.ok || v.jkt !== at.jkt) return json(401, { error: { code: 'UNAUTHORIZED', message: `proof ${v.ok ? 'jkt' : v.reason}` } });
    }
    if (path === '/api/oauth/logout' && method === 'POST') {
      revokedFamilies.add(at.family);
      return new Response(null, { status: 204 });
    }
    if (path === '/api/me') return json(200, { email: at.email });
    return json(404, { error: { code: 'NOT_FOUND', message: 'x' } });
  }

  return {
    fetch: handler as typeof fetch,
    requests,
    state,
    /** 讓目前所有 access token 過期（模擬 15 分鐘到了）。 */
    expireAccessTokens() { for (const t of accessTokens.values()) t.expired = true; },
    /** access token 目前是否仍被 api 接受（未過期、grant 未撤銷）。 */
    isAccessValid(token: string) {
      const a = accessTokens.get(token);
      return !!a && !a.expired && !revokedFamilies.has(a.family);
    },
    /** 目前 refresh token 是否已被 api 撤銷（家族撤銷或未知）。 */
    isRefreshRevoked(refreshToken: string) {
      const r = refreshTokens.get(refreshToken);
      return r ? revokedFamilies.has(r.family) : true;
    },
    tokenRequests() { return requests.filter((r) => new URL(r.url).pathname === '/api/oauth/token'); },
  };
}
