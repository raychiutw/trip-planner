# Uptime Monitoring Setup

**Last updated:** 2026-05-27 (v2.33.126 PR3)

外部 uptime monitor pin `/api/health` endpoint，CF Pages 邊緣健康可即時得知，不需等 daily-check 24h batch。

## Endpoint

`GET https://trip-planner-dby.pages.dev/api/health`

公開，無 auth。

### Response

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "checks": {
    "d1": "ok" | "fail",
    "googleMapsKey": "ok" | "missing"
  },
  "ts": "2026-05-27T03:00:00.000Z"
}
```

| status | HTTP code | 意義 |
|---|---|---|
| `healthy` | 200 | 全綠 |
| `degraded` | 200 | 非 critical 異常（如 Google Maps key 遺漏）— 仍 serve |
| `unhealthy` | 503 | D1 down — 多數 endpoint fail |

## 推薦外部 monitor 設定

任選一家（免費 tier 都夠）：

### UptimeRobot

1. <https://uptimerobot.com> sign up
2. Add New Monitor → Monitor Type: `HTTP(s)`
3. URL: `https://trip-planner-dby.pages.dev/api/health`
4. Monitoring Interval: 5 minutes（free tier 最低）
5. Alert Contacts：email + Telegram（UptimeRobot 內建 Telegram integration）

### Pingdom（替代）

類似流程，URL + 5min interval + Telegram alert。

### 純 curl cron（mac mini 自管）

如果不想用第三方，可在 mac mini 加 launchd job：

```bash
*/5 * * * * curl -sf -o /dev/null -w "%{http_code}" https://trip-planner-dby.pages.dev/api/health || /Users/ray/Projects/trip-planner/scripts/lib/send-telegram.sh "🚨 Tripline /api/health 5xx"
```

或 reuse PR4 schedule scripts pattern。

## 與既有 monitoring 的關係

| 層 | 工具 | 偵測 |
|---|---|---|
| CF Pages 邊緣 | 本 endpoint + 外部 monitor | D1 down / deploy 環境 var 遺漏 |
| Mac mini api-server | `funnel-guard launchd` (v2.33.123) | Tailscale funnel drift |
| 24h batch summary | `scripts/daily-check.js` | Sentry issues + api_logs 4xx/5xx + Workers Analytics |
| Frontend errors | Sentry (auto) | React render errors + apiFetch 5xx |

## 為什麼不檢查 mac mini api-server

`/api/health` 是 CF Pages 邊緣的健康訊號。如果 mac mini api-server 死，CF Worker 仍能 serve trip CRUD（只是 fire-and-forget trigger 會 timeout，但 30min cron 兜底）。

mac mini 健康由 funnel-guard launchd job 偵測（v2.33.123）+ daily-check.js (v2.33.124+) 涵蓋。雙層分離避免 single point of failure。

## Reference

- `functions/api/health.ts` — endpoint implementation
- `docs/monitoring/sentry-alerts.md` — Sentry alert rules（既有）
- `scripts/funnel-guard/README.md` — funnel drift auto-heal
- `scripts/daily-check.js` — 24h batch report
