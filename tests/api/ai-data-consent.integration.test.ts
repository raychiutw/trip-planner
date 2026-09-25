// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { callHandler, mockAuth, mockContext, mockEnv } from './helpers';
import { issueSession } from '../../functions/api/_session';
import { onRequestGet, onRequestPost, onRequestDelete } from '../../functions/api/account/ai-data-consent';
import { onRequestPost as sendRequest } from '../../functions/api/requests';
import { onRequestPost as mintRestricted } from '../../functions/api/oauth/mint-restricted';
import { requireAiDataConsentForTrip, requireAiDataConsentForQueuedRequest } from '../../functions/api/_aiDataConsent';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';

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
