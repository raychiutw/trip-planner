/**
 * _middleware.ts /api/oauth/* bypass 結構測試（V2-P1）
 *
 * 驗 source 含 OAuth bypass logic — OAuth endpoints 自管 auth (PKCE / JWT)，
 * 不該被 user-session middleware 攔截 401。
 *
 * 用 source-level test 而非 integration（避 miniflare setup 成本）；
 * end-to-end 行為靠 prod curl /api/oauth/spike 200 確認（next session post-deploy）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIDDLEWARE_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../functions/api/_middleware.ts'),
  'utf8',
);

describe('_middleware.ts — OAuth bypass (V2-P1)', () => {
  it('含 /api/oauth/ pathname startsWith bypass block', () => {
    expect(MIDDLEWARE_SRC).toMatch(/url\.pathname\.startsWith\(['"]\/api\/oauth\/['"]/);
  });

  it('bypass 設 auth = null 並 context.next()', () => {
    // 抓 OAuth pattern 後 5 行 window 找 auth = null + context.next()
    const lines = MIDDLEWARE_SRC.split('\n');
    const oauthLineIdx = lines.findIndex((l) => l.includes("'/api/oauth/'") || l.includes('"/api/oauth/"'));
    expect(oauthLineIdx).toBeGreaterThan(0);
    const window = lines.slice(oauthLineIdx, oauthLineIdx + 5).join('\n');
    expect(window).toMatch(/auth\s*=\s*null/);
    expect(window).toMatch(/context\.next\(\)/);
  });

  it('bypass 在「公開端點：POST /api/reports」block 之前（先 short-circuit）', () => {
    const oauthIdx = MIDDLEWARE_SRC.indexOf('/api/oauth/');
    const reportsIdx = MIDDLEWARE_SRC.indexOf("/api/reports'");
    expect(oauthIdx).toBeGreaterThan(0);
    expect(reportsIdx).toBeGreaterThan(0);
    expect(oauthIdx, 'oauth bypass 該在 /api/reports 之前').toBeLessThan(reportsIdx);
  });

  it('bypass 在 method+UTF-8 check 之後（仍套用 body encoding 驗證）', () => {
    const utf8CheckIdx = MIDDLEWARE_SRC.indexOf('detectGarbledText');
    const oauthIdx = MIDDLEWARE_SRC.indexOf('/api/oauth/');
    expect(utf8CheckIdx, 'UTF-8 check 該在 source 中').toBeGreaterThan(0);
    expect(oauthIdx, 'oauth bypass 該在 UTF-8 check 之後').toBeGreaterThan(utf8CheckIdx);
  });
});
