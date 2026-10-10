/**
 * Trip access module 的寫入 gate（functions/api/_auth.ts 的 requireTripWrite）。
 *
 * 規則：handler 要求「呼叫者能寫這個行程」就呼叫 requireTripWrite，不要自己內嵌
 * `if (!(await hasWritePermission(...))) throw new AppError('PERM_DENIED')`。
 * 內嵌版曾散在 18 處（另有 2 份私有複本，加上 _auth.ts 內 requirePoiWrite 一份），改規則要改 21 個地方；
 * requireTripWrite 當時只有 audit 兩處在用，等於 module 是淺的。
 *
 * 允許例外：需要自訂錯誤訊息的 throw、與其他查詢 Promise.all 平行的檢查（順序／延遲語意不同）。
 * 行為由 tests/api 各 handler 的 403 案例守（真實 D1；mutation：把 requireTripWrite 改成不檢查，
 * days／notes／segments／requests 等 4 個授權測試轉紅），這裡只守「不要再長出第二份」。
 * _auth.ts 本身只允許一份（requireTripWrite 的定義）。
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
const ALL = walk(join(ROOT, 'functions/api'));
const AUTH_FILE = ALL.find((p) => p.endsWith('functions/api/_auth.ts'))!;
const FILES = ALL.filter((p) => p !== AUTH_FILE);
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// if (!(await hasWritePermission(...))) { throw new AppError('PERM_DENIED'); }   （無自訂訊息；參數可含一層括號，如 requireAuth(context)）
const INLINE = /if\s*\(\s*!\s*\(?\s*await\s+hasWritePermission\((?:[^()]|\([^()]*\))*\)\s*\)?\s*\)\s*(\{\s*)?throw new AppError\('PERM_DENIED'\)\s*;?\s*(\})?/g;

describe('寫入 gate 只有 requireTripWrite 一份', () => {
  it('handler 不再內嵌 hasWritePermission → PERM_DENIED', () => {
    const offenders = FILES.flatMap((p) => {
      const n = (strip(readFileSync(p, 'utf8')).match(INLINE) ?? []).length;
      return n ? [`${p.slice(ROOT.length + 1)} ×${n}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it('_auth.ts 內也只有 requireTripWrite 的定義這一份（requirePoiWrite 等走它）', () => {
    const n = (strip(readFileSync(AUTH_FILE, 'utf8')).match(INLINE) ?? []).length;
    expect(n).toBe(1);
  });

  it('直接呼叫 hasWritePermission 的檔案只限已知清單（Promise.all 平行檢查／自訂訊息）', () => {
    // 新增或移除都要回來改這份清單 —— 逼你當下決定「為什麼不能用 requireTripWrite」。
    const KNOWN = [
      'functions/api/oauth/downscope.ts',
      'functions/api/poi-favorites/[id]/add-to-trip.ts',
      'functions/api/requests/[id]/index.ts',
      'functions/api/trips/[id].ts',
      'functions/api/trips/[id]/entries/[eid].ts',
      'functions/api/trips/[id]/entries/[eid]/alternates.ts',
      'functions/api/trips/[id]/entries/[eid]/alternates/[poiId].ts',
      'functions/api/trips/[id]/entries/[eid]/alternates/reorder.ts',
      'functions/api/trips/[id]/entries/[eid]/copy.ts',
      'functions/api/trips/[id]/entries/[eid]/master.ts',
      'functions/api/trips/[id]/entries/[eid]/poi-id.ts',
      'functions/api/trips/[id]/entries/[eid]/pois/[poiId].ts',
      'functions/api/trips/[id]/entries/[eid]/trip-pois.ts',
    ];
    const callers = FILES.filter((p) => /hasWritePermission\(/.test(strip(readFileSync(p, 'utf8'))))
      .map((p) => p.slice(ROOT.length + 1)).sort();
    expect(callers).toEqual(KNOWN);
  });

  it('沒有私有的 requireTripWrite 複本', () => {
    const copies = FILES.filter((p) => /(?:async\s+)?function\s+requireTripWrite\b|const\s+requireTripWrite\s*=/.test(strip(readFileSync(p, 'utf8'))))
      .map((p) => p.slice(ROOT.length + 1));
    expect(copies).toEqual([]);
  });
});
