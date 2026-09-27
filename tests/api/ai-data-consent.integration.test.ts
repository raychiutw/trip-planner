// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { callHandler, mockAuth, mockContext, mockEnv } from './helpers';
import { issueSession } from '../../functions/api/_session';
import { onRequestGet, onRequestPost, onRequestDelete } from '../../functions/api/account/ai-data-consent';
import { onRequestGet as listRequests, onRequestPost as sendRequest } from '../../functions/api/requests';
import { onRequestGet as getQueuedRequest, onRequestPatch as updateQueuedRequest } from '../../functions/api/requests/[id]/index';
import { onRequestGet as streamQueuedRequest } from '../../functions/api/requests/[id]/events';
import { onRequestPost as mintRestricted } from '../../functions/api/oauth/mint-restricted';
import { requireAiDataConsentForTrip, requireAiDataConsentForQueuedRequest } from '../../functions/api/_aiDataConsent';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';
import { onRequest as middleware } from '../../functions/api/_middleware';

const SECRET = 'ai-data-consent-test-secret-long-enough';
const disclosure = { title: 'Test-only disclosure', processor: 'Test processor', dataCategories: ['test trip data'], purpose: 'test only', revocation: 'test route' };
let db: D1Database;
let env: ReturnType<typeof mockEnv>;

