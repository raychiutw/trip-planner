/**
 * POST /api/oauth/token — V2-P4
 * 走 HTTP 邊界（tests/api/http.ts）：請求本身（client 憑證、授權碼、refresh token、PKCE）就是認證。
 * 原本檢查手寫 mock DB 的 prepare／bind 呼叫形狀之處，改讀真實 D1：
 * 授權碼與 refresh token 的 consumed 狀態、token 家族（grantId）撤銷、簽發的 token 資料列、rate-limit bucket。
 * 共用 D1 下只動自己的 client／使用者／token，結束時清掉。
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi } from './http';
import { hashPassword } from '../../src/server/password';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';

// 專用 client id：共用 D1 下只動自己的資料列
const MOBILE = 'tok-http-mobile';
const OTHER = 'tok-http-other-client';
const PARTNER = 'tok-http-partner';
const CLI = 'tok-http-cli';
const CLI_NO_ADMIN = 'tok-http-cli-no-admin';
const CLI_DEFAULT = 'tok-http-cli-default';
const CLIENTS = [MOBILE, OTHER, PARTNER, CLI, CLI_NO_ADMIN, CLI_DEFAULT];
const CLIENT_SQL = CLIENTS.map((c) => `'${c}'`).join(', ');
const USER_ID = 'tok-http-user-1';
const USER_EMAIL = 'tok-http-user-1@http-test.example';
const ORIGIN = 'https://x.com';

let db: D1Database;

beforeAll(async () => {
  db = await createTestDb();
  const hashes = {
    partner: await hashPassword('correct-secret-1'),
    cli: await hashPassword('the-secret-1'),
    shared: await hashPassword('secret-1234'),
  };
  const clients: Array<[string, 'public' | 'confidential', string | null, string]> = [
    [MOBILE, 'public', null, '["admin"]'],
    [OTHER, 'public', null, '[]'],
    [PARTNER, 'confidential', hashes.partner, '[]'],
    [CLI, 'confidential', hashes.cli, '["admin","trips:read","trips:write"]'],
    [CLI_NO_ADMIN, 'confidential', hashes.shared, '["trips:read"]'],
    [CLI_DEFAULT, 'confidential', hashes.shared, '["admin","trips:read"]'],
  ];
  for (const [id, type, hash, scopes] of clients) {
    await db
      .prepare(`INSERT OR REPLACE INTO client_apps (client_id, client_type, client_secret_hash, app_name, redirect_uris, allowed_scopes, status)
        VALUES (?, ?, ?, ?, '["https://x.com/cb"]', ?, 'active')`)
      .bind(id, type, hash, id, scopes)
      .run();
  }
  await db
    .prepare('INSERT OR REPLACE INTO users (id, email, display_name, email_verified_at) VALUES (?, ?, ?, ?)')
    .bind(USER_ID, USER_EMAIL, 'Test User', '2026-04-20')
    .run();
}, 60_000);

async function cleanup() {
  await db.prepare(`DELETE FROM oauth_models WHERE json_extract(payload, '$.client_id') IN (${CLIENT_SQL})`).run();
  await db.prepare("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'oauth-token:%'").run();
}

beforeEach(cleanup);

afterAll(async () => {
  await cleanup();
  await db.prepare(`DELETE FROM client_apps WHERE client_id IN (${CLIENT_SQL})`).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(USER_ID).run();
  await disposeMiniflare();
});

async function generateTestPrivateKeyBase64(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const exported = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const bytes = new Uint8Array(exported);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  let str = '';
  for (let i = 0; i < hash.length; i++) str += String.fromCharCode(hash[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** POST /api/oauth/token；預設 JSON body（與原本一致），也可用 form-urlencoded。 */
