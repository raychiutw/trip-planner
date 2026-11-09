// @vitest-environment node
/**
 * 本機開發的 API 代理（#1646）：瀏覽器同源打 /api，由 vite 轉到新 api，不需動 CORS 白名單。
 * 只鎖「不放寬 production、不含機密、文件講得出做法」，真正的連線由 npm run dev 手動驗證。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error mjs 無型別宣告
import { devApiProxy } from '../../scripts/dev-proxy.mjs';

describe('devApiProxy', () => {
  it('沒設 DEV_API_PROXY_TARGET → 維持舊預設 http://localhost:8788', () => {
    expect(devApiProxy({})['/api'].target).toBe('http://localhost:8788');
  });
  it('DEV_API_PROXY_TARGET 可指到新 api（本機 wrangler dev 或 staging）', () => {
    expect(devApiProxy({ DEV_API_PROXY_TARGET: 'https://trip-planner-api.lean-lean.workers.dev' })['/api'].target)
      .toBe('https://trip-planner-api.lean-lean.workers.dev');
  });
  it('proxyReq 會移除 Origin（否則瀏覽器的 localhost origin 會被新 api 的白名單 403）', () => {
    const removed: string[] = [];
    let handler: ((req: { removeHeader: (n: string) => void }) => void) | undefined;
    devApiProxy({})['/api'].configure({ on: (ev: string, fn: typeof handler) => { if (ev === 'proxyReq') handler = fn; } });
    handler!({ removeHeader: (n) => removed.push(n) });
    expect(removed).toContain('origin');
  });
});

describe('本機開發設定檔與文件', () => {
  const example = readFileSync('.env.local.example', 'utf8');
  it('.env.local.example 列出 DEV_API_PROXY_TARGET，且不含機密樣式的值', () => {
    expect(example).toMatch(/DEV_API_PROXY_TARGET/);
    expect(example).not.toMatch(/(SECRET|PRIVATE_KEY|TOKEN)\s*=\s*\S+/i);
    expect(example).not.toMatch(/-----BEGIN/);
  });
  it('CONTRIBUTING.md 說明本機開發的新 api 做法，且不建議在 production 白名單加 localhost 或 *', () => {
    const doc = readFileSync('CONTRIBUTING.md', 'utf8');
    expect(doc).toMatch(/DEV_API_PROXY_TARGET/);
    expect(doc).toMatch(/ALLOWED_ORIGINS/);
    expect(doc).not.toMatch(/ALLOWED_ORIGINS\s*=\s*["']?\*/);
  });
});
