import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { issueSession, getSessionUser } from '../../functions/api/_session';
import { onRequestGet, onRequestDelete as revokeOthers } from '../../functions/api/account/sessions';
import { onRequestDelete as revokeOne } from '../../functions/api/account/sessions/[sid]';
import { onRequestPost as logout } from '../../functions/api/oauth/logout';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
beforeAll(async () => { db = await createTestDb(); env = { DB: db, SESSION_SECRET: 't28-integration-secret-long-enough' } as Env; }, 30000);
afterAll(async () => { await disposeMiniflare(); });
const request = (cookie: string, method = 'GET') => new Request('https://example.com/api/account/sessions', { method, headers: { Cookie: cookie } });
function context(req: Request, sid?: string) {
  return { request: req, env, params: sid ? { sid } : {}, data: {}, next: async () => new Response(), waitUntil: () => {}, passThroughOnException: () => {} } as Parameters<typeof onRequestGet>[0];
}
async function device(userId: string) {
  const res = new Response();
  await issueSession(new Request('https://example.com', { headers: { 'User-Agent': 'Chrome/140.0', 'CF-Connecting-IP': '192.0.2.1' } }), res, userId, env);
  const cookie = res.headers.get('Set-Cookie')!.split(';')[0]!;
  const session = await getSessionUser(request(cookie), env);
  expect(session?.sid).toBeTruthy();
  return { cookie, sid: session!.sid! };
}

describe('real session scope from handler to D1', () => {
  it('single, other-device and current logout change only their authorized sessions', async () => {
    for (const id of ['t28-owner', 't28-neighbor']) {
      await db.prepare("INSERT INTO users (id, email, display_name, status) VALUES (?, ?, ?, 'active')").bind(id, `${id}@example.com`, id).run();
    }
    const current = await device('t28-owner'); const phone = await device('t28-owner'); const tablet = await device('t28-owner'); const neighbor = await device('t28-neighbor');
    const listing = await onRequestGet(context(request(current.cookie)));
    const body = await listing.json() as { current_sid: string; sessions: { sid: string; is_current: boolean; created_at: string }[] };
    expect(body.current_sid).toBe(current.sid);
    expect(body.sessions).toHaveLength(3);
    expect(body.sessions.filter(row => row.is_current).map(row => row.sid)).toEqual([current.sid]);
    expect(body.sessions.every(row => row.created_at.endsWith('Z'))).toBe(true);

    const forbidden = await revokeOne(context(request(current.cookie, 'DELETE'), neighbor.sid));
    expect(forbidden.status).toBe(404);
    expect(await getSessionUser(request(neighbor.cookie), env)).not.toBeNull();

    const one = await revokeOne(context(request(current.cookie, 'DELETE'), phone.sid));
    expect(await one.json()).toEqual({ ok: true, revoked_sid: phone.sid });
    expect(await getSessionUser(request(phone.cookie), env)).toBeNull();
    expect(await getSessionUser(request(tablet.cookie), env)).not.toBeNull();
    expect(await getSessionUser(request(current.cookie), env)).not.toBeNull();

    const others = await revokeOthers(context(request(current.cookie, 'DELETE')));
    expect(await others.json()).toEqual({ ok: true, revoked: 1 });
    expect(await getSessionUser(request(tablet.cookie), env)).toBeNull();
    expect(await getSessionUser(request(current.cookie), env)).not.toBeNull();
    expect(await getSessionUser(request(neighbor.cookie), env)).not.toBeNull();

    const done = await logout(context(request(current.cookie, 'POST')));
    expect(done.status).toBe(302);
    expect(done.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(await getSessionUser(request(current.cookie), env)).toBeNull();
    expect(await getSessionUser(request(neighbor.cookie), env)).not.toBeNull();
  });
});
