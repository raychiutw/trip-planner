import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { callHandler, getDayId, jsonRequest, mockAuth, mockContext, mockEnv, seedEntry, seedTrip } from './helpers';
import { onRequestGet as getRequest, onRequestPatch as patchRequest } from '../../functions/api/requests/[id]';
import { onRequestGet as getHealth, onRequestPost as startHealth } from '../../functions/api/trips/[id]/health-check';
import { onRequestPost as generateNotes } from '../../functions/api/trips/[id]/notes/[type]/generate';
import { onRequestGet as getAiState } from '../../functions/api/trips/[id]/notes/ai-state';
import { onRequestPost as mintRestricted } from '../../functions/api/oauth/mint-restricted';
import { onRequestPost as createRequest } from '../../functions/api/requests';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
beforeAll(async () => { db = await createTestDb(); env = mockEnv(db); });
afterAll(disposeMiniflare);

function context(id: string | number, request: Request, requestEnv = env) {
  return mockContext({ request, env: requestEnv, auth: mockAuth(), params: { id: String(id) } });
}

async function healthRequest(tripId: string) {
  await seedTrip(db, { id: tripId, days: 1 });
  await seedEntry(db, await getDayId(db, tripId, 1));
  const response = await callHandler(startHealth, context(tripId,
    jsonRequest(`https://test/api/trips/${tripId}/health-check`, 'POST')));
  expect(response.status).toBe(202);
  return ((await response.json()) as { report: { requestId: number } }).report.requestId;
}

async function chatRequest(tripId: string) {
  await seedTrip(db, { id: tripId, days: 1 });
  const response = await callHandler(createRequest, context(tripId,
    jsonRequest('https://test/api/requests', 'POST', { tripId, message: '請幫我安排行程' })));
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: number }).id;
}

function beforeRequestUpdate(action: () => Promise<unknown>): D1Database {
  let invoked = false;
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement => new Proxy(statement, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (property === 'bind') return (...values: unknown[]) => wrap(target.bind(...values));
      if (property === 'first') return async (...args: unknown[]) => {
        if (!invoked) { invoked = true; await action(); }
        return Reflect.apply(member, target, args);
      };
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });
  return new Proxy(db, {
    get(target, property) {
      if (property === 'prepare') return (sql: string) => {
        const statement = target.prepare(sql);
        return /UPDATE\s+trip_requests\s+SET/.test(sql) ? wrap(statement) : statement;
      };
      const member = Reflect.get(target, property);
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });
}

async function notesRequest(tripId: string) {
  await seedTrip(db, { id: tripId, days: 1 });
  const ctx = context(tripId, jsonRequest(`https://test/api/trips/${tripId}/notes/tips/generate`, 'POST'));
  ctx.params.type = 'tips';
  const response = await callHandler(generateNotes, ctx);
  expect(response.status).toBe(202);
  return (await response.json()) as { requestId: number; jobId: number; generation: number };
}

function mint(id: number, requestDb = db) {
  return callHandler(mintRestricted, context(id, jsonRequest('https://test/api/oauth/mint-restricted', 'POST',
    { request_id: id }, { Authorization: 'Bearer automatic-test-secret' }),
  mockEnv(requestDb, { TRIPLINE_API_SECRET: 'automatic-test-secret' })));
}

function failOnce(match: (sql: string) => boolean): D1Database {
  let failed = false;
  return new Proxy(db, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      return (...args: unknown[]) => {
        if (!failed && property === 'prepare' && match(String(args[0]))) {
          failed = true;
          throw new Error('Injected cleanup outage');
        }
        return Reflect.apply(member, target, args);
      };
    },
  });
}

