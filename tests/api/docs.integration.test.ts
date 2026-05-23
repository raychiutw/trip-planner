/**
 * Integration test — GET/PUT /api/trips/:id/docs/:type
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip , callHandler } from './helpers';
import { onRequestGet, onRequestPut } from '../../functions/api/trips/[id]/docs/[type]';
import { onRequestGet as onRequestGetBatch } from '../../functions/api/trips/[id]/docs/index';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-docs' });
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/docs/:type', () => {
  it('不存在 → 404', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-docs/docs/flights'),
      env,
      params: { id: 'trip-docs', type: 'flights' },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(404);
  });
});

describe('PUT /api/trips/:id/docs/:type', () => {
  it('建立/更新文件 → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-docs/docs/flights', 'PUT', {
        content: '# Flight Info\nCI123',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-docs', type: 'flights' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(200);

    // 驗證可以讀取（新格式：{ docType, title, entries }）
    const getCtx = mockContext({
      request: new Request('https://test.com/api/trips/trip-docs/docs/flights'),
      env,
      params: { id: 'trip-docs', type: 'flights' },
    });
    const getResp = await callHandler(onRequestGet, getCtx);
    expect(getResp.status).toBe(200);
    const data = await getResp.json() as { docType: string; title: string; entries: { content: string }[] };
    expect(data.docType).toBe('flights');
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].content).toContain('CI123');
  });

  it('新格式 entries → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-docs/docs/checklist', 'PUT', {
        title: '出發清單',
        entries: [
          { section: '證件', title: '護照', content: '' },
          { section: '證件', title: '簽證', content: '' },
          { section: '電子票', title: '機票 QR', content: '' },
        ],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-docs', type: 'checklist' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(200);

    const getCtx = mockContext({
      request: new Request('https://test.com/api/trips/trip-docs/docs/checklist'),
      env,
      params: { id: 'trip-docs', type: 'checklist' },
    });
    const getResp = await callHandler(onRequestGet, getCtx);
    expect(getResp.status).toBe(200);
    const data = await getResp.json() as { docType: string; title: string; entries: { section: string; title: string }[] };
    expect(data.title).toBe('出發清單');
    expect(data.entries).toHaveLength(3);
    expect(data.entries[0].section).toBe('證件');
    expect(data.entries[2].title).toBe('機票 QR');
  });

  it('無效 type → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-docs/docs/invalid', 'PUT', { content: 'x' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-docs', type: 'invalid' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(400);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-docs/docs/flights', 'PUT', { content: 'x' }),
      env,
      params: { id: 'trip-docs', type: 'flights' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(401);
  });
});

describe('GET /api/trips/:id/docs (v2.33.35 PR-8 batch endpoint)', () => {
  it('回 5 個 doc key + 存在的 doc 含 entries、不存在的為 null', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-docs/docs'),
      env,
      params: { id: 'trip-docs' },
    });
    const resp = await callHandler(onRequestGetBatch, ctx);
    expect(resp.status).toBe(200);
    // 注意：`json()` helper 走 deepCamel，所以 doc_type/updated_at → docType/updatedAt
    const data = (await resp.json()) as {
      docs: Record<string, { docType: string; title: string; entries: unknown[] } | null>;
    };

    expect(Object.keys(data.docs).sort()).toEqual(
      ['backup', 'checklist', 'emergency', 'flights', 'suggestions'].sort(),
    );

    // flights + checklist 在 PUT test 已建立
    expect(data.docs.flights).not.toBeNull();
    expect(data.docs.flights!.docType).toBe('flights');
    expect(data.docs.flights!.entries.length).toBeGreaterThan(0);

    expect(data.docs.checklist).not.toBeNull();
    expect(data.docs.checklist!.title).toBe('出發清單');
    expect(data.docs.checklist!.entries).toHaveLength(3);

    // backup/suggestions/emergency 沒建 → null
    expect(data.docs.backup).toBeNull();
    expect(data.docs.suggestions).toBeNull();
    expect(data.docs.emergency).toBeNull();
  });

  it('trip 沒任何 doc → 5 個 key 全 null', async () => {
    await seedTrip(db, { id: 'trip-empty-docs' });
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-empty-docs/docs'),
      env,
      params: { id: 'trip-empty-docs' },
    });
    const resp = await callHandler(onRequestGetBatch, ctx);
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as { docs: Record<string, unknown> };
    for (const key of ['flights', 'checklist', 'backup', 'suggestions', 'emergency']) {
      expect(data.docs[key]).toBeNull();
    }
  });
});
