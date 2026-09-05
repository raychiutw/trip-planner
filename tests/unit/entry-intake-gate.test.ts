/**
 * #1259 entry intake 守門：functions/ 內只有 entry intake module 可以 INSERT trip_entries。
 * 這是「呼叫點不存在」的掃描（允許檔案掃描），不是拿 regex 冒充行為測試 ——
 * 行為由 tests/api/entry-intake*.integration.test.ts 走 interface 驗。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../functions');
const ALLOWED = new Set(['functions/api/_entryWrite.ts']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('entry intake gate', () => {
  it('functions/ 內 INSERT INTO trip_entries 只存在於 _entryWrite.ts', () => {
    const offenders = walk(ROOT)
      .filter((f) => /INSERT\s+INTO\s+trip_entries\b/i.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(resolve(__dirname, '../..').length + 1))
      .filter((f) => !ALLOWED.has(f));
    expect(offenders).toEqual([]);
  });
});
