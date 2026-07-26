import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

/**
 * #1162 · 類級守衛：操作面板頁不得直接用 `useSearchParams` 的 setter。
 *
 * ## 為什麼需要「類級」而不只是行為測試
 *
 * `tests/unit/change-poi-tab-preserves-stack-depth.test.tsx` 守的是 ChangePoiPage 這一個
 * 已知的呼叫點。但這個坑是**整類**的：任何用 `OperationShell` 的頁面，只要更新查詢字串
 * 就會把 `location.state` 清成 `null`（react-router 的 setter 只做
 * `navigate('?'+params, opts)`，`createLocation` 的 state 只取 `opts.state`、不合併）
 * → `OperationShell` 讀不到 `state.depth` → 桌機「‹ 返回上一層」消失。
 *
 * **行為測試擋不到還不存在的呼叫點。** 今天 AddStopPage / AddEntryPage 是 latent
 * （它們的入口沒帶 depth），但只要哪天有人 push 進去時帶了 depth，同一個 bug 就復活。
 * 所以這裡鎖「寫法」而不是「行為」—— 一旦有人在面板頁寫裸 setter，這支就紅。
 *
 * 寫法沿用 repo 慣用的 source-grep 守衛（prior art：
 * tests/unit/silent-savestatus-explicit-back-nav.test.ts 的 scanDir + ALLOWLIST）。
 */

const PAGES_DIR = resolve(__dirname, '../../src/pages');

/**
 * 允許例外的檔案（相對 src/pages）。
 *
 * 目前為空 —— 刻意保留這個機制但不放任何項目：有需要例外時必須在這裡寫下**為什麼**，
 * 而不是讓守衛靜默失效。空的 allowlist 也讓「有人偷偷加一項」在 review 時看得見。
 */
const ALLOWLIST: ReadonlyArray<string> = [];

function listPageFiles(): string[] {
  const out: string[] = [];
  for (const name of readdirSync(PAGES_DIR)) {
    if (!name.endsWith('.tsx') && !name.endsWith('.ts')) continue;
    out.push(name);
  }
  return out.sort();
}

/** 剝掉註解，避免拿說明文字當違規（#1168 寫守衛時踩過這個坑）。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('#1162 — 用 OperationShell 的頁面不得直接用 useSearchParams setter', () => {
  const files = listPageFiles();

  it('src/pages 掃得到檔案（守衛沒有掃到空目錄）', () => {
    // 沒有這條，目錄改名或 glob 寫錯會讓整支守衛靜默通過 —— 那是最糟的一種綠。
    expect(files.length).toBeGreaterThan(10);
  });

  it('每一個引用 OperationShell 的頁面都走 useStackSearchParams', () => {
    const offenders: string[] = [];
    let panelPageCount = 0;

    for (const name of files) {
      if (ALLOWLIST.includes(name)) continue;
      const code = stripComments(readFileSync(join(PAGES_DIR, name), 'utf8'));
      if (!/OperationShell/.test(code)) continue;
      panelPageCount += 1;
      // 裸的 hook 呼叫：`= useSearchParams()`。只看呼叫、不看 import，因為
      // type-only import 或別名不構成問題。
      if (/=\s*useSearchParams\s*\(/.test(code)) offenders.push(name);
    }

    // 先確認真的掃到了面板頁 —— 否則「零違規」只是因為條件沒命中任何檔案。
    expect(panelPageCount, '沒有掃到任何使用 OperationShell 的頁面 —— 守衛條件失效').toBeGreaterThanOrEqual(3);

    expect(
      offenders,
      `這些操作面板頁直接用了 useSearchParams 的 setter，會把 location.state 清成 null、`
        + `讓桌機的「‹ 返回上一層」消失（#1162）。改用 src/hooks/useStackSearchParams：`
        + offenders.join(', '),
    ).toEqual([]);
  });

  it('useStackSearchParams 本體確實會把堆疊 state 帶到新 location', () => {
    // 守衛叫大家用這支 hook，那就得順手鎖住「這支 hook 真的有做那件事」——
    // 否則所有頁面都乖乖改用它，而它其實什麼都沒做。
    const hook = stripComments(
      readFileSync(resolve(__dirname, '../../src/hooks/useStackSearchParams.ts'), 'utf8'),
    );
    expect(hook, 'hook 沒有讀 location.state').toMatch(/pickStackState\(location\.state\)/);
    expect(hook, 'hook 沒有把 state 交給 setter').toMatch(/state:\s*stackState/);
    expect(hook, 'hook 沒有保留 depth').toMatch(/'depth'/);
  });
});

describe('#1162 — 操作面板 push 進更深一層時必須帶 depth', () => {
  // 與上面的守衛互補：上面管「更新查詢字串時不要弄丟 depth」，這裡管「push 時要先有 depth」。
  // 兩者缺一都會讓桌機的「‹ 返回上一層」不見 —— 同一個使用者症狀、兩個不同成因。
  const read = (rel: string) =>
    readFileSync(resolve(__dirname, '../..', rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('AddEntryPage 的「選來源」push 帶 depth（原本漏了，桌機一進去就沒有 ‹）', () => {
    const code = read('src/pages/AddEntryPage.tsx');
    const m = /navigate\(\s*`\/trip\/\$\{encodeURIComponent\(tripId\)\}\/stop\/0\/change-poi[^`]*`\s*,([\s\S]{0,120}?)\)/.exec(code);
    expect(m, '找不到 AddEntryPage 進 change-poi 的 navigate —— 呼叫形狀改了，守衛要跟著改').not.toBeNull();
    expect(m![1], 'push 進更深一層卻沒帶 state.depth').toMatch(/depth:\s*2/);
  });

  it('EditEntryPage 三個同型 push 都帶 depth（回歸鎖，不要在重構時掉掉）', () => {
    const code = read('src/pages/EditEntryPage.tsx');
    // ⚠ 逐行比對，不要用 /navigate\([^)]*change-poi[^)]*\)/ —— 呼叫裡有
    // `encodeURIComponent(tripId!)`，`[^)]*` 會在那個 `)` 提前停住而抓到 0 筆，
    // 讓「數量 >= 3」這條變成唯一擋住假綠的東西（第一版正是這樣紅的）。
    const pushes = code
      .split('\n')
      .filter((l) => l.includes('change-poi') && l.includes('navigate('));
    expect(pushes.length, 'EditEntryPage 進 change-poi 的 push 數量變了 —— 守衛要跟著更新').toBeGreaterThanOrEqual(3);
    for (const p of pushes) {
      expect(p, `這個 push 沒帶 depth：${p.trim().slice(0, 100)}`).toMatch(/depth:\s*2/);
    }
  });
});
