# ADR-0004：不引入 state management library

- **Status**：Accepted
- **來源**：自 `ARCHITECTURE.md` 的 Key Architectural Decisions 搬入（2026-07-22）

## Context

前端需要管理服務狀態（trip / requests）與 UI 狀態。

## Decision

- 服務狀態：custom hook + SWR-style fetch。
- UI 狀態：React context 或 local state。
- 不引入 Redux / Zustand。

## Consequences

- 對這個規模的應用，額外的 store 抽象是 overkill。
- **代價**：沒有跨元件的 cache 層 —— 元件 remount 就重新抓資料。這個代價在桌機三欄 shell 上真的咬過一次（開關第三欄面板會重抓中欄資料），修法是讓 `<TripPage>` 成為不隨路由 remount 的單例（見 `src/components/trip/TripPageHost.tsx`），而不是引入 store。
