/**
 * vite.config.ts — Sentry release config 測試（B-P6 task 10.1）
 *
 * 確保 sentryVitePlugin 設了 release.name，否則 Sentry source maps 上傳會 fall
 * 在 unnamed release 下，無法依 release 區分 errors / regression rate。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const VITE_CONFIG = fs.readFileSync(
  path.resolve(__dirname, '../../vite.config.ts'),
  'utf8',
);
// 版本 / SHA 的計算已抽到共用模組（帳號頁版本頁尾也要用同一份，避免兩套字串漂移）。
// 這幾條斷言跟著搬，但守的還是同一個不變量：release name 由 version + SHA 組成。
const VERSION_MODULE = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/app-version.mjs'),
  'utf8',
);

describe('vite.config.ts — Sentry release name', () => {
  it('含 sentryRelease const derive from version + SHA', () => {
    expect(VITE_CONFIG).toMatch(/const\s+sentryRelease\s*=/);
    expect(VITE_CONFIG).toMatch(/SENTRY_RELEASE/);
    // release name 必須真的插入版本與 SHA，不是寫死字串
    expect(VITE_CONFIG).toMatch(/\$\{appVersion\}/);
    expect(VITE_CONFIG).toMatch(/\$\{commitSha\}/);
    // 兩者的來源在共用模組
    expect(VERSION_MODULE).toMatch(/npm_package_version/);
  });

  it('sentryVitePlugin call 含 release.name', () => {
    // 從 sentryVitePlugin({...}) 內找 release: { name: ... } 結構
    expect(VITE_CONFIG).toMatch(/sentryVitePlugin\([\s\S]*?release:\s*\{\s*name:\s*sentryRelease[\s\S]*?\}/);
  });

  it('release name fallback to local when no CI env', () => {
    expect(VERSION_MODULE).toMatch(/['"]local['"]/);
  });

  it('uses GITHUB_SHA or CF_PAGES_COMMIT_SHA from CI env', () => {
    expect(VERSION_MODULE).toMatch(/GITHUB_SHA/);
    expect(VERSION_MODULE).toMatch(/CF_PAGES_COMMIT_SHA/);
  });

  it('vite.config 從共用模組取值，不自己重算一套', () => {
    expect(VITE_CONFIG).toMatch(/from\s*['"]\.\/scripts\/app-version\.mjs['"]/);
    expect(VITE_CONFIG).not.toMatch(/process\.env\.npm_package_version/);
  });
});
