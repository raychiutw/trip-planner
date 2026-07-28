// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';

describe('migration 0091 — 行程筆記 AI 維護狀態', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 90000);

  afterAll(disposeMiniflare);

  it.each(['trip_pretrip_notes', 'trip_emergency_contacts'])(
    '%s 有 origin、managed_by、semantic_key',
    async (table) => {
      const { results } = await db
        .prepare(`PRAGMA table_info('${table}')`)
        .all<{ name: string }>();
      expect(results.map((column) => column.name)).toEqual(expect.arrayContaining([
        'origin',
        'managed_by',
        'semantic_key',
      ]));
    },
  );

  it('建立排除 tombstone，且 trip＋docType＋semanticKey 唯一', async () => {
    const { results } = await db
      .prepare("PRAGMA index_list('trip_note_ai_exclusions')")
      .all<{ name: string; unique: number }>();
    expect(results.some((index) => index.name === 'idx_trip_note_ai_exclusions_unique' && index.unique === 1)).toBe(true);
  });

  it('job 支援 processing／timed_out、generation 與完成摘要', async () => {
    const { results } = await db
      .prepare("PRAGMA table_info('trip_note_ai_jobs')")
      .all<{ name: string }>();
    expect(results.map((column) => column.name)).toEqual(expect.arrayContaining([
      'generation',
      'started_at',
      'timeout_at',
      'replaced_count',
      'preserved_manual_count',
      'duplicate_excluded_count',
      'suppressed_count',
      'error_code',
    ]));

    const sql = await db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'trip_note_ai_jobs'")
      .first<{ sql: string }>();
    expect(sql?.sql).toContain("'processing'");
    expect(sql?.sql).toContain("'timed_out'");
  });
});