async function seed(uid: string) {
  await db.prepare("INSERT INTO users (id, email, status) VALUES (?, ?, 'active')")
    .bind(uid, `${uid}@example.com`).run();
}
async function activate(version: string) {
  await db.prepare('INSERT INTO ai_data_disclosures (version, content_json) VALUES (?, ?)')
    .bind(version, JSON.stringify(disclosure)).run();
  await db.prepare('INSERT INTO ai_data_disclosure_state (id, active_version) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET active_version = excluded.active_version')
    .bind(version).run();
}
async function context(uid: string, method: 'GET' | 'POST' | 'DELETE', body?: object) {
  const carrier = new Response();
  await issueSession(new Request('https://x.com'), carrier, uid, env);
  const cookie = carrier.headers.get('Set-Cookie')!.split(';')[0]!;
  const request = new Request('https://x.com/api/account/ai-data-consent', {
    method, headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return mockContext({ request, env });
}
async function decide(uid: string, version: string, decision: 'accept' | 'decline' | 'revoke', requestId = crypto.randomUUID()) {
  const handler = decision === 'revoke' ? onRequestDelete : onRequestPost;
  return callHandler(handler, await context(uid, decision === 'revoke' ? 'DELETE' : 'POST', { version, decision, requestId }));
}

describe('versioned AI data consent', () => {
  beforeAll(async () => { db = await createTestDb(); env = mockEnv(db, { SESSION_SECRET: SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com' }); }, 30000);
  afterAll(async () => {
    // API files share one D1 instance; leave the global gate unconfigured for
    // unrelated integration tests after this file.
    await db.prepare('DELETE FROM ai_data_disclosure_state').run();
    await disposeMiniflare();
  });

  it('starts unconfigured without treating old OAuth grants as data consent', async () => {
    const anonymous = await callHandler(onRequestGet, mockContext({ request: new Request('https://x.com/api/account/ai-data-consent'), env }));
    expect(anonymous.status).toBe(401);
    await seed('ai-unconfigured');
    const response = await callHandler(onRequestGet, await context('ai-unconfigured', 'GET'));
    expect(await response.json()).toMatchObject({ status: 'unconfigured', disclosure: null, acceptedVersion: null });
    expect((await decide('ai-unconfigured', 'v0', 'accept')).status).toBe(409);
  });

  it('records explicit version and decision, handles retries, revocation and version changes', async () => {
    await seed('ai-decisions');
    await activate('test-v1');
    await expect(db.prepare("UPDATE ai_data_disclosures SET content_json = '{}' WHERE version = 'test-v1'").run()).rejects.toThrow();
    await expect(db.prepare("INSERT OR REPLACE INTO ai_data_disclosures (version, content_json) VALUES ('test-v1', ?)")
      .bind(JSON.stringify(disclosure)).run()).rejects.toThrow();
    expect(await (await callHandler(onRequestGet, await context('ai-decisions', 'GET'))).json())
      .toMatchObject({ status: 'not_accepted', disclosure: { version: 'test-v1', title: disclosure.title } });
    expect((await decide('ai-decisions', 'unknown', 'accept')).status).toBe(409);
    expect((await decide('ai-decisions', 'test-v1', 'decline')).status).toBe(200);
    const key = crypto.randomUUID();
    expect((await decide('ai-decisions', 'test-v1', 'accept', key)).status).toBe(200);
    expect((await decide('ai-decisions', 'test-v1', 'accept', key)).status).toBe(200);
    expect((await decide('ai-decisions', 'test-v1', 'decline', key)).status).toBe(409);
    const concurrentKey = crypto.randomUUID();
    expect((await Promise.all([
      decide('ai-decisions', 'test-v1', 'accept', concurrentKey),
      decide('ai-decisions', 'test-v1', 'accept', concurrentKey),
    ])).map(response => response.status)).toEqual([200, 200]);
    expect((await db.prepare('SELECT COUNT(*) AS count FROM ai_data_consent_events WHERE user_id = ? AND request_id = ?')
      .bind('ai-decisions', concurrentKey).first<{ count: number }>())?.count).toBe(1);
    expect(await (await callHandler(onRequestGet, await context('ai-decisions', 'GET'))).json())
      .toMatchObject({ status: 'current', acceptedVersion: 'test-v1' });
    expect((await decide('ai-decisions', 'test-v1', 'revoke')).status).toBe(200);
    expect(await (await callHandler(onRequestGet, await context('ai-decisions', 'GET'))).json())
      .toMatchObject({ status: 'revoked', acceptedVersion: 'test-v1' });
    await activate('test-v2');
    expect((await decide('ai-decisions', 'test-v1', 'accept')).status).toBe(409);
    expect(await (await callHandler(onRequestGet, await context('ai-decisions', 'GET'))).json())
      .toMatchObject({ disclosure: { version: 'test-v2' }, status: 'outdated', acceptedVersion: 'test-v1' });
  });

  it('requires both submitter and owner before accepting AI work', async () => {
    const owner = 'ai-owner'; const member = 'ai-member'; const tripId = 'ai-consent-trip';
    await seed(owner); await seed(member);
    await db.prepare('INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)')
      .bind(tripId, 'AI test', owner).run();
    await db.prepare("INSERT INTO trip_permissions (trip_id, user_id, role) VALUES (?, ?, 'member')")
      .bind(tripId, member).run();
    const auth = mockAuth({ userId: member, email: `${member}@example.com` });
    const request = () => new Request('https://x.com/api/requests', { method: 'POST', body: JSON.stringify({ tripId, message: 'please plan' }) });
    const send = () => callHandler(sendRequest, mockContext({ request: request(), env, auth }));
    const submitterBlocked = await send();
    expect(submitterBlocked.status).toBe(403);
    expect(await submitterBlocked.json()).toMatchObject({ error: { code: 'AI_DATA_CONSENT_REQUIRED' } });
    expect((await decide(member, 'test-v2', 'accept')).status).toBe(200);
    const ownerBlocked = await send();
    expect(ownerBlocked.status).toBe(403);
    expect(await ownerBlocked.json()).toMatchObject({ error: { code: 'AI_DATA_CONSENT_OWNER_REQUIRED' } });
    expect((await decide(owner, 'test-v2', 'accept')).status).toBe(200);
    await expect(requireAiDataConsentForTrip(db, member, tripId)).resolves.toBeUndefined();
    await expect(requireAiDataConsentForQueuedRequest(db, owner, `${member}@example.com`)).resolves.toBeUndefined();
    const accepted = await send();
    expect(accepted.status).toBe(201);
    const { id: requestId } = await accepted.json() as { id: number };
    await new D1Adapter(db, 'Consent').upsert(`${owner}:tripline-tp-request`,
      { user_id: owner, client_id: 'tripline-tp-request', scopes: [] }, 3600);
    expect((await decide(member, 'test-v2', 'revoke')).status).toBe(200);
    expect((await send()).status).toBe(403);
    await expect(requireAiDataConsentForQueuedRequest(db, owner, `${member}@example.com`)).rejects.toMatchObject({ code: 'AI_DATA_CONSENT_REQUIRED' });
    const mint = await callHandler(mintRestricted, mockContext({
      request: new Request('https://x.com/api/oauth/mint-restricted', { method: 'POST',
        headers: { Authorization: 'Bearer ai-test-secret', 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }) }),
      env: mockEnv(db, { TRIPLINE_API_SECRET: 'ai-test-secret' }),
    }));
    expect(mint.status).toBe(403);
    expect(await db.prepare('SELECT status, terminal_reason FROM trip_requests WHERE id = ?').bind(requestId)
      .first()).toMatchObject({ status: 'failed', terminal_reason: 'needs_consent' });
  });

  it('does not show another submitter’s revoked or legacy request to a restricted AI worker', async () => {
    const owner = 'ai-list-owner'; const current = 'ai-list-current'; const older = 'ai-list-older';
    const revoked = 'ai-list-revoked'; const legacy = 'ai-list-legacy';
    const tripId = 'ai-list-trip';
    for (const uid of [owner, older, current, revoked, legacy]) await seed(uid);
    await db.prepare('INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)')
      .bind(tripId, 'AI list test', owner).run();
    await db.prepare("INSERT INTO trip_permissions (trip_id, user_id, role) VALUES (?, ?, 'owner')")
      .bind(tripId, owner).run();
    await activate('test-list-v1');
    for (const uid of [owner, older, current, revoked]) {
      expect((await decide(uid, 'test-list-v1', 'accept')).status).toBe(200);
    }
    expect((await decide(revoked, 'test-list-v1', 'revoke')).status).toBe(200);
    const ids = new Map<string, number>();
    for (const uid of [older, current, revoked, legacy]) {
      const row = await db.prepare('INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?) RETURNING id')
        .bind(tripId, `message from ${uid}`, `${uid}@example.com`).first<{ id: number }>();
      ids.set(uid, row!.id);
    }

    await new D1Adapter(db, 'Consent').upsert(`${owner}:tripline-tp-request`,
      { user_id: owner, client_id: 'tripline-tp-request', scopes: [] }, 3600);
    const minted = await callHandler(mintRestricted, mockContext({
      request: new Request('https://x.com/api/oauth/mint-restricted', { method: 'POST',
        headers: { Authorization: 'Bearer ai-test-secret', 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: ids.get(current) }) }),
      env: mockEnv(db, { TRIPLINE_API_SECRET: 'ai-test-secret' }),
    }));
    expect(minted.status).toBe(200);
    const mintedToken = (await minted.json() as { access_token: string }).access_token;
    const tokenRow = await new D1Adapter(db, 'AccessToken').find(mintedToken);
    expect(tokenRow?.restrict_request_id).toBe(String(ids.get(current)));

    const bearerRequest = new Request(`https://x.com/api/requests?tripId=${tripId}&status=open`, {
      headers: { Authorization: `Bearer ${mintedToken}` },
    });
    const data: Record<string, unknown> = {};
    const base = { request: bearerRequest, env, data, params: {}, waitUntil: () => undefined,
      passThroughOnException: () => undefined, functionPath: '' };
    const throughMiddleware = await middleware({ ...base,
      next: () => listRequests(base as Parameters<typeof listRequests>[0]),
    } as Parameters<typeof middleware>[0]);
    expect((await throughMiddleware.json() as Array<{ message: string }>).map(row => row.message))
      .toEqual([`message from ${current}`]);

    const request = () => new Request(`https://x.com/api/requests?tripId=${tripId}&status=open`);
    const read = (auth: ReturnType<typeof mockAuth>) => callHandler(listRequests, mockContext({ request: request(), env, auth }));
    const worker = mockAuth({ userId: owner, email: `${owner}@example.com`, restrictTrip: tripId,
      restrictRequestId: String(ids.get(current)), scopes: [] });
    const createFromBoundToken = await callHandler(sendRequest, mockContext({
      request: new Request('https://x.com/api/requests', { method: 'POST',
        body: JSON.stringify({ tripId, message: 'cross-request write' }) }), env, auth: worker,
    }));
    expect(createFromBoundToken.status).toBe(403);
    const visible = await read(worker);
    expect(visible.status).toBe(200);
    expect((await visible.json() as Array<{ message: string }>).map(row => row.message))
      .toEqual([`message from ${current}`]);

    // A normal trip member still sees the full conversation history.
    const ordinary = await read(mockAuth({ userId: owner, email: `${owner}@example.com` }));
    expect((await ordinary.json() as Array<{ message: string }>)).toHaveLength(4);

    const unbound = mockAuth({ userId: owner, email: `${owner}@example.com`, restrictTrip: tripId, scopes: [] });
    const page = await callHandler(listRequests, mockContext({
      request: new Request(`https://x.com/api/requests?tripId=${tripId}&status=open&limit=1`), env, auth: unbound,
    }));
    const firstPage = await page.json() as { items: Array<{ id: number; createdAt: string; message: string }>; hasMore: boolean };
    expect(firstPage.items.map(row => row.message)).toEqual([`message from ${current}`]);
    expect(firstPage.hasMore).toBe(true);
    const secondPage = await callHandler(listRequests, mockContext({
      request: new Request(`https://x.com/api/requests?tripId=${tripId}&status=open&limit=1&before=${encodeURIComponent(firstPage.items[0]!.createdAt)}&beforeId=${firstPage.items[0]!.id}`), env, auth: unbound,
    }));
    expect((await secondPage.json() as { items: Array<{ message: string }>; hasMore: boolean })).toMatchObject({
      items: [{ message: `message from ${older}` }], hasMore: false,
    });

    const patch = (uid: string) => callHandler(updateQueuedRequest, mockContext({
      request: new Request(`https://x.com/api/requests/${ids.get(uid)}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'processing' }),
      }), env, auth: worker, params: { id: String(ids.get(uid)) },
    }));
    expect((await patch(current)).status).toBe(200);
    expect((await patch(revoked)).status).toBe(403);
    expect((await patch(legacy)).status).toBe(403);

    // Already-issued work may finish after consent changes, but another
    // request's processing row must remain inaccessible to this token.
    for (const uid of [revoked, legacy]) {
      await db.prepare("UPDATE trip_requests SET status = 'processing' WHERE id = ?").bind(ids.get(uid)).run();
      const get = await callHandler(getQueuedRequest, mockContext({
        request: new Request(`https://x.com/api/requests/${ids.get(uid)}`),
        env, auth: worker, params: { id: String(ids.get(uid)) },
      }));
      expect(get.status).toBe(403);
      expect((await patch(uid)).status).toBe(403);
      const sse = await callHandler(streamQueuedRequest, mockContext({
        request: new Request(`https://x.com/api/requests/${ids.get(uid)}/events`),
        env, auth: worker, params: { id: String(ids.get(uid)) },
      }));
      expect(sse.status).toBe(403);
      const legacyScopeSse = await callHandler(streamQueuedRequest, mockContext({
        request: new Request(`https://x.com/api/requests/${ids.get(uid)}/events`),
        env, auth: unbound, params: { id: String(ids.get(uid)) },
      }));
      expect(legacyScopeSse.status).toBe(403);
    }
    const processing = await callHandler(listRequests, mockContext({
      request: new Request(`https://x.com/api/requests?tripId=${tripId}&status=processing`), env, auth: worker,
    }));
    expect((await processing.json() as Array<{ message: string }>).map(row => row.message))
      .toEqual([`message from ${current}`]);
    expect((await decide(current, 'test-list-v1', 'revoke')).status).toBe(200);
    const stillIssued = await callHandler(listRequests, mockContext({
      request: new Request(`https://x.com/api/requests?tripId=${tripId}&status=processing`), env, auth: worker,
    }));
    expect((await stillIssued.json() as Array<{ message: string }>).map(row => row.message))
      .toEqual([`message from ${current}`]);
    const ownStream = await callHandler(streamQueuedRequest, mockContext({
      request: new Request(`https://x.com/api/requests/${ids.get(current)}/events`),
      env, auth: worker, params: { id: String(ids.get(current)) },
    }));
    expect(ownStream.status).toBe(200);
    await ownStream.body?.cancel();
    const finishOwnWork = await callHandler(updateQueuedRequest, mockContext({
      request: new Request(`https://x.com/api/requests/${ids.get(current)}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'completed', reply: 'done' }),
      }), env, auth: worker, params: { id: String(ids.get(current)) },
    }));
    expect(finishOwnWork.status).toBe(200);
  });

  it('accepts only the canonical first-party mobile Bearer actor', async () => {
    await seed('ai-mobile');
    const auth = mockAuth({ userId: 'ai-mobile', email: 'ai-mobile@example.com', clientId: 'tripline-mobile', grantId: 'grant-ai-mobile' });
    const request = new Request('https://x.com/api/account/ai-data-consent', { headers: { Authorization: 'Bearer test' } });
    const response = await callHandler(onRequestGet, mockContext({ request, env, auth }));
    expect(response.status).toBe(200);
    const wrong = await callHandler(onRequestGet, mockContext({ request, env, auth: { ...auth, clientId: 'third-party' } }));
    expect(wrong.status).toBe(403);
  });
});
