// @vitest-environment node
/**
 * Migration 0050 — audit_log.companion_failure_reason column verify
 *
 * 對映 specs/tp-companion-mapping/spec.md Requirement: companion 失敗結構化 log
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';

describe('migration 0050 — audit_log.companion_failure_reason', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  it('audit_log 含 companion_failure_reason TEXT column nullable', async () => {
    const { results } = await db.prepare("PRAGMA table_info('audit_log')").all();
    const col = results.find(
      (r) => (r as { name: string }).name === 'companion_failure_reason',
    ) as { type: string; notnull: number; dflt_value: string | null } | undefined;

    expect(col).toBeDefined();
    expect(col!.type).toBe('TEXT');
    expect(col!.notnull).toBe(0); // nullable
  });

  it('既有 audit_log INSERT 不影響（companion_failure_reason 預設 null）', async () => {
    const result = await db.prepare(
      `INSERT INTO audit_log (trip_id, table_name, action, changed_by)
       VALUES (?, ?, ?, ?) RETURNING id, companion_failure_reason`,
    ).bind('test-trip-x', 'trips', 'insert', 'test@test.com').first<{
      id: number;
      companion_failure_reason: string | null;
    }>();

    expect(result).toBeDefined();
    expect(result!.companion_failure_reason).toBeNull();
  });

  it('companion path 失敗時可寫 enum 值', async () => {
    const validReasons = [
      'invalid_request_id',
      'status_completed',
      'submitter_unknown',
      'self_reported_scope',
      'client_unauthorized',
      'quota_exceeded',
    ];

    for (const reason of validReasons) {
      const result = await db.prepare(
        `INSERT INTO audit_log (trip_id, table_name, action, changed_by, companion_failure_reason)
         VALUES (?, ?, ?, ?, ?) RETURNING companion_failure_reason`,
      ).bind('system:companion', 'poi_favorites', 'insert', 'companion:1', reason)
        .first<{ companion_failure_reason: string }>();

      expect(result!.companion_failure_reason).toBe(reason);
    }
  });
});
