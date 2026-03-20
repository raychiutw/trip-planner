## ADDED Requirements

### Requirement: React Testing Library 整合
測試 SHALL 使用 Vitest + React Testing Library，取代現有的手動 innerHTML 測試。

#### Scenario: 組件渲染測試
- **WHEN** 使用 `render(<Component props={...} />)` 渲染組件
- **THEN** 可透過 `screen.getByText()`、`screen.getByRole()` 驗證輸出

### Requirement: 現有測試覆蓋率維持
遷移後的測試 SHALL 覆蓋所有現有測試案例，測試數量不得低於現有的 423 個。

#### Scenario: 測試全過
- **WHEN** 執行 `npm test`
- **THEN** 所有測試通過，包含組件測試、API mapping 測試、命名規範測試、CSS HIG 測試

### Requirement: 純邏輯測試保持
不依賴 DOM 的純邏輯測試（mapRow、escape、validate、naming-convention、css-hig）SHALL 保持或直接遷移，不需改為 React Testing Library 風格。

#### Scenario: mapRow 測試
- **WHEN** 執行 mapRow 相關測試
- **THEN** 驗證 DB row → 前端物件的轉換正確性

### Requirement: E2E 測試不受影響
Playwright E2E 測試 SHALL 繼續運作，測試最終渲染的 HTML。

#### Scenario: E2E 測試通過
- **WHEN** 執行 Playwright E2E 測試
- **THEN** 頁面載入、互動、導航等功能正常
