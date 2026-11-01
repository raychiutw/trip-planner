// @vitest-environment node
/**
 * `.env.production`（vite build 的正式環境變數）守衛：
 *  - `/oauth/authorize` 頁需要新 api 的網址 → VITE_API_BASE_URL 必須是 production 的 api。
 *  - 新 api 的登入旗標在 production 仍是關閉的 → VITE_NEW_API_AUTH 不可在這個檔案裡被打開（切換是 T21 的人工動作）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

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
  it('不打開 VITE_NEW_API_AUTH（production 仍走舊入口，切換是人工動作）', () => {
    expect(env.VITE_NEW_API_AUTH ?? '').not.toBe('1');
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
