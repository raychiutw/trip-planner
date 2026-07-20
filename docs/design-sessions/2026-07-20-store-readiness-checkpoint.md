# Store Readiness 批次 — 進度存檔

**日期**：2026-07-20
**分支**：`feat/landing-privacy-store-readiness`（off `origin/master`）
**另有進行中 PR**：#1092（chrome 材質統一，獨立分支 `feat/hig-regular-glass-chrome`）

---

## 需求清單（原 5 項 + 盤點後追加 1 項）

| # | 需求 | 狀態 |
|---|---|---|
| ① | 帳號頁底部版本資訊 | ✅ **完成** |
| ② | 未登入首頁 | 🎨 mockup 三版已交付，**owner 選 B（SVG 插畫導向）**；React 未實作 |
| ③ | 隱私權聲明頁（中文） | ⛔ 卡 8 項政策決定 + scope 決定 |
| ④ | Google Play 審核用 demo 帳號 | 📋 方向已定，未動工 |
| ⑤ | 桌機手機同版 | 內建於 ②③⑥ |
| ⑥ | **帳號刪除**（盤點後追加） | 🔍 影響面盤完，決策已定，未實作 |

⑥ 不在原始清單，但 **Google Play 對「可建立帳號的 app」強制要求帳號刪除路徑**，不做會直接退件。

---

## 已完成：① 帳號頁版本資訊

- `scripts/app-version.mjs` — **版本 / commit 單一來源**（新檔）
- `vite.config.ts` — 改吃共用模組，`define: versionDefine`
- `vitest.config.js` — **同一份 define**（原本沒有 → 11 個 AccountPage 測試 ReferenceError）
- `src/vite-env.d.ts` — `__APP_VERSION__` / `__APP_COMMIT__` 宣告
- `src/pages/AccountPage.tsx` — `.tp-account-version` 頁尾 + 樣式
- `tests/unit/app-version-footer.test.tsx` — 新增，含「兩份設定都要套 define」的守護
- `tests/unit/sentry-release-config.test.ts` — 斷言跟著搬到共用模組

**踩到的坑**：`vitest.config.js` 是獨立設定，**不吃** `vite.config.ts` 的 `define`。已加測試守住。

驗證：tsc 0 · lint clean · build ok · **436 files / 3794 tests 全綠**

---

## Owner 已定的決策

| 決策點 | 選擇 |
|---|---|
| 首頁視覺方向 | **變體 B — SVG 插畫導向**（延伸 ThemeArt 風格，零圖片檔） |
| Google 審核帳號 | **建專用 demo 帳號**（prod，預載範例行程） |
| 隱私權聲明策略 | **先討論 scope 這件事**（討論已完成，見下） |
| 帳號刪除 → 行程歸屬 | **一併刪除**（含共編者的） |
| 帳號刪除 → audit_log | **匿名化**（保留列、洗掉個資） |

---

## ⑥ 帳號刪除 — 影響面盤點結果

盤點方式：查 **live schema**（本機 D1 已套全部 migration），非 migration 推導。

### 外鍵層（8 條）

| 行為 | 表.欄位 |
|---|---|
| 🔴 `RESTRICT` | `trips.owner_user_id` ← 唯一硬阻擋 |
| `CASCADE` | `auth_identities.user_id` · `poi_favorites.user_id` · `trip_health_reports.user_id` · `trip_permissions.user_id` |
| `SET NULL` | `audit_log.changed_by_user_id` · `client_apps.owner_user_id` · `trip_invitations.accepted_by` · `trip_invitations.invited_by` |

### ⚠️ 14 張表存了使用者身分卻**無 users 外鍵**（刪帳號不連動）

`session_devices`(user_id, ip_hash) · `auth_audit_log`(user_id, ip_hash, user_agent) ·
`audit_log`(changed_by 明文 email) · `trip_invitations`(invited_email 第三方明文) ·
`rate_limit_buckets`(bucket_key = 明文 email/IP 當 PK) · `requests` / `trip_requests`(submitted_by, processed_by) ·
`trip_shares`(created_by) · `permissions`(email) · `trip_emergency_contacts`(email 第三方) ·
`error_reports`(user_agent) · `auth_identities`(provider_user_id) · `pois`(email — 應為店家聯絡信箱，非使用者個資) · `users`(email)

**關鍵**：`audit_log.changed_by_user_id` 被 SET NULL，但同列的 `changed_by` 明文 email、`diff_json`、`snapshot` 原封不動，且 `audit_log` **不在 `scripts/auth-cleanup.js` 的保留期清單內** → 永久留存。

### trips 的子表

