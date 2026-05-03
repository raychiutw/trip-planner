/**
 * Integration test — GET/POST /api/saved-pois + DELETE /api/saved-pois/:id
 *
 * 涵蓋：auth gate、UNIQUE 衝突、FK 404、permission 403、DESC 排序。
 *
 * v2.21.1 rewrite — V2 cutover (migration 0046+0047) 後 saved_pois.email column
 * dropped；改純 user_id-keyed inserts via seedUser helper. helper userIdFor()
 * 把 email 衍生成 deterministic user id。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedPoi, seedUser, userIdFor, callHandler } from './helpers';
import { onRequestGet, onRequestPost } from '../../functions/api/saved-pois';
import { onRequestDelete } from '../../functions/api/saved-pois/[id]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let poiA: number;
let poiB: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  poiA = await seedPoi(db, { name: 'POI A for saved' });
  poiB = await seedPoi(db, { name: 'POI B for saved' });
});

afterAll(disposeMiniflare);

describe('GET /api/saved-pois', () => {
  it('回自己的收藏，按 saved_at DESC 排序', async () => {
    const userId = await seedUser(db, 'list@test.com');
    await db.prepare('INSERT INTO saved_pois (user_id, poi_id) VALUES (?, ?)').bind(userId, poiA).run();
    // datetime('now') 精度為秒；用 saved_at 手動設讓 DESC 排序穩定
    await db.prepare("INSERT INTO saved_pois (user_id, poi_id, saved_at) VALUES (?, ?, '2026-04-23 10:00:00')").bind(userId, poiB).run();

    const ctx = mockContext({
      request: new Request('https://test.com/api/saved-pois'),
      env,
      auth: mockAuth({ email: 'list@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<{ poiId: number; poiName: string; savedAt: string }>;
    expect(data.length).toBe(2);
    // 最新（poiA 用 datetime('now') 是當下；poiB 寫死 2026-04-23）— DESC 排序 poiA 在前
    expect(data[0]!.poiId).toBe(poiA);
    expect(data[0]!.poiName).toBe('POI A for saved');
    expect(data[1]!.poiId).toBe(poiB);
  });

  it('無 auth → 401', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/saved-pois'),
      env,
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(401);
  });

  it('回他人 user 的 row 不可見', async () => {
    const otherId = await seedUser(db, 'other@test.com');
    await db.prepare('INSERT INTO saved_pois (user_id, poi_id) VALUES (?, ?)').bind(otherId, poiA).run();
    // mockAuth 自動 derive userId from email；callHandler 自動 seedUser
    const ctx = mockContext({
      request: new Request('https://test.com/api/saved-pois'),
      env,
      auth: mockAuth({ email: 'isolated@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<unknown>;
    expect(data.length).toBe(0);
  });
});

describe('POST /api/saved-pois', () => {
  it('成功 INSERT 回 201', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/saved-pois', 'POST', { poiId: poiA, note: '值得再去' }),
      env,
      auth: mockAuth({ email: 'insert@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as { id: number; poiId: number; userId: string; note: string };
    expect(data.id).toBeGreaterThan(0);
    expect(data.poiId).toBe(poiA);
    expect(data.userId).toBe(userIdFor('insert@test.com'));
    expect(data.note).toBe('值得再去');
  });

  it('重複 POI → 409', async () => {
    const userId = await seedUser(db, 'dup@test.com');
    await db.prepare('INSERT INTO saved_pois (user_id, poi_id) VALUES (?, ?)').bind(userId, poiA).run();
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/saved-pois', 'POST', { poiId: poiA }),
      env,
      auth: mockAuth({ email: 'dup@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(409);
  });

  it('poiId 不存在 → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/saved-pois', 'POST', { poiId: 999999 }),
      env,
      auth: mockAuth({ email: 'nf@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(404);
  });

  it('缺 poiId → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/saved-pois', 'POST', { note: 'no poi' }),
      env,
      auth: mockAuth({ email: 'nf2@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('無 auth → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/saved-pois', 'POST', { poiId: poiA }),
      env,
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(401);
  });
});

describe('DELETE /api/saved-pois/:id', () => {
  it('刪自己的收藏 → 204', async () => {
    const userId = await seedUser(db, 'del@test.com');
    const row = await db.prepare(
      'INSERT INTO saved_pois (user_id, poi_id) VALUES (?, ?) RETURNING id',
    ).bind(userId, poiB).first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/saved-pois/${row!.id}`, 'DELETE'),
      env,
      auth: mockAuth({ email: 'del@test.com' }),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(204);

    const after = await db.prepare('SELECT id FROM saved_pois WHERE id = ?').bind(row!.id).first();
    expect(after).toBeNull();
  });

  it('刪他人的收藏 → 403', async () => {
    const ownerId = await seedUser(db, 'owner@test.com');
    const row = await db.prepare(
      'INSERT INTO saved_pois (user_id, poi_id) VALUES (?, ?) RETURNING id',
    ).bind(ownerId, poiB).first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/saved-pois/${row!.id}`, 'DELETE'),
      env,
      auth: mockAuth({ email: 'attacker@test.com' }),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(403);

    const still = await db.prepare('SELECT id FROM saved_pois WHERE id = ?').bind(row!.id).first();
    expect(still).not.toBeNull();
  });

  it('不存在 id → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/saved-pois/999999', 'DELETE'),
      env,
      auth: mockAuth({ email: 'del2@test.com' }),
      params: { id: '999999' },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(404);
  });

  it('admin 可刪任何人的收藏', async () => {
    const someId = await seedUser(db, 'someone@test.com');
    const row = await db.prepare(
      'INSERT INTO saved_pois (user_id, poi_id) VALUES (?, ?) RETURNING id',
    ).bind(someId, poiB).first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/saved-pois/${row!.id}`, 'DELETE'),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(204);
  });

  it('無 auth → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/saved-pois/1', 'DELETE'),
      env,
      params: { id: '1' },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(401);
  });
});
