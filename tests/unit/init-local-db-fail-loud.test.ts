// @vitest-environment node
/**
 * scripts/init-local-db.js — 失敗必須走得到 exit code。
 *
 * 這個 script 每一步都是 catch-and-continue，結尾無條件印「✅ Local DB ready!」exit 0，
 * 所以整份 restore 全掛也會回報成功。
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

/** 用括號配對切出每個 catch 區塊的完整內容 —— 正則配不出巢狀大括號。 */
function catchBlocks(src: string): string[] {
  return [...src.matchAll(/catch\s*\([^)]*\)\s*\{/g)].map((m) => {
    let i = m.index! + m[0].length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    return src.slice(m.index!, i);
  });
}

describe('init-local-db.js — 失敗不能靜默', () => {
  it('每個 catch 區塊都要記錄失敗或直接退出，不能默默吞掉', () => {
    // 逐個 catch 區塊檢查，不是數 failures.push 的個數。數個數的版本是反的：
    // 新增一個「忘記記錄」的 swallow（正是要防的回歸）→ 個數不變 → 綠；
    // 新增一個「有好好記錄」的步驟 → 個數變 6 → 紅。獎懲完全顛倒，
    // 而且清紅燈最省事的方法是把 5 改成 6 —— 那個數字什麼都沒鎖住。
    expect(SRC).toContain('const failures = [];');
    const blocks = catchBlocks(SRC);
    expect(blocks.length).toBeGreaterThan(0); // 0 = 正則壞了，不是「沒有 catch」
    for (const b of blocks) {
      expect(b, `靜默的 catch-and-continue：\n${b}`).toMatch(/failures\.push\(|process\.exit\(|throw /);
    }
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

  it('errDetail 取 stderr 且不得截字數', () => {
    // err.message 開頭是「Command failed: npx wrangler ...」，截 80 字剛好切在原因之前。
    // 鎖「沒有任何截斷呼叫」而不是鎖某一種拼法：只禁 substring(0, 80) 的話，
    // 改成 .slice(0, 80) 或包在外層再截，都能把截斷原封不動加回來而測試全綠。
    const m = SRC.match(/const errDetail = [^\n]*/);
    expect(m, 'errDetail 不見了').not.toBeNull();
    expect(m![0]).toContain('err.stderr');
    expect(m![0]).not.toMatch(/\.(substring|slice|substr)\(/);
  });

  it('失敗一律走 console.error，不混在 console.log 裡', () => {
    // 引號不拘：反引號、單引號、雙引號的 console.log 都不准帶 ✗。
    expect(SRC).not.toMatch(/console\.log\([^)]*✗/);
  });
});
