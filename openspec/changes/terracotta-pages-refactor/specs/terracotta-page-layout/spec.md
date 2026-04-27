## ADDED Requirements

### Requirement: TitleBar 統一 API
所有主功能頁 TitleBar MUST 使用統一 component API：`<TitleBar title back? actions? />`，移除桌機 eyebrow / meta / helper text；TitleBar SHALL 為 sticky 顯示，桌機 64px / compact 56px 高度，glass blur 14px + hairline border-bottom；只有行程詳情頁 MUST 有左側返回 button。

#### Scenario: 桌機渲染 TripList titlebar
- **WHEN** 使用者在桌機（≥1024px）開啟 `/trips`
- **THEN** TitleBar 顯示 `title="我的行程"`、無左側返回、右側 actions 為「搜尋 icon button + 新增 `+` icon button」、無 eyebrow / meta

#### Scenario: 桌機渲染 TripDetail titlebar
- **WHEN** 使用者在桌機開啟 `/trip/:id`
- **THEN** TitleBar 顯示行程名稱、左側「返回列表」icon button、右側 actions 包含「建議、共編、下載、更多 ⋯」icon buttons + menu

#### Scenario: 手機渲染 Map titlebar
- **WHEN** 使用者在 compact viewport（<1024px）開啟 `/trip/:id/map`
- **THEN** TitleBar 顯示 `title="地圖"`、右側僅「行程切換」icon button，無多餘 actions

#### Scenario: Chat / Account titlebar 無右側 action
- **WHEN** 使用者開啟 `/chat` 或 `/account`
- **THEN** TitleBar 右側 actions 區為空（list item 點選即進入對話 / 裝置登出走 settings row）

### Requirement: Map page full bleed layout
Map page MUST 使用 full bleed 佈局：sticky titlebar → 全寬 map canvas → bottom underline day tabs（含「總覽」prepend）→ entry cards horizontal snap-scroll；three layers SHALL vertical stack 不重疊，且 MUST NOT 再使用 floating top day strip。

#### Scenario: Overview 模式 day tabs 顯示總覽 + 各日
- **WHEN** 使用者在 `/trip/:id/map?day=all`
- **THEN** Day tabs 第一項為「總覽 · {N}天」active 狀態，後接 Day 01 ~ Day {N}（每個 tab 顯示 dayColor eyebrow + 日期）

#### Scenario: 切換 day tab 更新 marker 顯示與 entry cards
- **WHEN** 使用者點 Day 02 tab
- **THEN** URL 變為 `?day=2`、map 顯示僅 Day 2 markers + polyline、entry cards 區只顯示 Day 2 entries 並重置 day-local index 從 1 開始

#### Scenario: 點 entry card 觸發 marker focus
- **WHEN** 使用者在 entry cards row 點某 card
- **THEN** 對應 marker 變 `is-active` 狀態（accent fill + ring）、map flyTo 該 marker 中心、card 自身加 `is-active` border-color

### Requirement: Marker 視覺規格（移除 emoji）
Map markers MUST 遵循 src OceanMap 規格 + DESIGN.md 政策：idle 狀態 SHALL 為白底 + dayColor 1.5px border + dayColor 文字 + 28×28；active 狀態 SHALL 為 accent fill + on-accent border + accent ring + 36×36；marker 內容 MUST 為純數字 `String(pin.index)`，且 MUST NOT 使用任何 emoji（含 `🛏`）。

#### Scenario: Hotel pin 顯示為純數字
- **WHEN** 渲染 `pin.type === 'hotel'` 的 marker
- **THEN** marker label 為 `String(pin.index)`，無 emoji 字元

#### Scenario: Idle marker 套用 dayColor
- **WHEN** 渲染 day 3 (violet `#7C3AED`) 的 idle marker
- **THEN** marker DOM `border-color` 與 `color` 套用 `#7C3AED`、background 為 `var(--color-background)`

#### Scenario: Active marker 套用 accent
- **WHEN** marker 為 focused 狀態
- **THEN** background 為 `var(--color-accent)`、border 為 `var(--color-accent-foreground)`、box-shadow 含 4px accent ring + 12px ambient shadow

### Requirement: Pin type icon 系統（entry card 上）
Map page 與 Trip detail page 的 entry card MUST 在 leading position 顯示 16px inline SVG type icon，依 entry kind 對映：hotel→`i-bed` / food→`i-utensils` / sight→`i-camera` / shopping→`i-bag` / 其他→無 icon；active 狀態 icon 顏色 SHALL 轉 accent。

