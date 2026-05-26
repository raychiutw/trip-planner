/**
 * index.html FOUC-prevention dark mode init — regression for v2.33.117.
 *
 * Bug context: 未登入 page (login/signup/forgot/verify/reset) 在 user 設過 dark mode
 * 或系統 prefers-color-scheme dark 時，初始 paint 為 light，re-render 後才切 dark
 * → 視覺像「未登入頁不認 dark mode 設定」。
 *
 * Fix: index.html `<body>` 開頭加 inline blocking script 同步讀 tp-color-mode
 * localStorage + 檢查 prefers-color-scheme + 加 body.dark class，在 React mount
 * 前完成 — 第一個 paint 就是正確主題。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '../../index.html'), 'utf8');

describe('index.html v2.33.117 FOUC-prevention dark mode (regression)', () => {
  it('inline script 讀 tp-color-mode localStorage', () => {
    expect(SRC).toContain("localStorage.getItem('tp-color-mode')");
  });

  it('legacy tp-dark key 仍 fallback 識別', () => {
    expect(SRC).toContain("localStorage.getItem('tp-dark')");
  });

  it('auto mode 檢查 prefers-color-scheme', () => {
    expect(SRC).toMatch(/matchMedia\(['"]\(prefers-color-scheme: dark\)['"]\)/);
  });

  it('dark 時加 body.dark class + 更新 meta theme-color', () => {
    expect(SRC).toContain("document.body.classList.add('dark')");
    expect(SRC).toContain("'#1A140F'"); // dark theme-color
  });

  it('script 在 React mount 之前（block paint）', () => {
    const scriptIdx = SRC.indexOf("localStorage.getItem('tp-color-mode')");
    const reactRootIdx = SRC.indexOf('id="reactRoot"');
    const moduleIdx = SRC.indexOf('src="src/entries/main.tsx"');
    expect(scriptIdx).toBeGreaterThan(0);
    expect(scriptIdx).toBeLessThan(reactRootIdx);
    expect(scriptIdx).toBeLessThan(moduleIdx);
  });
});

describe('VerifyEmailPage v2.33.117 token alignment', () => {
  const VPAGE = readFileSync(
    join(__dirname, '../../src/pages/VerifyEmailPage.tsx'),
    'utf8',
  );

  it('不再用 undefined token --color-bg / --color-paper', () => {
    expect(VPAGE).not.toContain('var(--color-bg)');
    expect(VPAGE).not.toContain('var(--color-paper)');
  });

  it('shell 用 --color-secondary，card 用 --color-background（對齊其他 auth page）', () => {
    expect(VPAGE).toContain('var(--color-secondary)');
    expect(VPAGE).toContain('var(--color-background)');
  });
});
