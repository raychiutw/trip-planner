## Context

V2 Terracotta layout 已在 mockup 階段定稿，但 src/ 仍是舊規格。本 refactor 把 `src/pages/*` 與相關 component 對齊到 mockup 定義的視覺與互動規格。

### Single Source of Truth

**`docs/design-sessions/terracotta-preview-v2.html` 是本次 refactor 的唯一 source of truth。**

所有實作決定（layout、spacing、typography、color、shadow、interaction、empty/loading state、entry card 結構、marker 視覺、modal sizing、titlebar action 對映）以該 mockup 為最終依據。其他文件的角色：

| 文件 | 角色 | 關係 |
|------|------|------|
| `docs/design-sessions/terracotta-preview-v2.html` | **唯一 source of truth** | 實作對齊的最終權威；任何視覺 / 互動衝突以此為準 |
| `docs/design-sessions/2026-04-27-unified-layout-plan.md` | 規範表格參考 | titlebar action 對映表、route mapping、bottom nav active；若與 mockup 衝突，以 mockup 為準並回頭更新此 md |
| `DESIGN.md` | token / 規則底層 | tokens.css 變數、anti-slop 政策、shadow exception；若與 mockup 衝突，以 mockup 為準並回頭更新此 md |
| `tokens.css` | CSS variable 實作 | mockup 的視覺值若已對應 token，必須使用 token 而非寫死；若 token 不存在，補 token 定義 |

實作期間若發現 mockup 規格不完整（例如某邊界狀態未繪），停下回 mockup 補圖，**不要在 src 自行決定**。

## Goals / Non-Goals

**Goals:**
- `src/pages/` 與 `src/components/shell|trip/` 視覺與互動行為跟 mockup 100% 對齊
- TitleBar API 統一 (`<TitleBar title back? actions? />`)
- Map page 結構翻新（bottom underline tabs + entry cards）對齊 src OceanMap 既有 marker spec
- OceanMap marker 拆掉 `🛏` emoji（DESIGN.md L383 + anti-slop）
- entry card 加 type icon 系統（hotel/food/sight/shopping）
- NewTripModal 改 form-first single-column
- Loading / empty state UI 落地（Map page）

**Non-Goals:**
- 不動 D1 schema、API endpoint、permission model
- 不動 OceanMap polyline / cluster / route fetching 邏輯（marker 視覺除外）
- 不動 6 套主題的 tokens.css 變數定義（V2 Terracotta 已是預設）
- 不重做 sidebar / bottom nav IA（unified-layout-plan.md 已定）
- 不寫 desktop tablet-only layout（unified-layout-plan.md 明確排除）

## Decisions

### D1：TitleBar 跟 PageHeader 並存（修正 2026-04-27 — Open Q1 解）

**決定**：新建 `src/components/shell/TitleBar.tsx`（簡化 API：`<TitleBar title back? actions? backLabel? />`，無 eyebrow / meta / variant / align），用於 mockup 涵蓋的 6 主功能頁；PageHeader.tsx 保留現狀，繼續服務 8 個非 mockup-scope 子頁（ForgotPasswordPage / SignupPage / ResetPasswordPage / EmailVerifyPendingPage / SessionsPage / DeveloperAppsPage / ConnectedAppsPage 等 splash / auth / settings 頁），這些頁有 hero / eyebrow / meta 設計需求且不在本 refactor 範圍。

**理由**：
- mockup 6 主功能頁 (Chat / Trips / Trip detail / Map / Explore / Account) 是單行 chrome，TitleBar 簡化 API 對齊 unified-layout-plan.md
- V2 OAuth / settings 子頁是 splash-style hero 頁面（已用 ConsentPage `align="center"` 模式），保留 PageHeader 避免破壞既有 hero 設計
- 兩 component 並存，責任清楚：TitleBar = page chrome、PageHeader = splash hero
- 沒有 re-export shim 需求（既有 PageHeader 用戶都不在 refactor scope，不需漸進切換）

