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

- ⚠️ **callback 主機 `mobile-callback.trip-planner-dby.pages.dev` 是 `*.pages.dev` 的子網域，只可能是本專案（`trip-planner-dby`）的 branch alias**；repo 內沒有任何設定會建立它。誰能推送、force-reset 或刪除該 branch，就控制或癱瘓 production 與 UAT 的授權碼落點（批次清 stale branch 也會）；`public/.well-known/*` 只經由該 branch 的 build 到達。上線前要保護該 branch，或改用專屬自訂網域／主站路徑。
- association 檔裡的 iOS Team ID 與 Android 憑證指紋**無法在 repo 內查證**；Android 必須是 Play App Signing 的簽章指紋，不是 upload key。沒有實機證據前不得宣稱正式支援。
- 舊版 `tripline-mobile`（走 loopback redirect）無法再發起新的授權碼登入；refresh token 不受影響。
- 本機 development 的 mobile client 只供 OAuth 授權碼流程；刪帳號 challenge 要求 HTTPS callback，在 loopback 契約下回 500 `SERVER_MISCONFIG`。
- migration 0097 是 additive：**先套 production 與 staging D1，再 merge**。程式比 migration 先上線時是 fail-closed（web 登入不受影響，mobile authorize 回錯誤，不會 500）。rollback 分不出「0097 新增」與「營運端原有」，同 client_id 的列與該 callback URI 一律移除，執行前要先確認。
- 上線證據清單（缺一不可）：真實 Google 往返（見 [ADR-0009](0009-account-deletion-requires-fresh-google-reauth.md)）、callback 主機與 association 檔部署、Flutter 實機的 callback／背景恢復／cold start／取消、受控刪帳號 smoke。
- 相關：[ADR-0002](0002-self-hosted-v2-oauth.md)。
