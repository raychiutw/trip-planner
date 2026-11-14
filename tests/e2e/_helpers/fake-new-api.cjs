/**
 * 新 api 的本機假伺服器（只給 playwright.newapi.config.js 的 e2e 用）。
 *
 * 目的：讓 web 建置（真的 auth client，不套穿透版）在真瀏覽器裡，對一個**真的有狀態、真的驗證**的 api 跑完整流程，
 * 而不是 page.route 回罐頭。它實作的是 api 契約（contracts/openapi.json）裡 web 會碰到的那一小塊：
 *   - PKCE（S256 驗 code_verifier）、DPoP（驗簽章、htm、htu、ath、jkt 綁定、jti 不可重複）
 *   - refresh token 每次輪替；**用過的 refresh token 再出現 = 重放 → 撤銷整個 family**（RFC 9700 §4.14）
 *   - 登出撤銷 family；變更密碼撤銷「其他」family；刪除帳號撤銷全部
 *   - SSE 一次性 ticket（用過即失效）、CORS（跨埠，和 production 的 pages.dev ↔ workers.dev 一樣是跨 origin）
 * 它**不是** production 行為的證明（那是 api repo 自己的測試）；它證明的是「web 這端送出的東西合不合 api 的規矩」。
 * 登入帳密是假的，不碰任何真實身分提供者。
 *
 * 控制面（僅測試用）：GET /__fake/state、POST /__fake/reset、POST /__fake/expire-access。
 */
const http = require('node:http');
const crypto = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const PORT = Number(process.env.FAKE_API_PORT || 3102);
const WEB_ORIGIN = process.env.FAKE_WEB_ORIGIN || 'http://localhost:3101';
const ORIGIN = `http://localhost:${PORT}`;
const spec = JSON.parse(readFileSync(join(__dirname, '../../../contracts/openapi.json'), 'utf8'));
const LOGIN_REQUIRED = spec.components.schemas.LoginRequest.required;

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const sha256 = (s) => b64u(crypto.createHash('sha256').update(s).digest());
const rand = (n = 24) => b64u(crypto.randomBytes(n));

const USERS = () => ({
  'demo@example.test': { id: 'u-demo', email: 'demo@example.test', displayName: 'Demo', password: 'correct-horse-1' },
});

const FAKE_TRIP = { tripId: 'fake-trip', name: '假行程', owner: 'Demo', title: '假行程', role: 'owner', countries: '["JP"]', published: 0, lang: 'zh-TW', dataSource: 'manual' };

let S;
function reset() {
  S = {
    users: USERS(),
    codes: new Map(), // code -> { challenge, jkt, userId, clientId }
    refresh: new Map(), // token -> { family, used }
    access: new Map(), // token -> { family, expired }
    families: new Map(), // id -> { userId, jkt, revoked, scope }
    jtis: new Set(),
    tickets: new Map(), // ticket -> { userId, requestId, used }
    stats: { codeGrants: 0, refreshGrants: 0, reuseDetected: 0, ticketsIssued: 0, ticketsConsumed: 0, ticketsRejected: 0, dpopRejected: 0 },
    log: [], // { method, path, status }
    unhandled: [],
    nextRequestId: 100,
    done: new Set(), // 已由 SSE 送出 completed 的 request id；在那之前 GET 回 processing（否則輪詢會搶先結案、SSE 根本沒機會連）
  };
}
reset();

const cors = (req, res) => {
  const o = req.headers.origin;
  if (o) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, DPoP, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
  }
};
const send = (req, res, status, body, headers = {}) => {
  cors(req, res);
  const isStr = typeof body === 'string';
  res.writeHead(status, { 'Content-Type': isStr ? 'text/plain' : 'application/json', ...headers });
  res.end(body === undefined ? undefined : isStr ? body : JSON.stringify(body));
  S.log.push({ method: req.method, path: new URL(req.url, ORIGIN).pathname, status });
};
const err = (req, res, status, code, message = code) => send(req, res, status, { error: { code, message } });
const oauthErr = (req, res, status, error) => send(req, res, status, { error, error_description: error });

const readBody = (req) => new Promise((resolve) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});

