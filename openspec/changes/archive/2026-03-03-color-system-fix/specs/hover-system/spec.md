## ADDED Requirements

### Requirement: hover 背景色 CSS 變數

系統 SHALL 在 `css/shared.css` 的 `:root` 與 `body.dark` 中定義 `--hover-bg` 變數：

| 變數 | Light 值 | Dark 值 | 用途 |
|------|----------|---------|------|
| `--hover-bg` | `#EDE8E0` | `#3D3A37` | 互動元素 hover 底色 |

#### Scenario: Light mode hover 變數值正確

- **WHEN** 載入 `css/shared.css` 且頁面為 light mode
- **THEN** `:root` 中 `--hover-bg` SHALL 為 `#EDE8E0`

#### Scenario: Dark mode hover 變數值正確

- **WHEN** 頁面有 `body.dark` class
- **THEN** `--hover-bg` SHALL 為 `#3D3A37`

---

### Requirement: 全站 hover 底色統一使用 --hover-bg

系統 SHALL 將以下元素的 hover 背景色改為 `var(--hover-bg)`：

| 選擇器 | 原值（淺） | 原值（深） | 改為 |
|--------|-----------|-----------|------|
| `.map-link:hover` | `#333` | `#5A5651` | `var(--hover-bg)` |
| `.map-link.apple:hover` | `#333` | 無覆蓋 | `var(--hover-bg)` |
| `.map-link.mapcode:hover` | `#333` | 無覆蓋 | `var(--hover-bg)` |

map-link hover 的文字色 SHALL 改為 `var(--text)`（取代 `#fff`），apple icon SVG fill 在 hover 時 SHALL 改為 `currentColor`。

#### Scenario: map-link hover 在 light mode 使用 hover-bg

- **WHEN** 頁面為 light mode 且使用者 hover `.map-link`
- **THEN** 背景色 SHALL 為 `var(--hover-bg)`（`#EDE8E0`）、文字色 SHALL 為 `var(--text)`

#### Scenario: map-link hover 在 dark mode 使用 hover-bg

- **WHEN** 頁面為 dark mode 且使用者 hover `.map-link`
- **THEN** 背景色 SHALL 為 `var(--hover-bg)`（`#3D3A37`）、文字色 SHALL 為 `var(--text)`

#### Scenario: apple map-link hover 在 dark mode 使用 hover-bg

- **WHEN** 頁面為 dark mode 且使用者 hover `.map-link.apple`
- **THEN** 背景色 SHALL 為 `var(--hover-bg)`（`#3D3A37`），不再是未覆蓋的 `#333`

---

### Requirement: 深色模式硬寫 hover 色碼改為變數

系統 SHALL 將以下深色模式硬寫的 hover/互動背景色改為 CSS 變數：

| 選擇器 | 原硬寫值 | 改為 |
|--------|---------|------|
| `body.dark .hw-block` | `#3D3A37` | `var(--hover-bg)` |
| `body.dark .trip-btn` | `#3D3A37` | `var(--hover-bg)` |

#### Scenario: hw-block 在 dark mode 使用 hover-bg 變數

- **WHEN** 頁面為 dark mode 且渲染 `.hw-block`
- **THEN** 背景色 SHALL 為 `var(--hover-bg)`（`#3D3A37`）

#### Scenario: trip-btn 在 dark mode 使用 hover-bg 變數

- **WHEN** 頁面為 dark mode 且渲染 `.trip-btn`
- **THEN** 背景色 SHALL 為 `var(--hover-bg)`（`#3D3A37`）
