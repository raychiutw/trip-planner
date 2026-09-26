import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedUser } from './helpers';
import { onRequestPost } from '../../functions/api/oauth/consent';
import { onRequestGet as authorizeGet } from '../../functions/api/oauth/authorize';
import { signSessionToken } from '../../src/server/session';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';

let db: D1Database;
let userId: string;
const secret = 'consent-integration-secret';
const clientId = 'consent-integration-client';
const callback = 'https://client.example/callback';

beforeAll(async () => {
  db = await createTestDb();
  userId = await seedUser(db, 'consent-integration@example.com');
  await db.prepare(`INSERT INTO client_apps
    (client_id, client_type, app_name, redirect_uris, allowed_scopes, status)
    VALUES (?, 'public', 'Consent test', ?, ?, 'active')`)
    .bind(clientId, JSON.stringify([callback]), JSON.stringify(['openid', 'profile'])).run();
});
afterAll(disposeMiniflare);
beforeEach(async () => {
  await db.prepare("DELETE FROM oauth_models WHERE name = 'Consent'").run();
});

async function submit(extra: Record<string, string> = {}) {
  const token = await signSessionToken(userId, secret);
  const body = new URLSearchParams({
    client_id: clientId, redirect_uri: callback, response_type: 'code',
    scope: 'openid', state: 'csrf-1', code_challenge: 'challenge',
    code_challenge_method: 'S256', decision: 'allow', ...extra,
  });
  const request = new Request('https://tripline.test/api/oauth/consent', {
    method: 'POST', headers: {
      'content-type': 'application/x-www-form-urlencoded', Cookie: `tripline_session=${token}`,
    }, body,
  });
  const base = { request, env: mockEnv(db, { SESSION_SECRET: secret }), params: {}, data: {},
    next: () => Promise.resolve(new Response()), waitUntil: () => undefined,
    passThroughOnException: () => undefined };
  return onRequestPost(base as unknown as Parameters<typeof onRequestPost>[0]);
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

    const token = await signSessionToken(userId, secret);
    const request = new Request(new URL(first.headers.get('Location')!, 'https://tripline.test'), {
      headers: { Cookie: `tripline_session=${token}` },
    });
    const base = { request, env: mockEnv(db, { SESSION_SECRET: secret }), params: {}, data: {},
      next: () => Promise.resolve(new Response()), waitUntil: () => undefined,
      passThroughOnException: () => undefined };
    const authorized = await authorizeGet(base as unknown as Parameters<typeof authorizeGet>[0]);
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
