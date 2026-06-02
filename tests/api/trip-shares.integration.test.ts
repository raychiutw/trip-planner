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
import { onRequestPost as cloneShare } from '../../functions/api/share/[token]/clone';
import { getDayId, seedEntry, seedPoi, seedEntryAlternate, seedHotelForDay, userIdFor } from './helpers';
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

describe('anonymous share (PR2)', () => {
  it('anonymous link → public payload sharedBy is empty (owner has a name)', async () => {
    const { id } = await seedTrip(db, { id: 'anon-trip', owner, days: 1 });
    // non-anon → sharedBy = owner display_name (seedTrip sets it to the email local-part)
    const plain = (await (await createShareFor(id)).json()) as { token: string };
    const p1 = (await (await callHandler(publicView as never, mockContext({
      request: new Request(`https://x/api/share/${plain.token}`), env, params: { token: plain.token },
    }))).json()) as { meta: { sharedBy: string } };
    expect(p1.meta.sharedBy).toBe('share-owner');

    const anon = (await (await callHandler(createShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${id}/shares`, 'POST', { anonymous: true }),
      env, auth: mockAuth({ email: owner }), params: { id },
    }))).json()) as { token: string };
    const p2 = (await (await callHandler(publicView as never, mockContext({
      request: new Request(`https://x/api/share/${anon.token}`), env, params: { token: anon.token },
    }))).json()) as { meta: { sharedBy: string } };
    expect(p2.meta.sharedBy).toBe('');
  });
});

describe('rotate token (PR2)', () => {
  it('rotate issues a new token; old 404s, new works', async () => {
    const { id } = await seedTrip(db, { id: 'rotate-trip', owner, days: 1 });
    const created = (await (await createShareFor(id)).json()) as { id: number; token: string };
    const rot = await callHandler(patchShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${id}/shares/${created.id}`, 'PATCH', { action: 'rotate' }),
      env, auth: mockAuth({ email: owner }), params: { id, shareId: String(created.id) },
    }));
    expect(rot.status).toBe(200);
    const { token: newToken } = (await rot.json()) as { token: string };
    expect(newToken).not.toBe(created.token);
    expect((await callHandler(publicView as never, mockContext({
      request: new Request(`https://x/api/share/${created.token}`), env, params: { token: created.token },
    }))).status).toBe(404);
    expect((await callHandler(publicView as never, mockContext({
      request: new Request(`https://x/api/share/${newToken}`), env, params: { token: newToken },
    }))).status).toBe(200);
  });
});

describe('clone (PR3)', () => {
  it('clones visible body + visible notes into the cloner account; hidden sections NOT copied', async () => {
    const { id } = await seedTrip(db, { id: 'clone-src', owner, days: 1 });
    const dayId = await getDayId(db, id, 1);
    const poiId = await seedPoi(db, { name: '那霸機場', type: 'transport' });
    await seedEntry(db, dayId, { title: '那霸機場', poiId });
    await db.prepare("INSERT INTO trip_flights (trip_id, airline, flight_no) VALUES (?, 'BR', '112')").bind(id).run();
    await db.prepare("INSERT INTO trip_emergency_contacts (trip_id, name, phone) VALUES (?, 'Mom', '0900')").bind(id).run();
    const created = (await (await createShareFor(id)).json()) as { token: string }; // default: flights ON, emergency OFF

    const clonerEmail = 'cloner@test.com';
    await seedUser(db, clonerEmail);
    const cloneRes = await callHandler(cloneShare as never, mockContext({
      request: jsonRequest(`https://x/api/share/${created.token}/clone`, 'POST'),
      env, auth: mockAuth({ email: clonerEmail }), params: { token: created.token },
    }));
    expect(cloneRes.status).toBe(201);
    const { tripId: newId } = (await cloneRes.json()) as { tripId: string };

    const ownerRow = await db.prepare('SELECT owner_user_id FROM trips WHERE id = ?').bind(newId).first<{ owner_user_id: string }>();
    expect(ownerRow?.owner_user_id).toBe(userIdFor(clonerEmail));
    const ents = await db.prepare('SELECT COUNT(*) AS c FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?').bind(newId).first<{ c: number }>();
    expect(ents?.c).toBe(1);
    const fl = await db.prepare('SELECT COUNT(*) AS c FROM trip_flights WHERE trip_id = ?').bind(newId).first<{ c: number }>();
    expect(fl?.c).toBe(1); // flights default-ON → copied
    const em = await db.prepare('SELECT COUNT(*) AS c FROM trip_emergency_contacts WHERE trip_id = ?').bind(newId).first<{ c: number }>();
    expect(em?.c).toBe(0); // emergency default-OFF → NOT copied (default-deny holds through clone)
  });

  it('clone of unknown token → 404', async () => {
    const res = await callHandler(cloneShare as never, mockContext({
      request: jsonRequest('https://x/api/share/nope/clone', 'POST'),
      env, auth: mockAuth({ email: 'cloner@test.com' }), params: { token: 'nopetokennopetoken12' },
    }));
    expect(res.status).toBe(404);
  });
});

