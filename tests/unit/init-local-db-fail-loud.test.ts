// @vitest-environment node
/**
 * scripts/init-local-db.js — 失敗必須走得到 exit code。
 *
 * 這個 script 每一步都是 catch-and-continue，結尾無條件印「✅ Local DB ready!」exit 0。
 * 2026-07-16 用 repo 現有的 2026-04-24 傾印實測：9 張表全部匯入失敗（傾印欄位與現在的
 * schema 對不上），它照樣印 ✅ 並 exit 0，而 Step 3「Verifying」還親口報了 `pois: 0 rows`。
 *
 * source-grep（非執行）—— 這個 script 沒有 export、沒有 require.main guard，require 它
 * 會直接跑 main() 並打 wrangler。與 tests/unit/init-local-db-table-order.test.ts 同慣例。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/init-local-db.js'),
  'utf8',
);

describe('init-local-db.js — 失敗不能靜默', () => {
  it('每個 catch-and-continue 的步驟都要記進 failures[]', () => {
    expect(SRC).toContain('const failures = [];');
    // 匯入 / fixup / verify 解析不出 / verify catch / database_id 讀不到 —— 五處
    expect((SRC.match(/failures\.push\(/g) || []).length).toBe(5);
  });

  it('failures 非空 → exit 1，而且要在印「Local DB ready」之前', () => {
    // 用順序而不是魔術距離：訊息長度改了不該讓這條紅。
    // 比對真正的 console.log 呼叫，不是裸字串 —— 檔案裡談論這句話的註解也含同樣的字。
    const gateIdx = SRC.indexOf('if (failures.length > 0)');
    const exitIdx = SRC.indexOf('process.exit(1)', gateIdx);
    const readyIdx = SRC.indexOf("console.log('\\n✅ Local DB ready!");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(exitIdx).toBeGreaterThan(gateIdx);
    expect(readyIdx).toBeGreaterThan(exitIdx);
  });

  it('錯誤訊息取 stderr，不截字數', () => {
    // err.message 開頭是「Command failed: npx wrangler ...」，截 80 字剛好切在原因之前。
    expect(SRC).toContain('err.stderr?.toString().trim()');
    expect(SRC).not.toMatch(/err\.message\?\.substring\(0, 80\)/);
  });

  it('失敗一律走 console.error，不混在 console.log 裡', () => {
    expect(SRC).not.toMatch(/console\.log\(`\s*✗/);
  });
});
