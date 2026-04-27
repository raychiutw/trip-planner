/**
 * Migration 0040 — trip_invitations schema 結構測試（V2 共編分享信）
 *
 * 為什麼 token_hash 是 PK 不存 raw token：跟 _session.ts / forgot-password.ts
 * 一致 — DB dump 不能直接用來反查 token，HMAC(SESSION_SECRET, raw) 才能比對。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/0040_trip_invitations.sql'),
  'utf8',
);

const ROLLBACK = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/rollback/0040_trip_invitations_rollback.sql'),
  'utf8',
);

describe('Migration 0040 — trip_invitations (V2 共編邀請)', () => {
  it('token_hash 是 TEXT PRIMARY KEY (HMAC of raw token)', () => {
    expect(MIGRATION).toMatch(/token_hash\s+TEXT PRIMARY KEY/);
  });

  it('trip_id NOT NULL FK to trips ON DELETE CASCADE', () => {
    expect(MIGRATION).toMatch(/trip_id\s+TEXT NOT NULL REFERENCES trips\(id\) ON DELETE CASCADE/);
  });

  it('invited_email NOT NULL (lowercase 由 application 保證)', () => {
    expect(MIGRATION).toMatch(/invited_email\s+TEXT NOT NULL/);
  });

  it("role CHECK constraint 限制為 'member'（V2 共編語意）", () => {
    expect(MIGRATION).toMatch(/role[\s\S]*?CHECK[\s\S]*?'member'/);
  });

  it('invited_by NOT NULL FK to users ON DELETE CASCADE', () => {
    expect(MIGRATION).toMatch(/invited_by\s+TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  });

  it("created_at 預設 datetime('now')（跟 0036/0037 一致）", () => {
    expect(MIGRATION).toMatch(/created_at[\s\S]*?DEFAULT \(datetime\('now'\)\)/);
  });

  it('expires_at NOT NULL（lazy expire on read 用）', () => {
    expect(MIGRATION).toMatch(/expires_at\s+TEXT NOT NULL/);
  });

  it('accepted_at nullable（NULL = pending, NOT NULL = accepted）', () => {
    // accepted_at TEXT 不 NOT NULL
    expect(MIGRATION).toMatch(/accepted_at\s+TEXT[\s,\n]/);
    expect(MIGRATION).not.toMatch(/accepted_at\s+TEXT NOT NULL/);
  });

  it('accepted_by FK to users ON DELETE SET NULL（保留 invitation history）', () => {
    expect(MIGRATION).toMatch(/accepted_by\s+TEXT REFERENCES users\(id\) ON DELETE SET NULL/);
  });

  it('index idx_invitations_email（依 email 查 pending）', () => {
    expect(MIGRATION).toMatch(/CREATE INDEX idx_invitations_email/);
  });

  it('index idx_invitations_trip（CollabSheet 列 pending by trip）', () => {
    expect(MIGRATION).toMatch(/CREATE INDEX idx_invitations_trip/);
  });

  it('partial index idx_invitations_pending（只索引 accepted_at IS NULL）', () => {
    expect(MIGRATION).toMatch(/CREATE INDEX idx_invitations_pending[\s\S]*?WHERE accepted_at IS NULL/);
  });
});

describe('Rollback 0040 — trip_invitations', () => {
  it('drops 全部 3 個 indexes', () => {
    expect(ROLLBACK).toMatch(/DROP INDEX IF EXISTS idx_invitations_email/);
    expect(ROLLBACK).toMatch(/DROP INDEX IF EXISTS idx_invitations_trip/);
    expect(ROLLBACK).toMatch(/DROP INDEX IF EXISTS idx_invitations_pending/);
  });

  it('drops trip_invitations table', () => {
    expect(ROLLBACK).toMatch(/DROP TABLE IF EXISTS trip_invitations/);
  });
});
