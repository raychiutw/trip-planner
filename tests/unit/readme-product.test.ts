/**
 * readme-product.test.ts — README 產品介紹的連結與截圖契約
 *
 * README 是對外的產品頁：圖片或文件連結壞掉，GitHub 上就是破圖；截圖放進
 * docs/readme/ 卻沒被引用，就是白白留在 git history 的孤兒檔。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const README = readFileSync(path.join(ROOT, 'README.md'), 'utf-8');

describe('README 產品介紹', () => {
  it('所有本地連結與圖片都指向存在的檔案', () => {
    const targets = [...README.matchAll(/(?:src=["']|\]\()([^"')#\s]+)/g)]
      .map((m) => m[1])
      .filter((t) => !/^https?:/.test(t))
      .map((t) => t.replace(/^\.\//, ''));
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) expect(existsSync(path.join(ROOT, t)), t).toBe(true);
  });

  it('docs/readme/ 底下每張圖都有被 README 引用（沒有孤兒檔）', () => {
    const files = readdirSync(path.join(ROOT, 'docs/readme'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(README, f).toContain(`docs/readme/${f}`);
  });

  // 逐一列出字面路徑：gstack pregate 靠字面路徑把圖檔對到這支測試。
  it.each([
    'docs/readme/desktop-trip.png',
    'docs/readme/desktop-print.png',
    'docs/readme/mobile-trip.png',
    'docs/readme/mobile-map.png',
    'docs/readme/mobile-chat.png',
  ])('README 有放 %s', (img) => {
    expect(README).toContain(img);
  });
});
