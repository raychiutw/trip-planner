/**
 * /api/oauth/.well-known/openid-configuration + jwks.json 結構測試（V2-P1）
 *
 * 驗 OIDC Discovery doc spec compliance + JWKS empty stub。
 * 用 source-level test (read handler module + invoke onRequestGet)。
 */
import { describe, it, expect } from 'vitest';
import { onRequestGet as openidConfigHandler } from '../../functions/api/oauth/.well-known/openid-configuration';
import { onRequestGet as jwksHandler } from '../../functions/api/oauth/.well-known/jwks.json';

function makeContext(url: string): Parameters<typeof openidConfigHandler>[0] {
  return {
    request: new Request(url),
    env: {} as unknown as never,
    params: {} as unknown as never,
    data: {} as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof openidConfigHandler>[0];
}

describe('GET /api/oauth/.well-known/openid-configuration', () => {
  it('returns 200 + application/json', async () => {
    const res = await openidConfigHandler(makeContext('https://trip-planner-dby.pages.dev/api/oauth/.well-known/openid-configuration'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('issuer derives from request origin (not hardcoded)', async () => {
    const prodRes = await openidConfigHandler(makeContext('https://trip-planner-dby.pages.dev/api/oauth/.well-known/openid-configuration'));
    const localRes = await openidConfigHandler(makeContext('http://localhost:8788/api/oauth/.well-known/openid-configuration'));
    const prodJson = await prodRes.json() as { issuer: string };
    const localJson = await localRes.json() as { issuer: string };
    expect(prodJson.issuer).toBe('https://trip-planner-dby.pages.dev/api/oauth');
    expect(localJson.issuer).toBe('http://localhost:8788/api/oauth');
  });

  it('endpoints all under issuer base + correct paths', async () => {
    const res = await openidConfigHandler(makeContext('https://example.com/api/oauth/.well-known/openid-configuration'));
    const json = await res.json() as Record<string, string>;
    expect(json.authorization_endpoint).toBe('https://example.com/api/oauth/authorize');
    expect(json.token_endpoint).toBe('https://example.com/api/oauth/token');
    expect(json.userinfo_endpoint).toBe('https://example.com/api/oauth/userinfo');
    expect(json.jwks_uri).toBe('https://example.com/api/oauth/.well-known/jwks.json');
    expect(json.revocation_endpoint).toBe('https://example.com/api/oauth/revoke');
  });

  it('scopes_supported includes openid + profile + email + offline_access', async () => {
    const res = await openidConfigHandler(makeContext('https://x.com/api/oauth/.well-known/openid-configuration'));
    const json = await res.json() as { scopes_supported: string[] };
    expect(json.scopes_supported).toContain('openid');
    expect(json.scopes_supported).toContain('profile');
    expect(json.scopes_supported).toContain('email');
    expect(json.scopes_supported).toContain('offline_access');
  });

  it('grant_types_supported includes authorization_code + refresh_token', async () => {
    const res = await openidConfigHandler(makeContext('https://x.com/api/oauth/.well-known/openid-configuration'));
    const json = await res.json() as { grant_types_supported: string[] };
    expect(json.grant_types_supported).toEqual(expect.arrayContaining(['authorization_code', 'refresh_token']));
  });

  it('response_types_supported is [code] only (no implicit/hybrid — secure default)', async () => {
    const res = await openidConfigHandler(makeContext('https://x.com/api/oauth/.well-known/openid-configuration'));
    const json = await res.json() as { response_types_supported: string[] };
    expect(json.response_types_supported).toEqual(['code']);
  });

  it('code_challenge_methods_supported includes S256 (PKCE required)', async () => {
    const res = await openidConfigHandler(makeContext('https://x.com/api/oauth/.well-known/openid-configuration'));
    const json = await res.json() as { code_challenge_methods_supported: string[] };
    expect(json.code_challenge_methods_supported).toContain('S256');
  });

  it('id_token signing alg includes RS256', async () => {
    const res = await openidConfigHandler(makeContext('https://x.com/api/oauth/.well-known/openid-configuration'));
    const json = await res.json() as { id_token_signing_alg_values_supported: string[] };
    expect(json.id_token_signing_alg_values_supported).toContain('RS256');
  });

  it('cache-control public 24h (low-churn discovery doc)', async () => {
    const res = await openidConfigHandler(makeContext('https://x.com/api/oauth/.well-known/openid-configuration'));
    expect(res.headers.get('cache-control')).toMatch(/max-age=86400/);
  });
});

describe('GET /api/oauth/.well-known/jwks.json', () => {
  it('returns 200 + application/json', async () => {
    const res = await jwksHandler(makeContext('https://x.com/api/oauth/.well-known/jwks.json'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('returns empty keys array (V2-P1 stub)', async () => {
    const res = await jwksHandler(makeContext('https://x.com/api/oauth/.well-known/jwks.json'));
    const json = await res.json() as { keys: unknown[] };
    expect(Array.isArray(json.keys)).toBe(true);
    expect(json.keys).toEqual([]);
  });

  it('cache-control public 1h (key rotation V2-P6 後 TTL 才需短)', async () => {
    const res = await jwksHandler(makeContext('https://x.com/api/oauth/.well-known/jwks.json'));
    expect(res.headers.get('cache-control')).toMatch(/max-age=3600/);
  });
});
