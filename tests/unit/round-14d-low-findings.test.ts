/**
 * round-14d-low-findings.test.ts — v2.33.63 真做完 LOW finding
 *
 * 5 個 LOW fix:
 *   1. permissions.ts invitationExpiresAt() 用 default 取代寫死 7
 *   2. oauth-d1-adapter 16KB payload size cap
 *   3. session.ts CryptoKey isolate cache (避免每 request importKey)
 *   4. google-id-token JWKS cache 加 KV upgrade path doc
 *   5. manifest maskable icon 192/512 加入
 *   + stale v2.18.0 comment 從 tokens.css 清掉 (1 處)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');
const exists = (p: string) => existsSync(path.resolve(__dirname, '../..', p));

const PERMISSIONS = read('functions/api/permissions.ts');
const ADAPTER = read('src/server/oauth-d1-adapter.ts');
const SESSION = read('src/server/session.ts');
const GOOGLE_ID = read('src/server/oauth-client/google-id-token.ts');
const MANIFEST = JSON.parse(read('public/manifest.json'));
const TOKENS_CSS = read('css/tokens.css');

describe('v2.33.63 #1 — INVITATION_TTL drift fix', () => {
  it('invitationExpiresAt() 不寫死 7', () => {
    expect(PERMISSIONS).not.toMatch(/invitationExpiresAt\(7\)/);
    expect(PERMISSIONS).toMatch(/invitationExpiresAt\(\)/);
  });
});

describe('v2.33.63 #2 — D1Adapter payload size cap', () => {
  it('upsert 加 16KB size cap', () => {
    expect(ADAPTER).toMatch(/serialised\.length > 16 \* 1024/);
    expect(ADAPTER).toMatch(/oauth_models payload too large/);
  });
});

describe('v2.33.63 #3 — session CryptoKey cache', () => {
  it('KEY_CACHE Map<secret, CryptoKey> 加入', () => {
    expect(SESSION).toMatch(/const KEY_CACHE = new Map<string, CryptoKey>/);
  });

  it('importHmacKey 先查 cache', () => {
    expect(SESSION).toMatch(/KEY_CACHE\.get\(secret\)/);
    expect(SESSION).toMatch(/KEY_CACHE\.set\(secret, key\)/);
  });
});

describe('v2.33.63 #4 — JWKS KV upgrade doc', () => {
  it('comment 標 V2-P7 KV cache upgrade path', () => {
    expect(GOOGLE_ID).toMatch(/V2-P7 infra|KV cache/);
  });
});

describe('v2.33.63 #5 — manifest maskable icons', () => {
  it('manifest 含 4 icons (2 any + 2 maskable)', () => {
    expect(MANIFEST.icons).toHaveLength(4);
  });

  it('192/512 maskable variants', () => {
    const maskable = MANIFEST.icons.filter((i: { purpose?: string }) => i.purpose === 'maskable');
    expect(maskable).toHaveLength(2);
    expect(maskable.find((i: { sizes: string }) => i.sizes === '192x192')).toBeDefined();
    expect(maskable.find((i: { sizes: string }) => i.sizes === '512x512')).toBeDefined();
  });

  it('maskable PNG asset 實際存在 public/icons/', () => {
    expect(exists('public/icons/icon-192-maskable.png')).toBe(true);
    expect(exists('public/icons/icon-512-maskable.png')).toBe(true);
  });
});

describe('v2.33.63 #6 — stale v2.18.0 comment 清除', () => {
  it('tokens.css 拔 v2.18.0 stale version prefix', () => {
    expect(TOKENS_CSS).not.toMatch(/v2\.18\.0:`?\.map-highlight/);
  });
});