describe('clone — remap fidelity (PR3, multi-day + segment + hotel + alternates)', () => {
  it('remaps days/entries/segments to NEW ids, copies hotel + entry POIs with contiguous sort_order', async () => {
    const { id } = await seedTrip(db, { id: 'clone-rich', owner, days: 2 });
    const d1 = await getDayId(db, id, 1);
    const d2 = await getDayId(db, id, 2);
    const poiA = await seedPoi(db, { name: '景點A', type: 'attraction' });
    const poiB = await seedPoi(db, { name: '景點B-備選', type: 'attraction' });
    const poiC = await seedPoi(db, { name: '景點C', type: 'restaurant' });
    const hotelPoi = await seedPoi(db, { name: '飯店', type: 'hotel' });
    const e1 = await seedEntry(db, d1, { sortOrder: 1, title: '景點A', poiId: poiA });
    await seedEntryAlternate(db, { entryId: e1, poiId: poiB, sortOrder: 2 }); // e1 has master + 1 alternate
    const e2 = await seedEntry(db, d2, { sortOrder: 1, title: '景點C', poiId: poiC });
    await seedHotelForDay(db, d2, hotelPoi);
    await db.prepare("INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, version) VALUES (?, ?, ?, 'driving', 15, 5000, 'google', 0)").bind(id, e1, e2).run();

    const created = (await (await createShareFor(id)).json()) as { token: string };
    const clonerEmail = 'rich-cloner@test.com';
    await seedUser(db, clonerEmail);
    const cloneRes = await callHandler(cloneShare as never, mockContext({
      request: jsonRequest(`https://x/api/share/${created.token}/clone`, 'POST'),
      env, auth: mockAuth({ email: clonerEmail }), params: { token: created.token },
    }));
    expect(cloneRes.status).toBe(201);
    const { tripId: newId } = (await cloneRes.json()) as { tripId: string };

    // 2 days copied
    const days = await db.prepare('SELECT COUNT(*) AS c FROM trip_days WHERE trip_id = ?').bind(newId).first<{ c: number }>();
    expect(days?.c).toBe(2);
    // segment remapped: 1 segment whose from/to are entries belonging to the NEW trip
    const segs = (await db.prepare('SELECT from_entry_id AS f, to_entry_id AS t FROM trip_segments WHERE trip_id = ?').bind(newId).all()).results as { f: number; t: number }[];
    expect(segs.length).toBe(1);
    const newEntryIds = ((await db.prepare('SELECT e.id FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?').bind(newId).all()).results as { id: number }[]).map((r) => r.id);
    expect(newEntryIds).toContain(segs[0]!.f);
    expect(newEntryIds).toContain(segs[0]!.t);
    expect(segs[0]!.f).not.toBe(e1); // remapped, not the old id
    // hotel copied onto one day
    const hotelDays = await db.prepare('SELECT COUNT(*) AS c FROM trip_days WHERE trip_id = ? AND hotel_poi_id IS NOT NULL').bind(newId).first<{ c: number }>();
    expect(hotelDays?.c).toBe(1);
    // the 2-POI entry: sort_order contiguous 1,2 + entry_pois_version = 1
    const grp = (await db.prepare('SELECT tep.entry_id AS eid, COUNT(*) AS c, GROUP_CONCAT(tep.sort_order) AS so FROM trip_entry_pois tep JOIN trip_entries e ON e.id = tep.entry_id JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ? GROUP BY tep.entry_id').bind(newId).all()).results as { eid: number; c: number; so: string }[];
    const twoPoi = grp.find((g) => g.c === 2);
    expect(twoPoi).toBeTruthy();
    expect((twoPoi!.so ?? '').split(',').map(Number).sort((a, b) => a - b)).toEqual([1, 2]); // contiguous 1..N
    const ver = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?').bind(twoPoi!.eid).first<{ v: number }>();
    expect(ver?.v).toBe(1);
  });

  // migration 0078: trip_entries.note 已 DROP，備註改為 per-POI（trip_entry_pois.note）。
  // clone 必須把來源每個正選/備選 POI 各自的 note 原樣帶到 clone 後的 trip_entry_pois，
  // 且 INSERT trip_entries 不可再帶 entry-level note（否則 DROP 後 "no such column"）。
  it('copies per-POI note onto cloned master + alternate trip_entry_pois (migration 0078)', async () => {
    const { id } = await seedTrip(db, { id: 'clone-note', owner, days: 1 });
    const d1 = await getDayId(db, id, 1);
    const masterPoi = await seedPoi(db, { name: '正選餐廳', type: 'restaurant' });
    const altPoi = await seedPoi(db, { name: '備選餐廳', type: 'restaurant' });
    const e1 = await seedEntry(db, d1, { sortOrder: 1, title: '午餐', poiId: masterPoi });
    await seedEntryAlternate(db, { entryId: e1, poiId: altPoi, sortOrder: 2 });
    // 備註掛在 trip_entry_pois（per-POI），不在 trip_entries（已 DROP）。
    await db.prepare('UPDATE trip_entry_pois SET note = ? WHERE entry_id = ? AND poi_id = ?')
      .bind('必點山苦瓜炒麵', e1, masterPoi).run();
    await db.prepare('UPDATE trip_entry_pois SET note = ? WHERE entry_id = ? AND poi_id = ?')
      .bind('週三公休', e1, altPoi).run();

    const created = (await (await createShareFor(id)).json()) as { token: string };
    const clonerEmail = 'note-cloner@test.com';
    await seedUser(db, clonerEmail);
    const cloneRes = await callHandler(cloneShare as never, mockContext({
      request: jsonRequest(`https://x/api/share/${created.token}/clone`, 'POST'),
      env, auth: mockAuth({ email: clonerEmail }), params: { token: created.token },
    }));
    expect(cloneRes.status).toBe(201);
    const { tripId: newId } = (await cloneRes.json()) as { tripId: string };

    // clone 後正選（sort_order=1）與備選（sort_order=2）的 per-POI note 都原樣保留。
    const noteRows = (await db.prepare(
      `SELECT tep.sort_order AS so, tep.note AS note, p.name AS name
         FROM trip_entry_pois tep
         JOIN pois p ON p.id = tep.poi_id
         JOIN trip_entries e ON e.id = tep.entry_id
         JOIN trip_days d ON d.id = e.day_id
        WHERE d.trip_id = ?
        ORDER BY tep.sort_order ASC`,
    ).bind(newId).all()).results as { so: number; note: string | null; name: string }[];
    expect(noteRows.length).toBe(2);
    const master = noteRows.find((r) => r.so === 1);
    const alt = noteRows.find((r) => r.so === 2);
    expect(master?.name).toBe('正選餐廳');
    expect(master?.note).toBe('必點山苦瓜炒麵');
    expect(alt?.name).toBe('備選餐廳');
    expect(alt?.note).toBe('週三公休');
  });
});

