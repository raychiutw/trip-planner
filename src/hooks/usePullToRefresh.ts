/**
 * usePullToRefresh — mobile pull-to-refresh for inner scroll containers.
 *
 * iOS Safari 對 inner scroll container（非 document body）沒 native pull-to-refresh，
 * 必須自己 detect touch + 觸發 onRefresh。
 *
 * Trigger 條件：scrollTop=0 + touchstart + touchmove dy > threshold + touchend release。
 * Friction 0.5：拉的位移是 user 移動距離的一半（軟橡皮筋感）。
 *
 * 用法（AppShell）：
 *   const mainRef = useRef<HTMLElement>(null);
 *   const { pullPx, refreshing } = usePullToRefresh(mainRef, () => window.location.reload());
 *   <main ref={mainRef} style={{ transform: `translateY(${pullPx}px)` }}>...</main>
 */
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface PullToRefreshOptions {
  /** 拖動超過此距離 release → trigger refresh。預設 80px。 */
  threshold?: number;
  /** 拖動 friction 倍率。預設 0.5（user 拖 100px 視覺移動 50px）。 */
  friction?: number;
  /** 顯示位移上限，超過不再增加（避免拖到一半天）。預設 threshold * 1.5。 */
  maxPull?: number;
}

interface PullToRefreshResult {
  /** 當前拖動位移（px）— 給 caller 套到 transform translateY。 */
  pullPx: number;
  /** 是否正在 refresh（onRefresh 觸發到 reset 之間）。 */
  refreshing: boolean;
  /** 上一次 refresh 是否失敗（async onRefresh reject）— 給 caller 顯示重試回饋。 */
  failed: boolean;
}

export function usePullToRefresh(
  scrollerRef: RefObject<HTMLElement | null>,
  onRefresh: () => void | Promise<void>,
  opts: PullToRefreshOptions = {},
): PullToRefreshResult {
  const { threshold = 80, friction = 0.5, maxPull = threshold * 1.5 } = opts;

  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  // refs to avoid stale closure + listener churn on refreshing toggle
  const startYRef = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);

  // v2.33.40 round 4.5: stash onRefresh in ref so caller can pass inline arrow
  // without re-binding all 4 touch listeners on every parent render.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function handleTouchStart(e: TouchEvent) {
      // v2.55.x: touch 起點落在可編輯欄位內 → 不當下拉刷新。手機聚焦 textarea/input
      // 後捲動或手指微移常在 scrollTop=0 被誤判成 pull-to-refresh → onRefresh()=reload，
      // 把正在編輯的備註沖掉（景點備註 textarea + 行程筆記頁輸入皆在此 scroller 內）。
      const target = e.target as Element | null;
      if (target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) {
        startYRef.current = null;
        return;
      }
      if (!el || el.scrollTop > 0 || refreshingRef.current) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0]?.clientY ?? null;
      pullRef.current = 0;
    }

    function handleTouchMove(e: TouchEvent) {
      if (startYRef.current === null || !el) return;
      // 中途滾出頂端（user scroll up 過程）→ 取消
      if (el.scrollTop > 0) {
        startYRef.current = null;
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPullPx(0);
        }
        return;
      }
      const cy = e.touches[0]?.clientY ?? startYRef.current;
      const dy = cy - startYRef.current;
      if (dy <= 0) {
        // user 往上拖（不是下拉）— reset 但避免無變化的 setState
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPullPx(0);
        }
        return;
      }
      const visualPull = Math.min(dy * friction, maxPull);
      pullRef.current = visualPull;
      setPullPx(visualPull);
    }

    function handleTouchEnd() {
      const pulled = pullRef.current;
      startYRef.current = null;
      pullRef.current = 0;
      if (pulled >= threshold && !refreshingRef.current) {
        setRefreshing(true);
        // keep visual at threshold during refresh
        setPullPx(threshold);
        // W14：onRefresh 可能是 async soft-refetch（回 promise）或 sync reload。
        // await 讓 spinner 撐到資料回來；reject → 記 failed 供 caller 顯示重試。
        // reload fallback 會直接卸載頁面，下面的 reset 不會有機會跑（也無所謂）。
        void (async () => {
          try {
            await onRefreshRef.current();
            setFailed(false);
          } catch {
            setFailed(true);
          } finally {
            setRefreshing(false);
            setPullPx(0);
          }
        })();
      } else if (pulled !== 0) {
        setPullPx(0);
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
    // v2.33.40 round 4.5: onRefresh 移到 ref，不再放 deps（之前 inline arrow
    // 每父 render 都新 ref → 重綁 4 個 listener。
  }, [scrollerRef, threshold, friction, maxPull]);

  return { pullPx, refreshing, failed };
}
