import { useCallback } from 'react';
import { useLocation, useSearchParams, type NavigateOptions } from 'react-router-dom';

/**
 * useStackSearchParams — 更新查詢字串但**不抹掉堆疊層級**（#1162）。
 *
 * ## 為什麼需要它
 *
 * 桌機操作面板的「第幾層」由 push 端寫在 `location.state.depth`（`OperationShell` 讀它
 * 決定要不要給「‹ 返回上一層」，見 DESIGN.md「Operation stacking」）。
 *
 * 而 react-router 的 `useSearchParams` setter **會清掉 state**：它只做
 * `navigate('?' + params, opts)`，router 內部 `createLocation(current, path, opts?.state, …)`
 * 的 state **只取 `opts.state`、不與現有 location.state 合併**（實測 react-router 7.18.1）。
 * 所以任何 `setSearchParams(next, { replace: true })` 都會把 `state` 變成 `null`
 * → `depth` 落回預設 1 → 桌機的 ‹ 當場消失，使用者只剩 ✕、回不到上一個操作頁。
 *
 * 這不是某一個呼叫點寫錯，是**整類**的坑：面板頁只要更新查詢字串就會中。所以修在共用
 * hook、而不是逐一補 `state:` —— 並配一支 source-grep 守衛
 * （`tests/unit/operation-shell-search-params-guard.test.ts`）擋掉未來新增的裸呼叫點。
 *
 * ## 為什麼只帶回白名單而不是整包 state
 *
 * 整包帶回會連 `scrollAnchor` 之類的一次性欄位一起複製到新 location，讓「回到上次位置」
 * 之類的行為在切分頁後重新觸發。這裡只保留堆疊語意需要的兩個 key。
 */

/** 堆疊語意需要跨查詢字串更新保留的 state key。 */
const STACK_STATE_KEYS = ['depth', 'opStacked'] as const;

type StackState = { depth?: number; opStacked?: boolean };

/** 從任意 location.state 取出堆疊相關欄位；沒有就回 undefined（不要產生空物件）。 */
export function pickStackState(state: unknown): StackState | undefined {
  if (!state || typeof state !== 'object') return undefined;
  const src = state as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of STACK_STATE_KEYS) {
    if (src[k] !== undefined) out[k] = src[k];
  }
  return Object.keys(out).length > 0 ? (out as StackState) : undefined;
}

export type StackSearchParamsSetter = (
  next: URLSearchParams,
  options?: NavigateOptions,
) => void;

/**
 * 與 `useSearchParams` 同形，但 setter 會把 `depth` / `opStacked` 帶到新 location。
 *
 * 呼叫方明確傳 `options.state` 時以呼叫方為準（不覆蓋刻意的指定）。
 */
export function useStackSearchParams(): [URLSearchParams, StackSearchParamsSetter] {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const setStackSearchParams = useCallback<StackSearchParamsSetter>(
    (next, options) => {
      if (options && 'state' in options) {
        // 呼叫方自己決定 state → 尊重它，不要偷偷合併（否則除錯時找不到值從哪來）。
        setSearchParams(next, options);
        return;
      }
      const stackState = pickStackState(location.state);
      setSearchParams(next, stackState ? { ...options, state: stackState } : options);
    },
    // location.state 而非整個 location：只有 state 變動才需要新的 setter。
    [location.state, setSearchParams],
  );

  return [searchParams, setStackSearchParams];
}
