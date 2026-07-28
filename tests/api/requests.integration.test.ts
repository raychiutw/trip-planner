/**
 * Integration test — GET/POST /api/requests + PATCH /api/requests/:id
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockServiceAuth, mockContext, jsonRequest, seedTrip , callHandler } from './helpers';
import { onRequestGet, onRequestPost } from '../../functions/api/requests';
import { onRequestPatch, onRequestGet as onRequestGetOne } from '../../functions/api/requests/[id]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let requestId: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-req' });
});

afterAll(disposeMiniflare);

describe('POST /api/requests', () => {
  it('建立請求 → 201', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/requests', 'POST', {
        tripId: 'trip-req',
        mode: 'trip-edit',
        message: '請幫我加一間餐廳',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as Record<string, unknown>;
    requestId = data.id as number;
    expect(data.status).toBe('open');
  });

  it('mode rip-out phase 2: response shape 不含 mode (migration 0049 DROP COLUMN)', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/requests', 'POST', {
        tripId: 'trip-req', message: '幫我推薦景點',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as Record<string, unknown>;
    expect(data).not.toHaveProperty('mode');
  });

  it('缺 message → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/requests', 'POST', {
        tripId: 'trip-req',
      }),
      env,
      auth: mockAuth(),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/requests', 'POST', {
        tripId: 'trip-req', mode: 'trip-edit', message: 'hi',
      }),
      env,
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(401);
  });

  // 30 秒去重只擋「仍在跑」的請求；終結狀態不得遮蔽合法重送（adversarial F1）。
  it('dedupe 仍擋 30 秒內重複的 open 請求（同訊息雙擊 → 200 回同一筆）', async () => {
    const msg = '幫我找拉麵店';
    const auth = mockAuth({ email: 'user@test.com' }); // trip-req owner（有寫權）
    const mk = () => mockContext({
      request: jsonRequest('https://test.com/api/requests', 'POST', { tripId: 'trip-req', message: msg }),
      env, auth,
    });
    const a = await callHandler(onRequestPost, mk());
    expect(a.status).toBe(201);
    const aId = (await a.json() as Record<string, unknown>).id;
    const b = await callHandler(onRequestPost, mk());
    expect(b.status).toBe(200); // dedupe：回同一筆 open
    expect((await b.json() as Record<string, unknown>).id).toBe(aId);
  });

  it('park 成 failed 的請求不遮蔽合法重送 → 建新 open 請求（adversarial F1 回歸）', async () => {
    const msg = '幫我排三天兩夜溫泉';
    const auth = mockAuth({ email: 'user@test.com' }); // trip-req owner（有寫權）
    const mk = () => mockContext({
      request: jsonRequest('https://test.com/api/requests', 'POST', { tripId: 'trip-req', message: msg }),
      env, auth,
    });
    // 1. 首次送出 → open 請求
    const first = await callHandler(onRequestPost, mk());
    expect(first.status).toBe(201);
    const firstId = (await first.json() as Record<string, unknown>).id as number;
    // 2. 模擬 mint-restricted 未授權 park：標成 failed
    await db.prepare("UPDATE trip_requests SET status = 'failed' WHERE id = ?").bind(firstId).run();
    // 3. 授權後重送同一訊息（30 秒內）→ 不得 dedupe 回 failed，要建新的 open 請求
    const resend = await callHandler(onRequestPost, mk());
    expect(resend.status).toBe(201); // 非 200 dedupe 回舊 failed
    const resendData = await resend.json() as Record<string, unknown>;
    expect(resendData.id).not.toBe(firstId);
    expect(resendData.status).toBe('open');
  });
});

describe('GET /api/requests', () => {
  it('列出請求', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/requests?tripId=trip-req'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/requests?tripId=trip-req'),
      env,
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(401);
  });
});

describe('PATCH /api/requests/:id', () => {
  it('service token（companion scope）回覆請求 → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${requestId}`, 'PATCH', {
        reply: '已新增餐廳',
        status: 'completed',
      }),
      env,
      auth: mockServiceAuth(),
      params: { id: String(requestId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('completed');
  });

  it('sanitizeReply 過濾敏感內容', async () => {
    // 先建一個新請求
    await db.prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?)'
    ).bind('trip-req', 'test', 'user@test.com').run();
    const row = await db.prepare('SELECT id FROM trip_requests ORDER BY id DESC LIMIT 1').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${row!.id}`, 'PATCH', {
        reply: '請用 /api/trips 端點操作',
        status: 'completed',
      }),
      env,
      auth: mockServiceAuth(),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.reply).toBe('已處理您的請求。如有問題請直接聯繫行程主人。');
  });

  // v2.55.56: PATCH gate 放寬成 companion service token OR 對該 trip 有寫權的 user
  // （restrict_trip-scoped tp-request agent 回覆自己 trip 的請求；status/reply 也吃 trip scope）。
  it('trip owner（有寫權 user，無 companion scope）回覆自己 trip 的請求 → 200', async () => {
    // seedTrip 給 user@test.com owner role → hasWritePermission(trip-req) 為真
    await db.prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?)'
    ).bind('trip-req', 'owner 回覆測試', 'user@test.com').run();
    const row = await db.prepare(
      'SELECT id FROM trip_requests WHERE message = ? ORDER BY id DESC LIMIT 1'
    ).bind('owner 回覆測試').first<{ id: number }>();
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${row!.id}`, 'PATCH', { reply: '好的，已處理' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: String(row!.id) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
  });

  it('無寫權 user（非 companion、非該 trip 成員）→ 403', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${requestId}`, 'PATCH', { status: 'completed' }),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: String(requestId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(403);
  });

  // v2.33.104 T-5：status 推進 monotonicity — 不可從 completed 回退到 open/processing
  describe('status monotonicity (T-5)', () => {
    let monoReqId: number;

    beforeAll(async () => {
      await db.prepare(
        'INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?)'
      ).bind('trip-req', '監測 monotonicity', 'user@test.com').run();
      const row = await db.prepare(
        'SELECT id FROM trip_requests WHERE message = ? ORDER BY id DESC LIMIT 1'
      ).bind('監測 monotonicity').first<{ id: number }>();
      monoReqId = row!.id;
    });

    it('open → completed 允許', async () => {
      const ctx = mockContext({
        request: jsonRequest(`https://test.com/api/requests/${monoReqId}`, 'PATCH', { status: 'completed' }),
        env,
        auth: mockServiceAuth(),
        params: { id: String(monoReqId) },
      });
      expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    });

    it('completed → open 拒絕 400', async () => {
      const ctx = mockContext({
        request: jsonRequest(`https://test.com/api/requests/${monoReqId}`, 'PATCH', { status: 'open' }),
        env,
        auth: mockServiceAuth(),
        params: { id: String(monoReqId) },
      });
      const resp = await callHandler(onRequestPatch, ctx);
      expect(resp.status).toBe(400);
      const data = await resp.json() as { error?: { message?: string } };
      expect(JSON.stringify(data)).toContain('不可從');
    });

    it('completed → processing 拒絕 400', async () => {
      const ctx = mockContext({
        request: jsonRequest(`https://test.com/api/requests/${monoReqId}`, 'PATCH', { status: 'processing' }),
        env,
        auth: mockServiceAuth(),
        params: { id: String(monoReqId) },
      });
      expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
    });

    it('completed → failed 允許（failed 任何狀態都可標記）', async () => {
      const ctx = mockContext({
        request: jsonRequest(`https://test.com/api/requests/${monoReqId}`, 'PATCH', { status: 'failed' }),
        env,
        auth: mockServiceAuth(),
        params: { id: String(monoReqId) },
      });
      expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    });

    it('未知 status value 拒絕 400', async () => {
      const ctx = mockContext({
        request: jsonRequest(`https://test.com/api/requests/${monoReqId}`, 'PATCH', { status: 'invalid' }),
        env,
        auth: mockServiceAuth(),
        params: { id: String(monoReqId) },
      });
      expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
    });
  });
});

// ADR-0007：終結原因獨立成欄。status 說「結束了沒」，terminal_reason 說「為什麼」。
describe('終結原因 terminal_reason (ADR-0007)', () => {
  async function newRequest(message: string): Promise<number> {
    await db.prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?)'
    ).bind('trip-req', message, 'user@test.com').run();
    const row = await db.prepare(
      'SELECT id FROM trip_requests WHERE message = ? ORDER BY id DESC LIMIT 1'
    ).bind(message).first<{ id: number }>();
    return row!.id;
  }

  function patch(id: number, body: Record<string, unknown>) {
    return mockContext({
      request: jsonRequest(`https://test.com/api/requests/${id}`, 'PATCH', body),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: String(id) },
    });
  }

  it('停止等待：標 failed + cancelled → 200，回傳帶 terminalReason', async () => {
    const id = await newRequest('停止等待測試');
    const resp = await callHandler(onRequestPatch, patch(id, {
      status: 'failed',
      terminalReason: 'cancelled',
    }));
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('failed');
    expect(data.terminalReason).toBe('cancelled');
  });

  // 取消不會叫停 worker（entries/days 走 owner 身份 token，不受 companion gate 約束）。
  // 它做完仍會回報 —— 那份交代必須寫得進來，否則使用者只看到行程被改、零說明。
  it('遲到完成：終結後 worker 回報 → reply 寫得進來，status 不復活', async () => {
    const id = await newRequest('遲到完成測試');
    await callHandler(onRequestPatch, patch(id, { status: 'failed', terminalReason: 'cancelled' }));

    const resp = await callHandler(onRequestPatch, patch(id, {
      status: 'completed',
      reply: '已加入沖繩美麗海水族館',
    }));
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('failed');
    expect(data.terminalReason).toBe('cancelled');
    expect(data.reply).toContain('美麗海水族館');
  });

  it('遲到完成只送 status（無 reply）→ 200 no-op，不是「沒有要更新的欄位」', async () => {
    const id = await newRequest('遲到完成純 status');
    await callHandler(onRequestPatch, patch(id, { status: 'failed', terminalReason: 'timed_out' }));

    const resp = await callHandler(onRequestPatch, patch(id, { status: 'completed' }));
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('failed');
    expect(data.terminalReason).toBe('timed_out');
  });

  it('未知 terminalReason 拒絕 400', async () => {
    const id = await newRequest('未知終結原因');
    const resp = await callHandler(onRequestPatch, patch(id, {
      status: 'failed',
      terminalReason: 'because-i-said-so',
    }));
    expect(resp.status).toBe(400);
  });
});

// ADR-0007 第二層：牆鐘兜底。api-server 自己掛掉／mac mini 離線時沒人收屍，
// 由有人在打的 read path 就地收。100 分鐘 > ORPHAN_MAX_AGE_MS(90min)，健康 session
// 還在工作時絕不會被標終結（短於它就重演 #237）。
describe('牆鐘收屍 (ADR-0007)', () => {
  function getOne(id: number) {
    return mockContext({
      request: new Request(`https://test.com/api/requests/${id}`),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: String(id) },
    });
  }

  async function seedAged(message: string, status: string, minutesAgo: number, useUpdatedAt: boolean): Promise<number> {
    await db.prepare(
      `INSERT INTO trip_requests (trip_id, message, submitted_by, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now', ?), ?)`
    ).bind(
      'trip-req', message, 'user@test.com', status,
      `-${minutesAgo} minutes`,
      useUpdatedAt ? null : null,
    ).run();
    const row = await db.prepare(
      'SELECT id FROM trip_requests WHERE message = ? ORDER BY id DESC LIMIT 1'
    ).bind(message).first<{ id: number }>();
    if (useUpdatedAt) {
      await db.prepare(
        `UPDATE trip_requests SET updated_at = datetime('now', ?) WHERE id = ?`
      ).bind(`-${minutesAgo} minutes`, row!.id).run();
    }
    return row!.id;
  }

  it('processing 停滯 101 分鐘 → GET 就地標 failed + timed_out', async () => {
    const id = await seedAged('殭屍 101 分鐘', 'processing', 101, true);
    const resp = await callHandler(onRequestGetOne, getOne(id));
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('failed');
    expect(data.terminalReason).toBe('timed_out');

    const row = await db.prepare('SELECT status, terminal_reason FROM trip_requests WHERE id = ?')
      .bind(id).first<{ status: string; terminal_reason: string | null }>();
    expect(row!.status).toBe('failed');
    expect(row!.terminal_reason).toBe('timed_out');
  });

  it('從未被 PATCH 過（updated_at 為 NULL）也算齡 → 用 created_at 收', async () => {
    const id = await seedAged('殭屍 never-patched', 'open', 120, false);
    const resp = await callHandler(onRequestGetOne, getOne(id));
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('failed');
    expect(data.terminalReason).toBe('timed_out');
  });

  it('停滯 89 分鐘 → 不動（健康 session 還在工作，短於 orphan cap 絕不誤殺）', async () => {
    const id = await seedAged('工作中 89 分鐘', 'processing', 89, true);
    const resp = await callHandler(onRequestGetOne, getOne(id));
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('processing');
    expect(data.terminalReason).toBeNull();
  });

  it('已終結的 request 不被牆鐘覆寫原因', async () => {
    const id = await seedAged('久遠的已完成', 'completed', 500, true);
    const resp = await callHandler(onRequestGetOne, getOne(id));
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('completed');
    expect(data.terminalReason).toBeNull();
  });
});
