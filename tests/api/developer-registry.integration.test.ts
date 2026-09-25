import { beforeAll, afterAll, it, expect } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { issueSession } from '../../functions/api/_session';
import { onRequestGet as list } from '../../functions/api/dev/apps';
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
