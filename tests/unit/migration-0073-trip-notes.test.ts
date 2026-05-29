// @vitest-environment node
/**
 * Migration 0073 — trip_notes 5 table + 1 linkage
 *
 * 對應 v2.34.0 行程筆記 feature PR1：
 *   trip_flights / trip_lodgings / trip_reservations
 *   trip_pretrip_notes (含 ai_source) / trip_emergency_contacts
 *   trip_note_ai_jobs (linkage to trip_requests)
 *
 * Covers:
 * 1. 6 tables exist + column types correct
 * 2. version OCC counter — NOT NULL DEFAULT 0
 * 3. FK ON DELETE CASCADE to trips（5 data tables）+ SET NULL for lodging day_id
 * 4. CHECK enum constraints — kind / status / doc_type
 * 5. UNIQUE request_id 在 trip_note_ai_jobs
 * 6. ai_source nullable + partial index 存在
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { seedTrip } from '../api/helpers';

describe('migration 0073 — trip_notes 5 table + 1 linkage', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  describe('table existence + version OCC', () => {
    const tables = [
      'trip_flights',
      'trip_lodgings',
      'trip_reservations',
      'trip_pretrip_notes',
      'trip_emergency_contacts',
    ] as const;

    for (const t of tables) {
      it(`${t} 存在 + 含 version INTEGER NOT NULL DEFAULT 0`, async () => {
        const { results } = await db
          .prepare(`PRAGMA table_info('${t}')`)
          .all<{ name: string; type: string; notnull: number; dflt_value: string | null }>();
        expect(results.length, `${t} schema 不該為空`).toBeGreaterThan(0);
        const version = results.find((r) => r.name === 'version');
        expect(version, `${t}.version 應該存在`).toBeTruthy();
        expect(version!.type.toUpperCase()).toBe('INTEGER');
        expect(version!.notnull).toBe(1);
        expect(version!.dflt_value).toBe('0');
      });
    }

    it('trip_note_ai_jobs 存在 + 含 status / doc_type / inserted_count', async () => {
      const { results } = await db
        .prepare("PRAGMA table_info('trip_note_ai_jobs')")
        .all<{ name: string; type: string; notnull: number; dflt_value: string | null }>();
      expect(results.find((r) => r.name === 'request_id')).toBeTruthy();
      expect(results.find((r) => r.name === 'trip_id')).toBeTruthy();
      expect(results.find((r) => r.name === 'doc_type')).toBeTruthy();
      expect(results.find((r) => r.name === 'status')?.dflt_value).toBe("'pending'");
      expect(results.find((r) => r.name === 'inserted_count')?.dflt_value).toBe('0');
    });
  });

  describe('trip_pretrip_notes.ai_source', () => {
    it('ai_source TEXT nullable', async () => {
      const { results } = await db
        .prepare("PRAGMA table_info('trip_pretrip_notes')")
        .all<{ name: string; type: string; notnull: number }>();
      const col = results.find((r) => r.name === 'ai_source');
      expect(col).toBeTruthy();
      expect(col!.type.toUpperCase()).toBe('TEXT');
      expect(col!.notnull).toBe(0); // nullable
    });

    it('partial index idx_trip_pretrip_notes_ai_source 存在', async () => {
      const { results } = await db
        .prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND name='idx_trip_pretrip_notes_ai_source'")
        .all<{ name: string; sql: string }>();
      expect(results.length).toBe(1);
      expect(results[0].sql).toContain('ai_source IS NOT NULL');
    });

    it('INSERT ai_source NULL 預設 = manual entry', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'mig73-pretrip-null' });
      await db
        .prepare(`INSERT INTO trip_pretrip_notes (trip_id, title, content) VALUES (?, ?, ?)`)
        .bind(tripId, '貨幣 manual', 'TWD ≈ 4.8 JPY')
        .run();
      const row = await db
        .prepare('SELECT ai_source, ai_generated FROM trip_pretrip_notes WHERE trip_id = ?')
        .bind(tripId)
        .first<{ ai_source: string | null; ai_generated: number }>();
      expect(row!.ai_source).toBeNull();
      expect(row!.ai_generated).toBe(0);
    });

    it('INSERT ai_source = lodging-tips / general-tips 都接受', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'mig73-pretrip-ai' });
      for (const source of ['lodging-tips', 'general-tips']) {
        await db
          .prepare(
            `INSERT INTO trip_pretrip_notes (trip_id, title, content, ai_generated, ai_source) VALUES (?, ?, ?, 1, ?)`,
          )
          .bind(tripId, `title-${source}`, 'content', source)
          .run();
      }
      const { results } = await db
        .prepare('SELECT ai_source FROM trip_pretrip_notes WHERE trip_id = ?')
        .bind(tripId)
        .all<{ ai_source: string }>();
      expect(results.map((r) => r.ai_source).sort()).toEqual(['general-tips', 'lodging-tips']);
    });
  });

  describe('CHECK enum constraints', () => {
    it('trip_reservations.kind 限定 5 種', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'mig73-reserve-enum' });
      // valid
      for (const kind of ['restaurant', 'experience', 'ticket', 'transport', 'other']) {
        await db
          .prepare(`INSERT INTO trip_reservations (trip_id, kind, title) VALUES (?, ?, ?)`)
          .bind(tripId, kind, `r-${kind}`)
          .run();
      }
      // invalid 應該 throw
      await expect(
        db
          .prepare(`INSERT INTO trip_reservations (trip_id, kind, title) VALUES (?, ?, ?)`)
          .bind(tripId, 'invalid-kind', 'r-bad')
          .run(),
      ).rejects.toThrow();
    });

    it('trip_emergency_contacts.kind 限定 7 種', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'mig73-emerg-enum' });
      for (const kind of ['personal', 'embassy', 'police', 'medical', 'insurance', 'hotel', 'other']) {
        await db
          .prepare(`INSERT INTO trip_emergency_contacts (trip_id, kind, name) VALUES (?, ?, ?)`)
          .bind(tripId, kind, `c-${kind}`)
          .run();
      }
      await expect(
        db
          .prepare(`INSERT INTO trip_emergency_contacts (trip_id, kind, name) VALUES (?, ?, ?)`)
          .bind(tripId, 'invalid-emerg', 'c-bad')
          .run(),
      ).rejects.toThrow();
    });

    it('trip_note_ai_jobs.doc_type 限定 3 種', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'mig73-job-doctype' });
      const req = await db
        .prepare(`INSERT INTO trip_requests (trip_id, message) VALUES (?, ?) RETURNING id`)
        .bind(tripId, '[trip-notes] test')
        .first<{ id: number }>();
      for (const dt of ['lodging-tips', 'tips', 'emergency']) {
        await db
          .prepare(`INSERT INTO trip_note_ai_jobs (request_id, trip_id, doc_type) VALUES (?, ?, ?)`)
          .bind(req!.id + (dt === 'tips' ? 1 : dt === 'emergency' ? 2 : 0), tripId, dt)
          .run()
          .catch(() => {});
      }
      // invalid doc_type should fail
      await expect(
        db
          .prepare(`INSERT INTO trip_note_ai_jobs (request_id, trip_id, doc_type) VALUES (?, ?, ?)`)
          .bind(99999, tripId, 'invalid-doc')
          .run(),
      ).rejects.toThrow();
    });

    it('trip_note_ai_jobs.status 限定 3 種 + 預設 pending', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'mig73-job-status' });
      const req = await db
        .prepare(`INSERT INTO trip_requests (trip_id, message) VALUES (?, ?) RETURNING id`)
        .bind(tripId, '[trip-notes] test status')
        .first<{ id: number }>();
      await db
        .prepare(`INSERT INTO trip_note_ai_jobs (request_id, trip_id, doc_type) VALUES (?, ?, ?)`)
        .bind(req!.id, tripId, 'tips')
        .run();
      const row = await db
        .prepare('SELECT status FROM trip_note_ai_jobs WHERE request_id = ?')
        .bind(req!.id)
        .first<{ status: string }>();
      expect(row!.status).toBe('pending');
    });
  });

  describe('linkage table integrity', () => {
    it('trip_note_ai_jobs.request_id UNIQUE — 同 request_id 不能 INSERT 兩次', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'mig73-job-unique' });
      const req = await db
        .prepare(`INSERT INTO trip_requests (trip_id, message) VALUES (?, ?) RETURNING id`)
        .bind(tripId, '[trip-notes] unique test')
        .first<{ id: number }>();
      await db
        .prepare(`INSERT INTO trip_note_ai_jobs (request_id, trip_id, doc_type) VALUES (?, ?, ?)`)
        .bind(req!.id, tripId, 'tips')
        .run();
      await expect(
        db
          .prepare(`INSERT INTO trip_note_ai_jobs (request_id, trip_id, doc_type) VALUES (?, ?, ?)`)
          .bind(req!.id, tripId, 'emergency')
          .run(),
      ).rejects.toThrow();
    });
  });

  describe('FK CASCADE behavior', () => {
    it('刪 trip → 5 個 data table 都 CASCADE', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'mig73-cascade-trip' });
      // seed 1 row in each table
      await db.prepare(`INSERT INTO trip_flights (trip_id, airline) VALUES (?, ?)`).bind(tripId, 'CI').run();
      await db.prepare(`INSERT INTO trip_lodgings (trip_id, name) VALUES (?, ?)`).bind(tripId, 'Hotel').run();
      await db
        .prepare(`INSERT INTO trip_reservations (trip_id, kind, title) VALUES (?, ?, ?)`)
        .bind(tripId, 'restaurant', 'Soba')
        .run();
      await db
        .prepare(`INSERT INTO trip_pretrip_notes (trip_id, title, content) VALUES (?, ?, ?)`)
        .bind(tripId, '貨幣', 'TWD')
        .run();
      await db
        .prepare(`INSERT INTO trip_emergency_contacts (trip_id, kind, name) VALUES (?, ?, ?)`)
        .bind(tripId, 'embassy', 'TECO')
        .run();

      await db.prepare('DELETE FROM trips WHERE id = ?').bind(tripId).run();

      for (const t of [
        'trip_flights',
        'trip_lodgings',
        'trip_reservations',
        'trip_pretrip_notes',
        'trip_emergency_contacts',
      ]) {
        const row = await db
          .prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE trip_id = ?`)
          .bind(tripId)
          .first<{ n: number }>();
        expect(row!.n, `${t} 應該 CASCADE 刪除`).toBe(0);
      }
    });

    it('v2.34.44 migration 0074: trip_lodging_days junction — 刪 day 後 junction row CASCADE，lodging row 保留', async () => {
      // 從 migration 0074 起 trip_lodgings.day_id COLUMN 已被 DROP，改 trip_lodging_days junction。
      // 原 0073 SET NULL semantic 改為 junction CASCADE：刪 day 只清 junction，lodging row 保留。
      const { id: tripId } = await seedTrip(db, { id: 'mig73-lodging-setnull' });
      const day = await db
        .prepare('SELECT id FROM trip_days WHERE trip_id = ? ORDER BY day_num LIMIT 1')
        .bind(tripId)
        .first<{ id: number }>();
      const inserted = await db
        .prepare(`INSERT INTO trip_lodgings (trip_id, name) VALUES (?, ?) RETURNING id`)
        .bind(tripId, 'Naha Hotel')
        .first<{ id: number }>();
      await db
        .prepare(`INSERT INTO trip_lodging_days (lodging_id, day_id) VALUES (?, ?)`)
        .bind(inserted!.id, day!.id)
        .run();

      await db.prepare('DELETE FROM trip_days WHERE id = ?').bind(day!.id).run();

      const lodgingRow = await db
        .prepare('SELECT id FROM trip_lodgings WHERE trip_id = ?')
        .bind(tripId)
        .first<{ id: number }>();
      expect(lodgingRow, 'lodging row 應該還在').not.toBeNull();
      const junctionRow = await db
        .prepare('SELECT lodging_id FROM trip_lodging_days WHERE lodging_id = ?')
        .bind(inserted!.id)
        .first();
      expect(junctionRow, 'junction row 應被 CASCADE 清掉').toBeNull();
    });
  });
});
