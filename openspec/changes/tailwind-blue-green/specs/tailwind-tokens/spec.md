## ADDED Requirements

### Requirement: tokens.css 提供完整的設計 token 系統
tokens.css SHALL 包含所有 CSS custom properties（顏色、字型大小、間距、圓角、陰影、z-index）、6 套主題的深淺模式切換、@keyframes 動畫定義、全域 reset，以及 Tailwind v4 的 theme/utilities imports。

#### Scenario: tokens.css 獨立載入時 Tailwind utilities 生效
- **WHEN** 頁面只載入 tokens.css（不載入 shared.css）
- **THEN** Tailwind utility classes（如 `bg-[var(--color-accent)]`）的 computed styles SHALL 正確反映 token 定義值

#### Scenario: 主題切換正常運作
- **WHEN** body 加上 `theme-sky` class 並載入 tokens.css
- **THEN** `var(--color-accent)` 等 CSS custom properties SHALL 切換為 sky 主題定義的值

#### Scenario: 深色模式正常運作
- **WHEN** body 加上 `dark` class 並載入 tokens.css
- **THEN** 所有顏色 token SHALL 切換為深色模式定義的值

### Requirement: tokens.css 不包含任何元件 class
tokens.css SHALL NOT 包含任何語意化 CSS class 定義（如 `.request-item`、`.sticky-nav`、`.chat-container`）。所有元件樣式 SHALL 由 Tailwind inline classes 處理。

#### Scenario: 無元件 class 定義
- **WHEN** 檢查 tokens.css 內容
- **THEN** SHALL NOT 存在任何以 `.` 開頭的 class selector（@theme block 和 body/html 的 reset 除外）

### Requirement: V2 元件視覺一致性
V2 元件的 computed styles SHALL 與 V1 元件在關鍵屬性上一致（fontSize, padding, margin, color, backgroundColor, transition, opacity），允許 1-2px 差異。

#### Scenario: RequestStepperV2 視覺一致
- **WHEN** 同時渲染 RequestStepper 和 RequestStepperV2
- **THEN** 7 個關鍵 computed style 屬性 SHALL 一致（1-2px 容差）

#### Scenario: V2 元件保留所有 a11y 屬性
- **WHEN** 檢查任何 V2 元件的 HTML output
- **THEN** SHALL 包含對應 V1 元件的所有 `aria-*`、`role`、`tabIndex` 屬性
