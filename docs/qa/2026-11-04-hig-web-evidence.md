# Web HIG 取證：mock 場景、截圖與觸控目標量測（trip-planner#1563、#1565～#1568，屬 flutter#531）

## 機制

`tests/e2e/hig-scenes.spec.js` 用既有 `api-mocks.js`（外加場景需要的端點 mock）把頁面開出來，**不碰 prod、不需真實登入**：

- 50 個場景（36 個頁面與狀態、14 個彈出層）× 手機寬（390×844）與桌機寬（1280×800）× 淺色與深色 = 198 張截圖（`popup-trip-sheet` 是桌機寬才有的表面，只有 2 張，其餘 4 張），存在 `docs/qa/2026-11-04-hig-web-screenshots/`（桌機寬縮到 800px 寬以控制體積）。彈出層 14 個場景的圖在 Linux 容器（Playwright v1.64.1 noble）截；前 36 個場景的圖不是本輪重截的，截圖環境未重新確認，字型可能不同。
- 渲染證明：有 `data-testid` 的頁面必須看得到它；所有頁面都要有內容、沒有未捕捉的頁面錯誤，且場景用的 API 不能回 4xx／5xx（否則畫面其實是錯誤態）。
- 彈出層場景另有 `scope`：彈出層根元素必須可見，`proof`／`proofText` 只在它裡面找（背景頁有同樣的字不算），觸控目標也只量它裡面且至少量到一個元素（橫幅與 Toast 例外）；高於一屏的對話框不剔除視窗外的元素。各場景的打開方式與 mock 見 `tests/e2e/hig-scene-fixtures.js`。
- 量測：手機寬淺色下，可見可點擊元素最短邊 ≥ 44px（檢查表 A1）。違規登錄在 `tests/e2e/hig-known-violations.js`，是棘輪（新增會紅，修好沒移除也會紅）。
- 只在 `chromium` 專案跑；webkit／mobile 專案的字型度量不同，不納入。
- 重跑：`HIG_SHOT_DIR=<dir> npx playwright test tests/e2e/hig-scenes.spec.js --project=chromium`；`HIG_COLLECT=1` 只印違規不斷言。

## 開發中抓到的「看起來有畫面其實是錯誤態」

第一輪收集時，`trip-health` 顯示「最新狀態未知；目前無法確認是否已有健檢」（健檢端點沒 mock），頁面測試與「有內容」檢查都通過。因此加了「API 4xx／5xx 即失敗」的斷言，並補上 `health-check`、`notes`、`notes/ai-state`、`segments`、`requests`、`dev/apps` 的場景 mock。`ai-data-consent`、`ai-authorization`、`public-config` 讀不到是功能關閉的設計（程式碼定義為「不強制」），列為可忽略。

## 量測結果（15 個頁面場景加 3 個彈出層場景有違規）

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

彈出層（只量彈出層本身，Linux 容器）：

| 場景 | 違規 |
|---|---|
| popup-share-link-modal | 18 項：✕ 27×27、區塊 pill 與期限分段高 34、匿名勾選 17×17、連結名稱輸入高 34、建立分享連結高 42、編輯／重新產生／關閉／刪除高 34 |
| popup-account-sheet | 編輯名稱 32×32 |
| popup-trip-sheet（桌機寬量測） | 聊天建議 chip 高 39（4 個）、送出 40×40 |

0 違規的彈出層：`popup-ai-consent-sheet`、`popup-ai-data-consent-sheet`、`popup-confirm-modal`、`popup-conflict-modal`、`popup-input-modal`、`popup-note-ai-exclusions-dialog`、`popup-travel-pill-dialog`；橫幅與 Toast（`popup-error-banner`、`popup-server-status-banner`、`popup-toast-*`）沒有可點擊元素。

0 違規的場景：landing、forgot-password、privacy、trips-new、favorites、account-appearance／notifications／sessions／connected-apps、developer-apps、trip-health、trip-add-entry。

說明：
- 13×13 的勾選框可能被外層 label 擴大點擊區；量測只看元素本身，所以這幾筆需要人判斷，不能直接當違規。
- 「展開景點 7×17」等細小元素是否另有較大的點擊區（父層）沒有逐一確認。
- 行內文字連結（段落中）不量。

## 彈出層取證的缺口與限制

- **造不出場景的 3 個元件**：`TripPickerPopover`（沒有掛載點）、`CollabSheet`、`InfoSheet`（唯一入口 `openSheet('collab')` 沒有呼叫端）。都是使用者走不到的元件，不造假場景；原因與證據見 `2026-11-04-hig-page-inventory.md` 與 review。
- 每個彈出層只取證一種狀態（例如 AI 資料同意只有 consent 模式、Toast 只有 error 與 offline）；其他狀態列在 review 的「沒做的事」。
- 場景用 mock 觸發，不是真實伺服器時序：離線用 `window` 的 `offline` 事件驅動（不真的斷網）、衝突用 409 回應、AI 授權與資料同意用 stub。
- 彈出層截圖在每次操作後等 600ms 讓進場動畫跑完；沒等時拍到半透明過場畫面，ConfirmModal／ConflictModal 的按鈕也會因縮放動畫量出 43px 的假違規。
- 這一輪的棘輪、截圖、axe 都以 Linux 容器為準；macOS 字型不同，本機跑會和 CI 對不上。

## 我實際看過的截圖（其餘沒有逐張檢視）

`mobile/light/trip-detail`、`mobile/light/trip-health`、`mobile/light/chat`、`mobile/light/developer-apps-new`、`mobile/dark/trips-list`：渲染的是預期頁面，深色模式有實際反色。其餘約 100 張只靠上面的機器檢查，沒有人或我逐張對照 HIG 判讀（後續輪次的檢視範圍見 review 的「範圍與沒看到的」）。

## 沒做的

- 只有觸控目標有自動量測；字級、對比、標籤、文字縮放（Dynamic Type 對應的瀏覽器縮放）未量。
- 未覆蓋：`/s/:token`、`/oauth/*`、`/add-to-trip`、`/trip/:id/stop/*` 的地圖與 copy／move／change-poi／edit、`add-custom-stop`、`/favorites/:id/add-to-trip` 本身（只當彈出層背景）；彈出層缺 3 個（見上）。登入／重設密碼各狀態、`/invite`、空資料與錯誤與限流狀態，以及 14 個彈出層已由第三、第四輪補上。
- 只跑 chromium，沒有 Safari（webkit）。

## 第五輪（#1567）補充

新增 6 個場景（`trip-share`、`trip-stop-copy`、`trip-stop-move`、`trip-stop-change-poi`、`trip-stop-edit`、`trip-add-custom-stop`）。觸控目標違規（Linux 量測）：`trip-share` 3 筆（高 38）、`trip-stop-change-poi` 1 筆、`trip-stop-edit` 2 筆、`trip-add-custom-stop` 2 筆，copy／move 為 0。`stop/:entryId/map` 因 Google Maps 被擋造不出真實畫面，列缺口（見 inventory）。`/s/:token` 的 mock 是 `GET /api/share/:token` 回 `{ meta, days, notes }`，資料取自既有行程 mock。