/** 驗 DPoP proof；回 { jkt } 或丟 Error（訊息就是拒絕原因）。 */
function verifyProof(req, { accessToken } = {}) {
  const proof = req.headers.dpop;
  if (typeof proof !== 'string') throw new Error('missing proof');
  const [h, p, sig] = proof.split('.');
  if (!h || !p || !sig) throw new Error('malformed proof');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (header.typ !== 'dpop+jwt' || header.alg !== 'ES256' || header.jwk?.kty !== 'EC' || header.jwk?.crv !== 'P-256') throw new Error('bad header');
  if (header.jwk.d) throw new Error('private key in proof');
  const key = crypto.createPublicKey({ key: header.jwk, format: 'jwk' });
  const ok = crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
  if (!ok) throw new Error('bad signature');
  const url = new URL(req.url, ORIGIN);
  if (claims.htm !== req.method) throw new Error('htm mismatch');
  if (claims.htu !== `${ORIGIN}${url.pathname}`) throw new Error(`htu mismatch ${claims.htu}`);
  if (Math.abs(Date.now() / 1000 - claims.iat) > 120) throw new Error('stale iat');
  if (!claims.jti || S.jtis.has(claims.jti)) throw new Error('jti replay');
  S.jtis.add(claims.jti);
  if (accessToken !== undefined && claims.ath !== sha256(accessToken)) throw new Error('ath mismatch');
  if (accessToken === undefined && claims.ath !== undefined) throw new Error('unexpected ath');
  const jkt = sha256(JSON.stringify({ crv: header.jwk.crv, kty: header.jwk.kty, x: header.jwk.x, y: header.jwk.y }));
  return { jkt };
}

/** 資源端點的認證；失敗直接回 401 並回傳 null。 */
function authenticate(req, res) {
  try {
    const m = /^DPoP (.+)$/.exec(req.headers.authorization || '');
    if (!m) throw new Error('not a DPoP authorization');
    const token = m[1];
    const rec = S.access.get(token);
    if (!rec) throw new Error('unknown token');
    const fam = S.families.get(rec.family);
    if (!fam || fam.revoked) throw new Error('family revoked');
    if (rec.expired) throw new Error('expired');
    const { jkt } = verifyProof(req, { accessToken: token });
    if (jkt !== fam.jkt) throw new Error('jkt mismatch');
    const user = Object.values(S.users).find((u) => u.id === fam.userId);
    if (!user) throw new Error('user gone');
    return { user, familyId: rec.family };
  } catch (e) {
    if (!/missing proof|unknown token|expired|family revoked|not a DPoP/.test(e.message)) S.stats.dpopRejected += 1;
    send(req, res, 401, { error: { code: 'AUTH_REQUIRED', message: e.message } }, { 'WWW-Authenticate': 'DPoP error="invalid_token"' });
    return null;
  }
}