function post(body: Record<string, string>, env = mockEnv(db), contentType = 'application/json') {
  const payload = contentType === 'application/x-www-form-urlencoded' ? new URLSearchParams(body).toString() : JSON.stringify(body);
  return createApi({ env }).fetch(new Request(`${ORIGIN}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: payload,
  }));
}

async function seedCode(code: string, overrides: Record<string, unknown> = {}) {
  await new D1Adapter(db, 'AuthorizationCode').upsert(code, {
    client_id: MOBILE,
    user_id: USER_ID,
    redirect_uri: `${ORIGIN}/cb`,
    scopes: ['openid', 'profile'],
    code_challenge: null,
    code_challenge_method: null,
    ...overrides,
  }, 600);
}

async function seedRefresh(token: string, overrides: Record<string, unknown> = {}) {
  await new D1Adapter(db, 'RefreshToken').upsert(token, {
    client_id: MOBILE, user_id: USER_ID, scopes: ['openid', 'profile'], grantId: `grant-${token}`, ...overrides,
  }, 600);
}

async function seedAccess(token: string, grantId: string, clientId = MOBILE) {
  await new D1Adapter(db, 'AccessToken').upsert(token, { client_id: clientId, user_id: USER_ID, scopes: ['openid'], grantId }, 600);
}

async function modelRow(model: string, id: string): Promise<Record<string, unknown> | null> {
  const row = await db.prepare('SELECT payload FROM oauth_models WHERE name = ? AND id = ?').bind(model, id).first<{ payload: string }>();
  return row ? JSON.parse(row.payload) : null;
}

async function familyCount(grantId: string): Promise<number> {
  const row = await db
    .prepare("SELECT count(*) AS n FROM oauth_models WHERE name IN ('AccessToken', 'RefreshToken') AND json_extract(payload, '$.grantId') = ?")
    .bind(grantId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

async function bucketCount(key: string): Promise<number | null> {
  const row = await db.prepare('SELECT count FROM rate_limit_buckets WHERE bucket_key = ?').bind(key).first<{ count: number }>();
  return row ? row.count : null;
}

describe('POST /api/oauth/token', () => {
  it('400 unsupported_grant_type when not authorization_code', async () => {
    const res = await post({ grant_type: 'password' });
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('unsupported_grant_type');
  });

  it('400 invalid_client when client_id missing', async () => {
    const res = await post({ grant_type: 'authorization_code' });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_client');
  });

  it('401 invalid_client when client unknown', async () => {
    const res = await post({ grant_type: 'authorization_code', client_id: 'tok-http-unknown', code: 'c', redirect_uri: 'r' });
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe('invalid_client');
  });

  it('happy path public client (no PKCE): exchange code for tokens', async () => {
    await seedCode('auth-code-xyz');
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'auth-code-xyz',
      redirect_uri: `${ORIGIN}/cb`,
    });

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.access_token).toBe('string');
    expect(typeof json.refresh_token).toBe('string');
    expect(json.token_type).toBe('Bearer');
    expect(json.expires_in).toBe(3600);
    expect(json.scope).toBe('openid profile');
    expect(res.headers.get('cache-control')).toBe('no-store');
    // 真實 D1：授權碼已被消耗，發出的 access／refresh token 在同一個 grant 家族
    expect((await modelRow('AuthorizationCode', 'auth-code-xyz'))?.consumed).toBeTruthy();
    const access = await modelRow('AccessToken', json.access_token as string);
    const refresh = await modelRow('RefreshToken', json.refresh_token as string);
    expect(access).toMatchObject({ client_id: MOBILE, user_id: USER_ID, scopes: ['openid', 'profile'] });
    expect(refresh).toMatchObject({ client_id: MOBILE, user_id: USER_ID });
    expect(access?.grantId).toBe(refresh?.grantId);
  });

  it('400 invalid_grant when code unknown / expired', async () => {
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'expired',
      redirect_uri: 'r',
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_grant');
  });

  it('400 invalid_grant when redirect_uri mismatch (anti-injection)', async () => {
    await seedCode('c', { redirect_uri: 'https://original.com/cb' });
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'c',
      redirect_uri: 'https://attacker.com/cb', // different
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error_description: string }).error_description).toContain('redirect_uri mismatch');
    // 不匹配的請求不能消耗授權碼
    expect((await modelRow('AuthorizationCode', 'c'))?.consumed).toBeUndefined();
  });

  it('400 invalid_grant when code_verifier missing for PKCE-protected code', async () => {
    await seedCode('c', { code_challenge: 'some-challenge', code_challenge_method: 'S256' });
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'c',
      redirect_uri: `${ORIGIN}/cb`,
      // missing code_verifier
    });
    expect(res.status).toBe(400);
    // 要明確回報「缺少 verifier」，不能被當成「verifier 不符」
    const description = (await res.json() as { error_description: string }).error_description;
    expect(description).toContain('code_verifier required');
    expect(description).not.toContain('does not match');
    expect((await modelRow('AuthorizationCode', 'c'))?.consumed).toBeUndefined();
  });

  it('PKCE happy path: code_verifier matches code_challenge', async () => {
    const verifier = 'test-verifier-string-32-chars-min';
    await seedCode('c', { code_challenge: await pkceChallenge(verifier), code_challenge_method: 'S256' });
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'c',
      redirect_uri: `${ORIGIN}/cb`,
      code_verifier: verifier,
    });
    expect(res.status).toBe(200);
  });

  it('400 invalid_grant when PKCE code_verifier does not match code_challenge', async () => {
    await seedCode('c', { code_challenge: await pkceChallenge('the-real-verifier-string-32-chars'), code_challenge_method: 'S256' });
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'c',
      redirect_uri: `${ORIGIN}/cb`,
      code_verifier: 'a-different-verifier-string-32-chars',
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error_description: string }).error_description).toContain('does not match');
    expect((await modelRow('AuthorizationCode', 'c'))?.consumed).toBeUndefined();
  });

  it('400 invalid_grant when code already consumed (replay protection)', async () => {
    await seedCode('c');
    const body = { grant_type: 'authorization_code', client_id: MOBILE, code: 'c', redirect_uri: `${ORIGIN}/cb` };
    expect((await post(body)).status).toBe(200);
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json() as { error_description: string }).error_description).toContain('already used');
  });

  it('replay attack triggers cascade revoke of access+refresh tokens (RFC 6749 §10.5)', async () => {
    await seedCode('c');
    const body = { grant_type: 'authorization_code', client_id: MOBILE, code: 'c', redirect_uri: `${ORIGIN}/cb` };
    const issued = await (await post(body)).json() as { access_token: string; refresh_token: string };
    const grantId = (await modelRow('AccessToken', issued.access_token))?.grantId as string;
    expect(await familyCount(grantId)).toBe(2);
    // 另一個家族不受影響
    await seedAccess('bystander-access', 'bystander-grant');

    expect((await post(body)).status).toBe(400);

    // 重放後整個 grant 家族（AccessToken + RefreshToken）都被撤銷
    expect(await familyCount(grantId)).toBe(0);
    expect(await modelRow('AccessToken', issued.access_token)).toBeNull();
    expect(await modelRow('RefreshToken', issued.refresh_token)).toBeNull();
    expect(await modelRow('AccessToken', 'bystander-access')).not.toBeNull();
  });

  it('confidential client requires + verifies client_secret', async () => {
    // Wrong secret
    const r1 = await post({
      grant_type: 'authorization_code',
      client_id: PARTNER,
      client_secret: 'wrong-secret-2',
      code: 'c',
      redirect_uri: 'r',
    });
    expect(r1.status).toBe(401);
    expect((await r1.json() as { error: string }).error).toBe('invalid_client');
    // Missing secret
    const r2 = await post({ grant_type: 'authorization_code', client_id: PARTNER, code: 'c', redirect_uri: 'r' });
    expect(r2.status).toBe(401);
    // 對的 secret 才會繼續走到授權碼（此處 code 不存在 → invalid_grant，不是 invalid_client）
    const r3 = await post({
      grant_type: 'authorization_code',
      client_id: PARTNER,
      client_secret: 'correct-secret-1',
      code: 'c',
      redirect_uri: 'r',
    });
    expect(r3.status).toBe(400);
    expect((await r3.json() as { error: string }).error).toBe('invalid_grant');
  }, 60_000);
});

describe('POST /api/oauth/token — refresh_token grant', () => {
  it('happy path: rotate refresh + issue new access', async () => {
    await seedRefresh('old-refresh-token', { grantId: 'g1' });
    const res = await post({
      grant_type: 'refresh_token',
      client_id: MOBILE,
      refresh_token: 'old-refresh-token',
    });

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.access_token).toBe('string');
    expect(typeof json.refresh_token).toBe('string');
    expect(json.token_type).toBe('Bearer');
    expect(json.scope).toBe('openid profile');

    // Old refresh token marked consumed (NOT destroyed — kept for reuse detection)
    expect((await modelRow('RefreshToken', 'old-refresh-token'))?.consumed).toBeTruthy();
    // New refresh_token must differ from the one we passed in (rotation guarantee)
    expect(json.refresh_token).not.toBe('old-refresh-token');
    expect((json.refresh_token as string).length).toBeGreaterThan(40);
    // 新的一對 token 繼承同一個 grant 家族
    expect(await modelRow('AccessToken', json.access_token as string)).toMatchObject({ grantId: 'g1', client_id: MOBILE });
    expect(await modelRow('RefreshToken', json.refresh_token as string)).toMatchObject({ grantId: 'g1', client_id: MOBILE });
  });

  it('refresh-token reuse detection cascades family revoke (OAuth 2.1 §6.1)', async () => {
    // 這顆 refresh token 已被輪替過（consumed），有人拿它重放 → 攻擊者可能偷到了舊 token
    await seedRefresh('leaked', { scopes: ['openid'], grantId: 'family-1', consumed: Date.now() - 5000 });
    await seedAccess('family-1-access', 'family-1');
    await seedAccess('family-2-access', 'family-2');
    const res = await post({
      grant_type: 'refresh_token',
      client_id: MOBILE,
      refresh_token: 'leaked',
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error_description: string }).error_description).toContain('reuse detected');
    // 同一個家族的 AccessToken + RefreshToken 一次清光，別的家族不動
    expect(await familyCount('family-1')).toBe(0);
    expect(await modelRow('RefreshToken', 'leaked')).toBeNull();
    expect(await modelRow('AccessToken', 'family-2-access')).not.toBeNull();
  });

  it('400 invalid_grant when refresh_token unknown / expired', async () => {
    const res = await post({
      grant_type: 'refresh_token',
      client_id: MOBILE,
      refresh_token: 'expired',
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_grant');
  });

  it('400 invalid_grant when refresh_token belongs to other client (anti-token theft)', async () => {
    await seedRefresh('someone-elses-token', { client_id: OTHER, scopes: ['openid'], grantId: 'g1' });
    const res = await post({
      grant_type: 'refresh_token',
      client_id: MOBILE,
      refresh_token: 'someone-elses-token',
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error_description: string }).error_description).toContain('does not belong');
    // 別的 client 的 token 不能被消耗
    expect((await modelRow('RefreshToken', 'someone-elses-token'))?.consumed).toBeUndefined();
  });

  it('400 invalid_request when refresh_token missing', async () => {
    const res = await post({
      grant_type: 'refresh_token',
      client_id: MOBILE,
      // missing refresh_token
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_request');
  });

  it('Scope downgrade allowed (subset of stored), widening rejected', async () => {
    await seedRefresh('tok', { scopes: ['openid', 'profile', 'email'], grantId: 'g1' });
    // Downgrade ok
    const r1 = await post({
      grant_type: 'refresh_token',
      client_id: MOBILE,
      refresh_token: 'tok',
      scope: 'openid',
    });
    expect(r1.status).toBe(200);
    const issued = await r1.json() as { scope: string; access_token: string };
    expect(issued.scope).toBe('openid');
    expect((await modelRow('AccessToken', issued.access_token))?.scopes).toEqual(['openid']);

    // Widening rejected（且不消耗 refresh token）
    await seedRefresh('tok2', { scopes: ['openid'], grantId: 'g2' });
    const r2 = await post({
      grant_type: 'refresh_token',
      client_id: MOBILE,
      refresh_token: 'tok2',
      scope: 'openid admin',
    });
    expect(r2.status).toBe(400);
    expect(((await r2.json()) as { error: string }).error).toBe('invalid_scope');
    expect((await modelRow('RefreshToken', 'tok2'))?.consumed).toBeUndefined();
  });

  it('id_token issued when scope=openid + signing key configured (V2-P5)', async () => {
    const signingKey = await generateTestPrivateKeyBase64();
    await seedCode('auth-code-xyz');
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'auth-code-xyz',
      redirect_uri: `${ORIGIN}/cb`,
    }, mockEnv(db, { OAUTH_SIGNING_PRIVATE_KEY: signingKey }));

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, string>;
    expect(typeof json.id_token).toBe('string');

    // Parse JWT manually (header.payload.sig)
    const parts = json.id_token!.split('.');
    expect(parts.length).toBe(3);
    const padded = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const claims = JSON.parse(atob(padded + '='.repeat(padLen))) as Record<string, unknown>;
    // v2.55.85: 本條原本斷言 `https://x.com`，把 iss drift 固化了 —— discovery doc
    // 宣告的是 `<origin>/api/oauth`，兩者必須逐字元相同（OIDC Core 3.1.3.7 #2）。
    // 逐字比對由 tests/api/oauth-id-token.test.ts 直接拿 discovery 輸出來對。
    expect(claims.iss).toBe('https://x.com/api/oauth');
    expect(claims.sub).toBe(USER_ID);
    expect(claims.aud).toBe(MOBILE);
    expect(claims.email).toBe(USER_EMAIL);
    expect(claims.email_verified).toBe(true);
    expect(claims.name).toBe('Test User');
    expect(typeof claims.iat).toBe('number');
    expect(typeof claims.exp).toBe('number');
    expect(claims.exp).toBeGreaterThan(claims.iat as number);
  });

  it('NO id_token when scope lacks openid (just trips:read)', async () => {
    const signingKey = await generateTestPrivateKeyBase64();
    await seedCode('c', { scopes: ['trips.read'] });
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'c',
      redirect_uri: `${ORIGIN}/cb`,
    }, mockEnv(db, { OAUTH_SIGNING_PRIVATE_KEY: signingKey }));

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.id_token).toBeUndefined();
  });

  it('access_token still issued when openid scope but signing key missing (graceful degrade)', async () => {
    await seedCode('c');
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'c',
      redirect_uri: `${ORIGIN}/cb`,
    });
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.access_token).toBe('string');
    expect(json.id_token).toBeUndefined();
  });

  it('429 rate_limited when client bucket locked (V2-P6 throughput cap)', async () => {
    // v2.33.101 CR-9: rate-limit check 在 client_apps SELECT 之後，client 要存在且 active
    await db
      .prepare('INSERT OR REPLACE INTO rate_limit_buckets (bucket_key, count, window_start, locked_until) VALUES (?, ?, ?, ?)')
      .bind(`oauth-token:${MOBILE}`, 101, Date.now(), Date.now() + 30_000)
      .run();
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'c', redirect_uri: 'r',
    });
    expect(res.status).toBe(429);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('rate_limited');
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('不 bump per-client oauth-token bucket 當 client_id 未知 (v2.33.101 CR-9: prevent DB write DoS amp)', async () => {
    const res = await post({
      grant_type: 'authorization_code',
      client_id: 'tok-http-unknown-mobile',
      code: 'c', redirect_uri: 'r',
    });
    expect(res.status).toBe(401);
    // v2.33.101 CR-9: unknown client → 不寫 per-client bucket。
    expect(await bucketCount('oauth-token:tok-http-unknown-mobile')).toBeNull();
    // v2.33.103 SEC-7: per-IP bucket 仍會寫（早於 client lookup，IP 配額獨立）。
    expect(await bucketCount('oauth-token:ip:unknown')).toBe(1);
  });

  it('Bumps oauth-token + per-IP buckets on every known-client request', async () => {
    const res = await post({
      grant_type: 'authorization_code',
      client_id: MOBILE,
      code: 'c', redirect_uri: 'r',
    });
    expect(res.status).toBe(400); // invalid_grant — code not found
    // v2.33.103 SEC-7: per-IP bump + per-client bump 各一次
    expect(await bucketCount('oauth-token:ip:unknown')).toBe(1);
    expect(await bucketCount(`oauth-token:${MOBILE}`)).toBe(1);
  });
});

