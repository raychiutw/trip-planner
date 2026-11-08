# ADR-0010：Mobile OAuth 是 public client，callback 與 client 依環境精確綁定

- **Status**：Accepted（實作於 PR #1458；**尚未可上線**，見 Consequences）
- **來源**：2026-10-30 `/implement` #1349，含四輪 pre-landing review

## Context

repository 的 mobile client seed 只有 `http://127.0.0.1:8765` loopback。它不能證明 iOS／Android 有「正式可用、已註冊、與 Flutter 設定一致」的 callback，Flutter 也缺一份可核驗的正式契約。已知 source app id 是 `com.raychiu.tripline`（Android applicationId 與 iOS bundle id 相同），但這**不代表** callback URI 或線上 registry。

## Decision

**public client，不帶 client secret**（App 內任何 secret 都可被擷取）。授權碼流程要求 `response_type=code`、**精確**註冊的 `redirect_uri`、client 端檢查的 `state`、PKCE `S256`；token exchange 使用與授權時相同的 client 與 redirect。

**每個環境一組精確的 client 與 redirect，不開 wildcard、不跨環境：**

| 環境 | client_id | redirect |
|---|---|---|
| production | `tripline-mobile` | `https://mobile-callback.trip-planner-dby.pages.dev/oauth/callback` |
| UAT | `tripline-mobile-uat` | `https://mobile-callback.trip-planner-dby.pages.dev/uat/oauth/callback` |
| development | `tripline-mobile-dev` | `http://127.0.0.1:8765` |

由 runtime 的環境政策（`ENVIRONMENT` 加請求 origin）選出唯一合法的 client 與 redirect；`authorize`、`consent`、`token` 三處都用**精確相等**比對，跨環境的 client 或 redirect 在任何 redirect 之前就被拒絕。`authorization_code` 授權要求 redirect；`refresh_token` 只驗 client。

**registry 以 additive migration 登記，不覆蓋營運端資料**（migration 0097：對既有 `tripline-mobile` 只追加缺少的 HTTPS URI，另插入 UAT／dev client，皆 `ON CONFLICT DO NOTHING`）。runtime 政策才是真正的閘門，所以 production DB 裡的 dev client 與歷史 loopback URI 是惰性的。

**用 HTTPS app link（Universal Link／Android App Link），不用 custom scheme。** 關聯檔放在 `public/.well-known/`（`apple-app-site-association`、`assetlinks.json`），`_headers` 強制 `Content-Type: application/json`（extensionless 檔案不加會被 iOS 拒絕）。**callback 主機刻意與 issuer 主機不同**：同網域內的導覽在 Safari 不會觸發 Universal Link。

## Considered Options

**wildcard／萬用 redirect allowlist（否決）。** 等於 open redirect 的授權碼外洩面。

**custom scheme（否決）。** 任何 app 都能註冊同一個 scheme 並攔截授權碼；PKCE 能緩解但不能消除，且無法由 OS 驗證所有權。

**沿用 loopback 當正式 callback（否決）。** loopback 只存在於桌面開發，不能證明 mobile 能回到 app。

**用 migration 直接覆寫 redirect 清單（否決）。** 會蓋掉營運端自行登記的值；改成「缺才追加」。

## Consequences

