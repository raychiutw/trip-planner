/**
 * Integration test — v2.34.32 PR32 audit_log coverage
 *
 * 4 個 mutation endpoint 補 logAudit：
 *   - POST /api/trips/:id/days → action='insert' + recordId=newDayId
 *   - POST /api/trips/:id/days/shift → action='update' + recordId=null + op:'shift'
 *   - POST /api/trips/:id/recompute-travel → action='update' + recordId=null + op:'recompute-travel'
 *   - POST /api/pois/:id/enrich → action='update' + recordId=poiId + op:'enrich'
 *
 * 對齊 entries / segments / trip-notes (PR26/27) 既有 pattern。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, mockAuth, seedTrip, callHandler, jsonRequest } from './helpers';
import { onRequestPost as postDays } from '../../functions/api/trips/[id]/days';
import { onRequestPost as postShift } from '../../functions/api/trips/[id]/days/shift';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
});

afterAll(disposeMiniflare);

async function fetchAuditRows(tripId: string, tableName: string) {
  const rs = await db
    .prepare(
      `SELECT action, table_name AS tableName, record_id AS recordId, changed_by AS changedBy, diff_json AS diffJson
       FROM audit_log WHERE trip_id = ? AND table_name = ? ORDER BY id ASC`,
    )
    .bind(tripId, tableName)
    .all<{ action: string; tableName: string; recordId: number | null; changedBy: string; diffJson: string }>();
  return rs.results ?? [];
}

describe('PR32 — POST /api/trips/:id/days 補 audit_log', () => {
  it('append 新天 → audit_log action=insert + recordId 為新 day id', async () => {
    const tripId = 'pr32-days-trip';
    await seedTrip(db, { id: tripId, days: 2 });
    const before = await fetchAuditRows(tripId, 'trip_days');

    const ctx = mockContext({
      request: jsonRequest(`https://t/api/trips/${tripId}/days`, 'POST', { position: 'end' }),
      env,
      auth: mockAuth(),
      params: { id: tripId },
    });
    const res = await callHandler(postDays, ctx);
    expect(res.status).toBe(200);

    const after = await fetchAuditRows(tripId, 'trip_days');
    expect(after.length).toBe(before.length + 1);
    const last = after[after.length - 1];
    expect(last.action).toBe('insert');
    expect(last.recordId).toBeGreaterThan(0);
    expect(last.diffJson).toContain('day_num');
  });
});

describe('PR32 — POST /api/trips/:id/days/shift 補 audit_log', () => {
  it('shift +3d → audit_log action=update + recordId=null + op:shift summary', async () => {
    const tripId = 'pr32-shift-trip';
    await seedTrip(db, { id: tripId, days: 3 });

    const ctx = mockContext({
      request: jsonRequest(`https://t/api/trips/${tripId}/days/shift`, 'POST', { startDate: '2026-04-04' }),
      env,
      auth: mockAuth(),
      params: { id: tripId },
    });
    const res = await callHandler(postShift, ctx);
    expect(res.status).toBe(200);

    const audits = await fetchAuditRows(tripId, 'trip_days');
    // 最新一筆應是 shift（之前可能有 POST insert 留下的，這裡找 op:shift）
    const shifts = audits.filter((a) => a.diffJson.includes('"op":"shift"'));
    expect(shifts.length).toBeGreaterThanOrEqual(1);
    const shiftAudit = shifts[shifts.length - 1];
    expect(shiftAudit.action).toBe('update');
    expect(shiftAudit.recordId).toBeNull();
    expect(shiftAudit.diffJson).toContain('"deltaDays":3');
    expect(shiftAudit.diffJson).toContain('"daysShifted":3');
  });

  it('shift delta=0 → 早 return 不寫 audit', async () => {
    const tripId = 'pr32-shift-noop';
    await seedTrip(db, { id: tripId, days: 2 });
    const before = await fetchAuditRows(tripId, 'trip_days');

    const ctx = mockContext({
      request: jsonRequest(`https://t/api/trips/${tripId}/days/shift`, 'POST', { startDate: '2026-04-01' }),
      env,
      auth: mockAuth(),
      params: { id: tripId },
    });
    const res = await callHandler(postShift, ctx);
    expect(res.status).toBe(200);

    const after = await fetchAuditRows(tripId, 'trip_days');
    expect(after.length).toBe(before.length); // delta=0 早 return 不寫 audit
  });
});

describe('PR32 — source-grep regression: 4 endpoint 都 import logAudit', () => {
  it('days.ts / days/shift.ts / recompute-travel.ts / pois/[id]/enrich.ts 都 import + call logAudit', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const ROOT = join(__dirname, '..', '..');
    const FILES = [
      'functions/api/trips/[id]/days.ts',
      'functions/api/trips/[id]/days/shift.ts',
      'functions/api/trips/[id]/recompute-travel.ts',
      'functions/api/pois/[id]/enrich.ts',
    ];
    for (const rel of FILES) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(src, `${rel} 應 import logAudit`).toMatch(/import\s+\{[^}]*logAudit/);
      expect(src, `${rel} 應 call logAudit`).toMatch(/await\s+logAudit\(/);
    }
  });
});
