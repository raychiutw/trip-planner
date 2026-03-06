## ADDED Requirements

### Requirement: 概況區 accent-light 色塊

每天 section 頂部的天氣（`.hourly-weather`）、飯店（hotel `.col-row` + `.col-detail`）、交通統計（`.driving-stats`）SHALL 包裹在一個 `.day-overview` 容器內，該容器底色為 `var(--accent-light)`、圓角 `var(--radius-sm)`。

#### Scenario: 概況區視覺區隔

- **WHEN** 行程頁某天的 section 渲染完成
- **THEN** 天氣、飯店、交通統計區域 SHALL 共用一個 `accent-light` 底色圓角色塊，與下方時間軸在視覺上明確區隔

#### Scenario: 時間軸無底色

- **WHEN** 行程頁某天的時間軸渲染完成
- **THEN** 時間軸區域（`.timeline`）SHALL 維持 `card-bg` 底色，不包含在概況區色塊內

#### Scenario: 概況區部分元件缺失

- **WHEN** 某天無天氣資料或無飯店資料
- **THEN** `.day-overview` 容器 SHALL 仍正常渲染，僅包含存在的子元件

#### Scenario: 深色模式

- **WHEN** 使用者切換至深色模式
- **THEN** `.day-overview` 底色 SHALL 自動使用 `--accent-light` 深色值（`#3D3330`）

### Requirement: 移除 budget 渲染

`renderDayContent()` SHALL 不再呼叫 `renderBudget()`。`renderBudget()` 函式及相關 CSS（`.budget-table`、`.budget-total`）SHALL 移除。

#### Scenario: 每日 section 無預算區塊

- **WHEN** 行程頁渲染某天 section
- **THEN** section 內 SHALL NOT 包含預算相關 HTML（`.budget-table`、`.budget-total`）
