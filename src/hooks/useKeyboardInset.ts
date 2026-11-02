import { useEffect } from 'react';

/**
 * useKeyboardInset — 手機軟鍵盤彈出時，把「被鍵盤從底部佔掉的高度」寫進 CSS var
 * `--kb-inset`（掛 document.documentElement），讓 sticky/fixed 在底部的互動元件
 * （聊天 composer）能上移到鍵盤上方、不被蓋住（W8，visualViewport 首引入）。
 *
 * iOS Safari：軟鍵盤彈出時 layout viewport 不變、visualViewport 縮小。`sticky
 * bottom:0` 會貼 layout viewport 底 = 被鍵盤蓋。用 visualViewport 算出被佔高度補回。
 * 無 visualViewport（桌機舊瀏覽器 / SSR）：no-op，`--kb-inset` 維持 0。
 *
 * #1140 item 10（Apple HIG）：軟鍵盤彈出時把底部 root tab（`.app-shell-bottom-nav`）收起 ——
 * 除了寫 `--kb-inset`，inset 超過門檻時在 documentElement 掛 `data-kb-open="1"`，由 CSS 把
 * 膠囊往下滑出畫面（讓打字時螢幕留給內容 + 鍵盤，符合 iOS 鍵盤彈出即收 tab bar 的慣例）。
 * 用門檻（KB_OPEN_THRESHOLD_PX）過濾 Safari URL bar 顯隱造成的小幅 viewport 變化，避免誤收。
 * 全站掛一次（app root），故 `--kb-inset` 對所有頁面可用（聊天 composer 讀它上移）。
 */
// 軟鍵盤佔高通常 250–350px；Safari URL bar 顯隱約 <120px。以 120px 為界區分「真的是鍵盤」。
const KB_OPEN_THRESHOLD_PX = 120;

export function useKeyboardInset(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      // window.innerHeight = layout viewport 高；vv.height + vv.offsetTop = 可視底緣。
      // 差值 = 底部被鍵盤（或其他 UA chrome）佔掉的高度。
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--kb-inset', `${Math.round(inset)}px`);
      if (inset > KB_OPEN_THRESHOLD_PX) root.setAttribute('data-kb-open', '1');
      else root.removeAttribute('data-kb-open');
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--kb-inset');
      root.removeAttribute('data-kb-open');
    };
  }, []);
}
