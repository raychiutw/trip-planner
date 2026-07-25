import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { useSheetBehavior } from '../../src/hooks/useSheetBehavior';

afterEach(() => cleanup());

/**
 * #1161 · 宣告 aria-modal 就必須真的有 focus trap。
 *
 * 分兩層驗，因為兩層會壞的方式不同：
 *   1. **引擎層** —— Tab / Shift+Tab 真的在 panel 內繞回。trap 是純 JS
 *      （`handlePanelKeyDown` 攔 Tab + preventDefault + focus()），jsdom 量得準。
 *      這跟 #1160 的焦點**還原**不同 —— 那個依賴瀏覽器原生行為，只能在真瀏覽器驗。
 *   2. **接線層** —— 兩個手刻覆蓋層（ShareLinkModal / TravelPillDialog）確實把
 *      `panelRef` 與 `onKeyDown={handlePanelKeyDown}` 掛上去了。引擎再對，沒接上就沒用；
 *      而「有沒有接上」正是本票要修的東西，所以它需要自己的斷言。
 */

describe('#1161 引擎層 — Tab 在 panel 內繞回', () => {
  function Harness() {
    const { panelRef, handlePanelKeyDown } = useSheetBehavior(true, () => {});
    return (
      <>
        <button type="button" data-testid="outside-before">在對話框外（前）</button>
        <div ref={panelRef} tabIndex={-1} onKeyDown={handlePanelKeyDown} data-testid="panel">
          <button type="button" data-testid="first">第一個</button>
          <button type="button" data-testid="middle">中間</button>
          <button type="button" data-testid="last">最後一個</button>
        </div>
        <button type="button" data-testid="outside-after">在對話框外（後）</button>
      </>
    );
  }

  it('焦點在最後一個時按 Tab → 繞回第一個（不會跑到對話框外）', () => {
    render(<Harness />);
    const last = screen.getByTestId('last');
    const first = screen.getByTestId('first');
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(screen.getByTestId('panel'), { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('焦點在第一個時按 Shift+Tab → 繞到最後一個', () => {
    render(<Harness />);
    const first = screen.getByTestId('first');
    const last = screen.getByTestId('last');
    first.focus();
    fireEvent.keyDown(screen.getByTestId('panel'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('中間的元素按 Tab 不被攔 —— trap 只在邊界接手，不接管整個 Tab 順序', () => {
    render(<Harness />);
    const middle = screen.getByTestId('middle');
    middle.focus();
    const e = fireEvent.keyDown(screen.getByTestId('panel'), { key: 'Tab' });
    // fireEvent 回 false 代表 preventDefault 被呼叫過。中間位置不該被攔，
    // 要讓瀏覽器自己走原生 Tab 順序。
    expect(e, '中間位置的 Tab 被 preventDefault 了 —— trap 攔太多會弄壞原生順序').toBe(true);
  });

  it('非 Tab 鍵完全不碰', () => {
    render(<Harness />);
    const last = screen.getByTestId('last');
    last.focus();
    fireEvent.keyDown(screen.getByTestId('panel'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(last);
  });
});

describe('#1161 接線層 — 兩個手刻覆蓋層確實接上引擎', () => {
  // 這兩個元件在 e2e 都要多步導航才碰得到（分享要先開行程動作選單、交通方式要先進
  // timeline 點膠囊），而「有沒有接上引擎」是可以直接從原始碼判定的事實。
  // 用原始碼斷言換取確定性，並在下面同時鎖住「手刻的 Escape listener 已移除」——
  // 留著會與引擎的 top-most 判定打架（巢狀時兩個一起關）。
  const CASES = [
    { name: 'ShareLinkModal', path: 'src/components/share/ShareLinkModal.tsx' },
    { name: 'TravelPillDialog', path: 'src/components/trip/TravelPillDialog.tsx' },
  ];

  for (const { name, path } of CASES) {
    describe(name, () => {
      const src = readFileSync(resolve(__dirname, '../..', path), 'utf8');
      // 剝註解：本次改動在註解裡寫了大量「原本手刻 Escape listener」之類的說明，
      // 不剝掉會拿自己的說明當違規（#1168 寫守衛時踩過同一個坑）。
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

      it('宣告了 aria-modal', () => {
        expect(code).toMatch(/aria-modal="true"/);
      });

      it('接了 useSheetBehavior', () => {
        expect(code).toMatch(/useSheetBehavior\s*\(/);
      });

      it('panelRef 與 handlePanelKeyDown 都掛上了（少一個 trap 就不會生效）', () => {
        expect(code, 'panelRef 沒掛 → 引擎抓不到 panel，trap 直接 return').toMatch(/ref=\{panelRef\}/);
        expect(code, 'handlePanelKeyDown 沒掛 → Tab 事件根本進不了 trap').toMatch(
          /onKeyDown=\{handlePanelKeyDown\}/,
        );
      });

      it('沒有自己手刻的 Escape listener（要交給引擎的 top-most 判定）', () => {
        // 手刻版本會在巢狀時把外層一起關掉，也沒有 IME 組字保護。
        expect(code).not.toMatch(/addEventListener\(\s*['"]keydown['"]/);
      });
    });
  }
});

describe('#1161 交通方式對話框不得有假拖曳把手', () => {
  const src = readFileSync(
    resolve(__dirname, '../../src/components/trip/TravelPillDialog.tsx'),
    'utf8',
  );
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('.tp-travel-dialog-handle 的 CSS 與 JSX 都不存在', () => {
    // 固定高度的覆蓋層畫不出可拖曳行為，畫一個看起來可拖的把手會讓使用者一直嘗試
    // 一個不存在的手勢（誠實介面）。刪視覺元素，不新增手勢。
    expect(code, 'CSS 規則還在').not.toMatch(/\.tp-travel-dialog-handle\s*\{/);
    expect(code, 'JSX 節點還在').not.toMatch(/className="tp-travel-dialog-handle"/);
  });

  it('沒有偷偷改成綁真手勢（本票明確不新增手勢）', () => {
    expect(code).not.toMatch(/onTouchStart|onTouchMove|onPointerDown/);
  });
});
