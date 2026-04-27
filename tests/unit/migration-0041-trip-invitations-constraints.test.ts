/**
 * Migration 0041 — trip_invitations 約束強化（修 review findings 兩個 CRITICAL）
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/0041_trip_invitations_constraints.sql'),
  'utf8',
);

const ROLLBACK = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/rollback/0041_trip_invitations_constraints_rollback.sql'),
  'utf8',
);

describe('Migration 0041 — trip_invitations constraints', () => {
  it('用 SQLite recreate-swap pattern (PRAGMA foreign_keys OFF/ON)', () => {
    expect(MIGRATION).toMatch(/PRAGMA foreign_keys = OFF/);
    expect(MIGRATION).toMatch(/PRAGMA foreign_keys = ON/);
    expect(MIGRATION).toMatch(/CREATE TABLE trip_invitations_new/);
    expect(MIGRATION).toMatch(/DROP TABLE trip_invitations/);
    expect(MIGRATION).toMatch(/ALTER TABLE trip_invitations_new RENAME TO trip_invitations/);
  });

  it('invited_by 改 nullable + ON DELETE SET NULL（保留 audit trail）', () => {
    expect(MIGRATION).toMatch(/invited_by\s+TEXT REFERENCES users\(id\) ON DELETE SET NULL/);
    // 在 column declaration 不應該再 NOT NULL（comment 內可提及變更歷史）
    expect(MIGRATION).not.toMatch(/invited_by\s+TEXT NOT NULL/);
    // 在 column declaration 不應該再 CASCADE — 用 SQL 行頭 anchor 跳過 doc comment
    expect(MIGRATION).not.toMatch(/^\s*invited_by[^\n]+ON DELETE CASCADE/m);
  });

  it('保留 trip_id ON DELETE CASCADE（trip 刪 → invitations 刪是合理 lifecycle）', () => {
    expect(MIGRATION).toMatch(/trip_id\s+TEXT NOT NULL REFERENCES trips\(id\) ON DELETE CASCADE/);
  });

  it('加 partial UNIQUE INDEX(trip_id, invited_email) WHERE accepted_at IS NULL', () => {
    expect(MIGRATION).toMatch(
      /CREATE UNIQUE INDEX idx_invitations_unique_pending[\s\S]*?ON trip_invitations\(trip_id, invited_email\)[\s\S]*?WHERE accepted_at IS NULL/,
    );
  });

  it('保留 0040 既有 3 個 indexes（email / trip / pending partial）', () => {
    expect(MIGRATION).toMatch(/CREATE INDEX idx_invitations_email/);
    expect(MIGRATION).toMatch(/CREATE INDEX idx_invitations_trip/);
    expect(MIGRATION).toMatch(/CREATE INDEX idx_invitations_pending[\s\S]*?WHERE accepted_at IS NULL/);
  });

  it('INSERT SELECT 從舊表完整搬資料（9 個欄位）', () => {
    expect(MIGRATION).toMatch(/INSERT INTO trip_invitations_new[\s\S]*?token_hash[\s\S]*?accepted_by/);
    expect(MIGRATION).toMatch(/SELECT token_hash[\s\S]*?accepted_by\s+FROM trip_invitations/);
  });
});

describe('Rollback 0041', () => {
  it('警告 invited_by IS NULL row 需先處理（NOT NULL 反向不相容）', () => {
    expect(ROLLBACK).toMatch(/invited_by IS NULL/);
  });

  it('反向 recreate-swap，invited_by 改回 NOT NULL CASCADE', () => {
    expect(ROLLBACK).toMatch(/invited_by\s+TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  });

  it('過濾 invited_by IS NOT NULL 避免 INSERT 失敗', () => {
    expect(ROLLBACK).toMatch(/WHERE invited_by IS NOT NULL/);
  });
});
