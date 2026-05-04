/**
 * _middleware.ts — GET /api/poi-search public-read bypass (poi-favorites-rename §5.2)
 *
 * Cutover 修補：poi-search 是 OSM Nominatim proxy，無 user data，本應 anonymous
 * public-read（同 /api/route / /api/public-config pattern）。漏列的 198 筆
 * production 401 由本 PR 修補。
 *
 * 採 source-level grep 測試（同 middleware-oauth-bypass.test.ts pattern）避免
 * miniflare 整合設置成本。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIDDLEWARE_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../functions/api/_middleware.ts'),
  'utf8',
);

describe('_middleware.ts — GET /api/poi-search public-read bypass (§5.2)', () => {
  it('包含 GET /api/poi-search bypass block', () => {
    // Bypass 應檢查 method === GET 且 pathname === '/api/poi-search'
    expect(MIDDLEWARE_SRC).toMatch(
      /request\.method\s*===\s*['"]GET['"][\s\S]{0,200}url\.pathname\s*===\s*['"]\/api\/poi-search['"]/,
    );
  });

  it('bypass 設 auth = null 並 context.next()', () => {
    const lines = MIDDLEWARE_SRC.split('\n');
    let bypassLine = -1;
    lines.forEach((l, i) => {
      if (l.includes("/api/poi-search'") || l.includes('"/api/poi-search"')) {
        bypassLine = i;
      }
    });
    expect(bypassLine).toBeGreaterThan(0);

    const window = lines.slice(bypassLine, bypassLine + 5).join('\n');
    expect(window).toMatch(/auth\s*=\s*null/);
    expect(window).toMatch(/context\.next\(\)/);
  });

  it('bypass 在 V2 session check 之前（anonymous 不需要先 lookup session）', () => {
    const poiSearchIdx = MIDDLEWARE_SRC.indexOf('/api/poi-search');
    const sessionLookupIdx = MIDDLEWARE_SRC.indexOf('getSessionUser(request');
    expect(poiSearchIdx).toBeGreaterThan(0);
    expect(sessionLookupIdx).toBeGreaterThan(0);
    expect(
      poiSearchIdx,
      'poi-search bypass 應在 V2 session lookup 之前 short-circuit',
    ).toBeLessThan(sessionLookupIdx);
  });

  it('POST 不在 bypass：POST /api/poi-search 仍走 V2 auth path', () => {
    // 只 GET 有 public bypass；POST 該要求認證（防 abuse Nominatim quota）。
    // grep：bypass block 的 method === 應為 'GET'，不是 POST。
    const poiSearchIdx = MIDDLEWARE_SRC.indexOf('/api/poi-search');
    const before = MIDDLEWARE_SRC.slice(Math.max(0, poiSearchIdx - 200), poiSearchIdx);
    // 不應有 'POST' 在 poi-search bypass block 範圍內
    expect(before).not.toMatch(/method\s*===\s*['"]POST['"][\s\S]{0,150}poi-search/);
  });
});
