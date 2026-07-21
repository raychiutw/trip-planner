# Flutter 端上架整備 — 需修改項目

對象：`GithubRepos/trip-planner.flutter`
來源：web 端 `feat/landing-privacy-store-readiness` 分支（2026-07-21）
狀態：以下 API 變更**尚未部署到 prod**，合併後才生效 —— 兩邊可並行改。

---

## TL;DR

| # | 項目 | 不改的後果 | 檔案 |
|---|---|---|---|
| 1 | 建立行程不可再送 `id` | **建立行程一律 400** | `lib/api/trip_repository.dart:116` |
| 2 | 註冊要送 `privacyConsent: true` | **註冊一律 400** | `lib/api/auth_repository.dart:108` |
| 3 | 新增刪除帳號 | Google Play **強制項**，缺了會被退件 | 新增 |
| 4 | 隱私權政策連結 | 勾選框沒有可讀的政策可連 | `lib/features/auth/account_flow_screens.dart:165` |

1 與 2 是**會壞的**，3 與 4 是**缺的**。

---

## 1. 建立行程：移除 `id`（breaking）

### 變更原因
行程 ID 原本由呼叫端決定，導致兩個問題：資源識別碼開放搶佔；規則散在各 client，
web 前端與 `import.ts` 各長出一套慣例（`trip-bp5o` vs `imp-<uuid>`）。
ID 產生已收斂到後端 `src/lib/tripId.ts`。

**不留相容模式** —— 送了 `id` 就 400，不是默默忽略。忽略的話呼叫端會拿自己那個
id 去導頁而 404，變成「建立成功但看不到」的隱性 bug。

### 現況（會壞）
`lib/api/trip_repository.dart:116`
```dart
Future<...> createTrip({
  required String id,          // ← 移除
  required String name,
  ...
}) async {
  final body = await _client.post('/trips', body: {
    'id': id,                  // ← 移除
    'name': name,
    ...
  });
  return (
    tripId: map['tripId'] as String? ?? id,   // ← 移除 fallback
    ...
  );
}
```

### 改成
```dart
Future<...> createTrip({
  required String name,        // id 參數整個拿掉
  ...
}) async {
  final body = await _client.post('/trips', body: {
    'name': name,              // 不再送 id
    ...
  });
  final map = body as Map<String, dynamic>;
  return (
    // 後端一定回 tripId；沒有就是協定被破壞，不該靜默 fallback
    tripId: map['tripId'] as String,
    daysCreated: (map['daysCreated'] as num?)?.toInt() ?? 0,
    destinationsCreated: (map['destinationsCreated'] as num?)?.toInt() ?? 0,
  );
}
```

⚠️ **連帶檢查**：所有 `createTrip(...)` 的呼叫端都在傳 `id`，要一併移除；
若有樂觀更新（`optimistic_patchers.dart` 用 `tempId`），要確認建立成功後
用回傳的 `tripId` 取代暫時 id。

### 順帶一提：`published` 預設值
Flutter 的 `createTrip` 使用 `int published = 0`。
新建行程預設不會出現在 `GET /api/trips` 的**公開清單**（未登入可讀）。
Web 與 Flutter 建立行程時皆須使用 `published = 0`。

---

## 2. 註冊：加上 `privacyConsent`（breaking）

### 變更原因
Google Play 要求建立帳號時取得個資條款同意，且必須**留下證據**。純前端勾選框
擋不住直接打 API，也在 DB 裡留不下「這個人同意過」的紀錄。後端因此新增
`users.privacy_consent_at` + `privacy_policy_version`（migration 0088）。

### 現況（會壞）
`lib/api/auth_repository.dart:108` 的 `signup()` **沒有送 `privacyConsent`**。
勾選框（`signup-privacy-consent-checkbox`）只做前端驗證，值沒有進 request body。

### 改成
```dart
Future<SignupResult> signup({
  required String email,
  required String password,
  required bool privacyConsent,   // ← 新增，由勾選框傳入
  String? displayName,
  String? invitationToken,
}) async {
  final signupResponse = await _client.dio.post<dynamic>(
    '/oauth/signup',
    data: {
      'email': email.trim(),
      'password': password,
      'privacyConsent': privacyConsent,   // ← 新增
      if (displayName != null && displayName.trim().isNotEmpty)
        'displayName': displayName.trim(),
      if (invitationToken != null && invitationToken.trim().isNotEmpty)
        'invitationToken': invitationToken.trim(),
    },
  );
  ...
}
```

不要寫死 `true` —— 那等於偽造同意紀錄。要把畫面上勾選框的真實值傳下來。

---

## 3. 刪除帳號（Google Play 強制，目前完全沒有）

