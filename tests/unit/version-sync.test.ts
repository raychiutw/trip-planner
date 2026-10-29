/**
 * version-sync.test.ts — 發版版號的單一真相
 *
 * /ship 的版號 bump 會同時改 VERSION、package.json、package-lock.json；任何一處手改或
 * merge 漏掉，部署出去的版號（package.json，經 scripts/app-version.mjs 進帳號頁頁尾與
 * Sentry release）就會跟 VERSION／CHANGELOG 對不上。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf-8');

describe('版號一致', () => {
  const version = read('VERSION').trim();
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));

  it('VERSION 是 x.y.z 格式', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('package.json 的 version 等於 VERSION', () => {
    expect(pkg.version).toBe(version);
  });

  it('package-lock.json 的 version 與根套件 version 都等於 VERSION', () => {
    expect(lock.version).toBe(version);
    expect(lock.packages[''].version).toBe(version);
  });
});
