# Proposal: PR 5 Cleanup Follow-up — PR 3/4 Tech Debt 清理

## 問題

PR 3（MobileBottomNav + DayNav 重構）與 PR 4（Layout 調整）的 `/review` 與 QA dogfood 發現 7 項 non-blocking tech debt 與視覺一致性問題，未在原 PR 修復以保持 diff 乾淨，累積至此統一清理：

1. **Dead CSS**：`css/tokens.css` 保留 `.ocean-body` / `.ocean-main` / `.ocean-side` / `.info-panel` 等 PR 3 新 layout 後不再使用的 class rules（約 30 行），可能帶 `InfoPanel.tsx` 一併 orphan
2. **DaySection inline style**：`DaySection.tsx` 2 處 `style={{}}` object literal，每次 render 產生新物件 ref，違反 RBP-22
3. **TripMapRail inline `<style>` 節點**：`TripMapRail.tsx` 的 `SCOPED_STYLES` 在 JSX 每次 render 產生新 `<style>` DOM node，應改為 singleton injection
4. **MobileBottomNav `onClearSheet` 型別**：PR 3 後 navigate-based 行為不再需要 clear sheet，prop 應改 optional 避免 legacy call site 依賴強型別
5. **OverflowMenu `needsDivider` 冗餘分支**：`prev.action !== item.action` 第二個分支在新 group structure 下冗餘
6. **StopDetailPage / MapPage header 未用 `<TriplineLogo>`**：PR 1 已讓 `TriplineLogo` 包 `<Link to="/">`（logo → home 慣例），但 StopDetailPage 與 MapPage header 仍用 inline wordmark，editorial 慣例未全面落地
7. **QA script T8 sticky 邏輯錯誤**：`.playwright-mcp/qa-pr3.mjs` T8 assert「scroll 前後 top 相同」邏輯錯誤（sticky 本來就會改變 top），應改 assert「黏住後 rail top 保持穩定」

## 設計原則

- **`logo → home` 所有頁面一致**：TriplineLogo component 已封裝此行為，各頁面 header 一律採用，不得有 inline wordmark 繞過
- **inline style / inline `<style>` 違反 RBP-21/22**：每次 render 產生新 ref 影響 React reconciliation 與 DOM diff；style 提升至 CSS class 或 singleton injection
- **CSS dead code 必須清除**：設計系統 tokens.css 是唯一權威，殘留 dead rules 造成維護者誤判存活 class 的使用狀態
- **測試 assert 真實行為，不 assert 表象**：sticky header 測試若 assert「top 不變」等於測試靜止頁面，無法驗證 sticky 機制

## 解法

7 項問題分別對應 F001–F007，全部在同一 PR 處理（cleanup cohesion：同性質 tech debt 批次清理比分散 PR 更易 review）：

| Feature | 類型 | 影響元件 |
|---------|------|---------|
| F001 | Dead CSS 刪除 | `css/tokens.css`、`InfoPanel.tsx`（確認後） |
| F002 | Inline style 提升 | `DaySection.tsx` |
| F003 | Singleton style injection | `TripMapRail.tsx` |
| F004 | Prop 型別修正 | `MobileBottomNav.tsx`、`TripPage.tsx` |
| F005 | 邏輯簡化 | `OverflowMenu.tsx` |
| F006 | Logo 元件統一 | `StopDetailPage.tsx`、`MapPage.tsx` |
| F007 | QA script 修正 | `.playwright-mcp/qa-pr3.mjs` |

## 影響

- **無 breaking change**：所有修改為 refactor 或 bug fix，無 user-facing 功能變動
- **無 DB migration**：純前端與測試修改
- **測試數量變動**：預計 +3（F006 新增 StopDetailPage / MapPage header 含 TriplineLogo 的斷言）
- **bundle size**：預期略減（dead CSS 刪除）
