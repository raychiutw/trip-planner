/**
 * Migration 0037 — session_devices schema 結構測試（V2-P6）
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/0037_session_devices.sql'),
  'utf8',
);

describe('Migration 0037 — session_devices', () => {
  it('id INTEGER PRIMARY KEY AUTOINCREMENT', () => {
    expect(MIGRATION).toMatch(/id\s+INTEGER PRIMARY KEY AUTOINCREMENT/);
  });

  it('sid TEXT NOT NULL UNIQUE', () => {
    expect(MIGRATION).toMatch(/sid\s+TEXT NOT NULL UNIQUE/);
  });

  it('user_id TEXT NOT NULL', () => {
    expect(MIGRATION).toMatch(/user_id\s+TEXT NOT NULL/);
  });

  it('ua_summary TEXT nullable', () => {
    expect(MIGRATION).toMatch(/ua_summary\s+TEXT[\s,]/);
    expect(MIGRATION).not.toMatch(/ua_summary[^,\n]+NOT NULL/);
  });

  it('ip_hash TEXT nullable', () => {
    expect(MIGRATION).toMatch(/ip_hash\s+TEXT[\s,]/);
    expect(MIGRATION).not.toMatch(/ip_hash[^,\n]+NOT NULL/);
  });

  it('created_at + last_seen_at default datetime now', () => {
    expect(MIGRATION).toMatch(/created_at\s+TEXT NOT NULL DEFAULT/);
    expect(MIGRATION).toMatch(/last_seen_at\s+TEXT NOT NULL DEFAULT/);
  });

  it('revoked_at TEXT nullable (column line, not the comments)', () => {
    // Match the column definition line — leading whitespace + name + TEXT + no NOT NULL
    const columnLine = MIGRATION
      .split('\n')
      .find((l) => /^\s+revoked_at\s+TEXT\b/.test(l));
    expect(columnLine).toBeTruthy();
    expect(columnLine).not.toMatch(/NOT NULL/);
  });

  it('indexes for user_active + sid lookup', () => {
    expect(MIGRATION).toMatch(/CREATE INDEX idx_session_devices_user_active/);
    expect(MIGRATION).toMatch(/CREATE INDEX idx_session_devices_sid/);
  });
});
