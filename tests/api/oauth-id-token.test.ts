/**
 * issueIdToken unit test — iss 必須與 discovery 的 issuer 完全相同
 *
 * 先前 `issueIdToken` 沒有任何測試，drift 因此無人察覺：discovery 宣告
 * `<origin>/api/oauth`，實作卻簽 `<origin>`（無後綴）。
 */
import { describe, it, expect, vi } from 'vitest';
import { issueIdToken } from '../../functions/api/oauth/_id_token';
import { onRequestGet as openidConfigHandler } from '../../functions/api/oauth/.well-known/openid-configuration';
import { getPublicOrigin, getOidcIssuer, CANONICAL_PROD_ORIGIN } from '../../functions/api/_utils';
import type { Env } from '../../functions/api/_types';

async function generateTestPrivateKeyBase64(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const exported = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const bytes = new Uint8Array(exported);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str);
}

const USER_ROW = {
  id: 'u1',
  email: 'amy@example.com',
  display_name: 'Amy',
  email_verified_at: '2026-01-01T00:00:00Z',
};

async function makeEnv(overrides: Partial<Env> = {}): Promise<Env> {
  return {
    OAUTH_SIGNING_PRIVATE_KEY: await generateTestPrivateKeyBase64(),
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(USER_ROW),
      }),
    },
    ...overrides,
  } as unknown as Env;
}

function decodeClaims(jwt: string): Record<string, unknown> {
  const payload = jwt.split('.')[1]!;
  const normalised = payload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(normalised)) as Record<string, unknown>;
}

