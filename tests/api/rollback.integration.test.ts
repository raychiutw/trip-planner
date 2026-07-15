/**
 * Integration test — POST /api/trips/:id/audit/:aid/rollback
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, seedEntry, getDayId , callHandler } from './helpers';
import { onRequestPost } from '../../functions/api/trips/[id]/audit/[aid]/rollback';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-rb' });
});

afterAll(disposeMiniflare);

describe('POST /api/trips/:id/audit/:aid/rollback', () => {
  it('rollback update → 還原舊值', async () => {
    const dayId = await getDayId(db, 'trip-rb', 1);
    const entryId = await seedEntry(db, dayId);

    // 模擬 update audit log（description 從 Original → Changed）
    await db.prepare(
      "INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, diff_json) VALUES (?, 'trip_entries', ?, 'update', 'user@test.com', ?)"
    ).bind('trip-rb', entryId, JSON.stringify({ description: { old: 'Original', new: 'Changed' } })).run();

    // 先改掉 description
    await db.prepare('UPDATE trip_entries SET description = ? WHERE id = ?').bind('Changed', entryId).run();

    const auditRow = await db.prepare(
      'SELECT id FROM audit_log WHERE trip_id = ? ORDER BY id DESC LIMIT 1'
    ).bind('trip-rb').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-rb/audit/${auditRow!.id}/rollback`, 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }), // trip-rb owner（D4：rollback 改 owner gate）
      params: { id: 'trip-rb', aid: String(auditRow!.id) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);

    // 驗證已還原
    const entry = await db.prepare('SELECT description FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect((entry as Record<string, unknown>).description).toBe('Original');
  });

  it('rollback insert → 刪除記錄', async () => {
    const dayId = await getDayId(db, 'trip-rb', 2);
    const entryId = await seedEntry(db, dayId);

    await db.prepare(
      "INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by) VALUES (?, 'trip_entries', ?, 'insert', 'user@test.com')"
    ).bind('trip-rb', entryId).run();

    const auditRow = await db.prepare(
      'SELECT id FROM audit_log WHERE trip_id = ? ORDER BY id DESC LIMIT 1'
    ).bind('trip-rb').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-rb/audit/${auditRow!.id}/rollback`, 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }), // trip-rb owner（D4：rollback 改 owner gate）
      params: { id: 'trip-rb', aid: String(auditRow!.id) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);

    const entry = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect(entry).toBeNull();
  });

  it('rollback update on DROPPED column (trip_entries.note) → 400 乾淨拒絕，不 500', async () => {
    // migration 0078: trip_entries.note 已 DROP。針對 cutover 前產生的、diff 指向 note
    // 的歷史 update audit，rollback 必須在 column whitelist 階段乾淨拒絕（400 DATA_VALIDATION
    // 「Invalid column(s)」），而非通過 whitelist 後執行 `UPDATE trip_entries SET note=?`
    // 撞 "no such column: note" 變成 opaque 500。對齊本 handler header 對 dropped-column
    // rollback 的承諾（與既有 time/poi_id/travel_* cutover 一致）。
    const dayId = await getDayId(db, 'trip-rb', 3);
    const entryId = await seedEntry(db, dayId);

    await db.prepare(
      "INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, diff_json) VALUES (?, 'trip_entries', ?, 'update', 'user@test.com', ?)"
    ).bind('trip-rb', entryId, JSON.stringify({ note: { old: '舊備註', new: '新備註' } })).run();

    const auditRow = await db.prepare(
      'SELECT id FROM audit_log WHERE trip_id = ? ORDER BY id DESC LIMIT 1'
    ).bind('trip-rb').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-rb/audit/${auditRow!.id}/rollback`, 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }), // trip-rb owner（D4：rollback 改 owner gate）
      params: { id: 'trip-rb', aid: String(auditRow!.id) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
    const bodyObj = await resp.json() as { error?: { code?: string; message?: string; detail?: string } };
    expect(bodyObj.error?.code).toBe('DATA_VALIDATION');
    // detail 帶具體欄位名（handler: `Invalid column(s) in diff: note`）
    expect(bodyObj.error?.detail ?? '').toContain('note');
  });

  it('pois snapshot 帶 photos（非 whitelist 欄位）→ 400 乾淨拒絕，不 500', async () => {
    // photos 已從 TABLE_COLUMNS.pois 移除（欄位本身由 migration 0086 於後續 PR DROP）。
    // pois delete-audit 的 snapshot 由 `SELECT *` 產生、必帶 photos key → 必須在
    // whitelist 階段乾淨拒絕（400 DATA_VALIDATION「Invalid column(s) in snapshot」），
    // 而非通過後執行 `INSERT INTO pois (..., photos, ...)` —— 0086 套用後那會撞
    // "no such column: photos" 變 opaque 500。同 0062 / 0078 慣例（該慣例包含這個鎖，
    // 不只是 handler 註解）。
    //
    // 刻意 schema-independent：whitelist 在任何 SQL 碰到 pois 之前就短路，所以本測試
    // 在「欄位還在」(本 PR) 與「欄位已 DROP」(0086 後) 兩種 schema 下都綠 —— 那正是這道
    // 防線的價值所在。它鎖的是「photos 不在 whitelist」，不是「欄位已消失」；
    // 後者由 tests/unit/migration-0086-drop-pois-photos.test.ts 以 PRAGMA 驗。
    //
    // 註：這也是本檔第一個覆蓋 snapshot 分支（rollback.ts 的 invalidSnapshotCols）的測試；
    // 既有的 0078 測試走的是 diff/update 分支。
    const poi = await db.prepare(
      "INSERT INTO pois (type, name) VALUES ('attraction', 'legacy-snap') RETURNING id"
    ).first<{ id: number }>();
    await db.prepare('DELETE FROM pois WHERE id = ?').bind(poi!.id).run();

    await db.prepare(
      "INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, snapshot) VALUES (?, 'pois', ?, 'delete', 'user@test.com', ?)"
    ).bind('trip-rb', poi!.id, JSON.stringify({
      id: poi!.id, type: 'attraction', name: 'legacy-snap', photos: null, price: null,
    })).run();

    const auditRow = await db.prepare(
      'SELECT id FROM audit_log WHERE trip_id = ? ORDER BY id DESC LIMIT 1'
    ).bind('trip-rb').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-rb/audit/${auditRow!.id}/rollback`, 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-rb', aid: String(auditRow!.id) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
    const bodyObj = await resp.json() as { error?: { code?: string; detail?: string } };
    expect(bodyObj.error?.code).toBe('DATA_VALIDATION');
    expect(bodyObj.error?.detail ?? '').toContain('photos');
  });

  it('pois diff 指向 photos（非 whitelist 欄位）→ 400', async () => {
    const poi = await db.prepare(
      "INSERT INTO pois (type, name) VALUES ('attraction', 'diff-photos') RETURNING id"
    ).first<{ id: number }>();
    await db.prepare(
      "INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, diff_json) VALUES (?, 'pois', ?, 'update', 'user@test.com', ?)"
    ).bind('trip-rb', poi!.id, JSON.stringify({ photos: { old: '[]', new: null } })).run();

    const auditRow = await db.prepare(
      'SELECT id FROM audit_log WHERE trip_id = ? ORDER BY id DESC LIMIT 1'
    ).bind('trip-rb').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-rb/audit/${auditRow!.id}/rollback`, 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-rb', aid: String(auditRow!.id) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
    const bodyObj = await resp.json() as { error?: { detail?: string } };
    expect(bodyObj.error?.detail ?? '').toContain('photos');
  });

  it('非 owner（無 trip 寫權限）→ 403', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rb/audit/1/rollback', 'POST'),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: 'trip-rb', aid: '1' },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(403);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rb/audit/1/rollback', 'POST'),
      env,
      params: { id: 'trip-rb', aid: '1' },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(401);
  });

  it('不存在的 audit → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rb/audit/99999/rollback', 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }), // trip-rb owner（D4：rollback 改 owner gate）
      params: { id: 'trip-rb', aid: '99999' },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(404);
  });
});
