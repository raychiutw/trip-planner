# Web HIG 取證：mock 場景、截圖與觸控目標量測（trip-planner#1563，屬 flutter#531）

## 機制

`tests/e2e/hig-scenes.spec.js` 用既有 `api-mocks.js`（外加場景需要的端點 mock）把頁面開出來，**不碰 prod、不需真實登入**：

- 27 個頁面 × 手機寬（390×844）與桌機寬（1280×800）× 淺色與深色 = 108 張截圖，存在 `docs/qa/2026-11-04-hig-web-screenshots/`（桌機寬縮到 800px 寬以控制體積）。
- 渲染證明：有 `data-testid` 的頁面必須看得到它；所有頁面都要有內容、沒有未捕捉的頁面錯誤，且場景用的 API 不能回 4xx／5xx（否則畫面其實是錯誤態）。
- 量測：手機寬淺色下，可見可點擊元素最短邊 ≥ 44px（檢查表 A1）。違規登錄在 `tests/e2e/hig-known-violations.js`，是棘輪（新增會紅，修好沒移除也會紅）。
- 只在 `chromium` 專案跑；webkit／mobile 專案的字型度量不同，不納入。
- 重跑：`HIG_SHOT_DIR=<dir> npx playwright test tests/e2e/hig-scenes.spec.js --project=chromium`；`HIG_COLLECT=1` 只印違規不斷言。

## 開發中抓到的「看起來有畫面其實是錯誤態」

第一輪收集時，`trip-health` 顯示「最新狀態未知；目前無法確認是否已有健檢」（健檢端點沒 mock），頁面測試與「有內容」檢查都通過。因此加了「API 4xx／5xx 即失敗」的斷言，並補上 `health-check`、`notes`、`notes/ai-state`、`segments`、`requests`、`dev/apps` 的場景 mock。`ai-data-consent`、`ai-authorization`、`public-config` 讀不到是功能關閉的設計（程式碼定義為「不強制」），列為可忽略。

## 量測結果（15 個場景有違規）

| 場景 | 違規 |
|---|---|
| login | 忘記密碼？ 64×19 |
| signup | 隱私同意勾選框 20×20、隱私條款連結 149×24 |
| trips-list | 開啟搜尋 24×24 |
| explore | 搜尋鈕 62×38、搜尋欄 228×28 |
| chat | 4 個建議 chip 高 40、送出鈕 40×40 |
| map／trip-map | DAY 分頁 68×34、總覽 54×34 |
| account | 編輯名稱 32×32 |
| developer-apps-new | 名稱欄 292×42、6 個勾選／單選框 13×13 |
| trip-detail | DAY 分頁 68×34、交通方式 319×32、展開景點 7×17、更多動作 32×32、編輯起訖時間 79×24 |
| trip-notes | 刪除航班 32×32、拖移航班 24×24 |
| trip-print | 分享連結／列印／關閉 高 40 |
| trip-collab | 共編成員分頁 高 32～33 |
| trip-edit | 上線／草稿 高 38、加入目的地 高 40、移除 Day 36×36 |
| trip-add-stop | 全部地區 92×27 |

0 違規的場景：landing、forgot-password、privacy、trips-new、favorites、account-appearance／notifications／sessions／connected-apps、developer-apps、trip-health、trip-add-entry。

說明：
- 13×13 的勾選框可能被外層 label 擴大點擊區；量測只看元素本身，所以這幾筆需要人判斷，不能直接當違規。
- 「展開景點 7×17」等細小元素是否另有較大的點擊區（父層）沒有逐一確認。
- 行內文字連結（段落中）不量。

## 我實際看過的截圖（其餘沒有逐張檢視）

`mobile/light/trip-detail`、`mobile/light/trip-health`、`mobile/light/chat`、`mobile/light/developer-apps-new`、`mobile/dark/trips-list`：渲染的是預期頁面，深色模式有實際反色。其餘約 100 張只靠上面的機器檢查，沒有人或我逐張對照 HIG 判讀。

## 沒做的

- 只有觸控目標有自動量測；字級、對比、標籤、文字縮放（Dynamic Type 對應的瀏覽器縮放）未量。
- 未覆蓋：登入／重設密碼的各狀態頁、`/s/:token`、`/invite`、`/oauth/*`、`/trip/:id/stop/*` 與 copy／move／change-poi／edit、`/favorites/:id/add-to-trip`、彈出層（對話框、sheet、picker）、空資料與錯誤與限流狀態。
- 只跑 chromium，沒有 Safari（webkit）。
