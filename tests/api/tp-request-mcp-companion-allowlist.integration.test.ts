/**
 * Cross-module invariant: the MCP tool surface and the middleware companion
 * path-allowlist must agree, and every companion write must actually deliver the
 * restrict tripId. This would have caught the enrichPoi bug (a write tool that
 * reached an endpoint requiring ?tripId= without delivering it).
 *
 * Behavioural (build the real request → run the real middleware gate), not two
 * hand-kept lists that can drift.
 */
import { describe, it, expect } from 'vitest';
import { checkCompanionScope } from '../../functions/api/_middleware';

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
      const httpReq = new Request(req.url, { method: req.method, headers: { 'X-Request-Scope': 'companion' } });
      const gate = checkCompanionScope(httpReq, url);
      expect(gate, `${tool.name} (${req.method} ${url.pathname}) must pass checkCompanionScope`).toBeNull();
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
