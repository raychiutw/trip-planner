/**
 * OAuth consent → authorize 的授權碼流程（真實 D1）
 * 走 HTTP 邊界（tests/api/http.ts）：consent 與 authorize 都經真實路由與 middleware。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedUser } from './helpers';
import { createApi } from './http';
import { signSessionToken } from '../../src/server/session';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';

let db: D1Database;
let api: ReturnType<typeof createApi>;
let userId: string;
const secret = 'consent-integration-secret';
const clientId = 'consent-integration-client';
const callback = 'https://client.example/callback';
const origin = 'https://trip-planner-dby.pages.dev';
const EMAIL = 'consent-integration@example.com';

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, { SESSION_SECRET: secret }) });
  userId = await seedUser(db, EMAIL);
  await db.prepare(`INSERT INTO client_apps
    (client_id, client_type, app_name, redirect_uris, allowed_scopes, status)
    VALUES (?, 'public', 'Consent test', ?, ?, 'active')`)
    .bind(clientId, JSON.stringify([callback]), JSON.stringify(['openid', 'profile'])).run();
});

const CLEAN_MODELS = "DELETE FROM oauth_models WHERE (name = 'Consent' AND id LIKE ?) OR (name = 'AuthorizationCode' AND json_extract(payload, '$.client_id') = ?)";

afterAll(async () => {
  // 共用 D1：清掉自己建立的資料
  await db.prepare(CLEAN_MODELS).bind(`${userId}:%`, clientId).run();
  await db.prepare('DELETE FROM auth_audit_log WHERE client_id = ?').bind(clientId).run();
  await db.prepare('DELETE FROM client_apps WHERE client_id = ?').bind(clientId).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  await disposeMiniflare();
});

beforeEach(async () => {
  await db.prepare(CLEAN_MODELS).bind(`${userId}:%`, clientId).run();
});

async function cookie() {
  return `tripline_session=${await signSessionToken(userId, secret)}`;
}

async function submit(extra: Record<string, string> = {}) {
  return api.request('POST', 'https://tripline.test/api/oauth/consent', {
    form: {
      client_id: clientId, redirect_uri: callback, response_type: 'code',
      scope: 'openid', state: 'csrf-1', code_challenge: 'challenge',
      code_challenge_method: 'S256', decision: 'allow', ...extra,
    },
    headers: { Cookie: await cookie(), Origin: origin },
  });
}

describe('OAuth consent with real D1', () => {
  it('rejects invalid scope without a grant, then records one validated grant on repeated allow', async () => {
    const adapter = new D1Adapter(db, 'Consent');
    const invalid = await submit({ scope: 'admin' });
    expect(new URL(invalid.headers.get('Location')!).searchParams.get('error')).toBe('invalid_scope');
    expect(await adapter.find(`${userId}:${clientId}`)).toBeUndefined();

    const first = await submit({ scope: 'openid profile' });
    const second = await submit({ scope: 'openid profile' });
    expect(first.status).toBe(302);
    expect(second.status).toBe(302);
    expect(first.headers.get('Location')).toContain('/api/oauth/authorize?');
    expect(second.headers.get('Location')).toBe(first.headers.get('Location'));
    expect((await adapter.find(`${userId}:${clientId}`))?.scopes).toEqual(['openid', 'profile']);
    const row = await db.prepare("SELECT COUNT(*) AS count FROM oauth_models WHERE name = 'Consent' AND id = ?")
      .bind(`${userId}:${clientId}`).first<{ count: number }>();
    expect(row?.count).toBe(1);

    // 照著 consent 回的 Location 走回 authorize：這次有同意，直接發授權碼
    const authorized = await api.get(new URL(first.headers.get('Location')!, 'https://tripline.test').toString(), {
      headers: { Cookie: await cookie() },
    });
    expect(authorized.status).toBe(302);
    const location = new URL(authorized.headers.get('Location')!);
    expect(location.origin + location.pathname).toBe(callback);
    expect(location.searchParams.get('state')).toBe('csrf-1');
    const code = location.searchParams.get('code');
    expect(code).toBeTruthy();
    expect((await new D1Adapter(db, 'AuthorizationCode').find(code!))?.client_id).toBe(clientId);
  });

  it('denial redirects with access_denied and stores no consent', async () => {
    const res = await submit({ decision: 'deny' });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location')!);
    expect(location.origin + location.pathname).toBe(callback);
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.has('code')).toBe(false);
    expect(await new D1Adapter(db, 'Consent').find(`${userId}:${clientId}`)).toBeUndefined();
  });
});