function issueTokens(familyId) {
  const fam = S.families.get(familyId);
  const refresh = rand(32);
  const access = rand(32);
  S.refresh.set(refresh, { family: familyId, used: false });
  S.access.set(access, { family: familyId, expired: false });
  fam.current = refresh;
  const out = { access_token: access, refresh_token: refresh, token_type: 'DPoP', expires_in: 900 };
  // 對齊真 api：scope 含 openid 時回未簽章也無妨的 id_token（web 只驗 sub／aud／exp，見 src/lib/auth/idToken.ts）。可由 /__fake/no-id-token 關掉以測落回 userinfo
  const user = Object.values(S.users).find((u) => u.id === fam.userId);
  if (user && !S.noIdToken) {
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    out.id_token = `${b64u({ alg: 'ES256' })}.${b64u({ iss: ORIGIN, sub: user.id, aud: 'tripline-web', email: user.email, email_verified: true, name: user.displayName ?? user.email.split('@')[0], exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
  }
  return out;
}

function revokeFamily(id) { const f = S.families.get(id); if (f) f.revoked = true; }
function revokeUser(userId, exceptFamily) {
  for (const [id, f] of S.families) if (f.userId === userId && id !== exceptFamily) f.revoked = true;
}

async function handle(req, res) {
  const url = new URL(req.url, ORIGIN);
  const path = url.pathname;
  if (req.method === 'OPTIONS') { cors(req, res); res.writeHead(204); return res.end(); }

  // ---- 測試控制面 ----
  if (path === '/__fake/state') {
    const families = [...S.families.entries()].map(([id, f]) => ({ id, userId: f.userId, revoked: f.revoked }));
    return send(req, res, 200, { stats: S.stats, families, log: S.log, unhandled: S.unhandled, users: Object.keys(S.users) });
  }
  if (path === '/__fake/reset' && req.method === 'POST') { reset(); return send(req, res, 200, { ok: true }); }
  if (path === '/__fake/no-id-token' && req.method === 'POST') { S.noIdToken = true; return send(req, res, 200, { ok: true }); }
  if (path === '/__fake/expire-access' && req.method === 'POST') { for (const a of S.access.values()) a.expired = true; return send(req, res, 200, { ok: true }); }

  // ---- 公開端點 ----
  if (path === '/api/public-config' && req.method === 'GET') return send(req, res, 200, { features: { passwordSignup: true } });

  if (path === '/api/oauth/login' && req.method === 'POST') {
    let b; try { b = JSON.parse(await readBody(req)); } catch { return err(req, res, 400, 'LOGIN_INVALID_INPUT'); }
    const missing = LOGIN_REQUIRED.filter((k) => b[k] === undefined || b[k] === '');
    if (missing.length) return err(req, res, 400, 'LOGIN_INVALID_INPUT', `缺必填欄位 ${missing.join(',')}`);
    if (b.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(b.code_challenge)) return err(req, res, 400, 'LOGIN_INVALID_INPUT', 'PKCE');
    const user = S.users[String(b.email).toLowerCase()];
    if (!user || user.password === null || user.password !== b.password) return err(req, res, 401, 'LOGIN_INVALID');
    const code = rand();
    S.codes.set(code, { challenge: b.code_challenge, jkt: b.dpop_jkt, userId: user.id, clientId: b.client_id });
    return send(req, res, 200, { code });
  }

  if (path === '/api/oauth/token' && req.method === 'POST') {
    const form = new URLSearchParams(await readBody(req));
    let jkt;
    try { ({ jkt } = verifyProof(req)); } catch { S.stats.dpopRejected += 1; return oauthErr(req, res, 400, 'invalid_dpop_proof'); }
    if (form.get('client_id') !== 'tripline-web') return oauthErr(req, res, 401, 'invalid_client');
    if (form.get('grant_type') === 'authorization_code') {
      const rec = S.codes.get(form.get('code'));
      S.codes.delete(form.get('code')); // 單次
      if (!rec || rec.clientId !== 'tripline-web') return oauthErr(req, res, 400, 'invalid_grant');
      if (sha256(form.get('code_verifier') || '') !== rec.challenge) return oauthErr(req, res, 400, 'invalid_grant');
      if (rec.jkt && rec.jkt !== jkt) return oauthErr(req, res, 400, 'invalid_grant');
      if (form.get('redirect_uri')) return oauthErr(req, res, 400, 'invalid_grant'); // 第一方 code 沒有 redirect_uri
      const familyId = rand(8);
      S.families.set(familyId, { userId: rec.userId, jkt, revoked: false });
      S.stats.codeGrants += 1;
      return send(req, res, 200, issueTokens(familyId));
    }
    if (form.get('grant_type') === 'refresh_token') {
      const rec = S.refresh.get(form.get('refresh_token'));
      if (!rec) return oauthErr(req, res, 400, 'invalid_grant');
      const fam = S.families.get(rec.family);
      if (fam.revoked) return oauthErr(req, res, 400, 'invalid_grant');
      if (rec.used) { // 重放：整個 family 作廢，包含目前最新的那顆
        revokeFamily(rec.family);
        S.stats.reuseDetected += 1;
        return oauthErr(req, res, 400, 'invalid_grant');
      }
      if (fam.jkt !== jkt) return oauthErr(req, res, 400, 'invalid_grant');
      rec.used = true;
      S.stats.refreshGrants += 1;
      return send(req, res, 200, issueTokens(rec.family));
    }
    return oauthErr(req, res, 400, 'unsupported_grant_type');
  }

  // ---- 受保護端點 ----
  if (path.startsWith('/api/')) {
    const a = authenticate(req, res);
    if (!a) return;
    const { user, familyId } = a;
    const m = req.method;

    if (path === '/api/oauth/userinfo' && m === 'GET') {
      return send(req, res, 200, { id: user.id, email: user.email, emailVerified: true, displayName: user.displayName, avatarUrl: null, createdAt: '2026-01-01T00:00:00Z' });
    }
    if (path === '/api/oauth/logout' && m === 'POST') { revokeFamily(familyId); return send(req, res, 204); }
    if (path === '/api/my-trips' && m === 'GET') return send(req, res, 200, [FAKE_TRIP]);
    if (path === '/api/requests' && m === 'GET') return send(req, res, 200, []);
    if (path === '/api/account/stats' && m === 'GET') return send(req, res, 200, { tripCount: 6, totalDays: 45, collaboratorCount: 2 });

    if (path === '/api/account' && m === 'GET') {
      return send(req, res, 200, { hasPassword: user.password !== null, tripsOwned: 0, collaboratorsAffected: 0 });
    }
    if (path === '/api/account/password' && m === 'POST') {
      const b = JSON.parse((await readBody(req)) || '{}');
      if (user.password === null || b.current_password !== user.password) return err(req, res, 403, 'CHANGE_PASSWORD_CURRENT_INVALID');
      user.password = b.new_password;
      revokeUser(user.id, familyId); // 其他裝置登出，這個 family 保留
      return send(req, res, 200, { ok: true });
    }
    if (path === '/api/account' && m === 'DELETE') {
      const b = JSON.parse((await readBody(req)) || '{}');
      if (user.password === null) return err(req, res, 403, 'ACCOUNT_DELETE_REAUTH_REQUIRED'); // 無密碼：fail-closed
      if (b.password !== user.password) return err(req, res, 403, 'ACCOUNT_DELETE_PASSWORD_INVALID');
      revokeUser(user.id);
      delete S.users[user.email];
      return send(req, res, 200, { ok: true });
    }

    // ---- AI 請求與 SSE ticket ----
    if (path === '/api/account/ai-authorization' && m === 'GET') return send(req, res, 200, { authorized: true });
    if (path === '/api/trips/fake-trip/ai-authorization' && m === 'GET') return send(req, res, 200, { authorized: true });
    if (path === '/api/account/ai-data-consent' && m === 'GET') return send(req, res, 200, { status: 'none', enforced: false });
    if (path === '/api/requests' && m === 'POST') return send(req, res, 201, { id: ++S.nextRequestId });
    let r;
    if ((r = /^\/api\/requests\/(\d+)$/.exec(path)) && m === 'GET') {
      return send(req, res, 200, { id: Number(r[1]), tripId: 'fake-trip', message: '你好', reply: '好的', status: S.done.has(Number(r[1])) ? 'completed' : 'processing', processedBy: 'worker' });
    }
    if ((r = /^\/api\/requests\/(\d+)\/sse-ticket$/.exec(path)) && m === 'POST') {
      const ticket = rand(16);
      S.tickets.set(ticket, { userId: user.id, requestId: r[1], used: false });
      S.stats.ticketsIssued += 1;
      return send(req, res, 200, { ticket, expires_in: 30 });
    }
    S.unhandled.push(`${m} ${path}`);
    return err(req, res, 404, 'NOT_FOUND', 'fake api 未實作');
  }
  return send(req, res, 404, 'not found');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, ORIGIN);
  // SSE：ticket 在 query，不走 Authorization
  const ev = /^\/api\/requests\/(\d+)\/events$/.exec(url.pathname);
  if (ev && req.method === 'GET') {
    const t = S.tickets.get(url.searchParams.get('ticket'));
    if (!t || t.used || t.requestId !== ev[1]) { S.stats.ticketsRejected += 1; return err(req, res, 401, 'AUTH_REQUIRED', 'ticket'); }
    t.used = true; // 一次性
    S.stats.ticketsConsumed += 1;
    cors(req, res);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 600000\n\n');
    res.write(`data: ${JSON.stringify({ status: 'processing' })}\n\n`);
    const timer = setTimeout(() => {
      S.done.add(Number(ev[1]));
      res.write(`data: ${JSON.stringify({ status: 'completed', processedBy: 'worker' })}\n\n`);
      res.end();
    }, 300);
    req.on('close', () => clearTimeout(timer));
    S.log.push({ method: 'GET', path: url.pathname, status: 200 });
    return;
  }
  handle(req, res).catch((e) => { try { send(req, res, 500, { error: { code: 'FAKE_INTERNAL', message: String(e) } }); } catch { /* 已送出 */ } });
});
server.listen(PORT, () => console.log(`fake new api on ${ORIGIN}`));
