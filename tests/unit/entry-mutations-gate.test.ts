/**
 * #1261 entry 變更守門：src/ 內直接打 entries endpoint 的字串只准出現在 entryMutations.ts。
 * 「呼叫點不存在」的掃描（允許檔案掃描）；行為由 tests/unit/entry-mutations.test.tsx 走 interface 驗。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../src');
const ALLOWED = new Set(['src/lib/entryMutations.ts']);
// 直打 entries / add-to-trip endpoint 的呼叫（apiFetch 或 apiFetchRaw + template literal）
const DIRECT = /apiFetch(?:Raw)?\(\s*`\/(?:trips\/\$\{[^}]+\}\/(?:days\/[^`]*\/entries|entries)|poi-favorites\/[^`]*add-to-trip)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

describe('entry 變更 gate', () => {
  it('src/ 內直打 entries endpoint 只存在於 entryMutations.ts', () => {
    const offenders = walk(ROOT)
      .filter((f) => DIRECT.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(resolve(__dirname, '../..').length + 1))
      .filter((f) => !ALLOWED.has(f));
    expect(offenders).toEqual([]);
  });
});
