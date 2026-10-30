# ADR-0009：刪除帳號需要「伺服器驗證的近期 Google 重新驗證」，無法驗證就 fail-closed

- **Status**：Accepted（實作於 PR #1458；**尚未可上線**，見 Consequences 的未驗證項）
- **來源**：2026-10-30 `/implement` #1347，含四輪 pre-landing review

## Context

舊規則：純 OAuth（Google）帳號只要有登入狀態加輸入確認字串 `DELETE` 就能刪帳號。被取得的既有 session 因此足以不可逆地刪除一個人的全部行程（含共編者的）。

Google Play 與 Apple 都要求 **app 內**可發起刪除，所以 mobile 必須走同一套規則；Flutter 端不能把確認字串當成近期身分驗證，也不能由 client 自行宣告「我驗證過了」。

## Decision

**證據由伺服器產生與驗證。** 一般 session、refresh token、`confirm: "DELETE"`、caller 傳入的布林都**不算**重新驗證；`confirm` 單獨存在永遠回 403 `ACCOUNT_DELETE_REAUTH_REQUIRED`。有本機密碼的帳號維持原本的密碼確認，不放寬。

**兩個形態，共用同一條規則：**

- **瀏覽器**：開 `GET /api/oauth/login/google?purpose=account-delete`。Google callback 驗證後發一份 proof，綁定**原 session cookie 的雜湊、使用者**、5 分鐘有效、**一次性**；`DELETE /api/account` 消耗它。
- **mobile（Bearer）**：`POST /api/account/delete-reauth` 建立 challenge，綁定 **uid、grantId、client、環境**；在系統瀏覽器完成 Google 驗證；app 以 `GET` 查到 `verified`；`DELETE /api/account` 帶 `challengeId` 消耗它。Bearer 一律走 mobile 路徑（cookie 與 Bearer 並存時 cookie 優先，結果是 `PERM_DENIED`，不 fallback）。

**challenge 狀態機**：`pending → started → verified → used`；`failed`、`cancelled` 為終結態；過期視為不存在。**每一次轉移都是單句 compare-and-set**（`UPDATE … WHERE status = ? AND uid = ? AND grantId = ? AND expires_at >= now`），所以並行與重放只有一個贏家，不依賴先讀再寫。取消只能從 `pending`／`started`／`verified` 發生；`used` 回 409。

**Google callback 驗證**：同一個 Google `sub`；ID token 的 `auth_time` 不早於這次嘗試、距今不超過 5 分鐘；任何失敗走 `reauthFailure`（mobile → app link `status=failed`，瀏覽器 → `/account?deleteReauth=failed`），且**重新驗證分支一律不建立 session**。

**抹除是單一 D1 batch。** 失敗整批回滾、帳號完整；mobile challenge 由 `used` 還原成 `verified`、瀏覽器 proof 取消 `consumed`，同一份驗證可重試。OAuth token、challenge、proof 與使用者在同一個 batch 內一起刪除。

**fail-closed 是刻意的**：沒有 `auth_time`、沒有連結的 Google identity、provider 不可用，一律**不能刪**，**不退回**「只輸入 DELETE」。

## Considered Options

**只要確認字串（否決）。** 就是這次要修的漏洞。

**用既有 access / refresh token 當近期證據（否決）。** token 可被取得且壽命遠超 5 分鐘，不能證明「現在是本人」。

**challenge 另建資料表（否決）。** 沿用 `oauth_models`（`name` 區分 `AccountDeleteChallenge`／`AccountDeleteProof`）免 migration；一次性消耗靠 compare-and-set 而非唯一鍵，由並行測試證明。

**逐表刪除、失敗可半刪（否決）。** 舊做法會留下刪到一半的帳號。代價：單一大 batch 對極大帳號的 D1 上限尚未驗證。

**要求刪除專用 scope（未採）。** mobile token 只檢查 client／grant／使用者／非 trip-restricted；刪除仍需 verified challenge，單靠 token 刪不了。

## Consequences

- ⚠️ **最大風險：Google 的 OIDC discovery `claims_supported` 不含 `auth_time`**（2026-10-30 實查）。若 Google 不回傳，純 Google 帳號會永遠 fail-closed、**刪不了帳號**（違反商店要求）。上線前必須在 UAT 做真實 Google 往返；若不回，新鮮度證明要另做產品決策（例如 `prompt=select_account` 加 `iat`，強度較弱，需 owner 同意）。
- 已知且刻意不在這次處理：刪帳號後**其他裝置的 session cookie 仍有效**（`session_devices` 是刪除而非標記撤銷，`getSessionUser` 對缺列視為未撤銷）；密碼分支沒有節流；一個 5 分鐘生命週期涵蓋整個 mobile 流程（慢登入可能以 `failed` 收場，需重建）；`started` 在少數路徑可能卡到過期（缺 state、缺環境設定）；`restoreDeleteReauth` 沒有擁有者檢查，極窄的競態。
- 瀏覽器重新驗證的起點是 `GET`（可被預取或第三方頁面觸發），受害者仍須完成真實 Google 驗證，只會造成自己的 challenge 被燒掉。
- 舊版 app 或快取的 SPA 送 `{confirm}` 會得到 403，只顯示通用的「刪除失敗」。
- **契約摘要（Flutter 對接用）**

  | 端點 | 結果 |
  |---|---|
  | `POST /api/account/delete-reauth` | 200 `{ challengeId, authorizeUrl, expiresIn }`；403 `ACCOUNT_DELETE_REAUTH_REQUIRED`（無 Google identity）；500 `SERVER_MISCONFIG`（callback URL 未設或不符環境） |
  | `GET /api/account/delete-reauth?challenge_id=` | 200 `{ status, expiresIn? }`（狀態為 `pending/started/verified/failed/cancelled/used/expired`）；404 陌生或不屬於此 user／grant／client；400 缺參數 |
  | `DELETE /api/account/delete-reauth?challenge_id=` | 200 `{ status: "cancelled" }`（未過期的 `cancelled` 冪等）；409 `used`（即使已過期）或未過期的 `failed`；過期且非 `used` → 403 |
  | `DELETE /api/account` | 200 `{ ok, tripsDeleted, auditRowsAnonymized, tablesCleared }`；403 `ACCOUNT_DELETE_REAUTH_REQUIRED`（無可用證明：缺／陌生 `challengeId`、非 `verified`、過期、user／grant／client 不符、已使用） |
  | `GET /api/account` | `{ hasPassword, reauthProvider, reauthenticated, tripsOwned, collaboratorsAffected }`；`reauthenticated` 只對瀏覽器 cookie 流程有意義 |
  | 任一帳號端點 | 401 `AUTH_REQUIRED`（無有效憑證）；403 `PERM_DENIED`（有效 cookie 與 Bearer 並存、Bearer 非環境的 mobile client、service／restricted token、缺 `grantId`） |

  mobile 流程：用 `authorizeUrl` 在**系統瀏覽器**開（不要自己組 Google URL；每個 challenge 只能開始一次）→ 回到 app link（URL 本身**不是**證明，要再 `GET` 確認 `verified`）→ `DELETE /api/account`。失敗、取消、逾時都要重建 challenge。app 必須保留 pending 狀態跨背景與 cold start，並拒絕沒有對應 pending 嘗試的 callback。
- 相關：[ADR-0002](0002-self-hosted-v2-oauth.md)（自建 OAuth）、[ADR-0010](0010-mobile-oauth-public-client-callback-contract.md)（mobile client 與 callback）。
