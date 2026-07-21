# 帳號刪除 API 規格

**版本**：2026-07-20 · 實作於 `feat/landing-privacy-store-readiness`
**動機**：Google Play 對「可建立帳號的 app」**強制要求**帳號刪除路徑，且要求 **app 內與網頁各一條**。不提供會直接退件。

---

## 端點總覽

| Method | 完整路徑 | 用途 | Auth |
|---|---|---|---|
| `GET` | `/api/account` | 刪除前的影響預覽（確認畫面用） | Session cookie |
| `DELETE` | `/api/account` | 執行刪除 | Session cookie + 二次確認 |

**實作檔**：`functions/api/account/index.ts`
**抹除邏輯**：`functions/api/_erasure.ts`（`eraseUserAccount(db, userId)`）

---

## `GET /api/account` — 刪除影響預覽

確認畫面必須誠實顯示「按下去會發生什麼」。owner 決策為**擁有的行程一併刪除，含共編者的**，
所以受影響的共編人數一定要先讓使用者看到 —— 這個數字前端算不出來。

### Request

```http
GET /api/account
Cookie: <session>
```

### Response `200`

```jsonc
{
  "hasPassword": true,          // 有 local 密碼身分 → 用密碼確認；false → 用確認字串
  "tripsOwned": 3,              // 會被刪除的行程數（該使用者為 owner）
  "collaboratorsAffected": 5    // 受影響的共編者人數（DISTINCT，不含自己）
}
```

### 錯誤

| 情境 | code | HTTP |
|---|---|---|
| 未登入 | `AUTH_REQUIRED` | 401 |

---

## `DELETE /api/account` — 執行刪除

### Request

```http
DELETE /api/account
Cookie: <session>
Content-Type: application/json
Origin: https://trip-planner-dby.pages.dev     ← mutating request 必帶（CSRF）
```

Body **擇一**，依 `GET /api/account` 回的 `hasPassword` 決定：

```jsonc
// hasPassword: true —— 有密碼身分，必須用密碼確認
{ "password": "<使用者的密碼>" }

// hasPassword: false —— 純 OAuth 帳號沒有密碼可打
{ "confirm": "DELETE" }
```

> **為什麼分兩種**：這個 app 是 Google OAuth + 密碼雙軌。純 OAuth 使用者沒有
> `password_hash`，不能要求他打密碼；但這是不可逆操作，不接受只按一顆按鈕，
> 所以改要求顯式確認字串。確認字串刻意用英文大寫 `DELETE`，避免輸入法誤觸。

### Response `200`

```jsonc
{
  "ok": true,
  "tripsDeleted": 3,
  "auditRowsAnonymized": 47,
  "tablesCleared": { "trip_days": 12, "trips": 3, "session_devices": 2 }
}
```

同時回 **`Set-Cookie`** 清除 session（`Max-Age=0`）—— 帳號都沒了，cookie 不該還能用。

### 錯誤

| 情境 | code | HTTP | 備註 |
|---|---|---|---|
| 未登入 | `AUTH_REQUIRED` | 401 | |
| 沒帶確認（密碼或字串） | `ACCOUNT_DELETE_CONFIRM_REQUIRED` | 400 | **不會動到任何資料** |
| 密碼錯 | `ACCOUNT_DELETE_PASSWORD_INVALID` | 401 | **不會動到任何資料**，在呼叫抹除前就返回 |

---

## 刪除範圍（`eraseUserAccount` 實際做什麼）

### 為什麼逐表顯式刪除，不依賴 CASCADE

查 live schema 得出的三個事實：

1. **6 張表帶 `trip_id` 卻無 trips 外鍵** → 刪行程會留孤兒：
   `audit_log` · `error_reports` · `permissions` · `requests` · `trip_requests` · `trip_permissions`
2. **14 張表存了使用者身分卻無 users 外鍵** → 刪使用者完全不連動。
   最嚴重的是 `session_devices`（刪帳號後 session 還在）與
   `audit_log.changed_by`（明文 email，且該表**不在** `auth-cleanup.js` 的保留期清單內 → 永久留存）
