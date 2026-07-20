/**
 * 版本資訊頁尾 — 帳號頁底部顯示 app 版本 + commit
 *
 * 為什麼要有：使用者回報問題時第一個要問的就是「你用哪一版」。
 * 目前版本號**完全沒有**傳到前端 —— 沒有 vite define、前端零顯示，
 * 只有 Sentry release tag 帶著（使用者看不到）。
 *
 * 來源與 Sentry release 同源（vite.config.ts 的 sentryRelease），避免兩套版本字串漂移。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../');
const accountPage = readFileSync(resolve(ROOT, 'src/pages/AccountPage.tsx'), 'utf-8');

/** 剝掉註解 —— 解釋用的散文不該滿足「必須存在 X」的斷言。 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const versionModule = strip(readFileSync(resolve(ROOT, 'scripts/app-version.mjs'), 'utf-8'));
const viteConfig = strip(readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf-8'));
const vitestConfig = strip(readFileSync(resolve(ROOT, 'vitest.config.js'), 'utf-8'));

describe('版本注入 — 單一來源模組', () => {
  it('scripts/app-version.mjs 匯出 versionDefine，含兩個常數', () => {
    expect(versionModule).toMatch(/export const versionDefine\s*=/);
    expect(versionModule).toMatch(/__APP_VERSION__:/);
    expect(versionModule).toMatch(/__APP_COMMIT__:/);
  });

  it('版本源自 package.json 的 version，不是硬寫字串', () => {
    // 硬寫版本號一定會忘記更新。/ship 會 bump package.json，讓它當唯一權威。
    expect(versionModule).toMatch(/appVersion\s*=\s*process\.env\.npm_package_version/);
    expect(versionModule).toMatch(/__APP_VERSION__:\s*JSON\.stringify\(appVersion\)/);
  });

  it('commit 源自 CI / Cloudflare 的 SHA env', () => {
    expect(versionModule).toMatch(/GITHUB_SHA/);
    expect(versionModule).toMatch(/CF_PAGES_COMMIT_SHA/);
  });

  it('Sentry release 與版本頁尾同源（不可各算一套）', () => {
    // 各算一套的話，使用者回報「我用 2.56.13」時 Sentry 上可能對不到那個 release。
    expect(viteConfig).toMatch(/import\s*\{[^}]*appVersion[^}]*\}\s*from\s*['"]\.\/scripts\/app-version\.mjs['"]/);
    expect(viteConfig).toMatch(/sentryRelease\s*=[\s\S]{0,160}\$\{appVersion\}/);
  });

  it('vite 與 vitest **兩份**設定都套用同一個 versionDefine', () => {
    // 這條是本次實際踩到的坑：define 只加在 vite.config.ts，vitest 是獨立設定，
    // 結果任何 render __APP_VERSION__ 的 component 在測試裡 ReferenceError（11 個測試紅）。
    for (const [label, cfg] of [['vite.config.ts', viteConfig], ['vitest.config.js', vitestConfig]] as const) {
      expect(cfg, `${label} 必須 import versionDefine`).toMatch(/versionDefine/);
      expect(cfg, `${label} 必須把它掛在 define`).toMatch(/define:\s*versionDefine/);
    }
  });
});

describe('版本注入 — TypeScript 宣告', () => {
  it('有 global 宣告，否則 tsc 會爆 cannot find name', () => {
    const envDts = readFileSync(resolve(ROOT, 'src/vite-env.d.ts'), 'utf-8');
    expect(envDts).toMatch(/declare const __APP_VERSION__:\s*string/);
    expect(envDts).toMatch(/declare const __APP_COMMIT__:\s*string/);
  });
});

describe('帳號頁 — 版本頁尾', () => {
  it('render 版本字串', () => {
    expect(accountPage).toMatch(/__APP_VERSION__/);
  });

  it('render commit（供 bug report 對版）', () => {
    expect(accountPage).toMatch(/__APP_COMMIT__/);
  });

  it('有 data-testid 供 e2e / 客服指引定位', () => {
    expect(accountPage).toMatch(/data-testid="app-version"/);
  });

  it('版本列在 .tp-account-inner 內（跟著頁面捲動，不是 fixed 浮層）', () => {
    const innerIdx = accountPage.indexOf('tp-account-inner');
    const versionIdx = accountPage.indexOf('data-testid="app-version"');
    expect(innerIdx).toBeGreaterThan(-1);
    expect(versionIdx).toBeGreaterThan(innerIdx);
  });
});
