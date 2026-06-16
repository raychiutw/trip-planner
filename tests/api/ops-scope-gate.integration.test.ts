/**
 * ops-scope-gate — Phase 1（移除全域 admin）授權回歸鎖
 *
 * 驗證：
 *  - hasOpsScope / requireScope：只有 service token 帶對應 ops scope 才過；
 *    user-session 即使自帶 scopes 也不過（無偽造路徑）；Phase 1 舊 admin scope
 *    雙接受。
 *  - F1：master POI 寫入（PATCH/DELETE/enrich）改 ops:poi gate — service token
 *    帶 ops:poi 可不帶 tripId 直接改；無 ops:poi 的 token / 一般 user 走 owner 分支。
 *  - D4：audit 歷史改 per-trip owner gate（hasWritePermission）— owner 可看，
 *    陌生人 / service token 擋。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockAuth, mockEnv, seedTrip, seedPoi, callHandler, jsonRequest } from './helpers';
import { hasOpsScope, requireScope } from '../../functions/api/_auth';
import { onRequestPatch, onRequestDelete } from '../../functions/api/pois/[id]';
import { onRequestGet as auditGet } from '../../functions/api/trips/[id]/audit';
import type { AuthData } from '../../functions/api/_types';

/** service-token auth — userId=null（mockAuth 用 ...overrides 覆寫回 null）。 */
function svcToken(scopes: string[], clientId = 'cli'): AuthData {
  return mockAuth({
    email: `service:${clientId}`,
    userId: null,
    isServiceToken: true,
    scopes,
    clientId,
  });
}

describe('hasOpsScope (Phase 1 ops-scope gate)', () => {
  it('service token with matching ops scope → true; non-matching → false', () => {
    const auth = svcToken(['ops:maps']);
    expect(hasOpsScope(auth, 'ops:maps')).toBe(true);
    expect(hasOpsScope(auth, 'ops:poi')).toBe(false);
  });

  it('legacy admin scope 雙接受 → true for any ops (Phase 1 過渡)', () => {
    const auth = svcToken(['admin']);
    expect(hasOpsScope(auth, 'ops:maps')).toBe(true);
    expect(hasOpsScope(auth, 'ops:poi')).toBe(true);
    expect(hasOpsScope(auth, 'ops:trips:read')).toBe(true);
  });

  it('user session never passes even with scopes present (no forge)', () => {
    const auth = mockAuth({ scopes: ['ops:maps'] }); // isServiceToken=false
    expect(hasOpsScope(auth, 'ops:maps')).toBe(false);
  });

  it('service token without scopes → false; null auth → false', () => {
    expect(hasOpsScope(svcToken([] as string[]), 'ops:maps')).toBe(false);
    expect(hasOpsScope(mockAuth({ isServiceToken: true, userId: null }), 'ops:maps')).toBe(false);
    expect(hasOpsScope(null, 'ops:maps')).toBe(false);
  });
});

describe('requireScope', () => {
  it('returns auth when service token has the ops scope', () => {
    const auth = svcToken(['ops:cache']);
    expect(requireScope({ data: { auth } }, 'ops:cache')).toBe(auth);
  });

  it('throws when scope missing or caller is a user session', () => {
    expect(() => requireScope({ data: { auth: svcToken(['ops:maps']) } }, 'ops:poi')).toThrow();
    expect(() => requireScope({ data: { auth: mockAuth({}) } }, 'ops:maps')).toThrow();
  });
});

describe('F1 — master POI write gated by ops:poi', () => {
  let db: D1Database;
  beforeAll(async () => { db = await createTestDb(); });
  afterAll(disposeMiniflare);

  it('service token with ops:poi can PATCH master POI without tripId', async () => {
    const poiId = await seedPoi(db, { name: 'Old Name' });
    const res = await callHandler(onRequestPatch as never, {
      request: jsonRequest(`https://x/api/pois/${poiId}`, 'PATCH', { name: 'New Name' }),
      env: mockEnv(db),
      params: { id: String(poiId) },
      data: { auth: svcToken(['ops:poi']) },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('New Name');
  });

  it('service token WITHOUT ops:poi (only ops:maps) is rejected from PATCH without tripId', async () => {
    const poiId = await seedPoi(db, { name: 'X' });
    const res = await callHandler(onRequestPatch as never, {
      request: jsonRequest(`https://x/api/pois/${poiId}`, 'PATCH', { name: 'Y' }),
      env: mockEnv(db),
      params: { id: String(poiId) },
      data: { auth: svcToken(['ops:maps']) },
    });
    expect(res.status).not.toBe(200); // 走非維運分支 → 缺 tripId → DATA_VALIDATION
  });

  it('service token with ops:poi can DELETE master POI', async () => {
    const poiId = await seedPoi(db, { name: 'ToDelete' });
    const res = await callHandler(onRequestDelete as never, {
      request: jsonRequest(`https://x/api/pois/${poiId}`, 'DELETE'),
      env: mockEnv(db),
      params: { id: String(poiId) },
      data: { auth: svcToken(['ops:poi']) },
    });
    expect(res.status).toBe(200);
  });

  it('user (no ops scope) is rejected from DELETE master POI', async () => {
    const poiId = await seedPoi(db, { name: 'Z' });
    const res = await callHandler(onRequestDelete as never, {
      request: jsonRequest(`https://x/api/pois/${poiId}`, 'DELETE'),
      env: mockEnv(db),
      params: { id: String(poiId) },
      data: { auth: mockAuth({ email: 'user@test.com' }) },
    });
    expect(res.status).not.toBe(200); // PERM_DENIED
  });
});

describe('D4 — audit history gated by owner (hasWritePermission)', () => {
  let db: D1Database;
  beforeAll(async () => {
    db = await createTestDb();
    await seedTrip(db, { id: 'trip-audit', owner: 'owner@test.com' });
  });
  afterAll(disposeMiniflare);

  it('owner can read audit history', async () => {
    const res = await callHandler(auditGet as never, {
      request: new Request('https://x/api/trips/trip-audit/audit'),
      env: mockEnv(db),
      params: { id: 'trip-audit' },
      data: { auth: mockAuth({ email: 'owner@test.com' }) },
    });
    expect(res.status).toBe(200);
  });

  it('stranger (no permission row) cannot read audit', async () => {
    const res = await callHandler(auditGet as never, {
      request: new Request('https://x/api/trips/trip-audit/audit'),
      env: mockEnv(db),
      params: { id: 'trip-audit' },
      data: { auth: mockAuth({ email: 'stranger@test.com' }) },
    });
    expect(res.status).not.toBe(200);
  });

  it('service token (no trip permission) cannot read audit — no admin bypass', async () => {
    const res = await callHandler(auditGet as never, {
      request: new Request('https://x/api/trips/trip-audit/audit'),
      env: mockEnv(db),
      params: { id: 'trip-audit' },
      data: { auth: svcToken(['ops:trips:read']) },
    });
    expect(res.status).not.toBe(200);
  });
});
