import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedTrip } from './helpers';
import { onRequest } from '../../functions/api/_middleware';
import { onRequestPost as tokenPost } from '../../functions/api/oauth/token';
import { onRequestGet as tripGet } from '../../functions/api/trips/[id]';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';

let db: D1Database;
let ownerId: string;
beforeAll(async () => {
  db = await createTestDb();
  ownerId = (await seedTrip(db, { id: 'token-private-trip', owner: 'token-owner@test.com', published: 0 })).ownerUserId;
  for (const client of ['lifecycle-client', 'unrelated-client']) {
    await db.prepare(`INSERT INTO client_apps (client_id, client_type, app_name, redirect_uris, allowed_scopes, status)
      VALUES (?, 'public', ?, ?, ?, 'active')`).bind(client, client, JSON.stringify(['https://client.test/cb']), JSON.stringify(['openid', 'profile', 'trips:read'])).run();
  }
});
afterAll(disposeMiniflare);
beforeEach(async () => {
  await db.prepare('DELETE FROM oauth_models').run();
  await db.prepare('DELETE FROM rate_limit_buckets').run();
});

async function through(request: Request, handler: PagesFunction, requestDb = db, params: Record<string, string> = {}) {
  const base = { request, env: mockEnv(requestDb), data: {}, params, waitUntil: () => {}, passThroughOnException: () => {}, functionPath: '' };
  return onRequest({ ...base, next: () => handler({ ...base } as never) } as never);
}
function exchange(code: string, extra: Record<string, string> = {}, requestDb = db) {
  return through(new Request('https://test.com/api/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'lifecycle-client', code, redirect_uri: 'https://client.test/cb', ...extra }),
  }), tokenPost as PagesFunction, requestDb);
}
function readPrivateTrip(token: string) {
  return through(new Request('https://test.com/api/trips/token-private-trip', { headers: { Authorization: `Bearer ${token}` } }), tripGet as PagesFunction, db, { id: 'token-private-trip' });
}
async function grant(code: string, extra: Record<string, unknown> = {}) {
  await new D1Adapter(db, 'AuthorizationCode').upsert(code, {
    client_id: 'lifecycle-client', user_id: ownerId, redirect_uri: 'https://client.test/cb', scopes: ['trips:read'],
    code_challenge: null, code_challenge_method: null, ...extra,
  }, 600);
}

