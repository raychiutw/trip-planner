import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * useNavigateBack — explicit-URL back navigation.
 *
 * v2.33.139 拔掉 history-aware fallback：之前用 `navigate(-1)` if history > 1
 * 才 fallback，結果回前頁 destination 不可預測（看 browser 紀錄是什麼）。
 * 改成永遠走 caller-passed explicit URL — 行為一致、可測、無 history footgun
 * （e.g. open in new tab → history.length===1 但仍走 fallback 正確；history 含
 *  external referrer 不會跳回 evil.com / login redirect 之類）。
 *
 * Caller pattern (no change):
 *   const handleBack = useNavigateBack(tripId ? routes.tripsSelected(tripId) : routes.trips());
 */
export function useNavigateBack(fallbackPath: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    navigate(fallbackPath);
  }, [navigate, fallbackPath]);
}
