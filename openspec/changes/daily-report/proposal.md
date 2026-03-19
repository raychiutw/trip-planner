## Why

目前缺乏每日營運狀態的可見性 — 前端 JS 錯誤無人知、API 錯誤只能手動查 D1、壞連結無偵測、SEO 退步無預警、排程處理狀態散落各表。需要一封每日日報彙整所有健康指標，主動寄到 Gmail。

## What Changes

- 前端整合 Sentry（@sentry/react）收集 JS 錯誤、Performance、Source Map
- 後端 _middleware.ts 加 API 錯誤持久化（D1 api_logs 表）
- 新增 D1 migration：api_logs 表
- 新增 GitHub Actions workflow：每天 UTC 00:00 跑日報
- 日報腳本（scripts/daily-report.js）彙整 7 個數據來源
- 透過 Resend API 寄 HTML 信件到 Gmail

## Capabilities

### New Capabilities
- `sentry-frontend`: 前端 Sentry 錯誤收集 + Performance 監控
- `api-error-logging`: 後端 API 錯誤持久化到 D1 api_logs 表
- `daily-report`: GitHub Actions 日報（排程統計 + Sentry + CF Analytics + Lighthouse + 壞連結）

### Modified Capabilities

## Impact

- **前端**：`src/entries/*.tsx` 加 Sentry.init、bundle 增加 ~30KB
- **後端**：`functions/api/_middleware.ts` 加 error logging
- **D1**：新增 api_logs 表
- **GitHub**：新增 `.github/workflows/daily-report.yml` + `scripts/daily-report.js`
- **第三方**：Sentry（免費 5K/月）、Resend（免費 100封/天）、PageSpeed Insights API（免費）
