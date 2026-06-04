/**
 * main.tsx SW unhandled rejection regression — Sentry #7359874308 / #7355334934
 * / #7525493273 ("Error: Rejected", culprit /registerSW.js)
 *
 * 兩類 SW reject 都會變 unhandled promise rejection 上 Sentry：
 *   1. iOS Chrome 偶發「Script /sw.js load failed」TypeError / SecurityError
 *      → reg.update() reject。
 *   2. Chrome Mobile 無痕 / 儲存停用 / 企業政策 → navigator.serviceWorker
 *      .register('/sw.js') reject（原本 vite-plugin-pwa 自動注入的 registerSW.js
 *      沒 .catch）。
 *
 * 修法：vite.config.ts injectRegister:false 關掉自動注入，改由 main.tsx 自行
 * register('/sw.js') 並 chain .catch(() => {}) 靜默吞下兩類 reject。
 *
 * 這裡用 source-grep 驗 register + .catch 仍在 chain 上（避免之後 refactor 又拔掉）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MAIN_TSX = resolve(__dirname, '../../src/entries/main.tsx');
const VITE_CONFIG = resolve(__dirname, '../../vite.config.ts');

describe('main.tsx SW registration error swallow', () => {
  const src = readFileSync(MAIN_TSX, 'utf8');

  it('自行 register(\'/sw.js\') chain 包含 .catch', () => {
    const swBlock = src.match(/serviceWorker[\s\S]*?\.register\(['"]\/sw\.js['"][\s\S]*?\}\)\s*;?\s*\}/);
    expect(swBlock, 'SW registration block 必須存在').toBeTruthy();
    expect(swBlock?.[0]).toMatch(/\.catch\s*\(/);
  });

  it('reg.update() 在 .then 內回傳（讓 reject 進入下游 .catch）', () => {
    expect(src).toMatch(/\.then\(\(reg\) => reg\.update\(\)\)/);
  });
});

describe('vite-plugin-pwa registerSW.js auto-inject disabled', () => {
  const cfg = readFileSync(VITE_CONFIG, 'utf8');

  it('injectRegister:false — 不注入無 .catch 的 registerSW.js', () => {
    expect(cfg).toMatch(/injectRegister:\s*false/);
  });
});
