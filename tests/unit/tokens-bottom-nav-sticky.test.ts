/**
 * Unit test — tokens.css .ocean-bottom-nav sticky 定位（B-P2 §4.1-4.2）
 *
 * Bottom nav 從 position: fixed 改 position: sticky，讓它能在 AppShell
 * grid 中正確定位（fixed 會逃出 grid cell，sticky 在 scroll container 內 stick 到底）。
 * 同時保留 safe-area-inset-bottom 處理 iOS home indicator。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const TOKENS_PATH = path.join(__dirname, '..', '..', 'css', 'tokens.css');
const TOKENS = fs.readFileSync(TOKENS_PATH, 'utf8');

describe('tokens.css — .ocean-bottom-nav sticky positioning (B-P2 §4)', () => {
  it('§4.1 .ocean-bottom-nav 用 position: sticky', () => {
    expect(TOKENS).toMatch(/\.ocean-bottom-nav\s*\{[\s\S]*?position:\s*sticky/);
  });

  it('§4.1 .ocean-bottom-nav 用 inset-block-end: 0', () => {
    expect(TOKENS).toMatch(/\.ocean-bottom-nav\s*\{[\s\S]*?inset-block-end:\s*0/);
  });

  it('§4.1 .ocean-bottom-nav 不再使用 position: fixed', () => {
    // 排除 .ocean-overflow-menu 等其他 fixed 用法 — 聚焦 .ocean-bottom-nav rule
    const navRule = TOKENS.match(/\.ocean-bottom-nav\s*\{[\s\S]*?\}/);
    expect(navRule).not.toBeNull();
    expect(navRule![0]).not.toMatch(/position:\s*fixed/);
  });

  it('§4.2 .ocean-bottom-nav 保留 padding-bottom: env(safe-area-inset-bottom)', () => {
    expect(TOKENS).toMatch(
      /\.ocean-bottom-nav\s*\{[\s\S]*?padding-bottom:\s*env\(safe-area-inset-bottom\)/,
    );
  });
});
