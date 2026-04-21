## 問題

Design review v2（`design-audit-v2-strict.md`，2026-04-21）以嚴格挑戰者視角對 Tripline mobile 體驗進行量測稽核，發現以下結構性問題：

### P1 — Mobile 字體破洞（Typography）
實測 mobile 375px viewport 出現 `9.5px / 10.5px / 11.5px / 13.3333px` 等非整數字級，根本原因是 parent 元素使用 `font-size: 0.83em / 0.92em` 相對繼承，而非 DESIGN.md token-based 絕對值。DESIGN.md 定義的 stop name = 17px headline，實作只有 15px；day hero title 應 28px，實作 22px。Mobile 沒有被當成獨立斷點設計，是 desktop 的 side effect 縮放。

### P2 — Glass 材質三態並存（Material Consistency）
同一畫面同時存在 `blur(14px)`（topbar）、`blur(12px)`（bottom nav）、`blur(28px) + saturate(1.8)`（InfoSheet）加上純白主體，四層效果無共通 token。DESIGN.md Material section 只定義 topbar blur 14px，bottom nav 與 sheet 各自發明強度，造成「設計系統有原則、component PR 各自打破」的典型退化。

### P3 — MobileBottomNav IA 混血（Information Architecture）
5-tab bar 行為五種：scroll-to-top、URL 跳頁、開 sheet、開 sheet、開 sheet 後再二層選單。iOS HIG tab bar 原則：「每個 tab 是對等 section/view，保留 state」。現況是 tab bar + action bar 混血。「編輯」實為 AI 聊天頁，label 名稱造成使用者預期錯誤。

### P4 — User-trap（InfoSheet 預設展開）
TripPage mobile 載入預設 `activeSheet` 非 null，InfoSheet 展開至 609/812 = 75% viewport，使用者第一眼不是行程內容而是 sheet。

### P5 — Dead tabs（Topbar 路線 / 航班 / AI 建議）
Topbar 三個 tab 按了沒有對應 route，是視覺 affordance 有但 behavioral 未定義的「謊言 UI」。

### P6 — Icon 缺失（Bug）
MobileBottomNav「編輯」「更多」的 `<Icon name="edit">` / `<Icon name="menu">` 在 `Icon.tsx` name-to-svg map 缺項，實測 `iconSize: null`，只剩 10px label，一排 5 tab 視覺高度不均。

### P7 — AdminPage modal/page 語意混淆
`/admin` 是獨立路由卻有 `×` close 按鈕，使用者 mental model 崩潰：page 長得像 modal。

---

## 設計原則

本次變更基於以下設計方向（Q10 選 A）：

1. **Editorial 讀為主（Read-primary）**：Tripline 是行程共享網站，核心使用者行為是「讀」。UI 應以讀為主，編輯為輔，不與「AI 行程編輯器」競爭定位。
2. **Mobile-first 嚴格執行**：Mobile 是獨立斷點，有自己的 type scale 與 IA，不是 desktop 縮小版。
3. **單一 Ocean accent**：UI chrome 嚴守 Ocean 單一 accent。Data Visualization（地圖 polyline、chart series）是明文例外，允許 10 色 qualitative palette。
4. **4 層 hierarchy 收斂**：glass blur 全部收斂到 `--blur-glass: 14px` 單一 token，不再各自發明強度。
5. **Route-based IA**：Bottom nav 每個 tab 對應獨立路由，禁止 overlay / action 混入 tab bar。

---

## 解法架構

### Phase 1 — Tier 0 Bug Fix（PR #200 v2.0.1.1）

快速修復阻斷使用者的明確 bug，不做 IA 重構：

- 補 `Icon.tsx` 缺失 `edit` / `menu` SVG（P6）
- 砍 topbar 三個 dead tab（P5）
- `TriplineLogo` 改 `<Link to="/">`，AdminPage 移除 `×`（P7）
- 非整數 font-size 全改整數 px（P1 先修 subpixel 問題）
- Sheet default 改關閉（P4）

### Phase 2 — Typography + Material Consistency（PR #201 v2.0.1.2）

對齊設計系統，補 DESIGN.md 缺失的 mobile type scale section 與 data visualization 例外：

- DESIGN.md 新增 `## Type Scale (Mobile ≤760px)` 完整表格（P1）
- `--font-size-eyebrow: 0.625rem` / `--blur-glass: 14px` token 化（P2, P4）
- Glass 全面統一 14px，拿掉 sheet `saturate(1.8)`（P2）
- AI pill 改 Ocean fill，注意事項卡改 warning amber（P3 semantic）
- Stop card title 確認 17px 並加測試守住（P1）

### Phase 3 — IA 重構 + Desktop Map Rail（PR #202 v2.0.2.0）

IA 結構性改造，同步升級 desktop 體驗：

- `MobileBottomNav` 5 tab → 4 tab route-based（行程 / 地圖 / 訊息 / 更多）（P3）
- Desktop sidebar 刪除，右欄改 `TripMapRail` sticky Leaflet 地圖（Q1=A）
- 新增 `src/lib/dayPalette.ts`（10 色 qualitative palette，DESIGN.md DV 例外落地）
- Day Hero「看地圖」chip，導到 `/trip/:id/map?day=N`（取代 inline day map）
- Desktop OverflowMenu 補 3 個 sheet 入口（補 PR 1 拿掉 dead tab 的 tech debt）

---

## 影響範圍

| Phase | 變更檔案數 | 新增測試 | 測試總數 |
|-------|-----------|---------|---------|
| PR #200 v2.0.1.1 | 6+ | +18（370→388） | 388 |
| PR #201 v2.0.1.2 | 14+ | +36（388→424） | 424 |
| PR #202 v2.0.2.0 | 16+ | +45（424→469） | 469 |

主要變更檔案（代表性）：
- `src/components/shared/Icon.tsx`
- `src/components/trip/DayNav.tsx`
- `src/components/trip/MobileBottomNav.tsx`
- `src/components/trip/TripMapRail.tsx`（新）
- `src/lib/dayPalette.ts`（新）
- `src/hooks/useMediaQuery.ts`（新）
- `src/pages/TripPage.tsx`
- `src/pages/AdminPage.tsx`
- `css/tokens.css`
- `DESIGN.md`（type scale + DV 例外 section 新增）

**Public API**：無 breaking change。所有變更為前端 UI 層，API schema 不變。

---

## Retrofit 說明

本 proposal 為 **retroactive 補寫**。三個 PR 已於 2026-04-21 完成 merge（commits a66942d / 0ad5af7 / 1d26886），本文件為事後補齊 OpenSpec SDD 文件，以符合 CLAUDE.md 規範：「若 PR 未走 OpenSpec propose，ship 後須補 retroactive archive」。

實作細節請見對應 commits 與 `tasks.md`，決策記錄請見 `design.md`。
