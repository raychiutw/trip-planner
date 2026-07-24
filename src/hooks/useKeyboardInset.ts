import { useEffect } from 'react';

/**
 * useKeyboardInset — 手機軟鍵盤彈出時，把「被鍵盤從底部佔掉的高度」寫進 CSS var
 * `--kb-inset`（掛 document.documentElement），讓 sticky/fixed 在底部的互動元件
 * （聊天 composer）能上移到鍵盤上方、不被蓋住（W8，visualViewport 首引入）。
 *
 * iOS Safari：軟鍵盤彈出時 layout viewport 不變、visualViewport 縮小。`sticky
 * bottom:0` 會貼 layout viewport 底 = 被鍵盤蓋。用 visualViewport 算出被佔高度補回。
 * 無 visualViewport（桌機舊瀏覽器 / SSR）：no-op，`--kb-inset` 維持 0。
 */
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
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--kb-inset');
    };
  }, []);
}
