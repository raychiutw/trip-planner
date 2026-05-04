// @vitest-environment node
/**
 * Migration 0050 — companion_request_actions table verify
 *
 * 對映 specs/poi-favorites/spec.md Requirement: companion_request_actions 防灌爆 table
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { seedTrip, seedPoi, seedUser } from '../api/helpers';

describe('migration 0050 — companion_request_actions schema', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(disposeMiniflare);

  it('table 存在 + 5 columns', async () => {
    const { results } = await db.prepare(
      "PRAGMA table_info('companion_request_actions')",
    ).all();
    const columns = results.map((r) => (r as { name: string }).name).sort();
    expect(columns).toEqual(['action', 'created_at', 'id', 'poi_id', 'request_id']);
  });

  it('action CHECK constraint 限定三個值', async () => {
    await seedUser(db, 'tester@test.com');
    const { id: tripId } = await seedTrip(db, { id: 'trip-companion-test', owner: 'tester@test.com' });
    const reqRow = await db
      .prepare(
        'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
      )
      .bind(tripId, 'test', 'tester@test.com', 'processing')
      .first<{ id: number }>();
    const requestId = reqRow!.id;

    // valid action
    await expect(
      db.prepare(
        'INSERT INTO companion_request_actions (request_id, action) VALUES (?, ?)',
      ).bind(requestId, 'favorite_create').run(),
    ).resolves.toBeDefined();

    // invalid action 應違反 CHECK
    await expect(
      db.prepare(
        'INSERT INTO companion_request_actions (request_id, action) VALUES (?, ?)',
      ).bind(requestId, 'evil_action').run(),
    ).rejects.toThrow();
  });

  it('UNIQUE (request_id, action) 防同 requestId 同 action 重寫', async () => {
    await seedUser(db, 'unique-test@test.com');
    const { id: tripId } = await seedTrip(db, {
      id: 'trip-companion-unique', owner: 'unique-test@test.com',
    });
    const reqRow = await db
      .prepare(
        'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
      )
      .bind(tripId, 'unique', 'unique-test@test.com', 'processing')
      .first<{ id: number }>();
    const requestId = reqRow!.id;

    // 第一次 favorite_create OK
    await db.prepare(
      'INSERT INTO companion_request_actions (request_id, action, poi_id) VALUES (?, ?, ?)',
    ).bind(requestId, 'favorite_create', null).run();

    // 第二次同 (request_id, action) 應違反 UNIQUE
    await expect(
      db.prepare(
        'INSERT INTO companion_request_actions (request_id, action, poi_id) VALUES (?, ?, ?)',
      ).bind(requestId, 'favorite_create', null).run(),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('同 request_id 不同 action 允許共存', async () => {
    await seedUser(db, 'multi-action@test.com');
    const { id: tripId } = await seedTrip(db, {
      id: 'trip-companion-multi', owner: 'multi-action@test.com',
    });
    const reqRow = await db
      .prepare(
        'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
      )
      .bind(tripId, 'multi', 'multi-action@test.com', 'processing')
      .first<{ id: number }>();
    const requestId = reqRow!.id;

    await db.prepare(
      'INSERT INTO companion_request_actions (request_id, action) VALUES (?, ?)',
    ).bind(requestId, 'favorite_create').run();

    // 不同 action 不違反 UNIQUE
    await expect(
      db.prepare(
        'INSERT INTO companion_request_actions (request_id, action) VALUES (?, ?)',
      ).bind(requestId, 'add_to_trip').run(),
    ).resolves.toBeDefined();
  });

  it('FK request_id ON DELETE CASCADE', async () => {
    const { results: fks } = await db.prepare(
      "PRAGMA foreign_key_list('companion_request_actions')",
    ).all();
    const reqFk = fks.find((r) => (r as { from: string }).from === 'request_id') as
      | { table: string; on_delete: string }
      | undefined;
    expect(reqFk).toBeDefined();
    expect(reqFk!.table).toBe('trip_requests');
    expect(reqFk!.on_delete).toBe('CASCADE');
  });
});
