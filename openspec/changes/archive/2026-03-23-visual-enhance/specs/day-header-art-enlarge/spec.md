## ADDED Requirements

### Requirement: DayHeaderArt 插畫容器放大

系統 SHALL 將 `src/components/trip/ThemeArt.tsx` 中 `DayHeaderArt` 元件的容器 `style.width` 從 `'60%'` 改為 `'80%'`，使插畫佔據 day-header 右側更大範圍，增強裝飾視覺感。其餘容器樣式（position, right, top, height, pointerEvents）SHALL 維持不變。

#### Scenario: DayHeaderArt 容器寬度為 80%

- **WHEN** 渲染任意主題的 `DayHeaderArt` 元件
- **THEN** 容器 div 的 inline style `width` SHALL 為 `'80%'`

#### Scenario: DayHeaderArt 容器靠右對齊

- **WHEN** 渲染 `DayHeaderArt` 元件
- **THEN** 容器 div 的 `right` 為 `0`、`position` 為 `'absolute'`、`top` 為 `0`

### Requirement: Day Header 最小高度加高

系統 SHALL 將 `css/style.css` 中 `.day-header` 的 `min-height` 設為 `100px`，讓插畫有更多垂直空間展示。

#### Scenario: day-header min-height 為 100px

- **WHEN** 渲染 `.day-header` 元素
- **THEN** 元素的 computed `min-height` SHALL 為 `100px`

### Requirement: NavArt sticky nav 主題裝飾

系統 SHALL 在 `src/components/trip/ThemeArt.tsx` 新增 `NavArt` 元件，提供 sticky nav 背景淡色主題裝飾。`NavArt` 接收 `theme: ColorTheme` 與 `dark: boolean` props，回傳高度 `24px` 的 SVG，以 `position: absolute` 方式覆蓋 sticky nav 底部，`pointer-events: none`，不影響 nav 點擊互動。

各主題 light/dark 裝飾內容：

| 主題 | light | dark |
|------|-------|------|
| `sun` | 細波浪線 | 點狀螢火蟲 |
| `sky` | 海鷗輪廓 | 星點 |
| `zen` | 花瓣散落 | 螢火蟲 |

#### Scenario: NavArt 元件存在且可渲染

- **WHEN** 以 `theme="sky"` 與 `dark={false}` 渲染 `NavArt`
- **THEN** 回傳的 SVG 元素 SHALL 包含 `aria-hidden="true"` 且高度為 `24px`

#### Scenario: NavArt 不干擾點擊

- **WHEN** NavArt SVG 覆蓋於 sticky nav 上層
- **THEN** SVG 的 `pointer-events` SHALL 為 `none`，不阻擋底層按鈕點擊

#### Scenario: NavArt 各主題均有內容

- **WHEN** 分別以 `sun`、`sky`、`zen` 主題（含 light/dark 各別）渲染 `NavArt`
- **THEN** 各組合均 SHALL 回傳非空的 SVG 子元素，不得為空白 SVG
