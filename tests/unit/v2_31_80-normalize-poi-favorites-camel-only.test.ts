/**
 * v2.31.80：normalizePoiFavorites 移除 snake_case dead fallback。
 *
 * Backend `/api/poi-favorites` 用 functions/api/_utils.json() 經 deepCamel，
 * response 永遠 camelCase。原本 normalizePoiFavorites 寫 `item.poiId ?? item.poi_id`
 * 等 dead defensive，從未生效，留著只是噪音。Lock 此 cleanup。
 *
 * 不直接 export normalizePoiFavorites（component module-private），用 source-grep
 * 鎖該 function 內無 .poi_id / .poi_name / .poi_address / .poi_type / .poi_rating
 * snake_case property access。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('v2.31.80: normalizePoiFavorites reads camelCase only', () => {
  const src = readFileSync(
    join(__dirname, '../../src/pages/AddStopPage.tsx'),
    'utf8',
  );

  // 抓出 normalizePoiFavorites function block
  const fnMatch = src.match(
    /function\s+normalizePoiFavorites[\s\S]*?^}\s*$/m,
  );

  it('finds normalizePoiFavorites function', () => {
    expect(fnMatch, 'normalizePoiFavorites function not found').toBeTruthy();
  });

  it('reads camelCase fields (poiId, poiName, poiAddress, poiType, poiRating)', () => {
    const block = fnMatch![0];
    expect(block).toMatch(/item\.poiId\b/);
    expect(block).toMatch(/item\.poiName\b/);
    expect(block).toMatch(/item\.poiAddress\b/);
    expect(block).toMatch(/item\.poiType\b/);
    expect(block).toMatch(/item\.poiRating\b/);
  });

  it('no snake_case dead fallbacks remaining', () => {
    const block = fnMatch![0];
    // Strip comments first so comment text doesn't leak through
    const codeOnly = block
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/item\.poi_id\b/);
    expect(codeOnly).not.toMatch(/item\.poi_name\b/);
    expect(codeOnly).not.toMatch(/item\.poi_address\b/);
    expect(codeOnly).not.toMatch(/item\.poi_type\b/);
    expect(codeOnly).not.toMatch(/item\.poi_rating\b/);
  });
});
