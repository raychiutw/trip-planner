# Design: PR 5 Cleanup Follow-up

## 動機

PR 3/4 完成後，`/review` 與 QA dogfood 各自留下 follow-up 清單。這些問題不阻礙功能正常運作，但屬於工程品質債：RBP 違反、editorial 慣例缺口、測試邏輯錯誤。統一在 PR 5 清理，維持 master 的程式碼健康度，避免債務滾雪球。

## 關鍵決策

### Logo Component 統一（F006）

**決定**：直接替換 inline wordmark 為既有 `<TriplineLogo>` component，不做任何 refactor。

TriplineLogo 已在 PR 1 封裝「logo → home Link」行為，是唯一權威實作。StopDetailPage 與 MapPage 的 inline 版本是 PR 1 前的殘留，未在 PR 3/4 清理。此次替換最小 diff，不改 TriplineLogo 本身。

**未選替代**：把 TriplineLogo 拆成 with/without Link 兩個 variant → 過度設計，editorial 規則明確「logo 必 link home」，不需要 without-Link variant。

### Singleton Style Injection（F003）

**決定**：使用 module-level boolean flag + `useEffect` 一次 inject `<style data-scope="trip-map-rail">` 至 `document.head`。

```typescript
// module scope — 程式生命週期只 inject 一次
let injected = false;

function TripMapRail() {
  useEffect(() => {
    if (!injected) {
      const el = document.createElement('style');
      el.setAttribute('data-scope', 'trip-map-rail');
      el.textContent = SCOPED_STYLES;
      document.head.appendChild(el);
      injected = true;
    }
  }, []);
  // ...
}
```

**未選替代**：
- 把 `SCOPED_STYLES` 搬到 `tokens.css`：選 singleton injection 因為 scope 更緊，TripMapRail 保持自包含（styles 與 component 同檔），搬到 tokens.css 等於打破局部性
- React `<style>` JSX（React 18 `precedence`）：需確認 Vite + React 版本支援，且改動更大；singleton flag 是最小 risk 解法

### Dead CSS 確認策略（F001）

**決定**：先以 grep 確認 `.ocean-body` / `.ocean-main` / `.ocean-side` / `.info-panel` 在 TSX/JSX 的引用狀況，再決定刪除範圍。

- 若 `InfoPanel.tsx` 本身也無任何 import 引用 → 連同 component 一起刪（orphan 清理）
- 若 print mode 有 `@media print` 規則引用 `.info-panel` → 保留 print fallback，只刪非 print rules
- 刪除後以 `npx tsc --noEmit` 確認無 TypeScript 錯誤

### `needsDivider` 簡化（F005）

**決定**：移除 `prev.action !== item.action` 分支，僅保留 `prev.group !== item.group`。

PR 3 重構後 OverflowMenu items 的 group structure 已能完整決定 divider 插入點，`action` diff 是舊架構的殘留判斷，在新 group structure 下不可能有「group 相同但 action 不同需要 divider」的情境。

**前提**：F005.1 red test 先確認現有 divider 行為，再做簡化，確保行為不改變。

### `onClearSheet` Optional（F004）

**決定**：改為 `onClearSheet?: () => void`，並在 call site 檢查移除 dead prop 傳遞。

PR 3 後 MobileBottomNav 的 sheet 清除行為已透過 navigation event 自動觸發，不需要外部 callback。但若有其他 call site 仍傳入有意義的 handler → 保留傳入，僅改型別為 optional。

## 未選替代（總結）

| 決策點 | 選擇 | 未選 | 原因 |
|--------|------|------|------|
| Logo 統一 | 直接替換 inline → TriplineLogo | refactor TriplineLogo 加 variant | 過度設計，規則明確 |
| Singleton style | module flag + useEffect | 搬至 tokens.css | TripMapRail 保持自包含 |
| Dead CSS | grep 確認後刪 | 保留觀察 | 設計系統誠實，dead code 不應保留 |
| needsDivider | 移除 action branch | 改用 array grouping | minimal diff，行為等效 |