Flutter 端搜不到任何 `deleteAccount` / `DELETE /account`。Google Play 要求
app 內要有可達的帳號刪除路徑，缺了會退件。

**完整 API 規格見 `docs/api/account-deletion.md`**（含 Flutter 章節）。摘要：

| 端點 | 用途 |
|---|---|
| `GET /api/account` | 刪除前預覽：`hasPassword`、`tripsOwned`、`collaboratorsAffected` |
| `DELETE /api/account` | 實際刪除 |

二次確認分兩種：有密碼的帳號要求輸入密碼；純 OAuth 帳號要求輸入 `DELETE`。
`GET` 回傳的 `hasPassword` 就是用來決定顯示哪一種。

---

## 4. 隱私權政策連結

### 完整網址

```
https://trip-planner-dby.pages.dev/privacy
```

（`PRODUCTION_ORIGIN`，定義於 `functions/api/_middleware.ts:160`。Flutter 的
`api_client.dart:77` 用 `'$origin/api'`，政策頁是**同一個 origin 但不含 `/api`**。）

> ⚠️ **這個頁面目前是 404，尚未實作**（web 端 ③，本批次唯一未完成項）。
> Flutter 可以先接上連結，但**上架送審前必須確認它已經上線**，
> 否則審核員點到 404 會直接退件。

用途有二，兩處都要：
1. 註冊畫面同意勾選框旁的「個資條款」連結
2. 帳號/設定頁的「隱私權政策」入口

Google Play Console 的「隱私權政策」欄位也填同一個網址，且**必須未登入可讀**。

---

## Signup API 規格

### `POST /api/oauth/signup`

Base URL：`https://trip-planner-dby.pages.dev/api`

#### Request

```
Content-Type: application/json
Origin: https://trip-planner-dby.pages.dev
```

⚠️ **mutating 請求一律要帶 `Origin`** —— `_middleware.ts` 的 `isAllowedOrigin`
是 CSRF 防線，缺了會被擋。

```jsonc
{
  "email": "user@example.com",       // 必填
  "password": "至少 8 字元",           // 必填，MIN_PASSWORD_LEN = 8，無格式 regex
  "privacyConsent": true,            // 必填，且**只接受布林 true**
  "displayName": "顯示名稱",           // 選填
  "invitationToken": "..."           // 選填，帶了會嘗試自動加入該行程
}
```

`privacyConsent` 的判定是 `!== true` 就拒絕 —— 缺欄位、`false`、字串 `"true"`
全部算沒同意。Dart 端請確定送出的是 JSON boolean 而非字串。

#### Response 201

```jsonc
{
  "ok": true,
  "userId": "uuid",
  "email": "user@example.com",
  "requiresVerification": true,      // email_verified_at 留 NULL
  "joinedTrip": null,                // 帶 invitationToken 且成功時為 tripId
  "invitationError": null
}
```

同時回 `Set-Cookie: tripline_session=...`（**session 由 signup 直接發，不必再打
login**）。Flutter 現有的 `_sessionTokenFrom(headers)` 解析邏輯不用改。

`requiresVerification: true` 但**登入不擋未驗證**（`login.ts` 不檢查
`email_verified_at`），所以未驗證的帳號仍可正常使用，只是該顯示提示。

#### 錯誤碼

| HTTP | code | 意義 | Flutter 該怎麼處理 |
|---|---|---|---|
| 400 | `SIGNUP_CONSENT_REQUIRED` | **未同意個資條款** | 勾選框顯示錯誤（新增） |
| 400 | `SIGNUP_INVALID_EMAIL` | email 格式錯 | email 欄位 inline 錯誤 |
| 400 | `SIGNUP_PASSWORD_TOO_SHORT` | 少於 8 字元 | 密碼欄位 inline 錯誤 |
| 409 | `SIGNUP_EMAIL_TAKEN` | email 已註冊 | 提示改去登入 / 忘記密碼 |
| 429 | `SIGNUP_RATE_LIMITED` | 每 IP 每小時 3 次 | 顯示 `Retry-After` 秒數 |
| 500 | `SYS_INTERNAL` | — | 通用錯誤 |

錯誤 body 形狀：
```jsonc
{ "error": { "code": "SIGNUP_CONSENT_REQUIRED", "message": "..." } }
```

`SIGNUP_CONSENT_REQUIRED` 擋在 **rate limit 之前**，所以反覆送未同意的請求
不會消耗註冊額度。

---

## 建議順序

1. **先做 2（signup 加 `privacyConsent`）** —— 純新增欄位，web 端後端已可接受，
   現在改不會壞任何東西。
2. **再做 1（createTrip 移除 `id`）** —— 這條要等 web 端合併部署後才生效，
   但 Flutter 可以先改好等著；改完在舊 API 上仍能運作（後端目前忽略缺 id 會 400，
   所以**必須與部署同步上線**，這條要對時間）。
