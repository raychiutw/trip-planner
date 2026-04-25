/**
 * Migration 0036 — auth_audit_log schema 結構測試（V2-P6）
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/0036_auth_audit_log.sql'),
  'utf8',
);

describe('Migration 0036 — auth_audit_log', () => {
  it('id INTEGER PRIMARY KEY AUTOINCREMENT', () => {
    expect(MIGRATION).toMatch(/id\s+INTEGER PRIMARY KEY AUTOINCREMENT/);
  });

  it('event_type TEXT NOT NULL (string for forward compat, no CHECK)', () => {
    expect(MIGRATION).toMatch(/event_type\s+TEXT NOT NULL/);
  });

  it('outcome TEXT NOT NULL with CHECK (success | failure)', () => {
    expect(MIGRATION).toMatch(/outcome\s+TEXT NOT NULL CHECK[\s\S]*?'success'[\s\S]*?'failure'/);
  });

  it('user_id TEXT nullable', () => {
    expect(MIGRATION).toMatch(/user_id\s+TEXT[\s,]/);
    expect(MIGRATION).not.toMatch(/user_id[^,\n]+NOT NULL/);
  });

  it('client_id TEXT nullable', () => {
    expect(MIGRATION).toMatch(/client_id\s+TEXT[\s,]/);
    expect(MIGRATION).not.toMatch(/client_id[^,\n]+NOT NULL/);
  });

  it('ip_hash TEXT NOT NULL', () => {
    expect(MIGRATION).toMatch(/ip_hash\s+TEXT NOT NULL/);
  });

  it('failure_reason TEXT nullable', () => {
    expect(MIGRATION).toMatch(/failure_reason\s+TEXT[\s,]/);
    expect(MIGRATION).not.toMatch(/failure_reason[^,\n]+NOT NULL/);
  });

  it('metadata TEXT nullable (JSON serialised)', () => {
    expect(MIGRATION).toMatch(/metadata\s+TEXT[\s,]/);
  });

  it('trace_id TEXT nullable (correlation ID)', () => {
    expect(MIGRATION).toMatch(/trace_id\s+TEXT[\s,]/);
  });

  it('created_at TEXT NOT NULL DEFAULT datetime now', () => {
    expect(MIGRATION).toMatch(/created_at\s+TEXT NOT NULL DEFAULT/);
  });

  it('indexes for monitoring queries (user/client/event/time)', () => {
    expect(MIGRATION).toMatch(/CREATE INDEX idx_auth_audit_user_time/);
    expect(MIGRATION).toMatch(/CREATE INDEX idx_auth_audit_client_time/);
    expect(MIGRATION).toMatch(/CREATE INDEX idx_auth_audit_event_outcome/);
    expect(MIGRATION).toMatch(/CREATE INDEX idx_auth_audit_time/);
  });
});
