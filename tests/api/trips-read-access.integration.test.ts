/**
 * trips-read-access.integration.test.ts — v2.33.41 security audit fix
 *
 * Anonymous read of unpublished trips 之前是 wide-open hole（任何人知 tripId
 * 就讀全行程含 doc 航班 / hotel POI / 緊急聯絡）。本 spec 驗 `requireTripReadAccess`
 * helper 在每個 GET handler 的 wiring：
 *   - published=1 trip → anonymous OK
 *   - published=0 + anonymous → 403 PERM_DENIED
 *   - published=0 + member → OK
 *   - published=0 + non-member auth → 403
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, seedTrip, callHandler } from './helpers';
import { onRequestGet as getTrip } from '../../functions/api/trips/[id]';
import { onRequestGet as getDays } from '../../functions/api/trips/[id]/days';
import { onRequestGet as getDayNum } from '../../functions/api/trips/[id]/days/[num]';
import { onRequestGet as getDocsBatch } from '../../functions/api/trips/[id]/docs/index';
import { onRequestGet as getDoc } from '../../functions/api/trips/[id]/docs/[type]';
import { onRequestGet as getSegments } from '../../functions/api/trips/[id]/segments/index';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  // Published trip + unpublished trip
  await seedTrip(db, { id: 'pub-trip', owner: 'owner@test.com', published: 1 });
  await seedTrip(db, { id: 'priv-trip', owner: 'owner@test.com', published: 0 });
});

afterAll(disposeMiniflare);

function ctx(tripId: string, auth: ReturnType<typeof mockAuth> | null = null) {
  return mockContext({
    request: new Request(`https://test.com/api/trips/${tripId}`),
    env,
    auth: auth ?? undefined,
    params: { id: tripId },
  });
}

function ctxWithExtraParams(
  tripId: string,
  url: string,
  extraParams: Record<string, string>,
  auth: ReturnType<typeof mockAuth> | null = null,
) {
  return mockContext({
    request: new Request(url),
    env,
    auth: auth ?? undefined,
    params: { id: tripId, ...extraParams },
  });
}

describe('v2.33.41 trip read-access gate — published trip', () => {
  it('GET /trips/:id anonymous → 200 (published)', async () => {
    const resp = await callHandler(getTrip, ctx('pub-trip'));
    expect(resp.status).toBe(200);
  });

  it('GET /trips/:id/days anonymous → 200 (published)', async () => {
    const resp = await callHandler(
      getDays,
      mockContext({
        request: new Request('https://test.com/api/trips/pub-trip/days'),
        env,
        params: { id: 'pub-trip' },
      }),
    );
    expect(resp.status).toBe(200);
  });

  it('GET /trips/:id/docs batch anonymous → 200 (published)', async () => {
    const resp = await callHandler(getDocsBatch, ctx('pub-trip'));
    expect(resp.status).toBe(200);
  });

  it('GET /trips/:id/segments anonymous → 200 (published)', async () => {
    const resp = await callHandler(getSegments, ctx('pub-trip'));
    expect(resp.status).toBe(200);
  });
});

describe('v2.33.41 trip read-access gate — unpublished trip blocks anonymous', () => {
  it('GET /trips/:id anonymous → 403 (private)', async () => {
    const resp = await callHandler(getTrip, ctx('priv-trip'));
    expect(resp.status).toBe(403);
  });

  it('GET /trips/:id/days anonymous → 403 (private)', async () => {
    const resp = await callHandler(
      getDays,
      mockContext({
        request: new Request('https://test.com/api/trips/priv-trip/days'),
        env,
        params: { id: 'priv-trip' },
      }),
    );
    expect(resp.status).toBe(403);
  });

  it('GET /trips/:id/days/:num anonymous → 403 (private)', async () => {
    const resp = await callHandler(
      getDayNum,
      ctxWithExtraParams('priv-trip', 'https://test.com/api/trips/priv-trip/days/1', { num: '1' }),
    );
    expect(resp.status).toBe(403);
  });

  it('GET /trips/:id/docs batch anonymous → 403 (private)', async () => {
    const resp = await callHandler(getDocsBatch, ctx('priv-trip'));
    expect(resp.status).toBe(403);
  });

  it('GET /trips/:id/docs/:type anonymous → 403 (private)', async () => {
    const resp = await callHandler(
      getDoc,
      ctxWithExtraParams(
        'priv-trip',
        'https://test.com/api/trips/priv-trip/docs/flights',
        { type: 'flights' },
      ),
    );
    expect(resp.status).toBe(403);
  });

  it('GET /trips/:id/segments anonymous → 403 (private)', async () => {
    const resp = await callHandler(getSegments, ctx('priv-trip'));
    expect(resp.status).toBe(403);
  });
});

describe('v2.33.41 trip read-access gate — owner / member access unpublished', () => {
  it('GET /trips/:id with owner auth → 200 (private)', async () => {
    const resp = await callHandler(
      getTrip,
      ctx('priv-trip', mockAuth({ email: 'owner@test.com' })),
    );
    expect(resp.status).toBe(200);
  });

  it('GET /trips/:id with non-member auth → 403 (private)', async () => {
    const resp = await callHandler(
      getTrip,
      ctx('priv-trip', mockAuth({ email: 'stranger@test.com' })),
    );
    expect(resp.status).toBe(403);
  });
});

describe('v2.33.41 trip read-access gate — nonexistent trip', () => {
  it('GET /trips/nonexistent anonymous → 404', async () => {
    const resp = await callHandler(getTrip, ctx('nonexistent-trip'));
    expect(resp.status).toBe(404);
  });
});
