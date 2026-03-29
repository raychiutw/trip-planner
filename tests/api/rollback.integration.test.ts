/**
 * Integration test — POST /api/trips/:id/audit/:aid/rollback
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, seedEntry, getDayId } from './helpers';
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
    const entryId = await seedEntry(db, dayId, { title: 'Original' });

    // 模擬 update audit log（title 從 Original → Changed）
    await db.prepare(
      "INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, diff_json) VALUES (?, 'trip_entries', ?, 'update', 'user@test.com', ?)"
    ).bind('trip-rb', entryId, JSON.stringify({ title: { old: 'Original', new: 'Changed' } })).run();

    // 先改掉 title
    await db.prepare('UPDATE trip_entries SET title = ? WHERE id = ?').bind('Changed', entryId).run();

    const auditRow = await db.prepare(
      'SELECT id FROM audit_log WHERE trip_id = ? ORDER BY id DESC LIMIT 1'
    ).bind('trip-rb').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-rb/audit/${auditRow!.id}/rollback`, 'POST'),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
      params: { id: 'trip-rb', aid: String(auditRow!.id) },
    });
    const resp = await onRequestPost(ctx);
    expect(resp.status).toBe(200);

    // 驗證已還原
    const entry = await db.prepare('SELECT title FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect((entry as Record<string, unknown>).title).toBe('Original');
  });

  it('rollback insert → 刪除記錄', async () => {
    const dayId = await getDayId(db, 'trip-rb', 2);
    const entryId = await seedEntry(db, dayId, { title: 'ToRollback' });

    await db.prepare(
      "INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by) VALUES (?, 'trip_entries', ?, 'insert', 'user@test.com')"
    ).bind('trip-rb', entryId).run();

    const auditRow = await db.prepare(
      'SELECT id FROM audit_log WHERE trip_id = ? ORDER BY id DESC LIMIT 1'
    ).bind('trip-rb').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-rb/audit/${auditRow!.id}/rollback`, 'POST'),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
      params: { id: 'trip-rb', aid: String(auditRow!.id) },
    });
    const resp = await onRequestPost(ctx);
    expect(resp.status).toBe(200);

    const entry = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect(entry).toBeNull();
  });

  it('非 admin → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rb/audit/1/rollback', 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com', isAdmin: false }),
      params: { id: 'trip-rb', aid: '1' },
    });
    expect((await onRequestPost(ctx)).status).toBe(403);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rb/audit/1/rollback', 'POST'),
      env,
      params: { id: 'trip-rb', aid: '1' },
    });
    expect((await onRequestPost(ctx)).status).toBe(401);
  });

  it('不存在的 audit → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rb/audit/99999/rollback', 'POST'),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
      params: { id: 'trip-rb', aid: '99999' },
    });
    expect((await onRequestPost(ctx)).status).toBe(404);
  });
});