describe('自動終結沿用 request 收尾規則', () => {
  it('錯誤的跨行程筆記關聯不能終結其他擁有者的 request', async () => {
    const ownTrip = 'automatic-cross-trip-own';
    const { jobId } = await notesRequest(ownTrip);
    const otherTrip = 'automatic-cross-trip-other';
    await seedTrip(db, { id: otherTrip, owner: 'other@test.com', published: 0 });
    const otherAuth = mockAuth({ email: 'other@test.com' });
    const created = await callHandler(createRequest, mockContext({ env, auth: otherAuth,
      request: jsonRequest('https://test/api/requests', 'POST', { tripId: otherTrip, message: '私有行程請求' }),
    }));
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: number };
    await db.prepare("UPDATE trip_note_ai_jobs SET request_id = ?, timeout_at = datetime('now', '-1 second') WHERE id = ?")
      .bind(id, jobId).run();
    expect((await callHandler(getAiState, context(ownTrip, new Request(`https://test/api/trips/${ownTrip}/notes/ai-state`)))).status).toBe(200);
    const request = await callHandler(getRequest, mockContext({ env, auth: otherAuth, params: { id: String(id) },
      request: new Request(`https://test/api/requests/${id}`),
    }));
    expect(await request.json()).toMatchObject({ status: 'open', terminalReason: null });
  });

  it('收屍讀取後 worker 恢復活動，保留其回報與等待狀態', async () => {
    const tripId = 'automatic-wall-race';
    const id = await healthRequest(tripId);
    await db.prepare("UPDATE trip_requests SET updated_at = datetime('now', '-101 minutes') WHERE id = ?").bind(id).run();
    const racing = mockEnv(beforeRequestUpdate(() => callHandler(patchRequest, context(id,
      jsonRequest(`https://test/api/requests/${id}`, 'PATCH', { status: 'processing', reply: 'worker 已恢復' })))));
    const response = await callHandler(getRequest, context(id, new Request(`https://test/api/requests/${id}`), racing));
    expect(await response.json()).toMatchObject({ status: 'processing', terminalReason: null, reply: 'worker 已恢復' });
    const report = await callHandler(getHealth, context(tripId, new Request(`https://test/api/trips/${tripId}/health-check`)));
    expect(await report.json()).toMatchObject({ report: { status: 'pending' } });
  });

  it.each(['completed', 'failed'])('拒發 token 前 request 已先 %s，不覆寫首次終結與回覆', async (status) => {
    const id = await chatRequest(`automatic-consent-race-${status}`);
    const racing = beforeRequestUpdate(() => callHandler(patchRequest, context(id,
      jsonRequest(`https://test/api/requests/${id}`, 'PATCH', {
        status, reply: '先完成的回報', ...(status === 'failed' ? { terminalReason: 'cancelled' } : {}),
      }))));
    expect((await mint(id, racing)).status).toBe(403);
    const request = await callHandler(getRequest, context(id, new Request(`https://test/api/requests/${id}`)));
    expect(await request.json()).toMatchObject({ status, reply: '先完成的回報', terminalReason: status === 'failed' ? 'cancelled' : null });
  });

  it.each(['chat', 'health'])('未授權的 %s 請求解除隊列並保留授權指引', async (kind) => {
    const tripId = `automatic-consent-${kind}`;
    const id = kind === 'chat' ? await chatRequest(tripId) : await healthRequest(tripId);
    expect((await mint(id)).status).toBe(403);
    const request = await callHandler(getRequest, context(id, new Request(`https://test/api/requests/${id}`)));
    expect(await request.json()).toMatchObject({ status: 'failed', terminalReason: 'needs_consent', reply: expect.stringContaining('授權並送出') });
    if (kind === 'health') {
      const report = await callHandler(getHealth, context(tripId, new Request(`https://test/api/trips/${tripId}/health-check`)));
      expect(await report.json()).toMatchObject({ report: { status: 'failed', errorMessage: '需要行程擁有者授權 AI 才能執行健檢' } });
    }
  });

  it('拒發時 request 寫入故障仍拒發 token，下一次可解除隊列', async () => {
    const id = await chatRequest('automatic-consent-write-retry');
    expect((await mint(id, failOnce((sql) => /UPDATE trip_requests/.test(sql)))).status).toBe(403);
    const before = await callHandler(getRequest, context(id, new Request(`https://test/api/requests/${id}`)));
    expect(await before.json()).toMatchObject({ status: 'open' });
    expect((await mint(id)).status).toBe(403);
    const after = await callHandler(getRequest, context(id, new Request(`https://test/api/requests/${id}`)));
    expect(await after.json()).toMatchObject({ status: 'failed', terminalReason: 'needs_consent' });
  });

  it('100 分鐘牆鐘也收尾筆記工作，維持筆記自己的逾時狀態', async () => {
    const tripId = 'automatic-notes-wall';
    const { requestId, jobId } = await notesRequest(tripId);
    await db.prepare("UPDATE trip_requests SET updated_at = datetime('now', '-101 minutes') WHERE id = ?").bind(requestId).run();
    await db.prepare("UPDATE trip_note_ai_jobs SET timeout_at = datetime('now', '-91 minutes') WHERE id = ?").bind(jobId).run();
    const request = await callHandler(getRequest, context(requestId, new Request(`https://test/api/requests/${requestId}`)));
    expect(await request.json()).toMatchObject({ status: 'failed', terminalReason: 'timed_out' });
    const state = await callHandler(getAiState, context(tripId, new Request(`https://test/api/trips/${tripId}/notes/ai-state`)));
    expect(await state.json()).toMatchObject({ jobs: expect.arrayContaining([expect.objectContaining({ requestId, status: 'timedOut' })]) });
  });

  it('10 分鐘收尾寫入故障不復活 request，重新讀取可恢復', async () => {
    const tripId = 'automatic-notes-job-retry';
    const { requestId, jobId } = await notesRequest(tripId);
    await db.prepare("UPDATE trip_note_ai_jobs SET timeout_at = datetime('now', '-1 second') WHERE id = ?").bind(jobId).run();
    const faulty = mockEnv(failOnce((sql) => /UPDATE trip_note_ai_jobs/.test(sql)));
    const first = await callHandler(getAiState, context(tripId, new Request(`https://test/api/trips/${tripId}/notes/ai-state`), faulty));
    expect(await first.json()).toMatchObject({ jobs: expect.arrayContaining([expect.objectContaining({ requestId, status: 'pending' })]) });
    const request = await callHandler(getRequest, context(requestId, new Request(`https://test/api/requests/${requestId}`)));
    expect(await request.json()).toMatchObject({ status: 'failed', terminalReason: 'timed_out' });
    const after = await callHandler(getAiState, context(tripId, new Request(`https://test/api/trips/${tripId}/notes/ai-state`)));
    expect(await after.json()).toMatchObject({ jobs: expect.arrayContaining([expect.objectContaining({ requestId, status: 'timedOut' })]) });
  });

  it('再次拒發受限 token 時可補做先前失敗的筆記收尾', async () => {
    const tripId = 'automatic-consent-retry';
    const { requestId } = await notesRequest(tripId);
    expect((await mint(requestId, failOnce((sql) => /SELECT[\s\S]*FROM trip_note_ai_jobs/.test(sql)))).status).toBe(403);
    const before = await callHandler(getAiState, context(tripId, new Request(`https://test/api/trips/${tripId}/notes/ai-state`)));
    expect(await before.json()).toMatchObject({ jobs: expect.arrayContaining([expect.objectContaining({ requestId, status: 'pending' })]) });
    expect((await mint(requestId)).status).toBe(403);
    const after = await callHandler(getAiState, context(tripId, new Request(`https://test/api/trips/${tripId}/notes/ai-state`)));
    expect(await after.json()).toMatchObject({ jobs: expect.arrayContaining([expect.objectContaining({ requestId, status: 'failed' })]) });
  });

  it.each(['processing', 'completed'])('過期筆記收到 %s 回報時，先按期限終結且保留遲到回覆', async (status) => {
    const tripId = `automatic-notes-late-${status}`;
    const { requestId, jobId } = await notesRequest(tripId);
    await db.prepare("UPDATE trip_note_ai_jobs SET timeout_at = datetime('now', '-1 second') WHERE id = ?").bind(jobId).run();
    const reply = JSON.stringify([{ title: '已逾時的成果', content: '不套用', section: '一般' }]);
    const response = await callHandler(patchRequest, context(requestId,
      jsonRequest(`https://test/api/requests/${requestId}`, 'PATCH', { status, reply })));
    expect(await response.json()).toMatchObject({ status: 'failed', terminalReason: 'timed_out', reply });
    const state = await callHandler(getAiState, context(tripId, new Request(`https://test/api/trips/${tripId}/notes/ai-state`)));
    expect(await state.json()).toMatchObject({ jobs: expect.arrayContaining([expect.objectContaining({ requestId, status: 'timedOut' })]) });
  });

  it('筆記 10 分鐘逾時保留 timedOut 工作狀態，request 帶 timed_out 原因', async () => {
    const tripId = 'automatic-notes-expiry';
    const { requestId, jobId } = await notesRequest(tripId);
    await db.prepare("UPDATE trip_note_ai_jobs SET timeout_at = datetime('now', '-1 second') WHERE id = ?").bind(jobId).run();
    const state = await callHandler(getAiState, context(tripId, new Request(`https://test/api/trips/${tripId}/notes/ai-state`)));
    expect(await state.json()).toMatchObject({ jobs: expect.arrayContaining([expect.objectContaining({
      requestId, status: 'timedOut', errorCode: 'NOTES_AI_JOB_STALE',
    })]) });
    const request = await callHandler(getRequest, context(requestId, new Request(`https://test/api/requests/${requestId}`)));
    expect(await request.json()).toMatchObject({ status: 'failed', terminalReason: 'timed_out' });
  });

  it('缺少授權拒發 token；健檢收尾故障不阻止筆記收尾及授權指引', async () => {
    const tripId = 'automatic-no-consent-notes';
    const { requestId } = await notesRequest(tripId);
    const denied = await mint(requestId, failOnce((sql) => /trip_health_reports/.test(sql)));
    expect(denied.status).toBe(403);
    expect(await denied.json()).not.toHaveProperty('access_token');
    const state = await callHandler(getAiState, context(tripId, new Request(`https://test/api/trips/${tripId}/notes/ai-state`)));
    expect(await state.json()).toMatchObject({ jobs: expect.arrayContaining([expect.objectContaining({
      docType: 'tips', requestId, status: 'failed', errorCode: 'NOTES_AI_APPLY_FAILED',
      errorMessage: '需要行程擁有者授權 AI 才能生成',
    })]) });
    const request = await callHandler(getRequest, context(requestId, new Request(`https://test/api/requests/${requestId}`)));
    expect(await request.json()).toMatchObject({
      status: 'failed', terminalReason: 'needs_consent', reply: expect.stringContaining('授權並送出'),
    });
  });

  it('自動終結的收尾失敗時，下一次讀取能補做且保留逾時原因', async () => {
    const tripId = 'automatic-health-retry';
    const id = await healthRequest(tripId);
    await db.prepare("UPDATE trip_requests SET updated_at = datetime('now', '-101 minutes') WHERE id = ?").bind(id).run();
    const faulty = mockEnv(failOnce((sql) => /UPDATE trip_health_reports/.test(sql)));
    const first = await callHandler(getRequest, context(id, new Request(`https://test/api/requests/${id}`), faulty));
    expect(await first.json()).toMatchObject({ status: 'failed', terminalReason: 'timed_out' });
    const before = await callHandler(getHealth, context(tripId, new Request(`https://test/api/trips/${tripId}/health-check`)));
    expect(await before.json()).toMatchObject({ report: { status: 'pending' } });
    const retry = await callHandler(getRequest, context(id, new Request(`https://test/api/requests/${id}`)));
    expect(await retry.json()).toMatchObject({ status: 'failed', terminalReason: 'timed_out' });
    const after = await callHandler(getHealth, context(tripId, new Request(`https://test/api/trips/${tripId}/health-check`)));
    expect(await after.json()).toMatchObject({ report: { status: 'failed' } });
  });

  it('100 分鐘牆鐘解除等待，也完成關聯健檢收尾', async () => {
    const tripId = 'automatic-health-expiry';
    const id = await healthRequest(tripId);
    await db.prepare("UPDATE trip_requests SET updated_at = datetime('now', '-101 minutes') WHERE id = ?").bind(id).run();
    const request = await callHandler(getRequest, context(id, new Request(`https://test/api/requests/${id}`)));
    expect(await request.json()).toMatchObject({ status: 'failed', terminalReason: 'timed_out' });
    const report = await callHandler(getHealth, context(tripId, new Request(`https://test/api/trips/${tripId}/health-check`)));
    expect(await report.json()).toMatchObject({ report: { status: 'failed', requestId: id } });
  });
});
