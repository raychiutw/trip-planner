/**
 * issueIdToken 的 iss 與 discovery 公告的 issuer 一致 —— discovery 端走 HTTP 邊界（tests/api/http.ts）。
 *
 * 先前 `issueIdToken` 沒有任何測試，drift 因此無人察覺：discovery 宣告
 * `<origin>/api/oauth`，實作卻簽 `<origin>`（無後綴）。
 * 從 oauth-id-token 拆出：只留「需要 discovery handler」的兩條；其餘純 module 測試在 tests/unit/oauth-id-token.test.ts。
 * id_token 由 issueIdToken 直接簽（當作 fixture），discovery 用真實路由取得。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi } from './http';
import { issueIdToken } from '../../functions/api/oauth/_id_token';
import { CANONICAL_PROD_ORIGIN } from '../../functions/api/_utils';
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

let db: D1Database;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(disposeMiniflare);

describe('oidc issuer 一致性', () => {
  it('iss 與 discovery 的 issuer 逐字相同（OIDC Core 3.1.3.7 #2）', async () => {
    // 這是當初修復的核心：兩邊必須是同一個字串，client 才驗得過。
    const url = 'https://trip-planner-dby.pages.dev/api/oauth/token';
    const env = await makeEnv();

    const jwt = await issueIdToken(env, new Request(url, { method: 'POST' }), 'mobile', 'u1', ['openid']);
    const discovery = await createApi({ env: mockEnv(db) }).get(
      'https://trip-planner-dby.pages.dev/api/oauth/.well-known/openid-configuration',
    );
    const { issuer } = (await discovery.json()) as { issuer: string };

    expect(decodeClaims(jwt!).iss).toBe(issuer);
  });

  it('discovery 在 prod + spoofed Host → issuer 不被 Host 汙染', async () => {
    const api = createApi({ env: mockEnv(db, { ENVIRONMENT: 'production' }) });
    const res = await api.get('https://evil.example.com/api/oauth/.well-known/openid-configuration');
    const { issuer } = (await res.json()) as { issuer: string };
    expect(issuer).toBe(`${CANONICAL_PROD_ORIGIN}/api/oauth`);
  });
});