/** Fault the real SQLite statement at execution, including when it is inside a D1 batch. */
function failModelWrite(model: string): D1Database {
  return new Proxy(db, { get(target, property) {
    if (property === 'prepare') return (sql: string) => {
      const statement = target.prepare(sql);
      if (!/(INSERT|UPDATE).*oauth_models/s.test(sql)) return statement;
      return new Proxy(statement, { get(stmt, member) {
        if (member === 'bind') return (...args: unknown[]) => args[0] === model
          ? target.prepare('SELECT json(?)').bind('injected-invalid-json') : stmt.bind(...args);
        const value = Reflect.get(stmt, member);
        return typeof value === 'function' ? value.bind(stmt) : value;
      } });
    };
    const value = Reflect.get(target, property);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}

function synchronizeGrantReads(model: string): D1Database {
  let arrivals = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  return new Proxy(db, { get(target, property) {
    if (property === 'prepare') return (sql: string) => {
      const statement = target.prepare(sql);
      if (!sql.includes('SELECT payload, expires_at FROM oauth_models')) return statement;
      return new Proxy(statement, { get(stmt, member) {
        if (member === 'bind') return (...args: unknown[]) => {
          const bound = stmt.bind(...args);
          if (args[0] !== model) return bound;
          return new Proxy(bound, { get(value, method) {
            if (method === 'first') return async () => {
              const row = await value.first();
              if (++arrivals === 2) release();
              await ready;
              return row;
            };
            const fn = Reflect.get(value, method);
            return typeof fn === 'function' ? fn.bind(value) : fn;
          } });
        };
        const value = Reflect.get(stmt, member);
        return typeof value === 'function' ? value.bind(stmt) : value;
      } });
    };
    const value = Reflect.get(target, property);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}

describe('OAuth token issuance through D1 and real authorization middleware', () => {
  it('invalid PKCE cannot consume a fresh code or revoke the valid pair from a used code', async () => {
    const verifier = 'valid-verifier-'.repeat(4);
    const challengeBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const challenge = btoa(String.fromCharCode(...challengeBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await grant('pkce-code', { code_challenge: challenge, code_challenge_method: 'S256' });
    expect((await exchange('pkce-code', { code_verifier: 'wrong' })).status).toBe(400);
    expect((await new D1Adapter(db, 'AuthorizationCode').find('pkce-code'))?.consumed).toBeUndefined();
    const valid = await exchange('pkce-code', { code_verifier: verifier });
    expect(valid.status).toBe(200);
    const tokens = await valid.json() as { access_token: string; refresh_token: string };
    expect((await readPrivateTrip(tokens.access_token)).status).toBe(200);
    expect((await exchange('pkce-code', { code_verifier: 'wrong' })).status).toBe(400);
    expect((await readPrivateTrip(tokens.access_token)).status).toBe(200);
  });
  it('scope widening is rejected before consumption or replay revocation', async () => {
    await grant('scope-code');
    const denied = await exchange('scope-code', { scope: 'admin' });
    expect(denied.status).toBe(400);
    expect(await denied.json()).toMatchObject({ error: 'invalid_scope' });
    expect((await new D1Adapter(db, 'AuthorizationCode').find('scope-code'))?.consumed).toBeUndefined();
    const valid = await exchange('scope-code');
    const tokens = await valid.json() as { access_token: string };
    expect((await readPrivateTrip(tokens.access_token)).status).toBe(200);
    expect((await exchange('scope-code', { scope: 'admin' })).status).toBe(400);
    expect((await readPrivateTrip(tokens.access_token)).status).toBe(200);
  });
  it('a refresh-token storage failure leaves no usable half-pair and cannot reuse the consumed code', async () => {
    await grant('half-pair-code');
    const failed = await exchange('half-pair-code', {}, failModelWrite('RefreshToken'));
    expect(failed.status).toBeGreaterThanOrEqual(500);
    const candidates = await db.prepare("SELECT id FROM oauth_models WHERE name = 'AccessToken'").all<{ id: string }>();
    for (const candidate of candidates.results ?? []) expect((await readPrivateTrip(candidate.id)).status).not.toBe(200);
    expect((await new D1Adapter(db, 'AuthorizationCode').find('half-pair-code'))?.consumed).toBeTruthy();
    expect((await exchange('half-pair-code')).status).toBe(400);
  });
  it('two callers that read a fresh code can issue only one usable pair', async () => {
    await grant('parallel-code');
    const interleaved = synchronizeGrantReads('AuthorizationCode');
    const responses = await Promise.all([exchange('parallel-code', {}, interleaved), exchange('parallel-code', {}, interleaved)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    const issued = await responses.find((response) => response.status === 200)!.json() as { access_token: string; refresh_token: string; scope: string; expires_in: number };
    expect(issued).toMatchObject({ scope: 'trips:read', expires_in: 3600 });
    expect((await readPrivateTrip(issued.access_token)).status).toBe(200);
    expect(await new D1Adapter(db, 'RefreshToken').find(issued.refresh_token)).toMatchObject({ scopes: ['trips:read'], user_id: ownerId });
    const count = await db.prepare("SELECT count(*) AS n FROM oauth_models WHERE name IN ('AccessToken', 'RefreshToken')").first<{ n: number }>();
    expect(count?.n).toBe(2);
  });

  it.each([{ client_id: 'unrelated-client' }, { redirect_uri: 'https://wrong.test/cb' }])('invalid binding %j leaves a fresh and an issued grant untouched', async (input) => {
    await grant('binding-code');
    expect((await exchange('binding-code', input)).status).toBe(400);
    expect((await new D1Adapter(db, 'AuthorizationCode').find('binding-code'))?.consumed).toBeUndefined();
    const issued = await (await exchange('binding-code')).json() as { access_token: string };
    expect((await exchange('binding-code', input)).status).toBe(400);
    expect((await readPrivateTrip(issued.access_token)).status).toBe(200);
  });

  it.each(['$.consumed', 'AccessToken', 'RefreshToken', '$.grantId'])('failure at %s is isolated and cannot expose an incomplete issuance', async (stage) => {
    await grant('other-family', { client_id: 'unrelated-client' });
    const other = await (await exchange('other-family', { client_id: 'unrelated-client' })).json() as { access_token: string };
    await grant('fault-code');
    expect((await exchange('fault-code', {}, failModelWrite(stage))).status).toBeGreaterThanOrEqual(500);
    const own = await db.prepare("SELECT id, name FROM oauth_models WHERE name IN ('AccessToken', 'RefreshToken') AND json_extract(payload, '$.client_id') = ?").bind('lifecycle-client').all();
    expect(own.results).toEqual([]);
    const source = await new D1Adapter(db, 'AuthorizationCode').find('fault-code');
    if (stage === '$.consumed') {
      expect(source?.consumed).toBeUndefined();
      const retry = await (await exchange('fault-code')).json() as { access_token: string };
      expect((await readPrivateTrip(retry.access_token)).status).toBe(200);
    } else {
      expect(source?.consumed).toBeTruthy();
      expect((await exchange('fault-code')).status).toBe(400);
    }
    expect((await readPrivateTrip(other.access_token)).status).toBe(200);
  });

  it('authenticated replay revokes only the issued family and expired grants cannot issue', async () => {
    await grant('replayed-code');
    const issued = await (await exchange('replayed-code')).json() as { access_token: string; refresh_token: string };
    expect((await exchange('replayed-code')).status).toBe(400);
    expect((await readPrivateTrip(issued.access_token)).status).not.toBe(200);
    expect(await new D1Adapter(db, 'RefreshToken').find(issued.refresh_token)).toBeUndefined();
    await grant('expired-code');
    await db.prepare("UPDATE oauth_models SET expires_at = 0 WHERE id = 'expired-code'").run();
    expect((await exchange('expired-code')).status).toBe(400);
  });

});
