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
    // inline 連結 ](…)、HTML src=/href=、reference-style [ref]: … 都算；有 scheme 的（https:、mailto:）是外部連結。
    const targets = [...README.matchAll(/(?:(?:src|href)=["']|\]\(|^\[[^\]]+\]:\s*)([^"')#\s]+)/gm)]
      .map((m) => m[1])
      .filter((t) => !/^[a-z][a-z0-9+.-]*:/i.test(t))
      .map((t) => decodeURIComponent(t.replace(/^\.\//, '')));
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) expect(existsSync(path.join(ROOT, t)), t).toBe(true);
  });

  it('docs/readme/ 底下每張圖都有被 README 引用（沒有孤兒檔）', () => {
    // 只看圖檔：macOS Finder 會在資料夾留 .DS_Store（已 gitignore），不能讓它在本機誤報。
    const files = readdirSync(path.join(ROOT, 'docs/readme')).filter((f) => /\.(png|jpe?g|gif|webp|svg)$/i.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(README, f).toContain(`docs/readme/${f}`);
  });
});
