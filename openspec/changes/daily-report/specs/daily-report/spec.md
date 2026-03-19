## ADDED Requirements

### Requirement: GitHub Actions 每日排程
系統 SHALL 每天 UTC 00:00（台灣 08:00）自動執行日報 workflow，也支援手動觸發。

#### Scenario: 定時觸發
- **WHEN** UTC 00:00
- **THEN** GitHub Actions 執行 daily-report job

#### Scenario: 手動觸發
- **WHEN** 在 GitHub Actions UI 點 "Run workflow"
- **THEN** 立即執行日報

### Requirement: 日報彙整 7 個數據來源
日報 SHALL 包含以下區塊：

#### Scenario: 行程修改統計
- **WHEN** 查詢 D1 requests 表
- **THEN** 顯示昨日新增/已處理/未處理數量

#### Scenario: Cloudflare Workers Analytics
- **WHEN** 查詢 CF GraphQL API
- **THEN** 顯示 API 呼叫量、錯誤率、P50/P99 延遲

#### Scenario: Cloudflare Web Analytics
- **WHEN** 查詢 CF GraphQL API
- **THEN** 顯示瀏覽量、訪客數、Core Web Vitals（LCP/CLS/INP）

#### Scenario: Lighthouse 分數
- **WHEN** 執行 Lighthouse CLI
- **THEN** 顯示 Performance/SEO/Accessibility/Best Practices 分數

#### Scenario: 前端錯誤
- **WHEN** 查詢 Sentry API
- **THEN** 顯示昨日新增錯誤數 + Top 3 issue

#### Scenario: 後端錯誤
- **WHEN** 查詢 D1 api_logs 表
- **THEN** 顯示昨日 4xx/5xx 數量 + top 路徑

#### Scenario: 壞連結檢查
- **WHEN** 爬行程頁面所有外部連結
- **THEN** 顯示 4xx/5xx 壞連結清單，或全部正常

### Requirement: 信件透過 Resend API 寄出
日報 SHALL 透過 Resend API 寄 HTML 格式信件到指定 Gmail。

#### Scenario: 寄信成功
- **WHEN** 日報資料彙整完成
- **THEN** 寄一封 HTML email 到 lean.lean@gmail.com，主旨含日期

#### Scenario: 部分數據失敗
- **WHEN** 某個數據來源查詢失敗（如 Sentry API timeout）
- **THEN** 該區塊顯示「查詢失敗」，其他區塊正常顯示，信件仍然寄出
