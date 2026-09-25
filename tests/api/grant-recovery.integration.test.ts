import { beforeAll, afterAll, it, expect } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';
import { issueSession, getSessionUser } from '../../functions/api/_session';
import { onRequestGet as list } from '../../functions/api/account/connected-apps';
import { onRequestDelete as revoke } from '../../functions/api/account/connected-apps/[client_id]';
import { onRequestGet as aiState, onRequestPost as authorize } from '../../functions/api/account/ai-authorization';
import type { Env } from '../../functions/api/_types';
let db: D1Database; let env: Env;
beforeAll(async () => { db = await createTestDb(); env = { DB: db, SESSION_SECRET: 't29-real-grant-secret-long-enough' } as Env; }, 30000);
afterAll(async () => { await disposeMiniflare(); });
it('real grant revocation removes only the intended consent/tokens and leaves login sessions intact', async () => {
  const uid = 't29-owner'; const neighbor = 't29-neighbor';
  for (const id of [uid, neighbor]) await db.prepare("INSERT INTO users (id, email, status) VALUES (?, ?, 'active')").bind(id, `${id}@example.com`).run();
  for (const id of ['t29-tool', 't29-other', 'tripline-tp-request']) await db.prepare("INSERT OR IGNORE INTO client_apps (client_id, client_type, app_name, redirect_uris, allowed_scopes, status) VALUES (?, 'public', ?, '[]', '[\"openid\",\"profile\"]', 'active')").bind(id, id).run();
  const response = new Response(); await issueSession(new Request('https://example.com'), response, uid, env);
  const cookie = response.headers.get('Set-Cookie')!.split(';')[0]!;
  const req = new Request('https://example.com/api/account/connected-apps', { headers: { Cookie: cookie } });
  function ctx(clientId = 't29-tool') { return { request: req, env, params: { client_id: clientId }, data: {}, next: async () => new Response(), waitUntil: () => {}, passThroughOnException: () => {} } as Parameters<typeof list>[0]; }
  for (const [user, client] of [[uid, 't29-tool'], [uid, 't29-other'], [neighbor, 't29-tool']]) {
    const payload = { user_id: user, client_id: client, scopes: ['openid', 'profile', 'email', 'trips:write'], grantedAt: Date.now() };
    for (const model of ['Consent', 'AccessToken', 'RefreshToken']) await new D1Adapter(db, model).upsert(`${user}:${client}`, payload, 3600);
  }
  const before = await (await list(ctx())).json() as { apps: { client_id: string; scopes: string[]; granted_at: number }[] };
  expect(before.apps).toHaveLength(2); expect(before.apps.find(app => app.client_id === 't29-tool')?.scopes).toContain('trips:write');
  expect(before.apps.every(app => Number.isFinite(app.granted_at))).toBe(true);
  expect(await (await revoke(ctx())).json()).toEqual({ ok: true, revoked_client_id: 't29-tool' });
  for (const model of ['Consent', 'AccessToken', 'RefreshToken']) {
    const adapter = new D1Adapter(db, model);
    expect(await adapter.find(`${uid}:t29-tool`)).toBeUndefined();
    expect(await adapter.find(`${uid}:t29-other`)).toBeDefined();
    expect(await adapter.find(`${neighbor}:t29-tool`)).toBeDefined();
  }
  expect(await getSessionUser(req, env)).not.toBeNull();
  expect((await revoke(ctx())).status).toBe(404);
  expect(await (await aiState(ctx())).json()).toEqual({ authorized: false });
  expect(await (await authorize(ctx())).json()).toEqual({ authorized: true });
  expect(await (await aiState(ctx())).json()).toEqual({ authorized: true });
  const withAi = await (await list(ctx())).json() as { apps: { client_id: string }[] };
  expect(withAi.apps.map(app => app.client_id)).toContain('tripline-tp-request');
  await revoke(ctx('tripline-tp-request'));
  expect(await (await aiState(ctx())).json()).toEqual({ authorized: false });
  expect(await getSessionUser(req, env)).not.toBeNull();
});
