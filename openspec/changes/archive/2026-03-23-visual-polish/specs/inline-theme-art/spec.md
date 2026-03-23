## ADDED Requirements

### Requirement: ThemeArt 元件存在並匯出三個子元件

`src/components/trip/ThemeArt.tsx` SHALL 匯出 `DayHeaderArt`、`DividerArt`、`FooterArt` 三個 React 元件。每個元件 MUST 接受 `theme: 'sun' | 'sky' | 'zen'` 與 `dark: boolean` 兩個 props，並渲染對應的 inline SVG。所有 SVG 根節點 MUST 帶有 `aria-hidden="true"`。

#### Scenario: DayHeaderArt 根據 theme + dark 渲染正確 SVG

- **WHEN** `<DayHeaderArt theme="sun" dark={false} />` 渲染
- **THEN** 元件 SHALL 輸出陽光主題淺色版的 day header inline SVG（含太陽、椰子樹、飛機元素），並帶有 `aria-hidden="true"`

#### Scenario: DividerArt 深色模式渲染夜間版

- **WHEN** `<DividerArt theme="zen" dark={true} />` 渲染
- **THEN** 元件 SHALL 輸出和風主題深色版的 divider inline SVG（金色螢火蟲 + 花瓣光點），高度 24px

#### Scenario: FooterArt 陽光深色版含夜浪與星

- **WHEN** `<FooterArt theme="sun" dark={true} />` 渲染
- **THEN** 元件 SHALL 輸出陽光主題深色版的 footer inline SVG（夜浪 + 星點）

---

### Requirement: 插畫透明度符合規範

包裝插畫的容器 SHALL 在淺色模式下套用 50–55% `opacity`，深色模式下套用 35–45% `opacity`。透明度 MUST 以 CSS `opacity` 設定於包裝元素，不得嵌入 SVG fill alpha 值。

#### Scenario: 淺色模式 DayHeaderArt opacity 正確

- **WHEN** `dark={false}` 時渲染 DayHeaderArt
- **THEN** 包裝容器的 opacity SHALL 介於 0.50 至 0.55 之間

#### Scenario: 深色模式 DayHeaderArt opacity 正確

- **WHEN** `dark={true}` 時渲染 DayHeaderArt
- **THEN** 包裝容器的 opacity SHALL 介於 0.35 至 0.45 之間

---

### Requirement: 深色模式插畫使用鮮豔原色，不暗化

深色版 SVG 元素 MUST 使用鮮豔原色定義，金色月亮 SHALL 使用 `#FFD080`，亮星 SHALL 使用 `#FFF4C0`。SVG 內部顏色 MUST NOT 使用暗化濾鏡或將色碼乘以暗化係數。

#### Scenario: 陽光深色 DayHeaderArt 月亮色碼正確

- **WHEN** `<DayHeaderArt theme="sun" dark={true} />` 渲染
- **THEN** SVG 中代表月亮的元素 fill SHALL 為 `#FFD080`

#### Scenario: 深色版星點色碼正確

- **WHEN** 任一深色版 ThemeArt 元件渲染
- **THEN** 代表星點的 SVG 元素 fill SHALL 為 `#FFF4C0`

---

### Requirement: ThemeArt 插畫置入 TripPage 正確位置

`TripPage.tsx` SHALL 在以下位置引入插畫元件：
- `DayHeaderArt`：每個 day section 的標題右側
- `DividerArt`：timeline 卡片之間
- `FooterArt`：頁面最底部

元件所需的 `theme` 與 `dark` 值 MUST 從 `useDarkMode` hook 取得的 `colorTheme` 與 `isDark` 傳入。

#### Scenario: DayHeaderArt 出現在每個 day section header

- **WHEN** 行程有多個 day section 渲染
- **THEN** 每個 day section header 右側 SHALL 存在一個 DayHeaderArt 元件

#### Scenario: FooterArt 在頁面底部存在

- **WHEN** TripPage 完整渲染
- **THEN** 頁面底部 SHALL 存在一個 FooterArt 元件

---

### Requirement: Body 背景插畫移除

`css/style.css` MUST NOT 包含 `body.theme-sun`、`body.theme-sky`、`body.theme-zen` 的 `background-image` 規則。`images/bg-sun-light.svg`、`bg-sun-dark.svg`、`bg-sky-light.svg`、`bg-sky-dark.svg`、`bg-zen-light.svg`、`bg-zen-dark.svg` 六個靜態檔案 SHALL 從專案中刪除。

#### Scenario: style.css 不含 body theme background-image

- **WHEN** 讀取 `css/style.css`
- **THEN** 文件中 SHALL NOT 存在 `body.theme-` 配合 `background-image` 的規則

#### Scenario: bg-*.svg 靜態檔案不存在

- **WHEN** 檢查 `images/` 目錄
- **THEN** `bg-sun-light.svg`、`bg-sun-dark.svg`、`bg-sky-light.svg`、`bg-sky-dark.svg`、`bg-zen-light.svg`、`bg-zen-dark.svg` SHALL 不存在
