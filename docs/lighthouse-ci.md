# Lighthouse CI — 效能監控說明

## 概覽

Tripline 使用 [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) 對 production URL 進行自動化效能量測，在每次 push master 後執行。

## Perf Budget（warn 模式）

| 指標 | 說明 | 閾值 | 模式 |
|------|------|------|------|
| **LCP**（Largest Contentful Paint）| 最大內容渲染時間 | < 2500ms | warn |
| **TBT**（Total Blocking Time）| 主執行緒阻塞時間（JS parse/eval）| < 300ms | warn |
| **CLS**（Cumulative Layout Shift）| 累計版面位移（圖片延遲載入時的跳動）| < 0.1 | warn |
| **Perf Score**（綜合分）| Lighthouse 效能總分 | ≥ 0.80 | warn |

### 為何是 warn 而不是 error？

前 2 週為 baseline 收集期。Lighthouse 分數受外部因素影響大（Cloudflare cold start、網路抖動、CI runner 硬體差異），貿然設 blocking gate 會造成大量 false positive，破壞 CI 信賴感。2 週後根據實測 p50 / p95 數字調整為 blocking。

## 量測 URL

| URL | 說明 |
|-----|------|
| `https://trip-planner-dby.pages.dev/` | 首頁（首次進入體驗）|
| `https://trip-planner-dby.pages.dev/trip/okinawa-trip-2026-Ray` | 典型行程頁（Leaflet + timeline）|
| `https://trip-planner-dby.pages.dev/trip/okinawa-trip-2026-Ray/stop/419` | Stop detail（巢狀路由）|

每個 URL 跑 3 次取平均（desktop preset），減少單次量測的雜訊。

## 如何查看 Report

1. 前往 GitHub Actions：`Actions` → `Lighthouse CI` → 選最新執行
2. 展開 `執行 Lighthouse CI` step，查看 summary
3. 下載 `Artifacts`（`lighthouse-results`）→ 解壓縮後用瀏覽器開 `.html` 報告
4. 三個 URL 分別有獨立報告，可對比各頁效能

## Config 位置

- **lighthouserc.json**（根目錄）— 量測目標、assertion 閾值
- **.github/workflows/lighthouse.yml** — CI trigger、workflow 步驟

## 未來 Roadmap

### 近期（2 週 baseline 後）
- **Blocking gate**：將 `warn` 改 `error`，閾值根據 p50 + 10% buffer 設定
- 參考 `TODOS.md` — Lighthouse blocking gate 段落

### 中期
- **PR preview URL integration**：改為對比 PR preview deploy URL（`https://{branch}.trip-planner-dby.pages.dev`），可在 merge 前發現 regression
- **More pages**：ManagePage、AdminPage

### 長期
- **RUM（Real User Monitoring）**：整合 Sentry Performance 或 Cloudflare Analytics 補充真實用戶數據
- **JS bundle size gate**：整合 bundlesize / size-limit，直接在 CI 阻擋 Leaflet（~150KB）/ html2pdf（~936KB）chunk 爆炸

## 相關背景

- Leaflet chunk（TripMapRail）：~150KB gzip
- html2pdf chunk：~936KB gzip（目前最大威脅，建議 lazy import）
- 建立 baseline 的動機：autoplan retro 發現完全無效能監控，任何 UI 變更可能無感衰退