- ⚠️ **callback 主機 `mobile-callback.trip-planner-dby.pages.dev` 是 `*.pages.dev` 的子網域，只可能是本專案（`trip-planner-dby`）的 branch alias**；repo 內沒有任何設定會建立它。誰能推送、force-reset 或刪除該 branch，就控制或癱瘓 production 與 UAT 的授權碼落點（批次清 stale branch 也會）；`public/.well-known/*` 只經由該 branch 的 build 到達。該 branch 已於 2026-10-31 設為禁止刪除與 force-push（對 admin 也生效）；它是舊 UAT branch、不隨 master 更新。改用主站路徑留到 web／api 拆分時一起做（見 issue #1462），因為拆分前 issuer 與 callback 會同網域，iOS Universal Link 行為沒有實機證據。
- association 檔裡的 iOS Team ID 與 Android 憑證指紋**無法在 repo 內查證**；Android 必須是 Play App Signing 的簽章指紋，不是 upload key。沒有實機證據前不得宣稱正式支援。
- 舊版 `tripline-mobile`（走 loopback redirect）無法再發起新的授權碼登入；refresh token 不受影響。
- 本機 development 的 mobile client 只供 OAuth 授權碼流程；刪帳號 challenge 要求 HTTPS callback，在 loopback 契約下回 500 `SERVER_MISCONFIG`。
- migration 0097 是 additive：**先套 production 與 staging D1，再 merge**。程式比 migration 先上線時是 fail-closed（web 登入不受影響，mobile authorize 回錯誤，不會 500）。rollback 分不出「0097 新增」與「營運端原有」，同 client_id 的列與該 callback URI 一律移除，執行前要先確認。
- 上線證據清單（缺一不可）：真實 Google 往返（見 [ADR-0009](0009-account-deletion-requires-fresh-google-reauth.md)）、callback 主機與 association 檔部署、Flutter 實機的 callback／背景恢復／cold start／取消、受控刪帳號 smoke。
- 相關：[ADR-0002](0002-self-hosted-v2-oauth.md)。

## 更新（2026-11-08，#1482）：callback 搬到 web 主站，過渡期新舊並存

只記事實；**以下尚未經 iOS／Android 實機驗證**（Universal Link／App Link 的擁有權、cold start、背景恢復、取消都沒驗過）。

- **新增主站路徑**（owner 決議：callback 放 web 主站 `https://trip-planner-dby.pages.dev`，與 issuer〔新 api 的 workers.dev 主機〕刻意不同主機；路徑避開 SPA 既有的 `/auth/callback`、`/oauth/authorize`）：

  | 環境 | 新 redirect |
  |---|---|
  | production | `https://trip-planner-dby.pages.dev/mobile/oauth/callback` |
  | UAT | `https://trip-planner-dby.pages.dev/mobile/uat/oauth/callback` |

- **過渡期新舊並存**：已發佈的 App 仍用上表的舊 callback，所以 api 每個環境同時接受「舊＋新」兩個精確 redirect（api repo 的 `mobileOAuthContract` 回傳允許集合，`authorize`／`consent`／`token` 改為「在該環境集合內」的精確比對；不開 wildcard、不跨環境、dev 不變）。client 註冊以 additive migration 只追加新值。**舊 callback 與舊主機的移除是另案**，不在此決定。
- **關聯檔**：本 repo `public/.well-known/apple-app-site-association` 的 `applinks` paths 改為 `/mobile/oauth/callback`、`/mobile/uat/oauth/callback`、`/s/*`；`assetlinks.json` 內容不變（Android 的 SHA-256 指紋本來就以主機為單位）。舊主機（`mobile-callback` 分支別名）上的檔案由該分支承載，本次不動。`_headers` 對兩個關聯檔強制 `Content-Type: application/json`（既有）。
- **落地頁**：新路徑沒有專屬頁面，行為與舊別名等價——舊別名服務的是整份 SPA build（沒有專屬 callback 頁，也沒有「App 未安裝」備援），新路徑落到 Pages 的 SPA fallback，再由 SPA 的 `path="*"` 導向 `/trips`。App 已安裝時由 OS 攔截 https callback，不會載入頁面。`tests/unit/mobile-callback-main-site.test.ts` 守住「兩個路徑不被 Functions 路由、`_redirects`／`404.html` 或任何 SPA `<Route>` 吃掉」。
- **grep 守門**：同一個測試禁止原始碼新增對舊 `mobile-callback` 主機的引用；既有引用列為待清理清單（`functions/api/_mobileOAuth.ts`、`wrangler.toml`、`tests/unit/oauth-authorize-page.test.tsx`）。
- **仍待做**：Flutter 的 entitlements／intent-filter／`--dart-define`、實機驗證、web 先部署並確認 AASA 可達、api migration 套用與部署。