/** discovery handler 的 context（與 oidc-discovery.test.ts 同形）。 */
function makeDiscoveryContext(url: string): Parameters<typeof openidConfigHandler>[0] {
  return {
    request: new Request(url),
    env: {} as unknown as never,
    params: {} as unknown as never,
    data: {} as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof openidConfigHandler>[0];
}

describe('issueIdToken — iss claim', () => {
  it('iss 與 discovery 的 issuer 逐字相同（OIDC Core 3.1.3.7 #2）', async () => {
    // 這是本次修復的核心：兩邊必須是同一個字串，client 才驗得過。
    const url = 'https://trip-planner-dby.pages.dev/api/oauth/token';
    const env = await makeEnv();

    const jwt = await issueIdToken(env, new Request(url, { method: 'POST' }), 'mobile', 'u1', ['openid']);
    const discovery = await openidConfigHandler(
      makeDiscoveryContext('https://trip-planner-dby.pages.dev/api/oauth/.well-known/openid-configuration'),
    );
    const { issuer } = (await discovery.json()) as { issuer: string };

    expect(decodeClaims(jwt!).iss).toBe(issuer);
  });

  it('iss 帶 /api/oauth 後綴 —— discovery doc 就掛在該路徑下（OIDC Discovery §4）', async () => {
    const env = await makeEnv();
    const jwt = await issueIdToken(
      env,
      new Request('https://trip-planner-dby.pages.dev/api/oauth/token', { method: 'POST' }),
      'mobile',
      'u1',
      ['openid'],
    );
    expect(decodeClaims(jwt!).iss).toBe('https://trip-planner-dby.pages.dev/api/oauth');
  });

  it('PUBLIC_ORIGIN 優先於 request host（iss 是 trust anchor，不可被 Host header 竄改）', async () => {
    const env = await makeEnv({ PUBLIC_ORIGIN: 'https://trip-planner-dby.pages.dev' } as Partial<Env>);
    // 攻擊者控制 Host → request.url 是他的網域；iss 仍須是設定的 origin。
    const jwt = await issueIdToken(env, new Request('https://evil.example/api/oauth/token', { method: 'POST' }), 'mobile', 'u1', ['openid']);
    expect(decodeClaims(jwt!).iss).toBe('https://trip-planner-dby.pages.dev/api/oauth');
  });

  it('PUBLIC_ORIGIN 帶結尾斜線也不產生雙斜線', async () => {
    const env = await makeEnv({ PUBLIC_ORIGIN: 'https://trip-planner-dby.pages.dev/' } as Partial<Env>);
    const jwt = await issueIdToken(env, new Request('https://x.example/api/oauth/token', { method: 'POST' }), 'mobile', 'u1', ['openid']);
    expect(decodeClaims(jwt!).iss).toBe('https://trip-planner-dby.pages.dev/api/oauth');
  });

  it('本機 dev origin 同樣帶後綴', async () => {
    const env = await makeEnv();
    const jwt = await issueIdToken(env, new Request('http://localhost:8788/api/oauth/token', { method: 'POST' }), 'mobile', 'u1', ['openid']);
    expect(decodeClaims(jwt!).iss).toBe('http://localhost:8788/api/oauth');
  });

  it('scope 不含 openid → 不簽發', async () => {
    const env = await makeEnv();
    const jwt = await issueIdToken(env, new Request('https://x.example/api/oauth/token', { method: 'POST' }), 'mobile', 'u1', ['profile']);
    expect(jwt).toBeNull();
  });

  it('aud 是 client_id、sub 是 user id（一併鎖住，避免下次改 iss 時波及）', async () => {
    const env = await makeEnv();
    const jwt = await issueIdToken(env, new Request('https://x.example/api/oauth/token', { method: 'POST' }), 'mobile', 'u1', ['openid']);
    const claims = decodeClaims(jwt!);
    expect(claims.aud).toBe('mobile');
    expect(claims.sub).toBe('u1');
  });
});

describe('getPublicOrigin / getOidcIssuer — production trust anchor (v2.55.86)', () => {
  it('prod 無 PUBLIC_ORIGIN → 回標準常數，絕不用 request Host（防 spoof）', () => {
    // 探針證明 CF 擋不符 Host、不理 X-Forwarded-Host，但 trust anchor 不隱性依賴那個。
    const spoofed = new Request('https://evil.example.com/api/oauth/token');
    expect(getPublicOrigin({ ENVIRONMENT: 'production' }, spoofed)).toBe(CANONICAL_PROD_ORIGIN);
  });

  it('prod 有 PUBLIC_ORIGIN → 逐字用它（去尾斜線），不碰 request Host', () => {
    const spoofed = new Request('https://evil.example.com/api/oauth/token');
    expect(
      getPublicOrigin({ PUBLIC_ORIGIN: 'https://tripline.app/', ENVIRONMENT: 'production' }, spoofed),
    ).toBe('https://tripline.app');
  });

  it('dev/preview 無 PUBLIC_ORIGIN → 維持 request origin 彈性', () => {
    const local = new Request('http://localhost:5173/api/oauth/token');
    expect(getPublicOrigin({ ENVIRONMENT: 'development' }, local)).toBe('http://localhost:5173');
    expect(getPublicOrigin({ ENVIRONMENT: 'preview' }, local)).toBe('http://localhost:5173');
  });

  it('ENVIRONMENT 未設 → request origin（deny-list 邊界；prod 靠 wrangler.toml 強制 ENVIRONMENT=production，同 SEC-6 守衛）', () => {
    // 刻意保留：既有 oidc-discovery 測試靠此推導 issuer，且 prod 的 ENVIRONMENT 是
    // wrangler.toml enforced invariant（非 dashboard 慣例），未設 = 已有更嚴重的 auth bypass。
    const local = new Request('http://localhost:5173/api/oauth/token');
    expect(getPublicOrigin({}, local)).toBe('http://localhost:5173');
  });

  it('getOidcIssuer 在 prod + spoofed Host → issuer 仍是標準 origin + /api/oauth', () => {
    const spoofed = new Request('https://evil.example.com/api/oauth/token');
    expect(getOidcIssuer({ ENVIRONMENT: 'production' }, spoofed)).toBe(
      `${CANONICAL_PROD_ORIGIN}/api/oauth`,
    );
  });

  it('discovery handler 在 prod + spoofed Host → issuer 不被 Host 汙染', async () => {
    const ctx = {
      request: new Request('https://evil.example.com/api/oauth/.well-known/openid-configuration'),
      env: { ENVIRONMENT: 'production' } as unknown as never,
      params: {} as unknown as never,
      data: {} as unknown as never,
      next: () => Promise.resolve(new Response()),
      waitUntil: () => undefined,
      passThroughOnException: () => undefined,
    } as unknown as Parameters<typeof openidConfigHandler>[0];
    const res = await openidConfigHandler(ctx);
    const { issuer } = (await res.json()) as { issuer: string };
    expect(issuer).toBe(`${CANONICAL_PROD_ORIGIN}/api/oauth`);
  });
});
