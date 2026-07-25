# custom-scrollbar

全站統一捲軸樣式。**本 spec 只規範結構與 token 引用，不寫死色值** —— 上一版把四個色碼寫進 Scenario，色盤換成暖棕後整份斷言失效卻沒人發現（2026-07-25 更正）。

## Requirements

### Requirement: 全站統一捲軸樣式

系統 SHALL 在 `css/tokens.css` 定義全域捲軸樣式，適用所有可捲動元素。捲軸寬度 SHALL 為 6px，滑塊 SHALL 為圓角，軌道背景 SHALL 為透明。

滑塊顏色 SHALL 引用 `--scrollbar-thumb`、hover 態 SHALL 引用 `--scrollbar-thumb-hover`，**不得硬編碼色碼**。這兩個 token 在 light / dark 各有值，由 `body.dark` 覆寫。

#### Scenario: 捲軸結構

- **WHEN** 頁面出現可捲動區域
- **THEN** 捲軸 SHALL 為 6px 寬、滑塊圓角、軌道透明

#### Scenario: 滑塊色引用 token 而非硬編碼

- **WHEN** 檢視 `css/tokens.css` 的 `::-webkit-scrollbar-thumb` 規則
- **THEN** `background` SHALL 為 `var(--scrollbar-thumb)`，且該規則內 SHALL 不出現任何 `#` 色碼

#### Scenario: hover 態引用 token

- **WHEN** 使用者將滑鼠移至捲軸滑塊上
- **THEN** `background` SHALL 切換為 `var(--scrollbar-thumb-hover)`

#### Scenario: dark mode 自動切換

- **WHEN** 頁面套用 `body.dark`
- **THEN** `--scrollbar-thumb` 與 `--scrollbar-thumb-hover` SHALL 被覆寫為深色值，捲軸規則本身不需重寫

### Requirement: 捲軸宣告集中管理

預設樣式 SHALL 只由 `css/tokens.css` 的全域規則提供；元件層 SHALL NOT 為了改變**預設**捲軸外觀而自行宣告 `::-webkit-scrollbar-*`。

允許的元件層宣告只有兩類：

1. **隱藏捲軸** — 水平滑動的 tab／卡片列用 `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`。目前 4 處（行程 sheet tabs、行程清單 tabs、地圖手機卡片列、地圖景點卡列）。
2. **視覺化窄捲軸** — 需要比全域 6px 更細的容器。**目前 2 處，且都未引用捲軸 token**：時間選擇器的滾輪欄（4px，色用 `--color-border`）、新行程頁的彈性月份列（4px，色用 `--color-line-strong`）。

#### Scenario: 元件層不覆寫預設捲軸外觀

- **WHEN** 搜尋 `src/` 與 `css/` 的 `::-webkit-scrollbar-thumb` 宣告
- **THEN** 每一處 SHALL 落在上述兩類之一，SHALL NOT 有為了改預設外觀而重宣告的第三類

#### Scenario: 窄捲軸的色值應收斂到 token（已知偏離）

- **WHEN** 檢視第 2 類的兩處窄捲軸
- **THEN** 它們**目前**用 `--color-border` / `--color-line-strong` 而非 `--scrollbar-thumb`
- **AND** 這是**已記錄的偏離、不是合規** —— 要收斂需新增窄捲軸專用 token（例如 `--scrollbar-thumb-thin`）再一併改這兩處；在那之前本 spec 不宣稱它們合規

> ⚠️ 這條刻意寫成「記錄現況 + 標明偏離」而非 `SHALL 不存在其他宣告` —— 後者在寫下的當下就是紅的（實測 2 處違反）。**寫一條當下就守不住的 SHALL，等於製造下一個沒人守的規則。**
