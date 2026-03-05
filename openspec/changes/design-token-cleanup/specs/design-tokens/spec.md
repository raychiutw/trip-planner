## ADDED Requirements

### Requirement: Shadow token 定義於 shared.css

系統 SHALL 在 `css/shared.css` 的 `:root` 中定義以下四個 shadow CSS 變數，所有 CSS 檔案 MUST 引用這些變數，不得自行硬寫等效的 `box-shadow` 數值。

| 變數 | 值 | 用途 |
|------|----|------|
| `--shadow-sm` | `0 1px 4px rgba(0,0,0,0.06)` | 輕量浮升（訊息氣泡） |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.12)` | 中等浮升（input card、FAB） |
| `--shadow-lg` | `0 6px 16px rgba(0,0,0,0.2)` | 強浮升（FAB hover） |
| `--shadow-ring` | `0 0 0 2px var(--accent)` | 焦點環（focus-visible、hw-now） |

#### Scenario: 四個 shadow token 存在於 :root

- **WHEN** 載入 `css/shared.css`
- **THEN** `:root` 中 SHALL 存在 `--shadow-sm`、`--shadow-md`、`--shadow-lg`、`--shadow-ring` 四個變數，且值分別對應上表所定義的陰影

#### Scenario: CSS 中不得出現等效的 box-shadow 硬寫值

- **WHEN** 靜態分析 `css/style.css`、`css/edit.css`、`css/menu.css`、`css/setting.css`
- **THEN** 不得出現 `0 1px 4px rgba(0,0,0,0.06)`、`0 4px 12px rgba(0,0,0,0.2)`、`0 6px 16px rgba(0,0,0,0.2)` 等已 token 化的硬寫陰影值

#### Scenario: --shadow-ring 隨 --accent 動態更新

- **WHEN** `body.dark` 覆蓋 `--accent` 為 `#D4845E`
- **THEN** `--shadow-ring` 計算後焦點環色 SHALL 自動使用 dark mode 的 `--accent` 值，無需額外覆蓋

---

### Requirement: Radius token 定義於 shared.css

系統 SHALL 在 `css/shared.css` 的 `:root` 中定義以下三個 border-radius CSS 變數，並在各 CSS 檔案中取代對應的硬寫值。

| 變數 | 值 | 用途 |
|------|----|------|
| `--radius-sm` | `8px` | info-box、status-tag、map-link、警告區塊、小型元件 |
| `--radius-md` | `12px` | section card、info-card、nav-pill、trip-btn、flight-row |
| `--radius-full` | `99px` | pill tag（`.hl-tag`） |

以下形狀屬例外，不納入 token 化：

- `border-radius: 50%`（圓形元素）
- 非對稱值如 `16px 16px 0 0`（`.info-sheet-panel` 底部抽屜形狀）

#### Scenario: 三個 radius token 存在於 :root

- **WHEN** 載入 `css/shared.css`
- **THEN** `:root` 中 SHALL 存在 `--radius-sm: 8px`、`--radius-md: 12px`、`--radius-full: 99px` 三個變數

#### Scenario: 一般元件使用 --radius-sm

- **WHEN** 靜態分析 `css/style.css`
- **THEN** `.info-box`、`.status-tag`、`.tl-head`、`.hotel-sub` 的 `border-radius` SHALL 引用 `var(--radius-sm)`，不得出現 `8px` 硬寫

#### Scenario: 卡片元件使用 --radius-md

- **WHEN** 靜態分析 `css/style.css`
- **THEN** `#tripContent section`、`.info-card`、`.dn`、`.flight-row` 的 `border-radius` SHALL 引用 `var(--radius-md)`，不得出現 `12px` 硬寫

#### Scenario: Pill tag 使用 --radius-full

- **WHEN** 靜態分析 `css/style.css`
- **THEN** `.hl-tag` 的 `border-radius` SHALL 引用 `var(--radius-full)`，不得出現 `99px` 硬寫

---

### Requirement: Priority 色彩 token 定義於 shared.css

系統 SHALL 在 `css/shared.css` 的 `:root` 與 `body.dark` 中定義以下 priority 色彩 CSS 變數，並取代 `.sg-priority-*` 的硬寫色碼。

| 變數 | Light 值 | Dark 值 |
|------|----------|---------|
| `--priority-high-bg` | `rgba(239, 68, 68, 0.15)` | `rgba(239, 68, 68, 0.22)` |
| `--priority-high-dot` | `#EF4444` | `#FCA5A5` |
| `--priority-medium-bg` | `rgba(234, 179, 8, 0.15)` | `rgba(234, 179, 8, 0.22)` |
| `--priority-medium-dot` | `#EAB308` | `#FDE047` |
| `--priority-low-bg` | `rgba(34, 197, 94, 0.10)` | `rgba(34, 197, 94, 0.15)` |
| `--priority-low-dot` | `#22C55E` | `#86EFAC` |

#### Scenario: Light mode priority token 值正確

- **WHEN** 載入 `css/shared.css` 且頁面為 light mode
- **THEN** `:root` 中 `--priority-high-bg` SHALL 為 `rgba(239, 68, 68, 0.15)`、`--priority-medium-bg` SHALL 為 `rgba(234, 179, 8, 0.15)`、`--priority-low-bg` SHALL 為 `rgba(34, 197, 94, 0.10)`

#### Scenario: Dark mode priority 背景不透明度提升

- **WHEN** 頁面有 `body.dark` class
- **THEN** `--priority-high-bg` SHALL 為 `rgba(239, 68, 68, 0.22)`、`--priority-medium-bg` SHALL 為 `rgba(234, 179, 8, 0.22)`、`--priority-low-bg` SHALL 為 `rgba(34, 197, 94, 0.15)`，確保在深色背景上可見

#### Scenario: Dark mode priority dot 色改為淺色版本

- **WHEN** 頁面有 `body.dark` class
- **THEN** `--priority-high-dot` SHALL 為 `#FCA5A5`、`--priority-medium-dot` SHALL 為 `#FDE047`、`--priority-low-dot` SHALL 為 `#86EFAC`（各色系的淺色版本）

#### Scenario: .sg-priority-* 使用 token 而非硬寫色

- **WHEN** 靜態分析 `css/style.css`
- **THEN** `.sg-priority-high`、`.sg-priority-medium`、`.sg-priority-low` 的 `background` SHALL 引用對應的 CSS 變數，不得出現 `rgba(239, 68, 68, 0.15)` 等硬寫色碼
