/**
 * /api/oauth/spike deprecation headers 測試（V2-P1）
 *
 * RFC 8594 Sunset + Deprecation + Link rel=successor-version。
 * 確保 client 收 spike 回應時看到 deprecation 訊號，可遷到 discovery endpoint。
 */
import { describe, it, expect } from 'vitest';
import { onRequestGet } from '../../functions/api/oauth/spike';

function makeContext(url: string): Parameters<typeof onRequestGet>[0] {
  return {
    request: new Request(url),
    env: {} as unknown as never,
    params: {} as unknown as never,
    data: {} as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRequestGet>[0];
}

describe('GET /api/oauth/spike — deprecation headers', () => {
  it('Deprecation: true header', async () => {
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/spike'));
    expect(res.headers.get('Deprecation')).toBe('true');
  });

  it('Sunset header (RFC 8594) — V2-P2 ship 後 retire date', async () => {
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/spike'));
    const sunset = res.headers.get('Sunset');
    expect(sunset).toBeTruthy();
    expect(sunset).toMatch(/2026/); // sunset year
  });

  it('Link header rel=successor-version 指向 discovery endpoint', async () => {
    const res = await onRequestGet(makeContext('https://trip-planner-dby.pages.dev/api/oauth/spike'));
    const link = res.headers.get('Link');
    expect(link).toMatch(/successor-version/);
    expect(link).toMatch(/\/api\/oauth\/\.well-known\/openid-configuration/);
  });

  it('Link header origin from request URL (not hardcoded)', async () => {
    const res = await onRequestGet(makeContext('http://localhost:8788/api/oauth/spike'));
    expect(res.headers.get('Link')).toMatch(/http:\/\/localhost:8788\/api\/oauth\/\.well-known\/openid-configuration/);
  });

  it('response body 含 deprecated: true + successor path', async () => {
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/spike'));
    const json = await res.json() as { deprecated?: boolean; successor?: string };
    expect(json.deprecated).toBe(true);
    expect(json.successor).toBe('/api/oauth/.well-known/openid-configuration');
  });
});
