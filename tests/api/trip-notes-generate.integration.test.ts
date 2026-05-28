/**
 * Integration tests — POST /api/trips/:id/notes/:type/generate (v2.34.x 行程筆記 PR9)
 *
 * Covers:
 *   - 3 valid types create job + request linkage
 *   - Invalid type → 400
 *   - PERM_DENIED for non-authorized user
 *   - Debounce — 30s 內同 trip+type pending → return existing job (no double request)
 *   - trip_requests.message 含對應 prefix [行程筆記-{type}]
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { callHandler, jsonRequest, mockAuth, mockContext, mockEnv, seedTrip, seedUser } from './helpers';
import { onRequestPost as postGenerate } from '../../functions/api/trips/[id]/notes/[type]/generate';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
const tripA = 'trip-gen-a';
const tripB = 'trip-gen-b';
const ownerEmail = 'owner@gen.test';
const strangerEmail = 'stranger@gen.test';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedUser(db, ownerEmail);
  await seedUser(db, strangerEmail);
  await seedTrip(db, { id: tripA, owner: ownerEmail });
  await seedTrip(db, { id: tripB, owner: ownerEmail });
});

afterAll(disposeMiniflare);

async function callGen(tripId: string, type: string, email = ownerEmail) {
  const ctx = mockContext({
    request: jsonRequest(`https://test/api/trips/${tripId}/notes/${type}/generate`, 'POST', {}),
    env,
    auth: mockAuth({ email }),
    params: { id: tripId, type },
  });
  return callHandler(postGenerate, ctx);
}

describe('POST /api/trips/:id/notes/:type/generate', () => {
  for (const type of ['lodging-tips', 'tips', 'emergency']) {
    it(`type=${type} → 202 + jobId + requestId + status=pending`, async () => {
      const res = await callGen(tripA, type);
      expect(res.status).toBe(202);
      const body = await res.json() as any;
      expect(body.tripId).toBe(tripA);
      expect(body.docType).toBe(type);
      expect(body.status).toBe('pending');
      expect(typeof body.jobId).toBe('number');
      expect(typeof body.requestId).toBe('number');
    });
  }

  it('invalid type → 400 DATA_VALIDATION', async () => {
    const res = await callGen(tripA, 'invalid-type');
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('DATA_VALIDATION');
  });

  it('PERM_DENIED 對非授權 user', async () => {
    const res = await callGen(tripA, 'tips', strangerEmail);
    expect(res.status).toBe(403);
  });

  it('trip_requests.message 含 [行程筆記-{type}] prefix', async () => {
    const res = await callGen(tripB, 'lodging-tips');
    expect(res.status).toBe(202);
    const body = await res.json() as any;
    const row = await db
      .prepare('SELECT message FROM trip_requests WHERE id = ?')
      .bind(body.requestId)
      .first<{ message: string }>();
    expect(row!.message.startsWith('[行程筆記-lodging-tips]')).toBe(true);
  });

  it('trip_note_ai_jobs linkage row created with correct doc_type', async () => {
    const res = await callGen(tripB, 'emergency');
    const body = await res.json() as any;
    const row = await db
      .prepare('SELECT * FROM trip_note_ai_jobs WHERE id = ?')
      .bind(body.jobId)
      .first<{ request_id: number; trip_id: string; doc_type: string; status: string; inserted_count: number }>();
    expect(row!.request_id).toBe(body.requestId);
    expect(row!.trip_id).toBe(tripB);
    expect(row!.doc_type).toBe('emergency');
    expect(row!.status).toBe('pending');
    expect(row!.inserted_count).toBe(0);
  });

  it('debounce — 30s 內第二次同 trip+type 返回 existing job', async () => {
    const first = await callGen(tripB, 'tips');
    const firstBody = await first.json() as any;
    const second = await callGen(tripB, 'tips');
    expect(second.status).toBe(200); // 不是 202 — 已存在的 job
    const secondBody = await second.json() as any;
    expect(secondBody.jobId).toBe(firstBody.jobId);
    expect(secondBody.requestId).toBe(firstBody.requestId);
  });
});
