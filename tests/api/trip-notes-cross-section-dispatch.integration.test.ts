/**
 * Integration test — v2.34.40 PR40 (PR35 P1 gap)
 *
 * trip-notes feature 4 個 section (lodgings/reservations/pretrip/emergency) 的
 * /[rowId] + /reorder + parent endpoint handler 雖然共用 _shared.ts，但 dispatch
 * 對應 table name 是否正確？trip-notes-mutations.integration.test.ts 只 cover
 * flights/* path，剩 4 section 等於沒驗 dispatch。
 *
 * Cross-section parametrized test：4 個 section × POST → row 進對應 table。
 * 避免 16 個重複 test，只驗 dispatch 正確性而非完整 CRUD（後者 _shared.ts 已測）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, mockAuth, seedUser, seedTrip, callHandler, jsonRequest } from './helpers';
import type { Env } from '../../functions/api/_types';

// Section handlers (parent POST)
import { onRequestPost as postLodgings } from '../../functions/api/trips/[id]/notes/lodgings';
import { onRequestPost as postReservations } from '../../functions/api/trips/[id]/notes/reservations';
import { onRequestPost as postPretrip } from '../../functions/api/trips/[id]/notes/pretrip';
import { onRequestPost as postEmergency } from '../../functions/api/trips/[id]/notes/emergency';

// /[rowId] handlers (PATCH + DELETE)
import { onRequestPatch as patchLodgingsRow, onRequestDelete as deleteLodgingsRow } from '../../functions/api/trips/[id]/notes/lodgings/[rowId]';
import { onRequestPatch as patchReservationsRow, onRequestDelete as deleteReservationsRow } from '../../functions/api/trips/[id]/notes/reservations/[rowId]';
import { onRequestPatch as patchPretripRow, onRequestDelete as deletePretripRow } from '../../functions/api/trips/[id]/notes/pretrip/[rowId]';
import { onRequestPatch as patchEmergencyRow, onRequestDelete as deleteEmergencyRow } from '../../functions/api/trips/[id]/notes/emergency/[rowId]';

// /reorder handlers
import { onRequestPatch as reorderLodgings } from '../../functions/api/trips/[id]/notes/lodgings/reorder';
import { onRequestPatch as reorderReservations } from '../../functions/api/trips/[id]/notes/reservations/reorder';
import { onRequestPatch as reorderPretrip } from '../../functions/api/trips/[id]/notes/pretrip/reorder';
import { onRequestPatch as reorderEmergency } from '../../functions/api/trips/[id]/notes/emergency/reorder';

let db: D1Database;
let env: Env;
const ownerEmail = 'owner-pr40@test.com';
const tripId = 'trip-pr40';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedUser(db, ownerEmail);
  await seedTrip(db, { id: tripId, owner: ownerEmail });
});

afterAll(disposeMiniflare);

interface Section {
  name: string;
  table: string;
  postHandler: any;
  patchHandler: any;
  deleteHandler: any;
  reorderHandler: any;
  sampleBody: Record<string, unknown>;
}

const SECTIONS: Section[] = [
  {
    name: 'lodgings',
    table: 'trip_lodgings',
    postHandler: postLodgings,
    patchHandler: patchLodgingsRow,
    deleteHandler: deleteLodgingsRow,
    reorderHandler: reorderLodgings,
    sampleBody: { name: 'PR40 飯店', address: '東京都' },
  },
  {
    name: 'reservations',
    table: 'trip_reservations',
    postHandler: postReservations,
    patchHandler: patchReservationsRow,
    deleteHandler: deleteReservationsRow,
    reorderHandler: reorderReservations,
    sampleBody: { title: 'PR40 訂位', kind: 'restaurant' },
  },
  {
    name: 'pretrip',
    table: 'trip_pretrip_notes',
    postHandler: postPretrip,
    patchHandler: patchPretripRow,
    deleteHandler: deletePretripRow,
    reorderHandler: reorderPretrip,
    sampleBody: { title: 'PR40 行前須知', content: 'test content', section: '一般' },
  },
  {
    name: 'emergency',
    table: 'trip_emergency_contacts',
    postHandler: postEmergency,
    patchHandler: patchEmergencyRow,
    deleteHandler: deleteEmergencyRow,
    reorderHandler: reorderEmergency,
    sampleBody: { name: 'PR40 急救', phone: '110', kind: 'police' },
  },
];

async function callPost(handler: any, body: Record<string, unknown>) {
  return callHandler(handler, mockContext({
    request: jsonRequest(`https://test/api/trips/${tripId}/notes/x`, 'POST', body),
    env,
    auth: mockAuth({ email: ownerEmail }),
    params: { id: tripId },
  }));
}

async function callPatch(handler: any, body: Record<string, unknown>, rowId: number) {
  return callHandler(handler, mockContext({
    request: jsonRequest(`https://test/api/trips/${tripId}/notes/x/${rowId}`, 'PATCH', body),
    env,
    auth: mockAuth({ email: ownerEmail }),
    params: { id: tripId, rowId: String(rowId) },
  }));
}

async function callDelete(handler: any, rowId: number) {
  return callHandler(handler, mockContext({
    request: jsonRequest(`https://test/api/trips/${tripId}/notes/x/${rowId}`, 'DELETE', undefined),
    env,
    auth: mockAuth({ email: ownerEmail }),
    params: { id: tripId, rowId: String(rowId) },
  }));
}

async function callReorder(handler: any, items: Array<{ id: number; sortOrder: number }>) {
  return callHandler(handler, mockContext({
    request: jsonRequest(`https://test/api/trips/${tripId}/notes/x/reorder`, 'PATCH', { items }),
    env,
    auth: mockAuth({ email: ownerEmail }),
    params: { id: tripId },
  }));
}

describe('PR40 — trip-notes cross-section dispatch (4 sections × 4 ops = 16 assertions)', () => {
  for (const sec of SECTIONS) {
    describe(`${sec.name} (${sec.table})`, () => {
      let createdRowId: number;

      it(`POST → 201 + row 進 ${sec.table}`, async () => {
        const res = await callPost(sec.postHandler, sec.sampleBody);
        expect(res.status).toBe(201);
        const row = await res.json() as { id: number };
        createdRowId = row.id;
        const found = await db.prepare(`SELECT id FROM ${sec.table} WHERE id = ?`).bind(row.id).first();
        expect(found).not.toBeNull();
      });

      it(`PATCH /[rowId] → 200 + version 加 1`, async () => {
        // 取出 version 改變前的值
        const before = await db.prepare(`SELECT version FROM ${sec.table} WHERE id = ?`).bind(createdRowId).first<{ version: number }>();
        // PATCH 用 section-specific 欄位（依 sampleBody 第一個 key）
        const firstKey = Object.keys(sec.sampleBody)[0];
        const res = await callPatch(sec.patchHandler, { [firstKey]: 'PR40 updated' }, createdRowId);
        expect(res.status).toBe(200);
        const after = await db.prepare(`SELECT version FROM ${sec.table} WHERE id = ?`).bind(createdRowId).first<{ version: number }>();
        expect(after!.version).toBe(before!.version + 1);
      });

      it(`PATCH /reorder → 200 + audit_log written`, async () => {
        const auditBefore = await db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE trip_id = ? AND table_name = ?`).bind(tripId, sec.table).first<{ n: number }>();
        const res = await callReorder(sec.reorderHandler, [{ id: createdRowId, sortOrder: 0 }]);
        expect(res.status).toBe(200);
        const auditAfter = await db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE trip_id = ? AND table_name = ?`).bind(tripId, sec.table).first<{ n: number }>();
        expect(auditAfter!.n).toBeGreaterThan(auditBefore!.n);
      });

      it(`DELETE /[rowId] → 200 + row 從 ${sec.table} 消失`, async () => {
        const res = await callDelete(sec.deleteHandler, createdRowId);
        expect(res.status).toBe(200);
        const found = await db.prepare(`SELECT id FROM ${sec.table} WHERE id = ?`).bind(createdRowId).first();
        expect(found).toBeNull();
      });
    });
  }
});