- **15 張 CASCADE**：`trip_days` · `trip_entries`(經 days) · `trip_destinations` · `trip_docs` · `trip_emergency_contacts` · `trip_flights` · `trip_health_reports` · `trip_invitations` · `trip_lodgings` · `trip_note_ai_jobs` · `trip_pois` · `trip_pretrip_notes` · `trip_reservations` · `trip_segments` · `trip_shares`
- **⚠️ 6 張有 `trip_id` 但無 trips 外鍵**（刪 trip 留孤兒）：`audit_log` · `error_reports` · `permissions` · `requests` · `trip_requests` · **`trip_permissions`**

### 實作方針（已定）

**erasure routine 不依賴 CASCADE，逐表顯式刪除。**
理由：① 那 6 張孤兒表本來就得手動處理 ② 不論 D1 的 FK 強制設定為何都正確 ③ 順序可控、可測。

### 待做（未動工）

1. `DELETE /api/account` endpoint — 需 re-auth 確認（密碼或近期登入）
2. Erasure routine 依序：
   - 刪 owner 的所有 trips（顯式刪 15 張子表 + 6 張孤兒表的對應列）
   - `audit_log` **匿名化**：`changed_by` → `deleted-user-<id>`，`diff_json` / `snapshot` 洗掉 email 與個資欄位
   - 清 14 張無外鍵表中該使用者的列（`session_devices` / `auth_audit_log` / `rate_limit_buckets` / `requests` / `trip_requests` / `trip_shares` / `trip_invitations.invited_email` where invited_by = user …）
   - 最後 `DELETE FROM users`
3. 前端：帳號頁「刪除帳號」入口 + 確認流程（**須明白告知「N 個共編行程會一併刪除」**）
4. 網頁刪除路徑（Google Play 要求 app 內 + 網頁兩條）

---

## ③ 隱私權聲明 — 為何還不能寫

### scope 討論結論（已完成）

`functions/api/_auth.ts:99-181` 的 `hasPermission` / `requireTripReadAccess` / `hasWritePermission`
**完全不檢查 `auth.scopes`**，只看 `trip_permissions.user_id`。
→ 第三方 app 只要求 `openid` 就能讀寫使用者**全部**行程（含航班編號、訂房編號、緊急聯絡人電話）。

**曝險範圍（已查證）**：
- 任何登入使用者都能註冊 client app（`functions/api/dev/apps.ts` 只要 `requireSessionUser`），但新建為 `pending_review`
- `src/server/oauth-server/validate-authorize-request.ts:79` 擋掉非 `active`
- admin 已於 v2.55.5-v2.55.7 移除 → 要變 `active` 只能手動改 D1

→ **外人現在利用不了。但核准第一個真正的第三方 app 就會踩到。**
→ 不論風險高低，**consent 畫面的文字與實際不符，隱私權聲明照抄即為不實陳述**。

**建議**：scope gate 當獨立 PR（改 auth 層需回歸測試護著），不擋上架。

### 仍需 owner 決定的 8 項

1. **保留期**：`users` / `trips` 及所有子表 / `audit_log` / `poi_favorites` 程式碼中**無任何保留邏輯** → 是政策不是程式碼
2. Cloudflare Web Analytics 是否啟用（Dashboard 端注入，code 查無）
3. `scripts/auth-cleanup.js` 實際排程與可靠性（`.github/workflows/` grep 不到它；註解說 mac mini launchd，但又說挪到 CF Pages cron，自相矛盾）
4. Sentry 資料保留期與存放區域（`ingest.us.sentry.io` → 美國）
5. mac mini mailer 端的 audit log 內容與保留期（該端程式不在本 repo）
6. D1 備份 / Cloudflare 端保留與地理位置
7. 是否有 D1 Logpush → R2（`migrations/0036:29` 提及但 repo 查無設定）
8. `SESSION_IP_HASH_SECRET` 是否已在 prod 設定（未設 → IP hash 為 unsalted SHA-256，`migrations/0037:17-21` 自承 IPv4 可秒級反查）

### 其他已盤出、建議另案處理的隱私問題

- **Sentry 會收到分享 token**：`/s/:token` 在 URL path，`beforeSend` 只過濾雜訊不做 PII scrubbing
- **`rate_limit_buckets` 用明文 IP + 明文 email 當 PK**（與 `auth_audit_log` 刻意 hash IP 的政策自相矛盾）
- **Telegram 告警外送第三方 email**（`functions/api/permissions.ts:141` 把被邀請人 email 送進管理群）
- **郵件實際經 Gmail SMTP**（mac mini + nodemailer，非 Resend；`RESEND_API_KEY` 是死設定）

---

## 環境注意事項