3. **3 與 4 可並行**，不依賴後端部署（4 依賴 `/privacy` 上線）。

> ⚠️ 第 1 項是唯一需要對時間的：web 端部署前 Flutter 改了會壞（後端還要求 id），
> 部署後不改也會壞（後端拒絕 id）。建議 web 端合併部署後**立刻**發 Flutter 更新，
> 或先讓後端短暫兩者都接受再收斂 —— 但 owner 已明確要求不留相容模式。

---

# 2026-07-21 追加：UI／API 變更同步

以下是 web 端 v2.57.0–v2.57.5 的變更中**與 Flutter 有關**的部分。前面「TL;DR」那四項仍然有效，這裡是新增的。

## 🔴 5. 行程清單資料來源（會影響顯示）

**不要用 `GET /api/trips` 或 `GET /api/trips?all=1` 取使用者的行程。**

| 端點 | 回什麼 | 能不能當「我的行程」 |
|---|---|---|
| `GET /api/trips` | 只回 `published = 1` 的**公開**行程，未登入可讀 | ❌ 不行 |
| `GET /api/trips?all=1` | `all=1` 需要 `ops:trips:read` service-token scope，一般使用者拿不到 → **靜默降級**成同上 | ❌ 不行 |
| `GET /api/my-trips` | `FROM trip_permissions WHERE user_id = ?`，純看權限 | ✅ 這個 |

web 端有七處犯了這個錯，其中四處是「`/my-trips` 只拿 id 集合、名稱另外跟 `/trips?all=1` 要」的雙抓。2026-07-21 把既有行程改為不公開後，名稱全部消失、畫面只剩 tripId。

`/api/my-trips` 單一支就回齊：
```
tripId, name, title, owner, ownerDisplayName, ownerUserId, role,
countries, updatedAt, totalDays, startDate, endDate, memberCount
```
⚠️ 天數欄位叫 **`totalDays`**，不是 `dayCount`。

**請檢查 Flutter 的 `watchMyTrips()` / 行程清單畫面是否也有這個雙抓模式。**

## 🔴 6. 既有行程已全部改為不公開（2026-07-21）

migration 0089 把 prod 上 10 個 `published = 1` 的行程改成 `0`。

`published` 不只是清單旗標 —— 它同時是 `/api/trips/:id/*` 的**讀取權限閘門**。改動後：

- ✅ 共編者不受影響（走 `trip_permissions`）
- ✅ `/s/:token` 分享連結不受影響
- ⚠️ **匿名讀取那些行程一律 403**

若 Flutter 有任何「不帶 session 讀行程」的路徑，現在會 403。

新建行程的 `published` 預設也已改為 `0`（web 端原本寫死 `1`）。

## 7. 既有帳號的同意紀錄標記為沿用

migration 0090 把 2026-07-21 前建立的帳號回填 `privacy_consent_at`，
`privacy_policy_version` = **`2026-07-20-grandfathered`**（刻意與真實同意的
`2026-07-20` 區隔，稽核時分得出來）。

Flutter 若要判斷「這個人是否實際同意過」：
```
privacy_policy_version NOT LIKE '%-grandfathered'
```

## 8. UI 形制變更（若要與 web 對齊）

以下是 web 端的視覺／互動決策，Flutter 不一定要跟，但列出來讓兩邊不至於各走各的：

| 項目 | 變更 |
|---|---|
| 行程切換 | 移除分離的 `⇄` 圖示按鈕；**標題本身可點、後面接 chevron**（iOS「標題帶 ⌄ = 可切換」慣例）。只有一個行程時渲染純文字，不給可點的假象 |
| 底部 tab 材質 | **低 tint（0.42）+ blur(28px) + saturate(190%)**。這裡來回三次：92% 奶油「像實心白條」→ 全透明「沒有玻璃效果」→ 80% 白「還是白底」。關鍵是 **tint 一高，backdrop blur 就沒有表現空間**，材質退化成實心色板 |
| header / day tab | 與底部 tab **統一同一套材質**。先前三者各用各的（92% 奶油 / 14px blur / 28px blur），同畫面三種玻璃 |
| 底部 tab 數量 | 4 → **5**（新增「帳號」）。手機右上角的帳號圓圈移除後，帳號一度沒有入口 |
| 捲動行為 | 底部 tab **常駐**，下捲不再隱藏 |
| 登入頁 | 左上角加 Tripline 連回首頁（`/login` 先前沒有任何回首頁出口） |

## 9. 隱私權政策的深連錨點

Google Play Console「帳號刪除網址」欄位填：
```
https://trip-planner-dby.pages.dev/privacy#delete-account
```
