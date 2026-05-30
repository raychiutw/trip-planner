/**
 * Integration — public share platform endpoints (v2.39.0 PR1).
 *
 * Exercises the security-load-bearing handler behaviors that unit tests can't prove:
 *  - default-deny filtering END-TO-END: a closed section (emergency, off by default)
 *    is absent from the public GET even when rows exist;
 *  - cross-trip IDOR: managing a shareId via a DIFFERENT trip's :id → 404;
 *  - viewer-role rejection on create/list/revoke (write-tier capability);
 *  - unknown / revoked token → uniform 404 on the public GET;
 *  - public payload carries no owner email / user_id.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb } from './setup';
import { mockEnv, mockContext, mockAuth, seedUser, seedTrip, callHandler, jsonRequest } from './helpers';
import { onRequestPost as createShare, onRequestGet as listShares } from '../../functions/api/trips/[id]/shares';
import { onRequestPatch as patchShare, onRequestDelete as deleteShare } from '../../functions/api/trips/[id]/shares/[shareId]';
import { onRequestGet as publicView } from '../../functions/api/share/[token]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
const owner = 'share-owner@test.com';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
});

async function createShareFor(tripId: string, ownerEmail = owner) {
  const res = await callHandler(createShare as never, mockContext({
    request: jsonRequest(`https://x/api/trips/${tripId}/shares`, 'POST', {}),
    env,
    auth: mockAuth({ email: ownerEmail }),
    params: { id: tripId },
  }));
  return res;
}

describe('share create + public view (default-deny end-to-end)', () => {
  it('owner creates a link; public GET returns flights (default-on) but NOT emergency (default-off) even though rows exist', async () => {
    const { id } = await seedTrip(db, { id: 'share-trip-1', owner, days: 1 });
    await db.prepare("INSERT INTO trip_flights (trip_id, airline, flight_no) VALUES (?, 'BR', '112')").bind(id).run();
    await db.prepare("INSERT INTO trip_emergency_contacts (trip_id, name, phone) VALUES (?, 'Mom', '0900-000')").bind(id).run();

    const createRes = await createShareFor(id);
    expect(createRes.status).toBe(200);
    const created = await createRes.json() as { token: string; url: string };
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{20,64}$/);
    expect(created.url).toBe(`/s/${created.token}`);

    const viewRes = await callHandler(publicView as never, mockContext({
      request: new Request(`https://x/api/share/${created.token}`),
      env,
      params: { token: created.token },
    }));
    expect(viewRes.status).toBe(200);
    const payload = await viewRes.json() as { meta: Record<string, unknown>; notes: Record<string, unknown[]> };

    // flights is in DEFAULT_SHARE_SECTIONS → present; emergency is NOT → empty despite the seeded row
    expect(payload.notes.flights.length).toBe(1);
    expect(payload.notes.emergencyContacts).toEqual([]);
    expect(payload.notes.reservations).toEqual([]); // also default-off
    // no owner PII in the public payload
    expect(JSON.stringify(payload.meta)).not.toContain('owner_user_id');
    expect(JSON.stringify(payload.meta)).not.toContain('@test.com');
    // security headers
    expect(viewRes.headers.get('Cache-Control')).toContain('no-store');
    expect(viewRes.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('unknown token → 404; revoked token → 404 (uniform)', async () => {
    const unknownRes = await callHandler(publicView as never, mockContext({
      request: new Request('https://x/api/share/nonexistenttoken12345'),
      env,
      params: { token: 'nonexistenttoken12345' },
    }));
    expect(unknownRes.status).toBe(404);

    const { id } = await seedTrip(db, { id: 'share-trip-revoke', owner, days: 1 });
    const created = await (await createShareFor(id)).json() as { id: number; token: string };
    // revoke it
    const revokeRes = await callHandler(patchShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${id}/shares/${created.id}`, 'PATCH', { action: 'revoke' }),
      env,
      auth: mockAuth({ email: owner }),
      params: { id, shareId: String(created.id) },
    }));
    expect(revokeRes.status).toBe(200);

    const afterRevoke = await callHandler(publicView as never, mockContext({
      request: new Request(`https://x/api/share/${created.token}`),
      env,
      params: { token: created.token },
    }));
    expect(afterRevoke.status).toBe(404);
  });
});

describe('IDOR — cross-trip share management', () => {
  it('PATCH/DELETE a shareId via a DIFFERENT trip the user also owns → 404 (AND trip_id guard)', async () => {
    const a = await seedTrip(db, { id: 'idor-trip-a', owner, days: 1 });
    const b = await seedTrip(db, { id: 'idor-trip-b', owner, days: 1 });
    const shareOnA = await (await createShareFor(a.id)).json() as { id: number };

    // owner has write on BOTH a and b; try to revoke A's share via trip B's :id
    const crossRevoke = await callHandler(patchShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${b.id}/shares/${shareOnA.id}`, 'PATCH', { action: 'revoke' }),
      env,
      auth: mockAuth({ email: owner }),
      params: { id: b.id, shareId: String(shareOnA.id) },
    }));
    expect(crossRevoke.status).toBe(404); // belongs to A, not B

    const crossDelete = await callHandler(deleteShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${b.id}/shares/${shareOnA.id}`, 'DELETE'),
      env,
      auth: mockAuth({ email: owner }),
      params: { id: b.id, shareId: String(shareOnA.id) },
    }));
    expect(crossDelete.status).toBe(404);

    // sanity: the share on A is still active (not revoked by the cross-trip attempt)
    const list = await (await callHandler(listShares as never, mockContext({
      request: new Request(`https://x/api/trips/${a.id}/shares`),
      env,
      auth: mockAuth({ email: owner }),
      params: { id: a.id },
    }))).json() as { shares: { id: number; revokedAt: string | null }[] };
    expect(list.shares.find((s) => s.id === shareOnA.id)?.revokedAt).toBeNull();
  });
});

describe('viewer-role rejection (managing shares is write-tier)', () => {
  it('a viewer collaborator cannot create or list share links', async () => {
    const { id } = await seedTrip(db, { id: 'viewer-trip', owner, days: 1 });
    const viewerEmail = 'viewer@test.com';
    const viewerId = await seedUser(db, viewerEmail);
    await db.prepare("INSERT OR IGNORE INTO trip_permissions (user_id, trip_id, role) VALUES (?, ?, 'viewer')").bind(viewerId, id).run();

    const createAsViewer = await callHandler(createShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${id}/shares`, 'POST', {}),
      env,
      auth: mockAuth({ email: viewerEmail }),
      params: { id },
    }));
    expect(createAsViewer.status).toBe(403);

    const listAsViewer = await callHandler(listShares as never, mockContext({
      request: new Request(`https://x/api/trips/${id}/shares`),
      env,
      auth: mockAuth({ email: viewerEmail }),
      params: { id },
    }));
    expect(listAsViewer.status).toBe(403);
  });
});
