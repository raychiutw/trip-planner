/**
 * Integration tests — applyNotesGenerationCompletion hook into PATCH /api/requests/:id
 *
 * v2.34.x 行程筆記 PR10. Verify:
 *   - PATCH /requests/:id status=completed + linkage exists → INSERT rows in target table
 *   - PATCH status=failed → UPDATE trip_note_ai_jobs.status=failed + error_message
 *   - Dedup: existing title/name skipped
 *   - PATCH /requests/:id without notes linkage → no side effect (chat still works)
 *   - lodging-tips → ai_source='lodging-tips' in trip_pretrip_notes
 *   - tips → ai_source='general-tips' (different from lodging-tips!)
 *   - emergency → trip_emergency_contacts with kind narrowed
 *   - trip_requests.reply rewritten to user-friendly summary
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { callHandler, jsonRequest, mockContext, mockEnv, mockServiceAuth, seedTrip, seedUser } from './helpers';
import { onRequestPatch } from '../../functions/api/requests/[id]/index';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
const tripId = 'trip-hook-a';
const ownerEmail = 'owner@hook.test';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedUser(db, ownerEmail);
  await seedTrip(db, { id: tripId, owner: ownerEmail });
});

afterAll(disposeMiniflare);

async function createJobAndRequest(docType: 'lodging-tips' | 'tips' | 'emergency'): Promise<{ requestId: number; jobId: number }> {
  const req = await db
    .prepare('INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?) RETURNING id')
    .bind(tripId, `[行程筆記-${docType}] test`, ownerEmail)
    .first<{ id: number }>();
  const job = await db
    .prepare('INSERT INTO trip_note_ai_jobs (request_id, trip_id, doc_type) VALUES (?, ?, ?) RETURNING id')
    .bind(req!.id, tripId, docType)
    .first<{ id: number }>();
  return { requestId: req!.id, jobId: job!.id };
}

async function callPatch(requestId: number, body: Record<string, unknown>) {
  const ctx = mockContext({
    request: jsonRequest(`https://test/api/requests/${requestId}`, 'PATCH', body),
    env,
    // Phase 3：PATCH /requests/:id 由帶 companion scope 的 service token 執行（Claude CLI）
    auth: mockServiceAuth(),
    params: { id: String(requestId) },
  });
  return callHandler(onRequestPatch, ctx);
}

describe('PATCH /requests/:id — notes generation completion hook', () => {
  describe('docType=lodging-tips', () => {
    it('完成 → INSERT trip_pretrip_notes ai_source=lodging-tips', async () => {
      const { requestId, jobId } = await createJobAndRequest('lodging-tips');
      const reply = JSON.stringify([
        { title: '飯店早餐', content: '7:00-10:00', section: '住宿在地' },
        { title: '附近便利店', content: '步行 3 分', section: '住宿在地' },
      ]);
      const res = await callPatch(requestId, { status: 'completed', reply });
      expect(res.status).toBe(200);
      const job = await db.prepare('SELECT status, inserted_count FROM trip_note_ai_jobs WHERE id = ?').bind(jobId).first<{ status: string; inserted_count: number }>();
      expect(job!.status).toBe('completed');
      expect(job!.inserted_count).toBe(2);
      const rows = await db.prepare(`SELECT title, ai_source, ai_generated FROM trip_pretrip_notes WHERE trip_id = ? AND ai_source = 'lodging-tips'`).bind(tripId).all<{ title: string; ai_source: string; ai_generated: number }>();
      expect(rows.results!.length).toBe(2);
      expect(rows.results!.every((r) => r.ai_generated === 1)).toBe(true);
    });
  });

  describe('docType=tips', () => {
    it('完成 → INSERT trip_pretrip_notes ai_source=general-tips (區分 lodging-tips)', async () => {
      const { requestId } = await createJobAndRequest('tips');
      const reply = JSON.stringify([
        { title: '貨幣', content: 'TWD ≈ 4.8 JPY', section: '貨幣' },
        { title: '插頭', content: 'A 型 110V', section: '電子設備' },
      ]);
      await callPatch(requestId, { status: 'completed', reply });
      const rows = await db.prepare(`SELECT title, ai_source FROM trip_pretrip_notes WHERE trip_id = ? AND ai_source = 'general-tips'`).bind(tripId).all<{ title: string; ai_source: string }>();
      expect(rows.results!.length).toBeGreaterThanOrEqual(2);
      // 確認區分：lodging-tips 仍存在
      const all = await db.prepare(`SELECT COUNT(*) AS n FROM trip_pretrip_notes WHERE trip_id = ?`).bind(tripId).first<{ n: number }>();
      expect(all!.n).toBeGreaterThanOrEqual(4); // 2 lodging-tips + 2 tips
    });
  });

  describe('docType=emergency', () => {
    it('完成 → INSERT trip_emergency_contacts with kind narrowed', async () => {
      const { requestId, jobId } = await createJobAndRequest('emergency');
      const reply = JSON.stringify([
        { name: '日本警察', phone: '110', kind: 'police', relationship: '報案' },
        { name: '駐那霸經文辦', phone: '+81988628603', kind: 'embassy' },
        { name: 'Invalid kind', phone: '12345', kind: 'unknown-kind' }, // → 'other'
      ]);
      await callPatch(requestId, { status: 'completed', reply });
      const job = await db.prepare('SELECT status, inserted_count FROM trip_note_ai_jobs WHERE id = ?').bind(jobId).first<{ status: string; inserted_count: number }>();
      expect(job!.status).toBe('completed');
      expect(job!.inserted_count).toBe(3);
      const invalid = await db.prepare(`SELECT kind FROM trip_emergency_contacts WHERE name = 'Invalid kind' AND trip_id = ?`).bind(tripId).first<{ kind: string }>();
      expect(invalid!.kind).toBe('other');
    });
  });

  describe('dedup', () => {
    it('既有 title 重複 → skip 不 INSERT', async () => {
      const { requestId, jobId } = await createJobAndRequest('tips');
      // Reply includes '貨幣' which already exists from earlier test
      const reply = JSON.stringify([
        { title: '貨幣', content: 'duplicate', section: 'X' },
        { title: '新項目 unique', content: 'fresh', section: 'X' },
      ]);
      await callPatch(requestId, { status: 'completed', reply });
      const job = await db.prepare('SELECT inserted_count FROM trip_note_ai_jobs WHERE id = ?').bind(jobId).first<{ inserted_count: number }>();
      expect(job!.inserted_count).toBe(1); // 只 1 個新 (貨幣 dedup skip)
    });
  });

  describe('failed status', () => {
    it('PATCH failed → UPDATE trip_note_ai_jobs.status=failed + error_message', async () => {
      const { requestId, jobId } = await createJobAndRequest('emergency');
      await callPatch(requestId, { status: 'failed', reply: 'AI service timeout' });
      const job = await db.prepare('SELECT status, error_message FROM trip_note_ai_jobs WHERE id = ?').bind(jobId).first<{ status: string; error_message: string | null }>();
      expect(job!.status).toBe('failed');
      expect(job!.error_message).toContain('timeout');
    });
  });

  describe('no linkage row', () => {
    it('PATCH without trip_note_ai_jobs linkage → no side effect (chat reply still works)', async () => {
      const req = await db
        .prepare('INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?) RETURNING id')
        .bind(tripId, 'plain chat message', ownerEmail)
        .first<{ id: number }>();
      const res = await callPatch(req!.id, { status: 'completed', reply: 'just a reply' });
      expect(res.status).toBe(200);
      // No trip_note_ai_jobs row created since none linked
      const job = await db.prepare('SELECT id FROM trip_note_ai_jobs WHERE request_id = ?').bind(req!.id).first();
      expect(job).toBeNull();
    });
  });

  describe('reply rewritten', () => {
    it('完成後 trip_requests.reply 改成 user-friendly summary', async () => {
      const { requestId } = await createJobAndRequest('emergency');
      const reply = JSON.stringify([{ name: '新警察', phone: '999', kind: 'police' }]);
      await callPatch(requestId, { status: 'completed', reply });
      const row = await db.prepare('SELECT reply FROM trip_requests WHERE id = ?').bind(requestId).first<{ reply: string }>();
      expect(row!.reply).toContain('AI 生成完成');
      expect(row!.reply).toContain('[前往行程筆記');
      expect(row!.reply).not.toContain('"phone"'); // raw JSON not surfaced
    });
  });

  // PR27 — AI-driven INSERT 補 audit_log
  describe('PR27 audit_log on AI insert', () => {
    async function fetchAudit(tableName: string, requestId: number) {
      const rs = await db
        .prepare(
          `SELECT action, changed_by AS changedBy, request_id AS requestId, diff_json AS diffJson, record_id AS recordId
           FROM audit_log WHERE trip_id = ? AND table_name = ? AND request_id = ? ORDER BY id ASC`,
        )
        .bind(tripId, tableName, requestId)
        .all<{ action: string; changedBy: string; requestId: number; diffJson: string; recordId: number }>();
      return rs.results ?? [];
    }

    it('lodging-tips AI insert → audit_log action=insert + changedBy=ai:<submitted_by>', async () => {
      const { requestId } = await createJobAndRequest('lodging-tips');
      const reply = JSON.stringify([{ title: 'AI lodging tip', content: 'foo', section: '住宿在地' }]);
      await callPatch(requestId, { status: 'completed', reply });

      const rows = await fetchAudit('trip_pretrip_notes', requestId);
      expect(rows.length).toBe(1);
      expect(rows[0].action).toBe('insert');
      expect(rows[0].changedBy).toBe(`ai:${ownerEmail}`);
      expect(rows[0].requestId).toBe(requestId);
      expect(rows[0].diffJson).toContain('AI lodging tip');
      expect(rows[0].recordId).toBeGreaterThan(0);
    });

    it('emergency AI insert → audit_log per row', async () => {
      const { requestId } = await createJobAndRequest('emergency');
      const reply = JSON.stringify([
        { name: 'PR27 警察局', phone: '110', kind: 'police' },
        { name: 'PR27 醫院', phone: '119', kind: 'medical' },
      ]);
      await callPatch(requestId, { status: 'completed', reply });

      const rows = await fetchAudit('trip_emergency_contacts', requestId);
      expect(rows.length).toBe(2);
      expect(rows.every((r) => r.action === 'insert')).toBe(true);
      expect(rows.every((r) => r.changedBy === `ai:${ownerEmail}`)).toBe(true);
      const joined = rows.map((r) => r.diffJson).join('|');
      expect(joined).toContain('PR27 警察局');
      expect(joined).toContain('PR27 醫院');
    });

    it('submitted_by NULL → changedBy=system:ai fallback', async () => {
      const req = await db
        .prepare('INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, NULL) RETURNING id')
        .bind(tripId, '[行程筆記-tips] sysai test')
        .first<{ id: number }>();
      await db
        .prepare('INSERT INTO trip_note_ai_jobs (request_id, trip_id, doc_type) VALUES (?, ?, ?)')
        .bind(req!.id, tripId, 'tips')
        .run();
      const reply = JSON.stringify([{ title: 'sysai tip', content: 'x', section: '一般' }]);
      await callPatch(req!.id, { status: 'completed', reply });

      const rows = await fetchAudit('trip_pretrip_notes', req!.id);
      expect(rows.length).toBe(1);
      expect(rows[0].changedBy).toBe('system:ai');
    });

    it('failed status → 不寫 audit_log（沒 INSERT 就沒記錄）', async () => {
      const { requestId } = await createJobAndRequest('lodging-tips');
      await callPatch(requestId, { status: 'failed', reply: 'Claude timeout' });

      const rows = await fetchAudit('trip_pretrip_notes', requestId);
      expect(rows.length).toBe(0);
    });
  });
});
