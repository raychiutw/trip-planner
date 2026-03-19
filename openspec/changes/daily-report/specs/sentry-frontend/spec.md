## ADDED Requirements

### Requirement: Sentry React 整合
前端 SHALL 使用 @sentry/react 收集未捕捉的 JS 錯誤、Promise rejection、React render 錯誤。

#### Scenario: JS 錯誤自動上報
- **WHEN** 前端發生未捕捉的 JS 錯誤
- **THEN** 錯誤自動送到 Sentry，包含 stack trace、URL、瀏覽器資訊

#### Scenario: React render 錯誤
- **WHEN** React 組件 render 拋出錯誤
- **THEN** Sentry Error Boundary 捕捉並上報，頁面顯示 fallback UI

#### Scenario: Source Map 對應
- **WHEN** vite build 產出 production bundle
- **THEN** source map 自動上傳到 Sentry，錯誤可對應到原始 TSX 行號

### Requirement: Sentry 只在 production 啟用
Sentry init SHALL 只在 `import.meta.env.PROD` 為 true 時執行，dev 模式不送錯誤。

#### Scenario: dev 模式
- **WHEN** 執行 `vite dev`
- **THEN** Sentry 不初始化，錯誤只出現在 console

### Requirement: Performance 取樣
Sentry tracesSampleRate SHALL 設為 0.1（10%），避免免費額度消耗過快。

#### Scenario: API 呼叫追蹤
- **WHEN** 前端 fetch /api/* 端點
- **THEN** 10% 的請求會記錄 performance span
