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

describe('vite.config.ts — Sentry release name', () => {
  it('含 sentryRelease const derive from version + SHA', () => {
    expect(VITE_CONFIG).toMatch(/const\s+sentryRelease\s*=/);
    expect(VITE_CONFIG).toMatch(/SENTRY_RELEASE/);
    expect(VITE_CONFIG).toMatch(/npm_package_version/);
  });

  it('sentryVitePlugin call 含 release.name', () => {
    // 從 sentryVitePlugin({...}) 內找 release: { name: ... } 結構
    expect(VITE_CONFIG).toMatch(/sentryVitePlugin\([\s\S]*?release:\s*\{\s*name:\s*sentryRelease[\s\S]*?\}/);
  });

  it('release name fallback to local when no CI env', () => {
    expect(VITE_CONFIG).toMatch(/['"]local['"]/);
  });

  it('uses GITHUB_SHA or CF_PAGES_COMMIT_SHA from CI env', () => {
    expect(VITE_CONFIG).toMatch(/GITHUB_SHA/);
    expect(VITE_CONFIG).toMatch(/CF_PAGES_COMMIT_SHA/);
  });
});
