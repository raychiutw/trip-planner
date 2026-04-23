## ADDED Requirements

### Requirement: MapPage 總覽 Tab

MapPage (`/trip/:tripId/map`) SHALL 在 day tabs 最左側 prepend 一個「總覽」tab（在 Day 01 tab 之前），提供切換到全行程 overview 模式的入口。

#### Scenario: 「總覽」tab 位置

- **WHEN** 使用者進入 `/trip/:tripId/map` 頁面
- **THEN** day tabs 清單的第一個 tab SHALL 為「總覽」
- **AND** 其後 SHALL 依序為「DAY 01 · {date}」、「DAY 02 · {date}」…

#### Scenario: 點「總覽」tab

- **WHEN** 使用者點擊「總覽」tab
- **THEN** URL SHALL 更新為 `/trip/:tripId/map?day=all`
- **AND** 地圖 SHALL 顯示全行程所有 days 的 pins
- **AND** 每天 polyline SHALL 用對應的 `dayColor(N)` 著色

### Requirement: Overview Mode 路由解析

MapPage SHALL 根據 URL 的 `?day` query param 決定顯示模式：

- `?day=all` → Overview mode（全行程多天）
- `?day=N`（N 為正整數）→ Single day mode（指定某天）
- 無 `?day` → 預設 Day 1 single day mode

#### Scenario: URL `?day=all` 觸發 overview

- **WHEN** 使用者訪問 `/trip/:tripId/map?day=all`
- **THEN** MapPage SHALL 設定 activeTab = 'overview'
- **AND** 「總覽」tab SHALL 呈現選中狀態

#### Scenario: URL `?day=N` 維持單日行為

- **WHEN** 使用者訪問 `/trip/:tripId/map?day=3`
- **THEN** MapPage SHALL 設定 activeTab = 3
- **AND** Day 03 tab SHALL 呈現選中狀態
- **AND** 地圖 SHALL 僅顯示 Day 3 pins 與 polyline

#### Scenario: 無 day query 使用預設

- **WHEN** 使用者訪問 `/trip/:tripId/map`
- **THEN** MapPage SHALL 預設 activeTab = 1
- **AND** 顯示 Day 1 single day mode

### Requirement: Overview Mode 多天多色 Polyline

在 Overview mode 下，MapPage 的 OceanMap SHALL 顯示全行程 pins，且每個 day 的 polyline segments 使用 `dayColor(N)` 著色（依 day palette 10 色循環：sky, teal, amber, rose, violet, lime, orange, cyan, fuchsia, emerald）。

#### Scenario: 10 色循環

- **WHEN** 行程共 7 天，進入 overview mode
- **THEN** Day 1-7 的 polyline 依序使用 sky-500, teal-500, amber-500, rose-500, violet-500, lime-500, orange-500
- **AND** 若行程超過 10 天，Day 11 SHALL 循環回 sky-500

#### Scenario: Overview pins 涵蓋所有 days

- **WHEN** Overview mode 載入完成
- **THEN** 地圖 pins 數量 SHALL 等於「所有 days 中有效 location entry 數量總和」（含 hotel pins）
- **AND** `fitBounds` SHALL 涵蓋所有 pins 的地理範圍

### Requirement: Single Day Mode Polyline 改用 dayColor

MapPage 在 single day mode（`?day=N`）的 polyline 顏色 SHALL 使用 `dayColor(N)`，與桌機 TripMapRail 的 day palette 對齊（而非既有的固定 accent 色）。

#### Scenario: Day 1 顯示 sky-500

- **WHEN** 使用者訪問 `/trip/:tripId/map?day=1`
- **THEN** Day 1 的所有 polyline segments SHALL 以 `dayColor(1)` = Tailwind sky-500 顯示

#### Scenario: 同趟 trip 在 MapPage 與 TripMapRail 顏色一致

- **WHEN** 使用者在 TripMapRail 看到 Day 3 polyline 為 amber-500
- **AND** 切到 MapPage `?day=3`
- **THEN** MapPage 的 Day 3 polyline SHALL 同樣為 amber-500

### Requirement: 點 Entry Card 地圖置中 flyTo

MapPage 的 entry cards 點擊行為 SHALL 觸發 OceanMap `flyTo(entry.location)`；Overview mode 下點擊 **不** 切換到該 entry 所屬的 day tab，而是保持在 overview 中 flyTo 該座標。

#### Scenario: Single day 點 entry card

- **WHEN** 使用者在 `?day=2` 點擊任一 entry card
- **THEN** map SHALL flyTo(entry.location)
- **AND** activeTab SHALL 保持為 2

#### Scenario: Overview 點任一天 entry card

- **WHEN** 使用者在 `?day=all` 點擊 Day 5 某 entry card
- **THEN** map SHALL flyTo(entry.location)
- **AND** activeTab SHALL 保持為 'overview'（不切到 Day 5）

### Requirement: TripPage 看地圖 chip 連結不變

TripPage DaySection 的「看地圖」chip SHALL 繼續連結至 `/trip/:tripId/map?day=N`（已在 `src/components/trip/DaySection.tsx:113` 實作），不導向 overview mode。

#### Scenario: 點 Day 3 的看地圖 chip

- **WHEN** 使用者在 TripPage Day 3 hero 點擊「看地圖」chip
- **THEN** 導航至 `/trip/:tripId/map?day=3`
- **AND** MapPage 開啟為 Day 3 single day mode

### Requirement: OceanMap 支援 pinsByDay 與 dayNum

`OceanMap` component SHALL 新增 optional props 支援多天多色 polyline：

- `pinsByDay?: Map<number, MapPin[]>` — 若提供，依此 grouping 為每天分開 render segments（搭配 dayColor）
- `<Segment>` component SHALL 接 `dayNum?: number` prop，用 `dayPolylineStyle(dayNum)` 覆寫預設 segment style

若 `pinsByDay` 未提供，OceanMap 沿用既有 flat `pins` 行為。

#### Scenario: pinsByDay 驅動分段著色

- **WHEN** OceanMap 接收 `pinsByDay = Map { 1 → [pinA, pinB], 2 → [pinC, pinD] }`
- **THEN** pinA→pinB segment SHALL 以 `dayPolylineStyle(1)` 樣式 render
- **AND** pinC→pinD segment SHALL 以 `dayPolylineStyle(2)` 樣式 render
- **AND** Day 1→2 之間（pinB→pinC）SHALL **不** 連線（跨天 polyline 不繪製）

#### Scenario: 向後相容僅傳 pins

- **WHEN** OceanMap 僅接收 flat `pins`（無 `pinsByDay`）
- **THEN** 所有 pins 依 `dayNum` prop (optional) 決定 polyline 顏色
- **AND** 若無 `dayNum`，fallback 既有預設 segment style
