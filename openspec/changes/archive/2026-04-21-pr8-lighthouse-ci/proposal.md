# Proposal: pr8-lighthouse-ci — Lighthouse CI baseline

## 問題

autoplan retro 發現 Tripline 完全沒有建立 mobile perf budget 與效能 baseline：

- `TripMapRail` 引入 Leaflet（~150KB chunk），無任何 regression 偵測
- `html2pdf` chunk 高達 936KB，完全沒有 transfer size 警戒線
- LCP / TBT / CLS 從未被量測，任何 UI 變更都可能無感衰退
- 目前 CI 只做型別檢查、單元測試、build 驗證，缺少效能層

沒有 baseline 就無法偵測 regression，等到使用者抱怨才知道已晚。

## MVP Scope

1. **`lighthouserc.json`** — 3 個關鍵 URL（root / trip / stop detail），跑 3 次平均，設 4 項 warn budget（LCP / TBT / CLS / perf score）
2. **`.github/workflows/lighthouse.yml`** — push master 後自動跑 Lighthouse CI against production URL，上傳 artifact
3. **`docs/lighthouse-ci.md`** — 說明 perf budget 原則、如何看 report、未來 roadmap

### Non-blocking first（warn 不擋 merge）

前 2 週建立 baseline 階段，CI noise 多（外部因素、Cloudflare cold start、網路抖動），不適合設 blocking gate。先 **warn**，觀察 2 週後的 p50 數字，再決定 blocking 閾值。

### 對象 URL

| URL | 說明 |
|-----|------|
| `{BASE_URL}/` | 首頁（最輕，代表首次進入體驗） |
| `{BASE_URL}/trip/okinawa-trip-2026-Ray` | 典型行程頁（Leaflet + timeline）|
| `{BASE_URL}/trip/okinawa-trip-2026-Ray/stop/419` | Stop detail（巢狀路由）|

### Perf Budget（warn 模式）

| 指標 | 閾值 | 理由 |
|------|------|------|
| LCP | < 2500ms | Web Vitals 良好閾值 |
| TBT | < 300ms | 代表 main thread blocking（JS parse/eval）|
| CLS | < 0.1 | 版面穩定（圖片延遲載入時的跳動）|
| perf score | ≥ 0.80 | Lighthouse 綜合分 80 分 |

## 未來 Roadmap

1. **Blocking gate**（2 週 baseline 後）— 將 warn 改 error，閾值根據 p50 + 10% buffer 設定
2. **PR preview URL integration** — 改為對比 PR preview deploy URL，可在 merge 前發現 regression
3. **More pages** — ManagePage、AdminPage、停留點詳情等更多路由
4. **RUM（Real User Monitoring）** — Sentry Performance / Cloudflare Analytics 補充真實用戶數據
5. **JS bundle size gate** — 整合 bundlesize / size-limit，直接在 CI 阻擋 chunk 爆炸
