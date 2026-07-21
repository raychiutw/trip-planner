// @vitest-environment node
/**
 * navItems 宣告的每個 icon 名稱都必須真的存在於 Icon 元件
 *
 * 2026-07-21：加第五個「帳號」tab 時，我隨手寫了 `icon: 'nav-account'` ——
 * 那個名稱**從來不存在**。`Icon` 對未知名稱靜默不渲染，所以 tsc、lint、
 * 單元測試、e2e **全部綠燈**，直到 owner 在手機上看到「帳號」tab 沒有圖示。
 *
 * 型別擋不住這種錯（icon 欄位是 string），所以用測試擋：navItems 的每個
 * icon 名稱都要能在 Icon 的 paths 表裡找到。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

describe('navItems 的 icon 都存在', () => {
  it('每個 icon 名稱都能在 Icon 元件找到對應 path', () => {
    const navSrc = read('src/components/shell/navItems.ts');
    const iconSrc = read('src/components/shared/Icon.tsx');

    const declared = [...navSrc.matchAll(/icon:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(declared.length, '應該有解析到 icon 宣告').toBeGreaterThan(0);

    for (const name of declared) {
      expect(
        iconSrc.includes(`'${name}':`),
        `navItems 宣告了 icon「${name}」，但 Icon 元件沒有這個 path —— ` +
        'Icon 對未知名稱靜默不渲染，所以不會有任何錯誤訊息，只會少一個圖示',
      ).toBe(true);
    }
  });
});