**替代方案**：
- 保留 PageHeader 名稱、props 加 `variant?: 'titlebar' | 'header'`：拒絕，name 不反映 V2 角色（chrome 而非 hero）
- 砍 PageHeader 直接 inline 各頁：拒絕，違反 DRY，且 sticky / glass 樣式分散難維護
- TitleBar rename 取代 PageHeader 全站：拒絕，違反 mockup scope 限制，會強迫 splash 子頁改 layout（不在本 refactor 範圍）

### D2：Map page 改 src OceanMap 既有 spec + mockup 結構

**決定**：MapPage `src/pages/MapPage.tsx` 改 layout：titlebar → flex-1 map → bottom day tabs → bottom entry cards；OceanMap `markerIcon` 移除 hotel emoji；`.ocean-map-pin[data-type="hotel"]` font-size override 刪除；marker idle 改用 dayColor border + dayColor color；active 維持 src 既有 spec（accent fill + ring）。

**理由**：
- src OceanMap 既有 marker active 規格（36×36 accent + ring）已完整對應 mockup，只需 idle 配 dayColor
- bottom underline tabs 是 src 既有風格，mockup 改 floating top strip → bottom 是回歸 src 與 unified-layout-plan.md
- entry cards horizontal scroll 對齊 mockup 與既有 src MapPage 列表

**替代方案**：
- 保留 hotel emoji：拒絕，DESIGN.md L383「不用 emoji」+ anti-slop L2-5「非品牌 emoji 視覺裝飾」
- Hotel 用 SVG bed icon 嵌 marker 內：拒絕，marker 內混合 svg + 數字視覺不一致；type 已轉移到 entry card icon
- Hotel 用「H」字母：拒絕，跟 mockup「純數字」決策不符

### D3：Pin type icon 在 entry card 而非 marker

**決定**：entry card 加 16px leading SVG icon (`#i-bed` / `#i-utensils` / `#i-camera` / `#i-bag`)，marker 一律純數字。

**理由**：
- mockup 已採此設計（marker 純數字 + entry card 帶 type icon）
- map marker 28-36px 直徑放 svg + 數字 太擠
- entry card 是 horizontal 滾動 list，icon 區分 type 直觀且無視覺干擾

**替代方案**：marker 也放 type icon — 拒絕（同 D2 拒絕原因）

### D4：NewTripModal form-first single-column

**決定**：移除既有 hero / split-screen，改 single-column form：desktop max-width 720px、欄位垂直排列、footer sticky bottom。

**理由**：
- mockup Section 09 已採此設計
- unified-layout-plan.md 明文「desktop modal max width 約 680-720px」
- form-first 縮短填寫路徑，desktop / compact 共用一套 RWD

**替代方案**：保留 split-screen — 拒絕，違背 mockup + plan 文件

### D5：MapDayTab + MapEntryCard 抽出獨立 component

**決定**：新建 `src/components/trip/MapDayTab.tsx` + `MapEntryCard.tsx`，TripMapRail 與 MapPage 共用。

**理由**：
- mockup 兩個元件各有獨立樣式 + 互動邏輯（active dayColor underline / pin type icon）
- 複用於 desktop 2-col TripPage（TripMapRail）與 mobile MapPage
- 抽出便於 unit test 個別狀態

**替代方案**：inline 在 MapPage / TripMapRail — 拒絕，違反 DRY、無法獨立測試

### D6：Token 不足補進 tokens.css 而非寫死

**決定**：mockup 用到但 `tokens.css` 未定義的值（例如 `--tp-radius-full: 9999px`、loading shimmer keyframe），先補進 tokens.css 再實作。

**理由**：
- coding-standards.md 規定 border-radius 限 5 級 token
- 寫死 999px / 9999px 在 src 違反 css-hig-rules
- mockup 是 standalone 自定義（只有 sm/md/lg），src 必須走 tokens.css 完整 5 級 + full

**替代方案**：src 也寫死 — 拒絕（commit_gate 紅燈）

### D7：TDD 入口統一在 component test

**決定**：每個新 / 改的 React component 必須先寫 unit test 紅燈再實作。

**理由**：全域 CLAUDE.md「一律 TDD」+ tp-claude-design「合入 src 必須先寫 failing test」。