#### Scenario: Hotel entry card 顯示 bed icon
- **WHEN** 渲染 `entry.kind === 'hotel'` 的 entry card
- **THEN** card body 區 leading 顯示 16px `<svg><use href="#i-bed"/></svg>`，其旁為 entry title

#### Scenario: Active entry card icon 變 accent
- **WHEN** entry card 為 active 狀態
- **THEN** icon `color` 套用 `var(--color-accent)`

### Requirement: NewTripModal form-first single column
NewTripModal MUST 移除大型 hero / split-screen 視覺，改 form-first single-column layout：desktop max-width 680-720px、footer actions sticky bottom、compact 用接近全寬 sheet/dialog；目的地欄位 SHALL 支援多筆。

#### Scenario: Desktop 開啟 NewTripModal
- **WHEN** 使用者在桌機點「新增行程 `+`」
- **THEN** modal 寬度 ≤720px、無左/右側 hero pane、所有欄位 single column 排列、footer「取消」+「建立」sticky bottom

#### Scenario: 多目的地輸入
- **WHEN** 使用者在目的地欄位輸入第一個目的地後點「+」加入
- **THEN** 欄位下方產生 chip + 可繼續輸入第二筆

### Requirement: Map loading / empty 狀態
Map page MUST 提供 loading 與 empty state UI：loading SHALL 顯示 shimmer canvas + accent spinner + 「地圖載入中…」文字 + `aria-busy="true"`；empty SHALL 顯示 glass card 含 `i-map` icon + 「此日尚無景點」+ hint「切換其他日期、或回到行程加入景點」。

#### Scenario: 初次進入 Map page tiles 載入中
- **WHEN** Map tiles 尚未 ready
- **THEN** map canvas 區顯示 shimmer background + 32×32 accent spinner + Inter 13px muted text「地圖載入中…」、titlebar 與 day tabs 為 disabled / aria-busy 狀態

#### Scenario: 切到無景點的日期
- **WHEN** 使用者切到某 day tab 該日無 entry
- **THEN** map canvas 中央顯示 280px max-width glass card（blur 14px + hairline border + shadow-md），含 32px `i-map` icon + 15px bold title + 13px muted hint text

### Requirement: Day tab dayColor underline
Map page 與 Trip detail page DayNav MUST 共用同一 visual primitive：tab SHALL 為底線型（border-radius 0、border-bottom 2px transparent → active 變 dayColor）、eyebrow SHALL 顯示 dayColor 文字、active state 文字色 MUST 轉 accent。

#### Scenario: Idle day tab 樣式
- **WHEN** 渲染未 active 的 Day 01 tab
- **THEN** tab `min-height: 44px`、padding 10px 14px、文字色 `var(--color-muted)`、border-bottom transparent、eyebrow `<span style="color: #BE123C">DAY 01</span>`

#### Scenario: Active day tab 樣式
- **WHEN** Day 02 為 selected
- **THEN** tab 文字色為 `var(--color-accent)`、border-bottom 2px `var(--color-accent)`、保留 dayColor eyebrow 但 color 蓋為 accent

### Requirement: Per-page right action 對映表（unified-layout-plan.md 表格）
各主功能頁 TitleBar right action MUST 對齊 `docs/design-sessions/2026-04-27-unified-layout-plan.md` 表格（衝突時 mockup 為準），下列對映 MUST 全數實作：

- 聊天：桌機無、手機無
- 行程列表：桌機「搜尋 + 新增 `+`」、手機「新增 `+`」
- 行程詳情：桌機「建議 + 共編 + 下載 + 更多 `⋯`」、手機「更多 `⋯`」+ 左側返回
- 地圖：桌機「行程切換 + 定位」、手機「行程切換」
- 探索：桌機「我的收藏」、手機「我的收藏」
- 帳號：桌機無、手機無

#### Scenario: 行程列表 titlebar 桌機 actions
- **WHEN** 使用者在桌機 `/trips`
- **THEN** TitleBar actions 從左到右為「搜尋 icon button」+「新增 `+` icon button」

#### Scenario: 行程詳情 titlebar 手機 actions
- **WHEN** 使用者在手機 `/trip/:id`
- **THEN** TitleBar 左側「返回」icon button、右側僅「更多 `⋯`」icon button（其餘 actions 收進 menu）

#### Scenario: 探索 titlebar 我的收藏
- **WHEN** 使用者開啟 `/explore`（不分桌機 / 手機）
- **THEN** TitleBar 右側顯示「我的收藏」icon button、無搜尋 / filter 等其他 action
