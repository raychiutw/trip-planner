# Design: pr8-lighthouse-ci

## 為何 Non-blocking first

### CI noise 問題
Lighthouse 分數受外部因素影響大：
- Cloudflare Pages cold start（第一個請求可能慢 1-2s）
- 公有網路抖動（GitHub Actions → CDN 路由變化）
- CI runner 硬體差異（GH Actions free tier CPU 不穩定）

在前 2 週收集 baseline 資料前就設 blocking gate，會造成大量 false positive，阻擋正常 PR merge，破壞 CI 信賴感。

### 建議策略
1. **Week 1-2**：全部 warn，收集 p50 / p95 數字
2. **Week 3+**：根據實測數字 + 10% buffer 設 blocking 閾值
3. **長期**：區分 PR preview vs master 兩條線

## Cloudflare Pages Preview URL Integration（未來）

目前 PR preview URL 格式為：
```
https://{branch-name}.trip-planner-dby.pages.dev
```

要在 PR 上跑 Lighthouse 需要：
1. 等待 Cloudflare Pages deploy check 完成
2. 從 GitHub check run 或 deploy comment 取得 preview URL
3. 動態替換 lighthouserc.json 的 BASE_URL

MVP 先跑 master push → production URL，避免複雜的 preview URL 解析邏輯。

## `{BASE_URL}` template 機制

`lighthouserc.json` 的 URL 使用 `{BASE_URL}` 佔位符：
```json
"url": [
  "{BASE_URL}/",
  "{BASE_URL}/trip/okinawa-trip-2026-Ray",
  "{BASE_URL}/trip/okinawa-trip-2026-Ray/stop/419"
]
```

GitHub Actions workflow 透過 `env.LHCI_BASE_URL` 注入（treosh/lighthouse-ci-action 支援環境變數替換）。

實際上 `@lhci/cli` 支援 `--collect.url` 覆蓋，或直接在 workflow 傳 `BASE_URL` 環境變數，config 中用 `process.env.BASE_URL`（若改為 .js config）。

為保持 JSON 格式簡潔，MVP 直接硬寫 URL（不用 template），移除 `{BASE_URL}` 佔位符。

## 測試設計

測試只驗證 **infra 的存在與結構**，不跑真正的 Lighthouse（需要 browser + 網路）：
- `lighthouse-config.test.ts` — 讀 JSON 驗 schema
- `lighthouse-workflow.test.ts` — 讀 YAML 驗關鍵欄位

這種「config-as-code 驗證」模式與現有 `tokens-css.test.ts`、`design-md-sections.test.ts` 一致。
