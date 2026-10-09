/**
 * Trip access module 的寫入 gate（functions/api/_auth.ts 的 requireTripWrite）。
 *
 * 規則：handler 要求「呼叫者能寫這個行程」就呼叫 requireTripWrite，不要自己內嵌
 * `if (!(await hasWritePermission(...))) throw new AppError('PERM_DENIED')`。
 * 內嵌版曾散在 18 處（另有 2 份私有複本），改規則要改 20 個地方；requireTripWrite 存在卻沒人用，等於 module 是淺的。
 *
 * 允許例外：需要自訂錯誤訊息的 throw、與其他查詢 Promise.all 平行的檢查（順序／延遲語意不同）。
 * 行為由 tests/api 的授權測試守（真實 D1），這裡只守「不要再長出第二份」。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../..');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
const FILES = walk(join(ROOT, 'functions/api')).filter((p) => !p.endsWith('functions/api/_auth.ts'));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// if (!(await hasWritePermission(...))) { throw new AppError('PERM_DENIED'); }   （無自訂訊息）
const INLINE = /if\s*\(\s*!\s*\(?\s*await\s+hasWritePermission\([^)]*\)\s*\)?\s*\)\s*(\{\s*)?throw new AppError\('PERM_DENIED'\)\s*;?\s*(\})?/g;

describe('寫入 gate 只有 requireTripWrite 一份', () => {
  it('handler 不再內嵌 hasWritePermission → PERM_DENIED', () => {
    const offenders = FILES.flatMap((p) => {
      const n = (strip(readFileSync(p, 'utf8')).match(INLINE) ?? []).length;
      return n ? [`${p.slice(ROOT.length + 1)} ×${n}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it('沒有私有的 requireTripWrite 複本', () => {
    const copies = FILES.filter((p) => /(?:async\s+)?function\s+requireTripWrite\b|const\s+requireTripWrite\s*=/.test(strip(readFileSync(p, 'utf8'))))
      .map((p) => p.slice(ROOT.length + 1));
    expect(copies).toEqual([]);
  });
});
