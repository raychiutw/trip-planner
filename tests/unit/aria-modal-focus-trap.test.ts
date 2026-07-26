import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

/**
 * 宣告 `aria-modal="true"` 的覆蓋層必須真的把焦點關在裡面（#1150 story 6）。
 *
 * `aria-modal="true"` 是對輔助技術的**承諾**：這層底下的內容不可及。瀏覽器不會替你實現
 * 它 —— 沒有 Tab 攔截的話，鍵盤使用者一路 Tab 就會跑到被遮住的內容上，而螢幕閱讀器
 * 卻已經根據這個屬性把底下的東西藏起來了。**宣告了卻沒做，比不宣告更糟。**
 *
 * 本 repo 的實作是 `useSheetBehavior` —— 它一次給 Escape（含 IME／巢狀 guard）、
 * focus trap、scroll lock、焦點還原。所以守衛的形式是「有 `aria-modal` 就要有它」。
 *
 * ⚠ 這是 source-grep，不是行為測試。它守的是**結構性條件**（有沒有接上引擎），
 * 因為「Tab 到底跑不跑出去」在 jsdom 裡量不準（jsdom 不做真正的 sequential focus
 * navigation，`Tab` 不會自己移動焦點）。引擎本身的 trap 行為由
 * `tests/unit/use-sheet-behavior.test.tsx` 這類元件測試守。
 */

const root = resolve(__dirname, '../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/** 剝掉註解 —— 本 repo 已經三次拿自己的說明註解當違規。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('aria-modal 覆蓋層的 focus trap（#1150）', () => {
  const files = walk(resolve(root, 'src')).map((f) => ({
    file: f.slice(root.length + 1),
    src: stripComments(readFileSync(f, 'utf-8')),
  }));

  const declaring = files.filter((f) => /aria-modal=["{]?["']?true/.test(f.src));

  it('至少掃到幾個 aria-modal 元件（守衛沒有掃空）', () => {
    // meta guard：正則若因寫法改變而失效，下面那條「全部達標」會假綠。
    expect(declaring.length, 'aria-modal 掃到 0 個，正則可能失效').toBeGreaterThan(5);
  });

  /**
   * ⚠ 一定要比對「呼叫」`useSheetBehavior(` 而不是識別字 `useSheetBehavior`。
   * 只比識別字的話，**一個留著沒用的 import 就能讓守衛通過**（2026-07-26 mutation 實測：
   * 把 hook 呼叫整行刪掉、import 留著，守衛仍是綠的）。
   */
  const CALLS_ENGINE = /useSheetBehavior\s*\(/;

  it('每個宣告 aria-modal 的檔案都真的呼叫 useSheetBehavior', () => {
    const offenders = declaring
      .filter((f) => !CALLS_ENGINE.test(f.src))
      .map((f) => f.file);
    expect(offenders, 'aria-modal 是對輔助技術的承諾 —— 宣告了就要真的 trap 焦點').toEqual([]);
  });

  it('每個接上引擎的都把 handlePanelKeyDown 掛到 panel 上（拿了 handler 卻不用 = 沒有 trap）', () => {
    // 這條擋的是「呼叫了 useSheetBehavior 但忘記把 onKeyDown 接上去」——
    // 那種寫法 grep 看起來合規、實際上 Tab 照樣跑出去。
    //
    // ⚠ 必須認 destructuring 改名。`EditTripPage` 寫的是
    //   `handlePanelKeyDown: shiftPanelKeyDown` → `onKeyDown={shiftPanelKeyDown}`，
    // 只比對字面 `onKeyDown={handlePanelKeyDown}` 會把它誤判成違規（2026-07-26 實際踩到）。
    const offenders: string[] = [];
    const noHandler: string[] = [];
    for (const f of declaring) {
      if (!CALLS_ENGINE.test(f.src)) continue;
      if (!f.src.includes('handlePanelKeyDown')) { noHandler.push(f.file); continue; }
      // 取 destructuring 用的實際變數名：`handlePanelKeyDown` 或 `handlePanelKeyDown: alias`
      const alias = f.src.match(/handlePanelKeyDown\s*:\s*([A-Za-z_$][\w$]*)/)?.[1] ?? 'handlePanelKeyDown';
      // 也接受 inline 箭頭（有些面板要先做自己的事再轉呼叫）
      if (!new RegExp(`onKeyDown=\\{\\s*(${alias}\\b|\\()`).test(f.src)) offenders.push(f.file);
    }
    expect(offenders, '拿了 handlePanelKeyDown 卻沒掛到 onKeyDown → trap 是空的').toEqual([]);
    expect(noHandler, '用了 useSheetBehavior 卻沒取 handlePanelKeyDown → 沒有 focus trap').toEqual([]);
  });
});
