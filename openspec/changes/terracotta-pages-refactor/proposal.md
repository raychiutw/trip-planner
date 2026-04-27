## Source of Truth

**`docs/design-sessions/terracotta-preview-v2.html` 是本次 refactor 的唯一 source of truth。** 所有實作決定（layout、spacing、typography、color、shadow、interaction、empty/loading state、entry card 結構、marker 視覺、modal sizing、titlebar action 對映）以該 mockup 為最終依據。`unified-layout-plan.md` 是規範表格參考、`DESIGN.md` 是 token / 規則底層；若兩者與 mockup 衝突，以 mockup 為準並回頭更新該文件。實作期間若發現 mockup 規格不完整（某邊界狀態未繪），停下回 mockup 補圖，**不在 src 自決**。

## Why

`docs/design-sessions/terracotta-preview-v2.html`（19 sections）跟 `docs/design-sessions/2026-04-27-unified-layout-plan.md` 已定義 V2 Terracotta layout 完整規格（TitleBar 規範、Map page bottom day tabs、無 emoji、dayColor marker），但 `src/` 既有 page 實作仍帶舊規格 drift：Map page 用 floating top day strip（不是 src 既有 underline tabs 的 mockup 對齊版）、OceanMap marker 仍含 `🛏` emoji（違反 DESIGN.md L383「不用 emoji」與 anti-slop）、TripList / TripDetail / Chat / NewTripModal titlebar action 跟 unified-layout-plan.md 表格不對齊（缺建議 / 共編 / 我的收藏 等 per-page actions）。

需把 `src/pages/*` + 相關 component refactor 成跟 mockup + unified-layout-plan.md 一致，作為下一輪 design-review baseline。

## What Changes

- **TitleBar API 改寫**: `src/components/shell/PageHeader.tsx` rename 成 `TitleBar.tsx`，props 改 `<TitleBar title back? actions? />`，移除桌機 eyebrow / meta / helper text。
- **TripList page** (`src/pages/TripsListPage.tsx`): titlebar 桌機右側「搜尋 + 新增 `+`」、手機右側只「新增 `+`」；entry card 採 mockup Section 18 設計。
- **TripDetail page** (`src/pages/TripPage.tsx`): titlebar 桌機加「建議 + 共編 + 下載 + 更多 `⋯`」、手機只「更多 `⋯`」+ 返回；DayNav sticky + hide-on-scroll。
- **Map page** (`src/pages/MapPage.tsx`): 對齊 mockup Section 20 — full bleed map + bottom underline day tabs（含「總覽」prepend）+ entry cards horizontal snap-scroll；titlebar 桌機「行程切換 + 定位」、手機「切換行程」icon。
- **OceanMap marker** (`src/components/trip/OceanMap.tsx`): hotel `🛏` emoji 改純數字（V1，已記錄於 `memory/project_pending_hotel-marker-emoji-cleanup.md`）；marker idle 改 white bg + dayColor border + dayColor text；active 改 src 既有 accent fill + ring。
- **Chat page**: 對齊 mockup Section 19 — list 點選即進入對話，titlebar 無 right action。
- **NewTripModal** (`src/components/trip/NewTripModal.tsx`): 改 form-first single-column（移除大型 hero），desktop max-width 680-720px，footer actions sticky bottom。
- **Explore page** (`src/pages/ExplorePage.tsx`): titlebar 右側只保留「我的收藏」icon。
- **Account page** (`src/pages/AccountPage.tsx`): titlebar 無 right action；裝置登出移到 settings 內的「已登入裝置」row。
- **Loading / Empty states**: Map page 補上 mockup 定義的 shimmer + spinner loading state、glass card empty state。
- **Pin type icon 系統**: entry card 內加 leading icon（hotel→`i-bed` / food→`i-utensils` / sight→`i-camera` / shopping→`i-bag`），active 時轉 accent。

## Capabilities

### New Capabilities
- `terracotta-page-layout`: V2 Terracotta layout 統一規格 — TitleBar API + per-page right action 對映表 + content width（一般 1040px / Map full bleed）+ Map page bottom day tabs + entry cards 雙向 sync。涵蓋 TripList / TripDetail / Map / Chat / Explore / Account 六大主功能頁。

### Modified Capabilities
（不改既有 spec requirement，視為 implementation update — 既有 `nav-pills-layout` / `mobile-bottom-nav` / `trip-map-rail` 仍適用，本次只動 page-level layout 與 titlebar action 對齊）

## Impact

**Code**:
- `src/pages/`: TripsListPage.tsx, TripPage.tsx, MapPage.tsx, ChatPage.tsx, ExplorePage.tsx, AccountPage.tsx
- `src/components/shell/`: PageHeader.tsx → TitleBar.tsx (rename + API)
- `src/components/trip/`: OceanMap.tsx, TripMapRail.tsx, NewTripModal.tsx
- 新組件: `src/components/trip/MapDayTab.tsx`, `MapEntryCard.tsx`

**Tests**:
- 既有 `tests/unit/ocean-map-*.test.tsx` 需更新（marker label 不再含 emoji）
- 新增 unit test：TitleBar action 渲染、MapDayTab active state、MapEntryCard sync state
- E2E：Map page bottom tabs 切換 + entry card click flyTo

**Specs**:
- 新建 `openspec/specs/terracotta-page-layout/spec.md`

**No DB / API change**：純前端 layout refactor，不動 schema / endpoint。

**Reference docs**:
- `docs/design-sessions/terracotta-preview-v2.html`（19 sections mockup）
- `docs/design-sessions/2026-04-27-unified-layout-plan.md`（titlebar 規範表格）
- `DESIGN.md`（L383 emoji 禁令、tokens、shadow exception）