3. 不依賴 D1 的 FK 強制設定，順序自己控、可測

### 執行順序

```
1. 查出 owner_user_id = <user> 的所有 trips
2. 逐行程：14 張子表 → 5 張孤兒表 → trip_entries → trips 本身
3. audit_log 匿名化（保留列）：
     changed_by → "deleted-user-<id>"
     changed_by_user_id → NULL
     diff_json / snapshot → NULL
4. 清無 users 外鍵的身分殘留：session_devices · auth_audit_log
5. 以 email 為鍵的殘留：rate_limit_buckets · requests · trip_requests · trip_invitations
6. DELETE FROM users  ← 最後（trips.owner_user_id 是 RESTRICT，不先刪行程會失敗）
```

### ⚠️ 不是 transaction

D1 沒有跨 statement 的互動式交易，中途失敗會留半刪狀態。

順序刻意由**最外圍的衍生資料**往 `users` 本體收，所以中斷時殘留的是**孤兒資料**，
而不是「使用者已刪但個資還在」—— 後者才是合規風險。函式**冪等**，重跑可收斂剩餘部分。

### audit_log 為何是匿名化而非刪除

owner 決策（2026-07-20）：保留行為紀錄供稽核，但洗掉可識別個資。
`migrations/0071:1-11` 原本刻意保留 email 供 forensic，該設計與 right-to-erasure 衝突，本次以匿名化調和。

---

## Web 端實作（已完成）

- 入口：帳號頁 `/account` → 「帳號」分區 → **刪除帳號**（danger row，`trash` icon）
- 確認：`ConfirmModal` + `children` slot 放輸入欄位
  - 顯示 `tripsOwned` 與 `collaboratorsAffected`
  - 確認按鈕在輸入未滿足前 **disabled**
- 成功後 `window.location.href = '/'`（整頁導向，一併清掉記憶體中的 auth context 與快取）

**測試**：
`tests/unit/account-erasure.test.ts`（8）· `tests/api/account-delete.test.ts`（10）· `tests/unit/account-delete-ui.test.tsx`（10）
前兩者用**真 Miniflare D1**，非 mock。

---

## 📱 Flutter app 待實作

Repo：`~/Desktop/Source/GithubRepos/trip-planner.flutter`

### 呼叫慣例（該專案既有規則，不可忽略）

1. **mutating request 必帶 `Origin` header** —— `lib/api/api_client.dart` 的 `kTriplineOrigin`。
   `DELETE /api/account` 是 mutating，漏帶會被 CSRF 檢查擋下。
2. **wire format 是 camelCase** —— 本規格的 `hasPassword` / `tripsOwned` /
   `collaboratorsAffected` / `tripsDeleted` 已符合，直接對應即可。
3. Bearer token 模式下**不送 Cookie/Origin**（見 `api_client.dart:46` 註解）——
   若 app 走 token 模式，確認 CSRF 檢查對 Bearer 請求的行為。

### 建議落點

- `lib/features/account/account_screen.dart` —— 加「刪除帳號」項（既有已有 sessions / settings 分區）
- 新增確認 dialog：需顯示 `tripsOwned` 與 `collaboratorsAffected`，並依 `hasPassword` 切換
  「輸入密碼」或「輸入 DELETE」
- 成功後清除本機 token/cookie 並導回未登入首頁

### Google Play 合規注意

Google 要求**兩條**路徑：app 內 **與** 可公開存取的網頁。
網頁那條目前是 `/account`（需登入）—— 送審時要提供的是**說明如何刪除的公開網址**，
這點會與隱私權政策頁一起處理（見 `docs/design-sessions/2026-07-20-store-readiness-checkpoint.md`）。

---

## 尚未處理

- [ ] Flutter app 端實作（上述）
- [ ] 公開的「如何刪除帳號」說明網頁（Google Play 送審欄位要填）
- [ ] `audit_log` 加入 `scripts/auth-cleanup.js` 的保留期清單（目前無保留期，匿名化後仍永久留存）
