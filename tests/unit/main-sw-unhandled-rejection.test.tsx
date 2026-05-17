/**
 * main.tsx SW unhandled rejection regression — Sentry #7359874308 / #7355334934
 *
 * iOS Chrome 偶發「Script /sw.js load failed」TypeError / SecurityError，原本
 * navigator.serviceWorker.getRegistration().then((reg) => reg.update()) 沒 .catch
 * → unhandled promise rejection 上 Sentry。修法：chain .catch(() => {}) 靜默吞下。
 *
 * 這裡用 source-grep 驗 .catch 仍在 chain 上（避免之後 refactor 又拔掉）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MAIN_TSX = resolve(__dirname, '../../src/entries/main.tsx');

describe('main.tsx SW registration error swallow', () => {
  const src = readFileSync(MAIN_TSX, 'utf8');

  it('navigator.serviceWorker.getRegistration() chain 包含 .catch', () => {
    const swBlock = src.match(/serviceWorker[\s\S]*?\.getRegistration\(\)[\s\S]*?\}\)\s*;?\s*\}/);
    expect(swBlock, 'SW registration block 必須存在').toBeTruthy();
    expect(swBlock?.[0]).toMatch(/\.catch\s*\(/);
  });

  it('reg.update() 在 .then 內回傳（讓 reject 進入下游 .catch）', () => {
    expect(src).toMatch(/if\s*\(reg\)\s*return\s+reg\.update\(\)/);
  });
});
