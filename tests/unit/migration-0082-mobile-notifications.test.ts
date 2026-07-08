/**
 * Migration 0082 — mobile OAuth client + account notification preferences.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/0082_mobile_oauth_notifications.sql'),
  'utf8',
);

describe('Migration 0082 — mobile OAuth + notifications', () => {
  it('creates per-user notification preferences with boolean checks', () => {
    expect(MIGRATION).toMatch(/CREATE TABLE IF NOT EXISTS account_notification_preferences/);
    expect(MIGRATION).toMatch(/user_id\s+TEXT PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE/);
    expect(MIGRATION).toMatch(/trip_updates\s+INTEGER NOT NULL DEFAULT 1 CHECK \(trip_updates IN \(0, 1\)\)/);
    expect(MIGRATION).toMatch(/invitations\s+INTEGER NOT NULL DEFAULT 1 CHECK \(invitations IN \(0, 1\)\)/);
    expect(MIGRATION).toMatch(/system\s+INTEGER NOT NULL DEFAULT 1 CHECK \(system IN \(0, 1\)\)/);
  });

  it('provisions the official Flutter mobile public OAuth client', () => {
    expect(MIGRATION).toMatch(/INSERT INTO client_apps/);
    expect(MIGRATION).toContain("'tripline-mobile'");
    expect(MIGRATION).toContain("'public'");
    expect(MIGRATION).toContain("'Tripline Mobile'");
    expect(MIGRATION).toContain("'[\"http://127.0.0.1:8765\"]'");
    expect(MIGRATION).toContain("'[\"openid\",\"profile\",\"email\",\"offline_access\"]'");
    expect(MIGRATION).toContain("'active'");
    expect(MIGRATION).toMatch(/ON CONFLICT\(client_id\) DO UPDATE/);
  });
});