**Test 範圍**：
- TitleBar：渲染 title / back / actions / sticky class / glass blur
- MapDayTab：active state、dayColor inline、min-height 44px
- MapEntryCard：sync state、type icon mapping、day-local index
- OceanMap：markerIcon hotel pin 回純數字（regression test for emoji removal）
- NewTripModal：single column structure、footer sticky、多目的地

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| OceanMap marker 規格改動破壞既有 trip detail map 顯示 | 改動限 idle marker 樣式 + emoji 移除；active marker 保留既有 spec；regression test 確保 polyline / cluster / focus 邏輯不動 |
| TitleBar rename 影響大量 import 路徑 | 保留 PageHeader 為 backward-compat re-export 一個 release，下個 release 移除（per CLAUDE.md「禁止 backward-compat shim」例外：跨 PR rollout 才允許） |
| Map page 改 layout 破壞 URL state（`?day=all`、`?day=N`） | 既有 URL state 解析邏輯不動，只動 render layer；test 涵蓋 URL ↔ active tab 雙向 sync |
| 多目的地欄位破壞既有 single 目的地 form 提交 | NewTripModal 既有 API 接受陣列；form state 改 `destinations: string[]`，serialize 與舊版相容 |
| mockup 沒涵蓋的邊界狀態（極長行程名 / 0 day trip / network error） | 實作前回 mockup 補圖，不在 src 自決；提案此事為 Open Question |

## Migration Plan

1. **Phase A — Token + Component primitives**（無 page 動作，CI 綠）
   - 補 tokens.css：`--radius-full`、loading shimmer keyframe、map marker exception variable
   - 新建 TitleBar.tsx（PageHeader re-export 暫保留）
   - 新建 MapDayTab.tsx + MapEntryCard.tsx
2. **Phase B — Map page + OceanMap**
   - OceanMap markerIcon 移 emoji + dayColor idle
   - MapPage 改 layout 用 MapDayTab + MapEntryCard
   - regression test：marker label / day query / focus
3. **Phase C — TripList + TripDetail + AddStopModal**
   - TitleBar action 對映 unified-layout-plan.md
   - TripDetail DayNav sticky + hide-on-scroll
   - AddStopModal layout 對齊 mockup Section 16
4. **Phase D — Chat + Explore + Account + NewTripModal**
   - Chat / Account titlebar 移除 right action
   - Explore titlebar 改「我的收藏」
   - NewTripModal form-first single-column
5. **Phase E — Cleanup**
   - 移除 PageHeader re-export shim
   - 補 E2E：bottom tab + entry card sync + new trip multi destinations
   - tp-code-verify + design-review baseline 拍照

每 Phase 一支 PR，走 `/tp-team` pipeline（tp-code-verify → review → cso --diff → ship → canary）。

**Rollback**：每 Phase PR 獨立可 revert，不會跨 phase 髒 schema。

## Open Questions

1. ~~**Q：`PageHeader` 既有使用者**有沒有任何頁面用到 `eyebrow` / `meta` / `helperText` props？需 grep 一輪。如果有，是否屬於 mockup 涵蓋的 6 主功能頁，還是其他子頁（如 ConsentPage / EmailVerifyPendingPage 等 V2 OAuth 流程頁）？~~
   - **解（2026-04-27）**：grep 結果 8 個非 mockup-scope 子頁用 PageHeader 帶 eyebrow / meta（ForgotPassword / Signup / Reset / EmailVerify / Sessions / DeveloperApps / ConnectedApps / 等）。這些是 splash / auth / settings hero 頁面，**不在本 refactor 範圍**。決策：TitleBar 跟 PageHeader 並存（見 D1 修正），不做 re-export shim。子頁未來若要改 layout 走另一個 change，本次 refactor 不動。
2. **Q：Map page entry card 在 overview 模式 active 高亮 sync**：mockup 有圖，但 src 既有實作是否已有 entry card list？需 confirm 是否有現成的 list state 可重用。
3. **Q：tabs scroll-into-view**：mockup 沒明示 active tab 是否要自動 scroll into view（horizontal scroll 區內）。需回 mockup 或 unified-layout-plan.md 補圖。
4. **Q：邊界 typography（極長行程名、空 day list）**：mockup 沒涵蓋。實作前必須補圖。
