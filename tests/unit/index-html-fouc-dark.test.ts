/**
 * index.html FOUC-prevention dark mode init — regression for v2.33.117 + v2.33.136.
 *
 * Bug context: 未登入 page (login/signup/forgot/verify/reset) 在 user 設過 dark mode
 * 或系統 prefers-color-scheme dark 時，初始 paint 為 light，re-render 後才切 dark
 * → 視覺像「未登入頁不認 dark mode 設定」。
 *
 * v2.33.117 Fix: index.html `<body>` 開頭加 inline blocking script。
 * v2.33.136 Fix: inline script 被 CSP `script-src 'self'`（無 unsafe-inline）block →
 *   Sentry 「Blocked 'script' from 'inline:'」(7506089366, 260 events / 22 users)。
 *   把 inline content 移到 external `public/dark-mode-init.js`，CSP `'self'` 自動 allow。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(__dirname, '../../index.html'), 'utf8');
const DARK_INIT = readFileSync(
  join(__dirname, '../../public/dark-mode-init.js'),
  'utf8',
);

describe('v2.33.136 FOUC dark mode init — external script (CSP compliant)', () => {
  it('index.html 不再含 inline FOUC script body（避免 CSP block）', () => {
    expect(INDEX_HTML).not.toContain("localStorage.getItem('tp-color-mode')");
    expect(INDEX_HTML).not.toContain("localStorage.getItem('tp-dark')");
  });

  it('index.html 透過 external script 載入 dark-mode-init.js', () => {
    expect(INDEX_HTML).toMatch(/<script\s+src="\/dark-mode-init\.js"\s*><\/script>/);
  });

  it('external script 標籤 sync (無 defer/async) — 必須 block render 才能防 FOUC', () => {
    const tag = INDEX_HTML.match(/<script[^>]*src="\/dark-mode-init\.js"[^>]*><\/script>/)?.[0] ?? '';
    expect(tag).not.toMatch(/\bdefer\b/);
    expect(tag).not.toMatch(/\basync\b/);
  });

  it('external script 在 React mount script 之前（block paint）', () => {
    const initIdx = INDEX_HTML.indexOf('src="/dark-mode-init.js"');
    const reactRootIdx = INDEX_HTML.indexOf('id="reactRoot"');
    const moduleIdx = INDEX_HTML.indexOf('src="src/entries/main.tsx"');
    expect(initIdx).toBeGreaterThan(0);
    expect(initIdx).toBeLessThan(reactRootIdx);
    expect(initIdx).toBeLessThan(moduleIdx);
  });
});

describe('v2.33.136 dark-mode-init.js content (mirrors useDarkMode hook)', () => {
  it('讀 tp-color-mode localStorage', () => {
    expect(DARK_INIT).toContain("localStorage.getItem('tp-color-mode')");
  });

  it('legacy tp-dark key 仍 fallback 識別', () => {
    expect(DARK_INIT).toContain("localStorage.getItem('tp-dark')");
  });

  it('auto mode 檢查 prefers-color-scheme', () => {
    expect(DARK_INIT).toMatch(/matchMedia\(['"]\(prefers-color-scheme: dark\)['"]\)/);
  });

  it('dark 時加 body.dark class + 更新 meta theme-color', () => {
    expect(DARK_INIT).toContain("classList.add('dark')");
    expect(DARK_INIT).toContain("'#1C1C1E'");
  });

  it('body 不存在時 fallback 到 DOMContentLoaded (head 內載入也安全)', () => {
    expect(DARK_INIT).toContain('DOMContentLoaded');
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