describe('POST /api/oauth/token — client_credentials grant (RFC 6749 §4.4)', () => {
  it('confidential client + correct secret + admin scope → 200 with access_token only (no refresh)', async () => {
    const res = await post({
      grant_type: 'client_credentials',
      client_id: CLI,
      client_secret: 'the-secret-1',
      scope: 'admin',
    });
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.access_token).toBe('string');
    expect(json.refresh_token).toBeUndefined(); // §4.4.3 — no refresh
    expect(json.token_type).toBe('Bearer');
    expect(json.scope).toBe('admin');
    // Stored in AccessToken adapter：沒有 user、帶 client 與 scope，且沒有 RefreshToken
    expect(await modelRow('AccessToken', json.access_token as string)).toMatchObject({
      client_id: CLI, user_id: null, scopes: ['admin'],
    });
    const refreshRows = await db
      .prepare("SELECT count(*) AS n FROM oauth_models WHERE name = 'RefreshToken' AND json_extract(payload, '$.client_id') = ?")
      .bind(CLI)
      .first<{ n: number }>();
    expect(refreshRows?.n).toBe(0);
  }, 60_000);

  it('public client → 401 unauthorized_client (client_credentials only for confidential)', async () => {
    const res = await post({
      grant_type: 'client_credentials',
      client_id: MOBILE,
      scope: 'admin',
    });
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe('unauthorized_client');
  });

  it('scope outside allowed_scopes → 400 invalid_scope', async () => {
    const res = await post({
      grant_type: 'client_credentials',
      client_id: CLI_NO_ADMIN, // allowed_scopes 只有 trips:read
      client_secret: 'secret-1234',
      scope: 'admin',
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_scope');
    // 沒有簽出任何 token
    const issued = await db
      .prepare("SELECT count(*) AS n FROM oauth_models WHERE json_extract(payload, '$.client_id') = ?")
      .bind(CLI_NO_ADMIN)
      .first<{ n: number }>();
    expect(issued?.n).toBe(0);
  }, 60_000);

  it('omitting scope param → defaults to all client.allowed_scopes', async () => {
    const res = await post({
      grant_type: 'client_credentials',
      client_id: CLI_DEFAULT,
      client_secret: 'secret-1234',
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { scope: string };
    expect(json.scope).toBe('admin trips:read');
  }, 60_000);

  it('accepts form-urlencoded body and HTTP Basic client auth', async () => {
    const res = await createApi({ env: mockEnv(db) }).fetch(new Request(`${ORIGIN}/api/oauth/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${CLI}:the-secret-1`)}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'trips:read' }).toString(),
    }));
    expect(res.status).toBe(200);
    expect((await res.json() as { scope: string }).scope).toBe('trips:read');
  }, 60_000);
});
