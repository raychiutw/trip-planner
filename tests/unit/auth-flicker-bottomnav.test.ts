/**
 * v2.31.40 fix — GlobalBottomNav auth flicker
 *
 * useCurrentUser 三態（undefined=loading / null=未登入 / CurrentUser=已登入），
 * docstring 明確警告「Caller 必須保留 undefined loading state，不要先當成未登入，
 * 避免 auth-dependent chrome flicker」。但所有 callsite 寫 `authed={!!user}` 把
 * loading (undefined) 當未登入 → mobile bottom nav 第 5 tab 短暫顯示「登入」
 * 然後 fetch 完成 re-render 變「帳號」。QA loop @ /favorites 截到 flicker。
 *
 * Fix：sed all callsite `!!user` → `user !== null`（樂觀預設，undefined 視為
 * truthy = 顯示「帳號」；null 確認未登入才顯示「登入」）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PAGES_DIR = resolve(__dirname, '../../src/pages');

function readAllPages(): Array<{ name: string; content: string }> {
  return readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((name) => ({
      name,
      content: readFileSync(join(PAGES_DIR, name), 'utf8'),
    }));
}

describe('v2.31.40 GlobalBottomNav auth flicker fix', () => {
  it('沒有任何 page 用 authed={!!user} pattern（loading 視為 truthy）', () => {
    const pages = readAllPages();
    const offenders: string[] = [];
    for (const { name, content } of pages) {
      if (/authed=\{!!user\}/.test(content)) offenders.push(`${name}: !!user`);
      if (/authed=\{!!auth\.user\}/.test(content)) offenders.push(`${name}: !!auth.user`);
      if (/authed=\{!!currentUser\}/.test(content)) offenders.push(`${name}: !!currentUser`);
    }
    expect(offenders).toEqual([]);
  });

  it('callsite 用 user !== null pattern（undefined → true 樂觀預設）', () => {
    const pages = readAllPages();
    let count = 0;
    for (const { content } of pages) {
      // 計 user !== null / auth.user !== null / currentUser !== null
      const matches = content.match(/authed=\{(user|auth\.user|currentUser)\s*!==\s*null\}/g);
      if (matches) count += matches.length;
    }
    // 至少 20 個 callsite（grep 過 22+ callsite）
    expect(count).toBeGreaterThanOrEqual(20);
  });
});
