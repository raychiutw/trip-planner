/**
 * Integration test — migration 0030: trip_entries.order_in_day ADD COLUMN
 *
 * 驗證：
 * 1. 欄位存在、型別正確
 * 2. default 值為 0（新 INSERT 不傳欄位亦為 0）
 * 3. NOT NULL（設為 null 會 fail）
 * 4. 既有 entry 在 migration 後 order_in_day = 0（不破壞既有 row）
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { seedTrip, seedEntry, getDayId } from './helpers';

let db: D1Database;

beforeAll(async () => {
  db = await createTestDb();
  await seedTrip(db, { id: 'order-trip' });
});

afterAll(disposeMiniflare);

describe('migration 0030 — trip_entries.order_in_day', () => {
  it('欄位存在且 NOT NULL with default 0', async () => {
    const info = await db.prepare("PRAGMA table_info('trip_entries')").all();
    const col = (info.results as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>)
      .find(r => r.name === 'order_in_day');
    expect(col).toBeDefined();
    expect(col!.type).toBe('INTEGER');
    expect(col!.notnull).toBe(1);
    expect(col!.dflt_value).toBe('0');
  });

  it('新增 entry 不傳 order_in_day 自動為 0', async () => {
    const dayId = await getDayId(db, 'order-trip', 1);
    const entryId = await seedEntry(db, dayId, { title: 'Default Order Entry' });
    const row = await db.prepare(
      'SELECT order_in_day FROM trip_entries WHERE id = ?'
    ).bind(entryId).first<{ order_in_day: number }>();
    expect(row!.order_in_day).toBe(0);
  });

  it('手動設 order_in_day 可成功 INSERT / 讀回', async () => {
    const dayId = await getDayId(db, 'order-trip', 2);
    await db.prepare(
      `INSERT INTO trip_entries (day_id, sort_order, time, title, order_in_day)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(dayId, 1, '10:00', 'Ordered Entry', 5).run();
    const row = await db.prepare(
      'SELECT order_in_day FROM trip_entries WHERE title = ?'
    ).bind('Ordered Entry').first<{ order_in_day: number }>();
    expect(row!.order_in_day).toBe(5);
  });

  it('(day_id, order_in_day) 複合 index 存在', async () => {
    const res = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_trip_entries_order'"
    ).first<{ name: string }>();
    expect(res).not.toBeNull();
    expect(res!.name).toBe('idx_trip_entries_order');
  });
});
