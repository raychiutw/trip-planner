# CANCELLED — 2026-05-23

**Decision**: Ray 確認 PR3 不做。

## Reasoning

實際盤點現有 offline infra（VitePWA + Workbox SW + NetworkFirst API cache）：

- ✅ Page shell / 公開行程資料 / 景點清單 / 地址 / 時間 / 備註 已能離線瀏覽
- ❌ Google Maps tiles 仍白塊（ToS 不允許 cache）

但「地圖白塊」這個 gap 可由 **系統 Google Maps app 預載沖繩離線地圖區**
cover 70% 導航需求 — 用戶實際出國前本來就會做這步。

PR3 Static Map fallback 只是減少「trip planner ↔ system Google Maps app
切換」的摩擦（省 3-4 次點擊），3-5 工作天投入 vs 實際痛點不成比例。

## Alternative

若沖繩 trip 出發前還想加 polish，5 分鐘可做：

- TripPage 加 dismissible banner「⚠ 沖繩部分區域訊號弱 — 建議在系統
  Google Maps app 下載沖繩離線地圖區」+ 連結教學
- 零開發、ToS 安全

但 Ray 確認連 banner 也不做（「不做」決議涵蓋整個 PR3 範疇）。

## Preserved Artifacts

- `proposal.md` — 原 proposal（含 Google Maps ToS 分析、Static Maps API
  路徑、5 個 open questions）
- `tasks.md` — 原 phase 1-5 task breakdown

未來若沖繩經驗發現「地圖白塊」真的痛、user 抱怨，可從 archive 恢復重啟。
