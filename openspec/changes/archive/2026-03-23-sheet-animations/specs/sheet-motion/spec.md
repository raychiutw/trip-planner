## ADDED Requirements

### Requirement: Sheet 開啟時背景 scale-down
InfoSheet 或 QuickPanel 開啟時，背後的 `.container` SHALL 縮小產生卡片堆疊景深效果。

#### Scenario: InfoSheet 開啟
- **WHEN** InfoSheet 從關閉變為開啟
- **THEN** `.container` SHALL 套用 `scale(0.95)` + `border-radius` 的縮小效果
- **THEN** 動畫 SHALL 使用 spring easing（帶微過衝）

#### Scenario: QuickPanel 關閉
- **WHEN** QuickPanel 從開啟變為關閉
- **THEN** `.container` SHALL 恢復 `scale(1)` + 原始 border-radius
- **THEN** 關閉動畫 SHALL 比開啟動畫更快且無過衝

### Requirement: Sheet 動畫使用 spring easing
Sheet 的開啟/關閉動畫 SHALL 使用不同的 easing curve。

#### Scenario: 開啟使用 spring
- **WHEN** sheet 開啟
- **THEN** 動畫 SHALL 使用 `cubic-bezier(0.32, 1.28, 0.60, 1.00)`（帶微過衝）
- **THEN** duration SHALL 約 400-420ms

#### Scenario: 關閉使用快速 ease-out
- **WHEN** sheet 關閉
- **THEN** 動畫 SHALL 使用無過衝的 ease-out
- **THEN** duration SHALL 約 280ms
