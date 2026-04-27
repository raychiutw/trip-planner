/**
 * Migration 0034 — client_apps schema 結構測試（V2-P4 starter）
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/0034_client_apps.sql'),
  'utf8',
);

describe('Migration 0034 — client_apps (V2-P4 OAuth Server)', () => {
  it('client_id is TEXT PRIMARY KEY (human-readable identifier)', () => {
    expect(MIGRATION).toMatch(/client_id\s+TEXT PRIMARY KEY/);
  });

  it('client_secret_hash 用 hash 不存明文 (nullable for public clients)', () => {
    expect(MIGRATION).toMatch(/client_secret_hash\s+TEXT[\s,]/);
    // 不該 NOT NULL — public client (PKCE) 沒 secret
    expect(MIGRATION).not.toMatch(/client_secret_hash[^,\n]+NOT NULL/);
  });

  it('client_type CHECK constraint: public | confidential', () => {
    expect(MIGRATION).toMatch(/client_type[\s\S]*?CHECK[\s\S]*?'public'[\s\S]*?'confidential'/);
  });

  it('app_name NOT NULL (consent screen 必顯示)', () => {
    expect(MIGRATION).toMatch(/app_name\s+TEXT NOT NULL/);
  });

  it('redirect_uris + allowed_scopes 都 NOT NULL JSON array (TEXT)', () => {
    expect(MIGRATION).toMatch(/redirect_uris\s+TEXT NOT NULL/);
    expect(MIGRATION).toMatch(/allowed_scopes\s+TEXT NOT NULL/);
  });

  it('owner_user_id FK to users.id ON DELETE SET NULL (保留 client app history)', () => {
    expect(MIGRATION).toMatch(/owner_user_id\s+TEXT REFERENCES users\(id\) ON DELETE SET NULL/);
  });

  it('status CHECK constraint includes pending_review (ops 審核 flow)', () => {
    expect(MIGRATION).toMatch(/status[\s\S]*?CHECK[\s\S]*?pending_review/);
  });

  it('default status = pending_review (new client 等審核)', () => {
    expect(MIGRATION).toMatch(/status\s+TEXT NOT NULL DEFAULT 'pending_review'/);
  });

  it('indexes on owner_user_id + status', () => {
    expect(MIGRATION).toMatch(/CREATE INDEX idx_client_apps_owner_user_id/);
    expect(MIGRATION).toMatch(/CREATE INDEX idx_client_apps_status/);
  });
});
