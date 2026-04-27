/**
 * Migration 0033 — add user_id columns 結構測試（V2-P1 backfill prep）
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/0033_add_user_id_columns.sql'),
  'utf8',
);

describe('Migration 0033 — add user_id columns', () => {
  it('saved_pois 加 user_id TEXT FK to users.id', () => {
    expect(MIGRATION).toMatch(/ALTER TABLE saved_pois\s+ADD COLUMN user_id TEXT REFERENCES users\(id\)/);
  });

  it('trip_permissions 加 user_id TEXT FK to users.id', () => {
    expect(MIGRATION).toMatch(/ALTER TABLE trip_permissions\s+ADD COLUMN user_id TEXT REFERENCES users\(id\)/);
  });

  it('trip_ideas 加 added_by_user_id TEXT FK to users.id', () => {
    expect(MIGRATION).toMatch(/ALTER TABLE trip_ideas\s+ADD COLUMN added_by_user_id TEXT REFERENCES users\(id\)/);
  });

  it('saved_pois / trip_permissions ON DELETE CASCADE (user 被刪 pool/perm 一起清)', () => {
    expect(MIGRATION).toMatch(/saved_pois[\s\S]*?ON DELETE CASCADE/);
    expect(MIGRATION).toMatch(/trip_permissions[\s\S]*?ON DELETE CASCADE/);
  });

  it('trip_ideas ON DELETE SET NULL (idea 文字保留 audit 用)', () => {
    expect(MIGRATION).toMatch(/trip_ideas[\s\S]*?ON DELETE SET NULL/);
  });

  it('3 個 user_id columns 都有 index', () => {
    expect(MIGRATION).toMatch(/CREATE INDEX idx_saved_pois_user_id/);
    expect(MIGRATION).toMatch(/CREATE INDEX idx_trip_permissions_user_id/);
    expect(MIGRATION).toMatch(/CREATE INDEX idx_trip_ideas_added_by_user_id/);
  });

  it('column 是 nullable（沒 NOT NULL）— 預備 backfill three-step pattern', () => {
    // user_id column 不能含 NOT NULL（既有 row 沒對應 user 會 fail）
    expect(MIGRATION).not.toMatch(/user_id TEXT[\s\S]*?NOT NULL/);
  });
});