- **`.dev.vars` 被我改過**：補了 `ENVIRONMENT=development` + `ALLOW_DEV_MOCK=1`（SEC-6 需三者齊全）。原檔備份於 `.dev.vars.qa-backup`。
- **`.env.local` 的 `CLOUDFLARE_API_TOKEN` 已失效** → `wrangler d1 execute --remote` 不可用。本次盤點改查本機 D1。
- dev server 可能仍在跑（vite 5173 + wrangler 8788）。
- 本機 D1 路徑：`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/ce45064df1f5788334965bb426801890a9bebe300445c220f24b2bd08d63f974.sqlite`

---

## 產出檔案

```
docs/design-sessions/2026-07-20-landing-page-3-variants.html      ← 首頁三版（owner 選 B）
docs/design-sessions/2026-07-20-chrome-hig-regular-glass.html     ← PR #1092 的規格 SoT
docs/design-sessions/2026-07-20-chrome-material-split.html        ← 已否決，留作紀錄
scripts/app-version.mjs                                           ← ① 版本單一來源
```

---

## 下一步順序（依賴關係）

```
⑥ 帳號刪除實作  ──┐
                  ├──→ ③ 隱私權聲明（要能寫「您可以刪除帳號」且該句為真）
② 首頁 B 版實作 ──┘
④ demo 帳號（獨立，可並行）
⑤ 兩斷點驗證（最後收尾）
```

**⑥ 必須早於 ③** —— 隱私權聲明要描述最終狀態，刪除功能不存在就只能寫「不提供」，上架照樣被退。

---

# 📌 8 項待決事項 — owner 已答覆（2026-07-20）

| # | 問題 | 答覆 | 影響 |
|---|---|---|---|
| A1 | OAuth scope 不生效 | **改 code** | ✅ 已實作 `hasTripScope` 三分法 |
| A2 | Telegram 外送 email | **遮蔽後送出** | ✅ 已實作 `maskEmail`，5 處套用 |
| B3 | Cloudflare Web Analytics | **有開** | 政策需揭露分析用途 |
| B4 | Sentry | **有開** | ⚠️ 保留期與落地區域仍未提供 |
| B5 | `auth-cleanup.js` 排程 | **沒使用** | 🔴 **推翻整個保留期章節**，見下 |
| B6 | D1 備份 | **有** | 政策需揭露備份存在 |
| C7 | 保留期政策 | **保留資料；建帳號需同意個資條款；刪帳號去識別化** | 🔴 衍生新功能，見下 |
| C8 | 聯絡信箱 | **lean.lean@gmail.com** | （owner 初次寫成 `gmaill.com`，已確認為筆誤） |

## 🔴 B5「沒使用」的後果

`scripts/auth-cleanup.js` 沒有在跑 → 政策草稿裡「登入稽核 30 天 / 錯誤回報 90 天 /
API 紀錄 60 天 / 共編邀請 30-90 天 / AI 健檢 30 天」**全部不成立**，那些資料實際無限期留存。

**寫進政策即為不實陳述。** 兩版 mockup 的「留多久」章節都必須改寫成 C7 的立場：

> 我們在你的帳號存續期間保留這些資料。你刪除帳號時，我們會刪除或去識別化。

（另一條路是「把 cleanup 排程真的接起來」，那樣才能寫回保留期天數 —— 但那是獨立工作。）

## 🔴 C7 衍生的新功能：註冊同意個資條款

現況盤查：**完全沒有同意機制**
- `functions/api/oauth/signup.ts:97` 建 user 時無任何同意欄位
- `users` 表無 `consent` / `terms` / `agree` 相關欄位
- 登入頁無勾選框

需要四塊：
1. **Migration**：`users.privacy_consent_at` + `privacy_policy_version`
   （版本要記，否則政策改版後無法得知誰同意的是哪一版）
2. **Signup API**：缺同意 → 拒絕建帳號
3. **Google OAuth 路徑**：`functions/api/oauth/callback/google.ts` 也會建 user，
   **同樣要擋**，否則從 Google 進來就繞過同意
4. **登入頁 UI**：勾選框 + 連 `/privacy`

### ⚠️ 待 owner 決定：既有使用者怎麼辦

既有帳號沒有同意紀錄。
- (a) 下次登入時要求補同意 —— 法律上站得住，但要多做攔截流程
- (b) 既有使用者視同已同意 —— 省事，但被問起時沒有證據

## 其他仍未解的

- **B4 Sentry 的保留期與資料落地區域**（`ingest.us.sentry.io` → 美國）仍需提供，跨境傳輸要揭露
- 兩版 mockup 都需要**深淺色版本**（owner 要求；mockup 已有切換鈕，React 落地時要確保 `body.dark` 生效）
