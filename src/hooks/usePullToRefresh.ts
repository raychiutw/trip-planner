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
}

export function usePullToRefresh(
  scrollerRef: RefObject<HTMLElement | null>,
  onRefresh: () => void,
  opts: PullToRefreshOptions = {},
): PullToRefreshResult {
  const { threshold = 80, friction = 0.5, maxPull = threshold * 1.5 } = opts;

  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // refs to avoid stale closure in event handlers
  const startYRef = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function handleTouchStart(e: TouchEvent) {
      if (!el || el.scrollTop > 0 || refreshing) {
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
        pullRef.current = 0;
        setPullPx(0);
        return;
      }
      const cy = e.touches[0]?.clientY ?? startYRef.current;
      const dy = cy - startYRef.current;
      if (dy <= 0) {
        // user 往上拖（不是下拉）— reset
        pullRef.current = 0;
        setPullPx(0);
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
      if (pulled >= threshold && !refreshing) {
        setRefreshing(true);
        // keep visual at threshold during refresh
        setPullPx(threshold);
        try {
          onRefresh();
        } catch {
          // onRefresh might throw（e.g. window.location 沒準備好）— still reset
          setRefreshing(false);
          setPullPx(0);
        }
      } else {
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
  }, [scrollerRef, onRefresh, threshold, friction, maxPull, refreshing]);

  return { pullPx, refreshing };
}
