/**
 * Cross-module invariant: the MCP tool surface and the middleware companion
 * path-allowlist must agree, and every companion write must actually deliver the
 * restrict tripId. This would have caught the enrichPoi bug (a write tool that
 * reached an endpoint requiring ?tripId= without delivering it).
 *
 * Behavioural (build the real request → send it through the real middleware gate), not two
 * hand-kept lists that can drift.
 *
 * 走 HTTP 邊界：MCP 工具組出的請求帶 X-Request-Scope: companion 發給真實路由，
 * 不再直接呼叫 checkCompanionScope。第二個測試只檢查 MCP 腳本組出的請求內容，不經 middleware，
 * 屬於腳本（module）測試，保持原樣，交給 #1503。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi, type Api } from './http';

const SCOPE_DETAIL = '此操作超出旅伴請求範圍';
let db: D1Database;
let api: Api;

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db) });
});

afterAll(disposeMiniflare);

const RESTRICT = 'trip-ABC';
const CFG = { restrictTrip: RESTRICT, token: 'tok' };

async function loadTools() {
  const m = await import('../../scripts/tp-request-mcp-server.js');
  return m;
}

function sampleArgs(tool: {
  pathParams?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: boolean;
}) {
  const args: Record<string, unknown> = {};
  for (const p of Object.keys(tool.pathParams || {})) args[p] = '7';
  for (const q of Object.keys(tool.query || {})) args[q] = '7';
  if (tool.body) args.body = {};
  return args;
}

describe('MCP companion tools ⊆ middleware COMPANION_ALLOWED', () => {
  it('every companion:true tool builds a path the middleware companion gate ALLOWS', async () => {
    const m = await loadTools();
    const companionTools = m.TOOLS.filter((t: { companion?: boolean }) => t.companion);
    expect(companionTools.length).toBeGreaterThan(5); // sanity: we did find the writes
    for (const tool of companionTools) {
      const req = m.buildRequest(tool, sampleArgs(tool), CFG);
      const url = new URL(req.url);
      const res = await api.request(req.method, req.url, {
        headers: { 'X-Request-Scope': 'companion', Origin: 'https://trip-planner-dby.pages.dev' },
      });
      const err = ((await res.json().catch(() => ({}))) as { error?: { detail?: string } }).error;
      const label = `${tool.name} (${req.method} ${url.pathname})`;
      expect(err?.detail, `${label} must pass the companion gate`).not.toBe(SCOPE_DETAIL);
      // 變更類請求沒帶認證時，過了 companion gate 與 CSRF 才會停在 401：
      // 證明路徑真的有對應的 route 並走到 middleware，而不是 404/405 直接略過
      if (req.method !== 'GET') expect(res.status, `${label} should reach the auth gate`).toBe(401);
    }
  });
});

describe('every companion write delivers the restrict tripId', () => {
  it('the built request references RESTRICT_TRIP in path, query, or body', async () => {
    const m = await loadTools();
    const companionTools = m.TOOLS.filter((t: { companion?: boolean }) => t.companion);
    for (const tool of companionTools) {
      const req = m.buildRequest(tool, sampleArgs(tool), CFG);
      const inUrl = req.url.includes(RESTRICT);
      const inBody = typeof req.body === 'string' && req.body.includes(RESTRICT);
      expect(inUrl || inBody, `${tool.name} must carry the restrict tripId (path/query/body) — else its endpoint 400s/403s`).toBe(true);
    }
  });
});
