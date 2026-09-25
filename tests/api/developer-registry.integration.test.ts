import { beforeAll, afterAll, it, expect } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { issueSession } from '../../functions/api/_session';
import { onRequestGet as list, onRequestPost as create } from '../../functions/api/dev/apps';
import type { Env } from '../../functions/api/_types';
let db: D1Database; let env: Env;
beforeAll(async () => { db = await createTestDb(); env = { DB: db, SESSION_SECRET: 't30-real-registry-secret-long-enough' } as Env; }, 30000);
afterAll(async () => { await disposeMiniflare(); });
it('lists only the session owner metadata, preserving long callbacks and excluding stored credentials', async () => {
  const uri = 'https://example.com/' + 'callback'.repeat(60);
  for (const id of ['t30-owner', 't30-neighbor', 't30-empty']) {
    await db.prepare("INSERT INTO users (id, email, status) VALUES (?, ?, 'active')").bind(id, `${id}@example.com`).run();
    if (id !== 't30-empty') await db.prepare("INSERT INTO client_apps (client_id, client_secret_hash, client_type, app_name, redirect_uris, allowed_scopes, status, owner_user_id) VALUES (?, 'never-expose-hash', 'confidential', ?, ?, '[\"openid\"]', 'active', ?)").bind(id + '-app', id, JSON.stringify([uri]), id).run();
  }
  async function ctx(uid?: string) {
    const response = new Response();
    if (uid) await issueSession(new Request('https://example.com'), response, uid, env);
    const request = new Request('https://example.com/api/dev/apps', { headers: { Cookie: response.headers.get('Set-Cookie')?.split(';')[0] ?? '' } });
    return { request, env, params: {}, data: {}, next: async () => new Response(), waitUntil: () => {}, passThroughOnException: () => {} } as Parameters<typeof list>[0];
  }
  await expect(list(await ctx())).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  const result = await list(await ctx('t30-owner'));
  const body = await result.json() as { apps: Record<string, unknown>[] };
  expect(body.apps).toHaveLength(1);
  expect(body.apps[0]).toMatchObject({ client_id: 't30-owner-app', redirect_uris: [uri], allowed_scopes: ['openid'] });
  expect(body.apps[0]).not.toHaveProperty('client_secret'); expect(body.apps[0]).not.toHaveProperty('client_secret_hash');
  expect(JSON.stringify(body)).not.toContain('never-expose-hash'); expect(JSON.stringify(body)).not.toContain('t30-neighbor');
  expect(await (await list(await ctx('t30-empty'))).json()).toEqual({ apps: [] });
});

it('registers public and confidential clients with the supported scopes and returns secrets only once', async () => {
  const uid = 't31-registration-owner';
  await db.prepare("INSERT INTO users (id, email, status) VALUES (?, ?, 'active')").bind(uid, `${uid}@example.com`).run();
  const session = new Response(); await issueSession(new Request('https://example.com'), session, uid, env);
  const cookie = session.headers.get('Set-Cookie')!.split(';')[0]!;
  function ctx(body?: unknown) {
    const request = new Request('https://example.com/api/dev/apps', { method: body ? 'POST' : 'GET', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { request, env, params: {}, data: {}, next: async () => new Response(), waitUntil: () => {}, passThroughOnException: () => {} } as Parameters<typeof create>[0];
  }
  const draft = { app_name: 'Registration', redirect_uris: ['https://example.com/cb', 'http://localhost:3000/cb', 'http://127.0.0.1/cb', 'http://[::1]/cb'], allowed_scopes: ['openid', 'profile', 'email', 'offline_access'] };
  for (const scope of ['trips.read', 'trips:write', 'companion', 'ops:write', 'admin']) {
    await expect(create(ctx({ ...draft, allowed_scopes: [scope] }))).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  }
  for (const uri of ['http://bad.example/cb', 'ftp://localhost/cb', 'ftp://127.0.0.1/cb', 'ftp://[::1]/cb', 'https://example.com/cb#fragment']) {
    await expect(create(ctx({ ...draft, redirect_uris: ['https://example.com/good', uri] }))).rejects.toMatchObject({ code: 'DATA_VALIDATION', detail: expect.stringContaining('redirect_uris[1]') });
  }
  expect(await (await list(ctx())).json()).toEqual({ apps: [] });
  for (const type of ['public', 'confidential']) {
    const response = await create(ctx({ ...draft, client_type: type })); expect(response.status).toBe(201);
    const body = await response.json() as { client_id: string; client_secret: string | null; allowed_scopes: string[]; status: string };
    expect(body).toMatchObject({ redirect_uris: draft.redirect_uris }); expect(body.allowed_scopes).toEqual(draft.allowed_scopes); expect(body.status).toBe('pending_review');
    if (type === 'public') expect(body.client_secret).toBeNull(); else expect(body.client_secret).toMatch(/^tps_/);
    const listing = await (await list(ctx())).json() as { apps: Record<string, unknown>[] };
    expect(listing.apps.find(app => app.client_id === body.client_id)).not.toHaveProperty('client_secret');
    expect(listing.apps.find(app => app.client_id === body.client_id)).not.toHaveProperty('client_secret_hash');
    if (body.client_secret) expect(JSON.stringify(listing)).not.toContain(body.client_secret);
  }
});
