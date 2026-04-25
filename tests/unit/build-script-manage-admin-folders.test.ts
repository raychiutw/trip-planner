/**
 * package.json `build` script invariant test
 *
 * /manage 和 /admin 是 SPA route，但 server 看到 `/manage`（沒 trailing slash）
 * 時會走 standard "directory canonical 308" 行為 → 必須有 `dist/manage/`
 * directory 存在才會 308 to `/manage/`（而不是 308 to `/` → SPA LegacyRedirect
 * → default trip）。
 *
 * 修復脈絡：PR #239 移除 public/_redirects 後，唯一保證 `/manage` 不再
 * 跳 default trip 的條件是 build 必須複製 dist/index.html 到 dist/manage/
 * 和 dist/admin/。本 test 防止未來重構 build script 時誤刪此段。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('build script — dist/manage and dist/admin folder creation', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'),
  ) as { scripts: { build: string } };

  it('build script 必須在 vite build 後複製 index.html 到 dist/manage 和 dist/admin', () => {
    const script = pkg.scripts.build;
    // 要含 manage 和 admin 兩個目錄名
    expect(script, 'build script 缺 manage 目錄複製').toContain("'manage'");
    expect(script, 'build script 缺 admin 目錄複製').toContain("'admin'");
    // 要含 copyFileSync + index.html
    expect(script, 'build script 缺 index.html 複製邏輯').toMatch(/copyFileSync.*index\.html/);
  });

  it('public/_redirects 必須不存在（會引發 wrangler canonical-strip → 308 to /）', () => {
    const p = path.resolve(__dirname, '../../public/_redirects');
    expect(
      fs.existsSync(p),
      'public/_redirects 被加回會破壞 /manage redirect — 詳見 PR #239 commit message',
    ).toBe(false);
  });
});
