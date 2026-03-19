## 1. Sentry 前端整合

- [x] 1.1 安裝 @sentry/react @sentry/vite-plugin
- [x] 1.2 建立 `src/lib/sentry.ts`（init 邏輯，只在 production 啟用）
- [x] 1.3 在 `src/entries/main.tsx` import sentry init
- [x] 1.4 在其他 3 個入口（setting/manage/admin）也 import sentry init
- [x] 1.5 `vite.config.ts` 加 @sentry/vite-plugin（source map 上傳，CI only）
- [x] 1.6 tsc 零錯誤 + npm test 437 passed

## 2. 後端 API 錯誤持久化

- [x] 2.1 建立 D1 migration `migrations/0007_api_logs.sql`
- [ ] 2.2 執行 migration：`wrangler d1 migrations apply trip-planner-db --remote`（手動）
- [x] 2.3 修改 `_middleware.ts`：handleAuth 抽離 + 4xx/5xx 寫入 api_logs
- [x] 2.4 npm test 437 passed

## 3. GitHub Actions 日報 workflow

- [x] 3.1 建立 `.github/workflows/daily-report.yml`（cron + workflow_dispatch）
- [ ] 3.2 設定 GitHub Secrets（手動）

## 4. 日報腳本

- [x] 4.1 建立 `scripts/daily-report.js` 主框架
- [x] 4.2 queryD1Requests()：排程處理統計
- [x] 4.3 queryD1ApiLogs()：後端 API 錯誤統計
- [x] 4.4 queryD1WebhookLogs()：webhook 失敗統計
- [x] 4.5 querySentry()：前端錯誤統計
- [x] 4.6 queryWorkersAnalytics()：CF Workers GraphQL
- [x] 4.7 queryWebAnalytics()：CF Web Analytics GraphQL
- [x] 4.8 runLighthouse()：PageSpeed Insights API
- [x] 4.9 checkLinks()：爬連結 HEAD 檢查
- [x] 4.10 buildHtml()：組合 HTML email
- [x] 4.11 sendEmail()：Resend API 寄信
- [x] 4.12 cleanupOldLogs()：清理 30 天前 api_logs

## 5. 驗證

- [ ] 5.1 手動觸發 GitHub Actions workflow 確認完整流程
- [ ] 5.2 確認 Gmail 收到日報信件
- [ ] 5.3 npm test + /tp-code-verify 全綠
