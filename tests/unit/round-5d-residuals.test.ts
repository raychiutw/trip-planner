/**
 * round-5d-residuals.test.ts — v2.33.55 Round 5d backend residuals
 *
 * Source-grep guard for atomic write fixes:
 *  1. connected-apps revoke: single db.batch (consent + tokens)
 *  2. entries POST: compensating DELETE on syncEntryMaster failure
 *  3. entries copy: compensating DELETE on trip_entry_pois batch failure
 *  4. oauth/authorize: prompt=consent policy documented
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REVOKE_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/account/connected-apps/[client_id].ts'),
  'utf-8',
);
const ENTRIES_POST_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/trips/[id]/days/[num]/entries.ts'),
  'utf-8',
);
const ENTRIES_COPY_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/trips/[id]/entries/[eid]/copy.ts'),
  'utf-8',
);
const AUTHORIZE_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/oauth/authorize.ts'),
  'utf-8',
);

describe('v2.33.55 round 5d — connected-apps revoke atomic batch', () => {
  it('用 db.batch 包 consent + tokens 兩個 DELETE', () => {
    expect(REVOKE_SRC).toContain('context.env.DB.batch([');
    expect(REVOKE_SRC).toMatch(/DELETE FROM oauth_models WHERE name = 'Consent' AND id = \?/);
    expect(REVOKE_SRC).toMatch(/name IN \('AccessToken', 'RefreshToken'\)/);
  });

  it('拔掉 sequential consentAdapter.destroy()', () => {
    expect(REVOKE_SRC).not.toContain('consentAdapter.destroy(');
  });

  it('註解說明 security 缺口理由', () => {
    expect(REVOKE_SRC).toContain('atomic batch');
    expect(REVOKE_SRC).toContain('security 缺口');
  });
});

describe('v2.33.55 round 5d — entries POST compensating delete', () => {
  it('syncEntryMaster 包 try/catch', () => {
    expect(ENTRIES_POST_SRC).toMatch(/try\s*\{\s*await syncEntryMaster/);
  });

  it('catch 內 compensating DELETE trip_entries', () => {
    expect(ENTRIES_POST_SRC).toContain("'DELETE FROM trip_entries WHERE id = ?'");
    expect(ENTRIES_POST_SRC).toContain('compensating delete');
  });

  it('catch rethrow AppError SYS_DB_ERROR', () => {
    expect(ENTRIES_POST_SRC).toMatch(/throw new AppError\('SYS_DB_ERROR'/);
  });
});

describe('v2.33.55 round 5d — entries copy compensating delete', () => {
  it('trip_entry_pois batch 包 try/catch', () => {
    expect(ENTRIES_COPY_SRC).toMatch(/try\s*\{\s*await db\.batch/);
  });

  it('catch 內 compensating DELETE on newEid', () => {
    expect(ENTRIES_COPY_SRC).toContain("'DELETE FROM trip_entries WHERE id = ?'");
    expect(ENTRIES_COPY_SRC).toContain('compensating delete');
  });

  it('catch rethrow AppError SYS_DB_ERROR', () => {
    expect(ENTRIES_COPY_SRC).toMatch(/throw new AppError\('SYS_DB_ERROR'/);
  });
});

describe('v2.33.55 round 5d — oauth/authorize prompt=consent policy', () => {
  it('prompt=consent short-circuit needsConsent (既有邏輯保留)', () => {
    expect(AUTHORIZE_SRC).toContain("result.prompt === 'consent'");
  });

  it('policy 註解：不 invalidate tokens / consent.ts upsert overwrites', () => {
    expect(AUTHORIZE_SRC).toContain('prompt=consent 不主動 invalidate');
    expect(AUTHORIZE_SRC).toContain('connected-apps');
  });
});
