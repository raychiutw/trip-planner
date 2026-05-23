# Round 10 — src/lib runtime reverse imports rip-out (v2.33.54)

**日期**: 2026-05-24
**PR**: TBD (chore/v2.33.54-lib-reverse-imports → master)
**Module**: `src/lib/` ←→ `src/hooks/` / `src/components/`
**LOC**: ~80 lines moved, 0 behaviour change

## 背景

backlog #117 — round 2 已記錄 `src/lib/` 有 reverse import 違反
leaf-layer 約定（lib 不該 import hooks / components / pages）。
此 round 把 2 個違規拆乾淨並立 regression test 鎖住未來不會回退。

## 違規 import (2 個)

### 1. `src/lib/apiClient.ts` → `src/hooks/useOnlineStatus.ts`

```ts
// 違規:
import { reportFetchResult } from '../hooks/useOnlineStatus';
```

`apiClient.ts` 每次 fetch 完打 `reportFetchResult(success)` 通知
online/offline state machine。但 state machine 本身是 module-level
`Set<Listener>` 純 pub/sub，跟 React 無關 — 不該住在 hook 檔。

### 2. `src/lib/tripExport.ts` → `src/components/shared/Toast.tsx`

```ts
// 違規:
import { showToast } from '../components/shared/Toast';
```

`showToast` 是 module-level singleton pub/sub，純資料推進 `toasts[]`
+ `listeners` Set，跟 React 也無關 — 不該住在 component 檔。

## 解法

兩個違規同形：把 module-level state 拆到 leaf 層，原檔 re-export 給
既有 caller backward compat。

### `src/lib/networkBus.ts` (new)

- `offlineSubscribers` / `onlineSubscribers` Set
- `registerNetworkCallbacks(onOffline, onOnline)` 返 unsubscribe
- `reportFetchResult(success)` 觸發對應 subscribers

`src/hooks/useOnlineStatus.ts` 改成：
```ts
import { registerNetworkCallbacks, reportFetchResult } from '../lib/networkBus';
export { registerNetworkCallbacks, reportFetchResult };
// ...其餘 hook 邏輯保留
```

`src/lib/apiClient.ts` 改成 `import { reportFetchResult } from './networkBus'`。

### `src/lib/toastBus.ts` (new)

- `ToastType` / `ToastItem` types
- `getToasts()` / `subscribeToasts(fn)` (returns unsubscribe)
- `showToast` / `dismissToast` / `resetToasts` / `showErrorToast`

`src/components/shared/Toast.tsx` 改成 import + re-export bus API，
`ToastContainer` 用 `subscribeToasts` + `getToasts` 取代直接讀 `listeners` /
`toasts`。

`src/lib/tripExport.ts` 改成 `import { showToast } from './toastBus'`。

## Backward compat

17 個既有 `from '../components/shared/Toast'` import + 多個
`from '../hooks/useOnlineStatus'` import 完全不動 — 兩個原檔 re-export
所有 public API。

## Regression test

`tests/unit/lib-no-reverse-import.test.ts`：
- walk `src/lib/` 全部 .ts/.tsx
- 對每個檔 grep 9 個 forbidden prefix (`../hooks/` / `../components/` / `../pages/` / `../App` / `../main` / `../store/` / `../providers/` / `../context/` / `../contexts/`)
- 任何違規列出 file → forbidden 配對 fail

未來任何 `lib/` 偷加 reverse import 都會被這 test 抓到。

## Status

- ✅ 2 個 reverse import 已拆
- ✅ 1 個 architectural guard test 鎖住
- ✅ tsc clean
- ✅ 2381 / 2381 全綠（+1 從 2380）
- ✅ 17 個既有 Toast caller backward compat
- ✅ #117 完成，closes backlog
