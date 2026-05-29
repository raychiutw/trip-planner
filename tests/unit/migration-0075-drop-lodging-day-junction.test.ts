// @vitest-environment node
/**
 * Migration 0075 — DROP trip_lodging_days junction
 *
 * v2.34.46 PR46: 旅館不再關聯 day。整個 junction 模型移除。
 *
 * 鎖：
 * 1. trip_lodging_days table 不存在
 * 2. idx_trip_lodging_days_day_id index 不存在
 * 3. trip_lodgings 本身保留（PR44 已拔 day_id column，0075 不動）
 * 4. SCHEMA file 不再 import / reference junction
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestDb, disposeMiniflare } from '../api/setup';

describe('migration 0075 — DROP trip_lodging_days junction', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  it('trip_lodging_days table 已不存在', async () => {
    const row = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='trip_lodging_days'`)
      .first<{ name: string }>();
    expect(row).toBeNull();
  });

  it('idx_trip_lodging_days_day_id index 已不存在', async () => {
    const row = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_trip_lodging_days_day_id'`)
      .first<{ name: string }>();
    expect(row).toBeNull();
  });

  it('trip_lodgings table 仍存在（0075 只 DROP junction）', async () => {
    const row = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='trip_lodgings'`)
      .first<{ name: string }>();
    expect(row).not.toBeNull();
  });

  it('migration SQL 只含 DROP — 不創 table', () => {
    const sql = readFileSync(resolve(__dirname, '../../migrations/0075_drop_trip_lodging_days.sql'), 'utf-8');
    expect(sql).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+idx_trip_lodging_days_day_id/i);
    expect(sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+trip_lodging_days/i);
    expect(sql).not.toMatch(/CREATE\s+TABLE/i);
  });
});
