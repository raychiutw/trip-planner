import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './setup';
import { callHandler, mockAuth, mockContext, mockEnv, mockServiceAuth, seedTrip, seedUser, userIdFor } from './helpers';
import { onRequestGet as listTrips } from '../../functions/api/my-trips';
import { onRequestGet as readTrip } from '../../functions/api/trips/[id]';
import { onRequestPut, onRequestDelete } from '../../functions/api/trips/[id]/archive';
import type { Env } from '../../functions/api/_types';

let env: Env;
const tripId = 'archive-contract-1333';
const owner = 'archive-owner@example.test';
const member = 'archive-member@example.test';
const viewer = 'archive-viewer@example.test';
const outsider = 'archive-outsider@example.test';

function ctx(email: string, method: string) {
  return mockContext({
    request: new Request(`https://test.com/api/trips/${tripId}/archive`, { method }),
    env,
    auth: mockAuth({ email }),
    params: { id: tripId },
  });
}

async function listFor(email: string) {
  const response = await callHandler(listTrips, mockContext({
    request: new Request('https://test.com/api/my-trips'),
    env,
    auth: mockAuth({ email }),
  }));
  expect(response.status).toBe(200);
  return response.json() as Promise<Array<{ tripId: string; archivedAt: string | null }>>;
}

beforeAll(async () => {
  const db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: tripId, owner, published: 0 });
  for (const [email, role] of [[member, 'member'], [viewer, 'viewer']] as const) {
    await seedUser(db, email);
    await db.prepare('INSERT INTO trip_permissions (user_id, trip_id, role) VALUES (?, ?, ?)')
      .bind(userIdFor(email), tripId, role).run();
  }
});

describe('owner-wide trip archive', () => {
  it('moves owner, member and viewer lists together, preserves access, and restores them together', async () => {
    for (const email of [owner, member, viewer]) {
      expect((await listFor(email)).find((trip) => trip.tripId === tripId)?.archivedAt).toBeNull();
    }

    const archive = await callHandler(onRequestPut, ctx(owner, 'PUT'));
    expect(archive.status).toBe(200);
    for (const email of [owner, member, viewer]) {
      expect((await listFor(email)).find((trip) => trip.tripId === tripId)?.archivedAt).toEqual(expect.any(String));
      const detail = await callHandler(readTrip, mockContext({
        request: new Request(`https://test.com/api/trips/${tripId}`), env,
        auth: mockAuth({ email }), params: { id: tripId },
      }));
      expect(detail.status).toBe(200);
    }
    for (const email of [member, viewer, outsider]) {
      expect((await callHandler(onRequestDelete, ctx(email, 'DELETE'))).status).toBe(403);
    }
    expect((await listFor(member)).find((trip) => trip.tripId === tripId)?.archivedAt).toEqual(expect.any(String));

    const restore = await callHandler(onRequestDelete, ctx(owner, 'DELETE'));
    expect(restore.status).toBe(200);
    for (const email of [owner, member, viewer]) {
      expect((await listFor(email)).find((trip) => trip.tripId === tripId)?.archivedAt).toBeNull();
    }
  });

  it('rejects member, viewer, outsider, service token and restricted owner token without mutation', async () => {
    for (const email of [member, viewer, outsider]) {
      expect((await callHandler(onRequestPut, ctx(email, 'PUT'))).status).toBe(403);
    }
    expect((await callHandler(onRequestPut, mockContext({
      request: new Request(`https://test.com/api/trips/${tripId}/archive`, { method: 'PUT' }), env,
      auth: mockServiceAuth(), params: { id: tripId },
    }))).status).toBe(403);
    expect((await callHandler(onRequestPut, mockContext({
      request: new Request(`https://test.com/api/trips/${tripId}/archive`, { method: 'PUT' }), env,
      auth: mockAuth({ email: owner, restrictTrip: tripId }), params: { id: tripId },
    }))).status).toBe(403);
    expect((await callHandler(onRequestPut, mockContext({
      request: new Request(`https://test.com/api/trips/${tripId}/archive`, { method: 'PUT' }), env,
      auth: mockAuth({ email: owner, scopes: ['trips:read'] }), params: { id: tripId },
    }))).status).toBe(403);
    expect((await listFor(owner)).find((trip) => trip.tripId === tripId)?.archivedAt).toBeNull();
  });
});
