/**
 * color-scheme.test.ts — F004 TDD test
 *
 * 驗證 tokens.css 含 color-scheme 宣告，確保瀏覽器原生 UI
 * （scrollbar、form element、selection color）在 dark mode 下能自動跟隨。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const TOKENS_CSS = resolve(__dirname, '../../css/tokens.css');
const source = readFileSync(TOKENS_CSS, 'utf-8');

describe('F004 — color-scheme 宣告', () => {
  it('tokens.css 包含 color-scheme 宣告', () => {
    expect(source).toMatch(/color-scheme\s*:/);
  });

  it('color-scheme 同時支援 light 與 dark', () => {
    // 應為 light dark（或 only light / only dark，但最佳實踐是 light dark）
    expect(source).toMatch(/color-scheme\s*:\s*light\s+dark/);
  });
});
