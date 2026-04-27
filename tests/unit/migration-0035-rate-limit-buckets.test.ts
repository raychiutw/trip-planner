/**
 * Migration 0035 — rate_limit_buckets schema 結構測試（V2-P6）
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/0035_rate_limit_buckets.sql'),
  'utf8',
);

describe('Migration 0035 — rate_limit_buckets', () => {
  it('bucket_key TEXT PRIMARY KEY', () => {
    expect(MIGRATION).toMatch(/bucket_key\s+TEXT PRIMARY KEY/);
  });

  it('count INTEGER default 0', () => {
    expect(MIGRATION).toMatch(/count\s+INTEGER NOT NULL DEFAULT 0/);
  });

  it('window_start INTEGER NOT NULL (unix ms)', () => {
    expect(MIGRATION).toMatch(/window_start\s+INTEGER NOT NULL/);
  });

  it('locked_until INTEGER nullable', () => {
    expect(MIGRATION).toMatch(/locked_until\s+INTEGER[\s,]/);
    expect(MIGRATION).not.toMatch(/locked_until[^,\n]+NOT NULL/);
  });

  it('created_at default datetime now', () => {
    expect(MIGRATION).toMatch(/created_at\s+TEXT NOT NULL DEFAULT/);
  });

  it('indexes on locked_until + window_start', () => {
    expect(MIGRATION).toMatch(/CREATE INDEX idx_rate_limit_locked/);
    expect(MIGRATION).toMatch(/CREATE INDEX idx_rate_limit_window/);
  });
});
