## Context

行程規劃網站部署在 Cloudflare Pages，前端 React + TS，後端 Pages Functions + D1。GitHub repo 在 raychiutw/trip-planner。目前沒有前端錯誤收集、沒有後端錯誤持久化、沒有每日健康報告。

## Goals / Non-Goals

**Goals:**
- 前端 JS 錯誤自動收集到 Sentry
- 後端 API 錯誤持久化到 D1
- 每天一封 Gmail 日報，包含 7 個數據來源
- 全自動，不需人工觸發

**Non-Goals:**
- 不做即時告警（Sentry 內建的 email alert 已夠用）
- 不做前端 Session Replay（免費額度有限，先不開）
- 不做後端 Sentry（CPU 開銷風險，D1 自建更適合）

## Decisions

### 1. 前端錯誤 → Sentry（@sentry/react）

在 4 個入口 TSX 的共用位置做一次 init。React Error Boundary 自動捕捉 render 錯誤。

```
src/lib/sentry.ts  ← init 邏輯
src/entries/main.tsx  ← import sentry init
```

Sentry DSN 存在環境變數（Vite 用 `import.meta.env.VITE_SENTRY_DSN`）。build 時注入。

Vite Source Map 上傳用 `@sentry/vite-plugin`。

### 2. 後端錯誤 → D1 api_logs 表

```sql
CREATE TABLE api_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  method     TEXT NOT NULL,
  path       TEXT NOT NULL,
  status     INTEGER NOT NULL,
  error      TEXT,
  duration   INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_api_logs_created ON api_logs(created_at);
```

在 `_middleware.ts` 的 try/catch 裡寫入。只記錄 4xx/5xx，不記錄 2xx（避免寫入量過大）。

### 3. GitHub Actions 日報

```yaml
# .github/workflows/daily-report.yml
on:
  schedule:
    - cron: '0 0 * * *'  # UTC 00:00 = 台灣 08:00
  workflow_dispatch:       # 手動觸發

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: node scripts/daily-report.js
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
      D1_DATABASE_ID: ${{ secrets.D1_DATABASE_ID }}
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
      RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
```

### 4. 日報腳本 7 個數據來源

```
scripts/daily-report.js
  │
  ├── queryD1Requests()        ← Cloudflare D1 REST API
  │   └── 昨天 requests 統計（new/closed/open/processed_by）
  │
  ├── queryD1ApiLogs()         ← Cloudflare D1 REST API
  │   └── 昨天 4xx/5xx 錯誤數 + top 路徑
  │
  ├── queryD1WebhookLogs()     ← Cloudflare D1 REST API
  │   └── 昨天 webhook 失敗數
  │
  ├── querySentry()            ← Sentry API
  │   └── 昨天前端錯誤數 + top 3 issue
  │
  ├── queryWorkersAnalytics()  ← CF GraphQL
  │   └── invocations / errors / P50 P99 延遲
  │
  ├── queryWebAnalytics()      ← CF GraphQL
  │   └── 瀏覽量 / 訪客 / Web Vitals
  │
  ├── runLighthouse()          ← npx lighthouse CLI
  │   └── Performance / SEO / Accessibility / Best Practices
  │
  ├── checkLinks()             ← fetch HEAD 各行程 maps URL
  │   └── 4xx/5xx 壞連結清單
  │
  └── sendEmail()              ← Resend API
      └── 組合 HTML → lean.lean@gmail.com
```

### 5. 寄信 → Resend

免費 100 封/天。一行 fetch，不需 OAuth。寄件地址用 `onboarding@resend.dev`（免費方案預設）或自訂 domain 驗證。

## Risks / Trade-offs

- **Sentry bundle 增加 ~30KB** → gzip 後 ~10KB，可接受
- **D1 api_logs 會持續增長** → 加排程清理（保留 30 天）
- **GitHub Actions 免費額度** → 2000 分鐘/月，日報每次 ~3 分鐘，月用 ~90 分鐘，夠用
- **Lighthouse 在 CI 跑結果可能與真實不同** → 作為趨勢參考即可
- **Resend 免費方案寄件地址限制** → 可用 `onboarding@resend.dev` 或驗證自有 domain