describe('rotate guard (PR2 review fix)', () => {
  it('cannot rotate a revoked link (404, no silent resurrection)', async () => {
    const { id } = await seedTrip(db, { id: 'rotate-guard', owner, days: 1 });
    const created = (await (await createShareFor(id)).json()) as { id: number; token: string };
    await callHandler(patchShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${id}/shares/${created.id}`, 'PATCH', { action: 'revoke' }),
      env, auth: mockAuth({ email: owner }), params: { id, shareId: String(created.id) },
    }));
    const rot = await callHandler(patchShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${id}/shares/${created.id}`, 'PATCH', { action: 'rotate' }),
      env, auth: mockAuth({ email: owner }), params: { id, shareId: String(created.id) },
    }));
    expect(rot.status).toBe(404); // revoked → cannot rotate
  });
});

describe('update — edit without new URL (PR-A)', () => {
  it('edits sections/label/anon on an active link; same token, public GET reflects it', async () => {
    const { id } = await seedTrip(db, { id: 'update-trip', owner, days: 1 });
    await db.prepare("INSERT INTO trip_emergency_contacts (trip_id, name, phone) VALUES (?, 'Mom', '0900')").bind(id).run();
    const created = (await (await createShareFor(id)).json()) as { id: number; token: string };

    // before: emergency default-OFF → not in public payload, owner name shown
    const before = (await (await callHandler(publicView as never, mockContext({ request: new Request(`https://x/api/share/${created.token}`), env, params: { token: created.token } }))).json()) as { meta: { sharedBy: string }; notes: { emergencyContacts: unknown[] } };
    expect(before.notes.emergencyContacts).toEqual([]);
    expect(before.meta.sharedBy).toBe('share-owner');

    const upd = await callHandler(patchShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${id}/shares/${created.id}`, 'PATCH', { action: 'update', visibleSections: ['flights', 'lodgings', 'pretrip', 'emergency'], label: '給爸媽', anonymous: true }),
      env, auth: mockAuth({ email: owner }), params: { id, shareId: String(created.id) },
    }));
    expect(upd.status).toBe(200);

    // after: SAME token now exposes emergency + is anonymous
    const after = (await (await callHandler(publicView as never, mockContext({ request: new Request(`https://x/api/share/${created.token}`), env, params: { token: created.token } }))).json()) as { meta: { sharedBy: string }; notes: { emergencyContacts: unknown[] } };
    expect(after.notes.emergencyContacts.length).toBe(1);
    expect(after.meta.sharedBy).toBe('');
    // list reflects label + anonymous
    const list = (await (await callHandler(listShares as never, mockContext({ request: new Request(`https://x/api/trips/${id}/shares`), env, auth: mockAuth({ email: owner }), params: { id } }))).json()) as { shares: { id: number; label: string; anonymous: number }[] };
    const row = list.shares.find((s) => s.id === created.id);
    expect(row?.label).toBe('給爸媽');
    expect(row?.anonymous).toBe(1);
  });

  it('cannot update a revoked link (404)', async () => {
    const { id } = await seedTrip(db, { id: 'update-revoked', owner, days: 1 });
    const created = (await (await createShareFor(id)).json()) as { id: number };
    await callHandler(patchShare as never, mockContext({ request: jsonRequest(`https://x/api/trips/${id}/shares/${created.id}`, 'PATCH', { action: 'revoke' }), env, auth: mockAuth({ email: owner }), params: { id, shareId: String(created.id) } }));
    const upd = await callHandler(patchShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${id}/shares/${created.id}`, 'PATCH', { action: 'update', label: 'x' }),
      env, auth: mockAuth({ email: owner }), params: { id, shareId: String(created.id) },
    }));
    expect(upd.status).toBe(404);
  });
});
