// @vitest-environment node
/**
 * `.env.production`（vite build 的正式環境變數）守衛：
 *  - web 的所有 API 請求與認證都走新 api（ADR-0011）→ VITE_API_BASE_URL 必須是 production 的 api。
 *  - 旗標 VITE_NEW_API_AUTH 已移除（新認證是唯一路徑）→ 不可再出現在 `.env.production` 與 `src/`，免得有人以為它還能切回舊入口。
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEADERS = readFileSync('public/_headers', 'utf8');

const env = Object.fromEntries(
  readFileSync('.env.production', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

describe('.env.production', () => {
  it('VITE_API_BASE_URL 指向 production 的新 api（https、無尾斜線）', () => {
    expect(env.VITE_API_BASE_URL).toBe('https://trip-planner-api-production.lean-lean.workers.dev');
  });
  it('旗標 VITE_NEW_API_AUTH 已移除：.env.production 與 src/ 都不再出現', () => {
    expect('VITE_NEW_API_AUTH' in env).toBe(false);
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
    });
    const offenders = walk('src').filter((f) => readFileSync(f, 'utf8').includes('VITE_NEW_API_AUTH'));
    expect(offenders).toEqual([]);
  });
});

describe('_headers 的 CSP connect-src（瀏覽器真的會擋，單元測試測不到，所以在這裡鎖）', () => {
  const connectSrc = /Content-Security-Policy:.*?connect-src([^;]*);/.exec(HEADERS)?.[1] ?? '';
  it('包含 VITE_API_BASE_URL 的精確 origin（否則 /oauth/authorize 的登入請求會被 CSP 擋掉）', () => {
    expect(connectSrc.split(/\s+/)).toContain(new URL(env.VITE_API_BASE_URL!).origin);
  });
  it('不用 *.workers.dev 這類過寬的萬用字元', () => {
    expect(connectSrc).not.toMatch(/\*\.workers\.dev/);
  });
});
