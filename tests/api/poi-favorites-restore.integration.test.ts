/**
 * Integration test — POST /api/poi-favorites/:id/restore + POST soft-delete 相容行為。
 * spec: docs/backend-tasks/2026-07-18-poi-favorites-undo-restore-api.md §7（必測案例 2/3/4/5/7/8/9）。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, seedPoi, seedUser, callHandler } from './helpers';
import { onRequestPost as restoreHandler } from '../../functions/api/poi-favorites/[id]/restore';
import { onRequestDelete } from '../../functions/api/poi-favorites/[id]';
import { onRequestPost as createFavorite, onRequestGet as listFavorites } from '../../functions/api/poi-favorites';
import type { Env } from '../../functions/api/_types';

// API 回應經 json() → deepCamel，故 key 為 camelCase（與全站一致），非 spec 文件的 snake_case 示意。
type FavBody = {
  id: number;
  userId: string;
  poiId: number;
  note: string | null;
  favoritedAt: string;
  deletedAt: string | null;
};
type ErrBody = { error: { code: string } };

let db: D1Database;
let env: Env;
const OWNER = 'restore-owner@test.com';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedUser(db, OWNER);
});
afterAll(disposeMiniflare);
beforeEach(async () => {
  await db.prepare("DELETE FROM poi_favorites WHERE user_id LIKE 'test-user-%'").run();
  await db.prepare("DELETE FROM audit_log WHERE table_name = 'poi_favorites'").run();
});

function restoreReq(id: number): Request {
  return new Request(`https://test.com/api/poi-favorites/${id}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}
function deleteReq(id: number): Request {
  return new Request(`https://test.com/api/poi-favorites/${id}`, { method: 'DELETE' });
}
function createReq(poiId: number, note?: string): Request {
  return new Request('https://test.com/api/poi-favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ poiId, note }),
  });
}
async function seedFavorite(userId: string, poiId: number, note: string | null = null): Promise<number> {
  const row = await db
    .prepare('INSERT INTO poi_favorites (user_id, poi_id, note) VALUES (?, ?, ?) RETURNING id')
    .bind(userId, poiId, note)
    .first<{ id: number }>();
  return row!.id;
}
const ownerCtx = (request: Request, params?: Record<string, string>) =>
  mockContext({ request, env, auth: mockAuth({ email: OWNER }), params: params ?? {} });

describe('POST /api/poi-favorites/:id/restore', () => {
  it('§7.2 DELETE 後 10 分鐘內 restore → 回同一 id，note/poiId/favoritedAt 完整保留、deleted_at null', async () => {
    const userId = await seedUser(db, OWNER);
    const poiId = await seedPoi(db, { name: 'Restore POI' });
    const favId = await seedFavorite(userId, poiId, '原收藏備註');
    const before = await db
      .prepare('SELECT favorited_at FROM poi_favorites WHERE id = ?')
      .bind(favId)
      .first<{ favorited_at: string }>();

    const del = await callHandler(onRequestDelete, ownerCtx(deleteReq(favId), { id: String(favId) }));
    expect(del.status).toBe(204);

    const resp = await callHandler(restoreHandler, ownerCtx(restoreReq(favId), { id: String(favId) }));
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as FavBody;
    expect(body.id).toBe(favId);
    expect(body.poiId).toBe(poiId);
    expect(body.note).toBe('原收藏備註');
    expect(body.favoritedAt).toBe(before!.favorited_at);
    expect(body.deletedAt).toBeNull();
  });

  it('§7.3 restore 重送兩次都 200、GET 最後只有一筆 active', async () => {
    const userId = await seedUser(db, OWNER);
    const poiId = await seedPoi(db, { name: 'Restore Twice POI' });
    const favId = await seedFavorite(userId, poiId);
    await callHandler(onRequestDelete, ownerCtx(deleteReq(favId), { id: String(favId) }));

    const r1 = await callHandler(restoreHandler, ownerCtx(restoreReq(favId), { id: String(favId) }));
    const r2 = await callHandler(restoreHandler, ownerCtx(restoreReq(favId), { id: String(favId) }));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const getResp = await callHandler(listFavorites, ownerCtx(new Request('https://test.com/api/poi-favorites')));
    const list = (await getResp.json()) as FavBody[];
    expect(list.filter((f) => f.poiId === poiId)).toHaveLength(1);
  });

  it('§7.4 超過 10 分鐘 restore → 410 UNDO_EXPIRED', async () => {
    const userId = await seedUser(db, OWNER);
    const poiId = await seedPoi(db, { name: 'Expired POI' });
    const favId = await seedFavorite(userId, poiId);
    await db.prepare("UPDATE poi_favorites SET deleted_at = datetime('now','-11 minutes') WHERE id = ?").bind(favId).run();

    const resp = await callHandler(restoreHandler, ownerCtx(restoreReq(favId), { id: String(favId) }));
    expect(resp.status).toBe(410);
    expect(((await resp.json()) as ErrBody).error.code).toBe('UNDO_EXPIRED');
  });

  it('§7.5 非 owner restore → 404，不洩漏 row 是否存在', async () => {
    const ownerId = await seedUser(db, OWNER);
    const poiId = await seedPoi(db, { name: 'Other POI' });
    const favId = await seedFavorite(ownerId, poiId);
    await db.prepare("UPDATE poi_favorites SET deleted_at = datetime('now') WHERE id = ?").bind(favId).run();
    await seedUser(db, 'attacker@test.com');

    const resp = await callHandler(
      restoreHandler,
      mockContext({ request: restoreReq(favId), env, auth: mockAuth({ email: 'attacker@test.com' }), params: { id: String(favId) } }),
    );
    expect(resp.status).toBe(404);
    // row 仍在（未被 attacker 復原）
    const row = await db.prepare('SELECT deleted_at FROM poi_favorites WHERE id = ?').bind(favId).first<{ deleted_at: string | null }>();
    expect(row?.deleted_at).not.toBeNull();
  });

  it('restore 不存在的 id → 404', async () => {
    await seedUser(db, OWNER);
    const resp = await callHandler(restoreHandler, ownerCtx(restoreReq(999999), { id: '999999' }));
    expect(resp.status).toBe(404);
  });

  it('restore 已 active（idempotent）→ 200 回目前 row', async () => {
    const userId = await seedUser(db, OWNER);
    const poiId = await seedPoi(db, { name: 'Active POI' });
    const favId = await seedFavorite(userId, poiId);
    const resp = await callHandler(restoreHandler, ownerCtx(restoreReq(favId), { id: String(favId) }));
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as FavBody;
    expect(body.id).toBe(favId);
    expect(body.deletedAt).toBeNull();
  });
});

describe('POST /api/poi-favorites — soft-delete 相容（§4 / §7.7-9）', () => {
  it('§7.7 只有 soft-deleted row 時重新 POST → 201 reactivate 同 id、不觸發 UNIQUE 500', async () => {
    const userId = await seedUser(db, OWNER);
    const poiId = await seedPoi(db, { name: 'Repost POI' });
    const favId = await seedFavorite(userId, poiId, '舊備註');
    await db.prepare("UPDATE poi_favorites SET deleted_at = datetime('now') WHERE id = ?").bind(favId).run();

    const resp = await callHandler(createFavorite, ownerCtx(createReq(poiId, '新備註')));
    expect(resp.status).toBe(201);
    const body = (await resp.json()) as FavBody;
    expect(body.id).toBe(favId); // 重用同 row，非新建
    expect(body.note).toBe('新備註');
    expect(body.deletedAt).toBeNull();
    const count = await db
      .prepare('SELECT COUNT(*) AS c FROM poi_favorites WHERE user_id = ? AND poi_id = ?')
      .bind(userId, poiId)
      .first<{ c: number }>();
    expect(count!.c).toBe(1);
  });

  it('§7.8 已有 active favorite 時 POST → 409', async () => {
    const userId = await seedUser(db, OWNER);
    const poiId = await seedPoi(db, { name: 'Dup POI' });
    await seedFavorite(userId, poiId);
    const resp = await callHandler(createFavorite, ownerCtx(createReq(poiId)));
    expect(resp.status).toBe(409);
  });

  it('§7.9 soft-deleted + 另一 active 同 POI 時 restore soft-deleted → 回該 active row、最後恆 1 筆 active', async () => {
    const userId = await seedUser(db, OWNER);
    const poiId = await seedPoi(db, { name: 'Race POI' });
    const softId = await seedFavorite(userId, poiId, 'soft');
    await db.prepare("UPDATE poi_favorites SET deleted_at = datetime('now') WHERE id = ?").bind(softId).run();
    const activeId = await seedFavorite(userId, poiId, 'active'); // partial index 允許 1 active + soft-deleted 並存

    const resp = await callHandler(restoreHandler, ownerCtx(restoreReq(softId), { id: String(softId) }));
    expect(resp.status).toBe(200);
    expect(((await resp.json()) as FavBody).id).toBe(activeId); // 回 active row、非 softId
    const count = await db
      .prepare('SELECT COUNT(*) AS c FROM poi_favorites WHERE user_id = ? AND poi_id = ? AND deleted_at IS NULL')
      .bind(userId, poiId)
      .first<{ c: number }>();
    expect(count!.c).toBe(1);
  });
});
