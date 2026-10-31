# ADR-0011：拆成 web、api、agent 三個專案，認證改 bearer token

- **Status**：Proposed（拆分尚未開始；#1458 先收尾）
- **來源**：2026-10-31 `/grill-with-docs`（「把本機 api server、web、api 拆成三個 GitHub 專案，api 要完整安全性」）

## Context

web 與 api（Pages Functions）現在是同一個 Pages 專案、同一個網域，用同網域的 session cookie 認證；本機 api-server 則在 Mac mini 上，只靠一把固定的共享 secret 與 api 互信，同一把 secret 同時授權觸發、寄信與換出使用者 token。

`functions/` 有 75 處 import `src/`（後端程式碼住在 SPA 的目錄底下），兩邊的契約靠共用 `src/types/api.ts`。拆成三個專案必須同時決定：網域怎麼配、認證怎麼做、程式碼與契約歸誰、怎麼遷。

## Decision

**三個專案**：web（`trip-planner`，維持原 CI/CD）、api（`trip-planner-api`，新 CI/CD）、agent（`trip-planner-agent`，原本機 api-server）。

**兩個網域、認證改 bearer token。** 不買自訂網域；`pages.dev` 在 Public Suffix List 上，兩個專案是 cross-site，`SameSite=Lax` cookie 不會被帶，所以不再用 cookie。web 是 OAuth public client（PKCE）：access token 只放記憶體（15 分鐘），refresh token 落地並 rotation，沿用既有 family revoke。即時推送（SSE）因 `EventSource` 無法帶 header，改用一次性 ticket（30 秒、綁定單一 request）。切換當天所有人強制重新登入一次，不做 cookie 換 token 的橋接。

**api 改成 Cloudflare Worker，用 Hono 重寫 112 個 handler。** 契約由 OpenAPI 產生，web 與 api 各自產生型別。後端程式碼（現在的 `src/server/*` 等）歸 api。

**api 與 agent 之間用 HMAC 簽章**：簽方法、路徑、body 雜湊、時間戳與 nonce，拒絕過期或重複 nonce；`trigger`、`mail`、`mint` 三種用途各一把 key，可輪替。

**遷移：大爆炸切換，沒有 A/B。** 先把現有 API 測試改成走 HTTP 邊界，在舊入口跑到全綠當行為基準，再改寫；新的全綠才准切換。對照組是舊程式碼綁**消毒過**的 staging 資料副本（憑證表不複製、email 換成 `user-N@example.test`、聊天與 log 截斷；驗收是輸出掃不到真實 email 或 token 樣式）。

**舊入口保留，仍綁 prod 資料庫，可自由切換，刪除另案處理。** 存在期間凍結、只收安全修補，api 的 migration 一律只加不刪，api 的 CI 擋 `DROP`、`RENAME` 這類破壞性變更。

**順序：** #1458（帳號刪除加 mobile OAuth）先在現有 repo 收尾並 merge，只做到現有網域可運作；issuer 與 redirect URI 在拆分時才改。

**「完整安全性」的範圍**是四類：供應鏈與 CI/CD、執行期防護、認證與 token、稽核與偵測；細項留給 spec。

## Considered Options

- **維持同網域（web 轉發 `/api/*` 給 api）**：認證模型不用重做，但需要 web 專案保留一層轉發；owner 選擇兩個網域。
- **api 留在 Pages**：檔案式路由、binding 幾乎不用改，風險最低；owner 選擇 Workers。
- **自己寫檔案路由產生器**：handler 本體不動、行為最容易證明不變；owner 選擇 Hono 並改寫。
- **分批遷移（舊的繼續服務）、A/B、影子流量**：可局部回退；owner 選擇大爆炸切換，用改寫前的基準測試當證明。
- **SSE 用 `fetch` 串流、或 token 放 query**：前者不需額外狀態、後者會洩漏進 log；owner 選一次性 ticket。
- **cookie 換 token 橋接**：使用者無感，但是一個專為遷移存在的高風險入口；不採用。
- **api 與 agent 改 pull 模式**：可消除入站攻擊面，但會增加聊天回覆延遲；不採用。

## Consequences

**已知殘留風險（owner 明確接受，不是已解決）：**

- **舊入口是旁路。** 它永久保留、不封閉、仍綁 prod 資料庫，沒有新的認證與 rate limit；在刪除它的另案完成前，新 api 的防護可被繞過。
- **排程與維運腳本仍帶 `CLOUDFLARE_API_TOKEN`。** `daily-check`、`daily-report`、`auth-cleanup` 與兩支 `provision-*-client` 留在 agent，持有能整庫讀寫 D1 的 token，被盜等於資料庫全被拿走。Cloudflare 的 D1 token 只能限定到資料庫，無法限定到表。
- **XSS 仍能偷走落地的 refresh token**，只能靠嚴格 CSP、rotation 與依賴稽核減輕。
- **大爆炸切換沒有局部回退**，只能整體切回舊入口；切換前的證明完全依賴改寫前建立的基準測試。

**不在範圍**：威脅模型文件與外部滲透測試；產出 spec 與票（另打 `/to-spec`、`/to-tickets`）；刪除舊入口（另案）；api 與 agent 的 pull 模式。

**後續約束**：舊入口存在期間 migration 只加不刪；拆分時 mobile 的 issuer 與 redirect URI 要隨 api 新網域更新（Flutter app 尚未上架，現在改成本最低）。
