## Why

2026-04-28 v2 deeper QA inspection（`.gstack/qa-reports/qa-report-trip-planner-dby-pages-dev-2026-04-28.md`）用 `getComputedStyle()` 進實際 DOM 量字級，比對 mockup `terracotta-preview-v2.html` 的 CSS line refs，找到 30 個 finding（0 Critical / 8 High / 13 Medium / 9 Low）。其中 typography token 不對齊問題影響 6 個關鍵 element（titlebar / day-hero / list-card-eyebrow / list-card-title / bottom-nav-label / NewTripModal-title），整站每個 page 都偏 mockup 規範 1-4px；NewTripModal 用 UTF-8「✕」字元當 close icon 直接違反 CLAUDE.md「icon 用 inline SVG，不用 emoji」明文規定；/map desktop 完全不渲染 entry cards（`tp-global-map-mobile-cards` bbox 0×0 on desktop）。Health score 6.8/10。

修這批 finding 是延續 `terracotta-mockup-parity-v2` 的 mockup parity 工作，把 v2 沒抓到的細節打平。

## What Changes

- **Typography token 對齊 mockup**：改 `--font-size-body` 17→16、`--font-size-footnote` 13→14；`.tp-titlebar-title` desktop 24→20 / compact 22→18；`.ocean-hero-title` desktop 32→28 / compact 28→24；`.tp-trip-card-eyebrow` 11→10、letter-spacing 1.98→0.12em；`.tp-trip-card-title` 17→16；NewTripModal title font-weight 800→700；mobile bottom nav label 14/600→11/700
- **NewTripModal close button 改用 SVG icon**：`.tp-new-form-close` 內部「✕」UTF-8 字元改 `<Icon name="x-mark" />`
- **TripInfo interface 修 stale snake_case bug**：API 透過 deepCamel() 回傳 camelCase，舊 interface 用 snake_case 導致 dayCount/startDate 永遠 undefined → eyebrow 不顯示「· N 天」、card meta 缺出發日
- **/trips 新增「已歸檔」filter tab**（mockup section 16）
- **/trips trip card meta 加出發日**「{owner} · 7/2 出發」格式
- **AddStopModal 新增 region selector + filter button**（mockup section 14）：頂部「沖繩 ▾」chevron pill + search input 旁 filter 按鈕
- **AddStopModal day meta + footer 文案統一**：「Day 1」→「DAY 01 · 7/29（五）」全大寫；footer「請先選擇」→「已選 N 個 · 將加入 DAY {NN} · M/D」即使 0 也顯示
- **/map desktop 也要顯示 entry cards horizontal scroll**：拿掉 `.tp-global-map-mobile-cards` 的 mobile-only display rule；rename class alias 移除 mobile- 前綴；移動「全覽 / 我的位置」chips 到 right-bottom FAB 位置
- **Icon registry 補 chevron-down / filter / target icons**

**不在範圍內（DEFER）**：
- /chat IA 從 single-conv 改成 multi-conv hub（F-02 需要 office-hours 決定 product direction）
- AddStopModal 2-col POI grid 結果 rendering（PR #387 已實作 tab 結構）
- /map 完整 day tabs filter（F-03 需要重構 GlobalMapPage state machine；trip-bound /trip/:id/map 已 mockup 對齊）
- archived_at schema migration（trips 表還沒有 archived_at column，filter tab 先放 visible UI，empty state 等資料模型補完）

## Capabilities

### New Capabilities
- `mockup-icon-svg-discipline`: 補強 modal/dialog close button 強制使用 SVG icon sprite reference 不允許 UTF-8 字元
- `map-page-day-strip`: /map desktop 也顯示 entry cards horizontal scroll；移除 floating top day strip pills 改為 FAB
- `add-stop-modal-region-filter`: AddStopModal 加 region selector chip + filter button + DAY 全大寫 + footer 已選計數

### Modified Capabilities
- `font-size-scale`: 改 `--font-size-body` 17→16、`--font-size-footnote` 13→14 對齊 mockup type scale 規範
- `terracotta-page-layout`: 改 `.tp-titlebar-title` / `.ocean-hero-title` / `.tp-trip-card-*` 字級對齊 mockup `.tp-page-titlebar-title` / `.tp-detail-hero-title` / `.tp-list-card-*`；TripsListPage 加「已歸檔」filter
- `mobile-bottom-nav`: 改 mobile bottom nav label 字級從 14/600 改為 11/700 對齊 mockup section 02 line 5227 規範

## Impact

**檔案範圍**：
- `css/tokens.css`：6 個 token / class 字級調整 + 加 compact responsive override
- `src/components/trip/NewTripModal.tsx`：close button 改 SVG icon + h2 weight 800→700
- `src/components/trip/AddStopModal.tsx`：加 region pill + filter button + footer counter 重寫 + CSS
- `src/pages/TripsListPage.tsx`：filter tabs 加「已歸檔」+ TripInfo camelCase fix + cardMeta 加出發日
- `src/pages/TripPage.tsx`：dayLabel format 改 「DAY 01 · 7/29（五）」全大寫
- `src/pages/GlobalMapPage.tsx`：entry-cards desktop visible + class alias rename + actions 移到 FAB
- `src/components/shell/GlobalBottomNav.tsx`：span font 11/14/700
- `src/components/shared/Icon.tsx`：加 chevron-down / chevron-up / filter / target icons

**沒影響**：
- 無 schema migration（archived_at follow-up issue）
- 無 API 改動
- 無 auth flow 改動
