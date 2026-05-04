# PR #474 poi-favorites-rename — Pre-merge Runbook

**Date**：2026-05-05
**Branch**：`feat/poi-favorites-rename`（10 commits ahead of master）
**Migration**：0050（CREATE poi_favorites + companion_request_actions + INSERT SELECT data + ALTER audit_log）
**Cutover type**：hard（無 alias）

---

## 步驟 1 — admin: 加 companion scope + 設 Pages secret ✅ 已完成（2026-05-05）

**為何**：companion path 三條件 gate 比對 `env.TP_REQUEST_CLIENT_ID`（middleware 讀）+
service token 帶 `companion` scope（DB 直接驗）。要讓 prod 接 companion path：
1. `client_apps.allowed_scopes` 必須含 `companion`
2. Pages secret 必須有 `TP_REQUEST_CLIENT_ID`

**結果**：
- ✅ UPDATE client_apps.allowed_scopes 加 `companion`（**不換 secret**）
- ✅ 重 mint access_token 拿到含 4 個 scope 的 token
- ✅ 設 Pages secret `TP_REQUEST_CLIENT_ID = "tripline-internal-cli"`（companion gate critical）
- ✅ 設 Pages secret `TRIPLINE_API_TOKEN`（**注意**：此 secret 實際不被 functions
  code 讀取 — `grep TRIPLINE_API_TOKEN functions/` 0 matches。設它是為了 future
  prod-side debug 工具或預留 hook；對 PR ship 路徑無影響。1 hr expiry 後會 stale）

**未做**：
- ❌ provision-admin-cli-client.js re-secret 跑（user：「不要換 key」）— client_secret 維持不變

**先決條件**（已 verify）：
- ✅ `.env.local` 有 `CLOUDFLARE_API_TOKEN` / `CF_ACCOUNT_ID` / `D1_DATABASE_ID`
- ✅ wrangler authed（Account `Lean.lean@gmail.com's Account`）

### Step 1.1 — provision client_apps row + 拿 client_secret

```bash
cd /Users/ray/Projects/trip-planner
node scripts/provision-admin-cli-client.js
```

**預期 output**：
```
Generated client_secret: tp_xxx_yyyyyyyyyyyy
   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   ↑ 一次性顯示，DB 只存 hash。立即 copy 到下一步。
```

> ⚠️ 若 client 已存在會 prompt 是否 re-secret — 選 yes（會 DELETE + INSERT，現有 cron token 會立即失效，要在後續步驟同步更新）

### Step 1.2 — 用 client_secret mint access_token

```bash
# 把上一步印出的 secret 貼進來（不要 export 進 shell history）
read -rs CLIENT_SECRET
# (paste secret + Enter — 不會在 terminal 顯示)

# 用 mktemp + umask 077 確保 token 檔只有 owner 可讀（不被 root 之外的 user 讀取）
TOKEN_FILE=$(mktemp -t tp-token.XXXXXX)
chmod 600 "$TOKEN_FILE"

curl -s -X POST https://trip-planner-dby.pages.dev/api/oauth/token \
  -d "grant_type=client_credentials" \
  -d "client_id=tripline-internal-cli" \
  -d "client_secret=$CLIENT_SECRET" \
  > "$TOKEN_FILE"

# 立即 unset secret + scrub clipboard（避免 paste 殘留）
unset CLIENT_SECRET
pbcopy </dev/null 2>/dev/null || true   # macOS 清剪貼簿（如使用 paste-from-pwm）

# 驗證 response（值仍只在 $TOKEN_FILE 內）
jq -r '.scope' "$TOKEN_FILE"
```

**預期 response**：
```json
{
  "access_token": "eyJhbGciOi...（很長）",
  "scope": "admin trips:read trips:write companion",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

> ⚠️ 確認 `scope` 含 `companion`。沒有 → provision-admin-cli-client.js:154 沒加上 → 重跑或手動 fix。

### Step 1.3 — 設 Pages secret

```bash
# 1. TRIPLINE_API_TOKEN（access_token）— 從 Step 1.2 的 $TOKEN_FILE 讀
jq -r '.access_token' "$TOKEN_FILE" | npx wrangler pages secret put TRIPLINE_API_TOKEN --project-name trip-planner

# 2. TP_REQUEST_CLIENT_ID（middleware companion gate 比對用）
echo "tripline-internal-cli" | npx wrangler pages secret put TP_REQUEST_CLIENT_ID --project-name trip-planner

# 3. verify
npx wrangler pages secret list --project-name trip-planner | grep -E "TRIPLINE_API_TOKEN|TP_REQUEST_CLIENT_ID"
# 預期：兩個都看到（值不會印出，只列名稱）
```

### Step 1.4 — 清理（重要）

```bash
# token 已寫進 Pages，本地檔可刪（shred 多次覆寫避免 file recovery）
shred -u "$TOKEN_FILE" 2>/dev/null || rm -f "$TOKEN_FILE"
unset TOKEN_FILE
# CLIENT_SECRET 已在 Step 1.2 unset；此處 fallback 確認
unset CLIENT_SECRET 2>/dev/null
```

---

## 步驟 2 — SRE: mac mini cron sync

**為何**：mac mini cron tp-request-scheduler 仍打舊 `/api/saved-pois*` path + 用舊 cf-access auth header。code 部署後 4 條 path 全 404，必須同步切換。

**SSH 到 mac mini**：
```bash
ssh ray@<mac-mini-host>   # 或 tailscale name
cd ~/tripline-cron        # 或 cron 安裝目錄
```

### Step 2.1 — 修改 scheduler script

```bash
# 找 base URL + auth header
grep -nE "saved-pois|CF-Access-Client" scripts/tp-request-scheduler.sh
```

修改：
```diff
- BASE_URL="https://trip-planner-dby.pages.dev/api/saved-pois"
+ BASE_URL="https://trip-planner-dby.pages.dev/api/poi-favorites"

- curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
-      -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
+ curl -H "Authorization: Bearer $TRIPLINE_API_TOKEN" \
+      -H "X-Request-Scope: companion" \
```

### Step 2.2 — 更新 cron env：用 client_secret 每次 run 前重 mint token

**重要**：access_token expires_in 只有 **3600 秒（1 hr）**，不能寫死進 .env。
正確 pattern：**cron run 前用 client_secret mint 一次新 token，run 完丟棄**。

```bash
# 找當前 .env path
launchctl list | grep tripline
# 或直接編輯 ~/.tripline-cron/.env
nano ~/.tripline-cron/.env

# 改成：
# 移除舊：CF_ACCESS_CLIENT_ID=... / CF_ACCESS_CLIENT_SECRET=...
# 加新：
#   TRIPLINE_API_CLIENT_ID=tripline-internal-cli
#   TRIPLINE_API_CLIENT_SECRET=<從 lean.lean@gmail.com 的 .env.local TRIPLINE_API_CLIENT_SECRET 複製>
#   # 不再放 TRIPLINE_API_TOKEN — 改 cron run 前動態 mint
```

修改 `scripts/tp-request-scheduler.sh` 在主邏輯前加 mint step：

```bash
#!/bin/bash
set -euo pipefail
source ~/.tripline-cron/.env

# 動態 mint access_token（每次 cron run 前一次）
TRIPLINE_API_TOKEN=$(curl -sf -X POST https://trip-planner-dby.pages.dev/api/oauth/token \
  -d "grant_type=client_credentials" \
  -d "client_id=$TRIPLINE_API_CLIENT_ID" \
  -d "client_secret=$TRIPLINE_API_CLIENT_SECRET" \
  | jq -r '.access_token')
export TRIPLINE_API_TOKEN

# (... 後續主邏輯，curl 用 -H "Authorization: Bearer $TRIPLINE_API_TOKEN" ...)
```

> ⚠️ 1 hr expiry 對 cron 跑短任務（< 60 min）夠用；長任務需在中途重 mint。
> 若要避免每次 mint，將來可加 token cache + expiry check（暫不在 PR scope）。

### Step 2.3 — dry-run smoke test

```bash
# trigger 一筆 test trip_requests row
wrangler d1 execute trip-planner-db --remote --command "
INSERT INTO trip_requests (trip_id, message, submitted_by, status, created_at)
VALUES ('test-trip-id', '我想把美麗海水族館加入收藏', 'lean.lean@gmail.com', 'open', datetime('now'))
"

# 在 mac mini 跑 cron 一次（手動）
~/.tripline-cron/run-once.sh

# 觀察 log
tail -f ~/.tripline-cron/logs/scheduler.log
# 預期：tp-request 處理「加入收藏」flow → POST /api/poi-favorites → 201 + audit_log 多 1 row
```

### Step 2.4 — 紀錄到 PR description

把以下證據貼進 PR #474 description：
- mac mini commit hash 或 config diff（before / after `tp-request-scheduler.sh`）
- dry-run output（成功 201 + audit_log row id）
- 確認 cron schedule 不變

---

## 步驟 3 — invoke review skills（合 PR 前 gate）

| skill | 何時跑 | 由誰 |
|-------|--------|------|
| `/tp-code-verify` | 已覆蓋（tsc + test + build + verify-sw 全綠）| ✅ done |
| `/review` | 馬上跑 | Claude（並行）|
| `/cso --diff` | 馬上跑 | Claude（並行）|
| `/qa` | post-deploy（需 prod URL）| 推遲到 §22 smoke |

完整步驟見下面 conversation 接續。

---

## 步驟 4 — `/ship` → `/land-and-deploy` → `/canary`

完成 步驟 1-3 後：

```
/ship                  # 開 PR 或更新（v2.22.0 已 bump，CHANGELOG 已更新）
/land-and-deploy       # merge + 等 CI + 觀察部署
/canary                # post-deploy console error / perf 監控
```

### Deploy 順序（critical）：

1. PR merge → CF Pages 自動 deploy 觸發
2. CF migrations workflow 跑 `wrangler d1 migrations apply --remote` → migration 0050 上 prod
3. 部署後 dual-table 期：`saved_pois` 與 `poi_favorites` 共存（migration 0050 INSERT SELECT 複製資料）
4. Step 1 + 2 設好的 token / cron 接住 companion path

### Rollback playbook（if 5xx >1% within 5 min）：

```bash
# 1. revert code
git revert <merge-commit>
git push

# 2. 不 revert migration 0050 — saved_pois 表仍存在（migration 不 DROP，只 ADD），
#    git revert 後會把 functions/api/saved-pois{.ts,/[id].ts,/[id]/add-to-trip.ts}
#    handler 帶回 → 舊 path 重新 work。code 自身沒有 dual-read fallback；恢復靠
#    revert PR 帶回舊 handler，不靠任何 runtime fallback 邏輯。

# 3. SW unregister 強 client refresh
deploy SW unregister dummy: self.registration.unregister() + clients.reload()

# 4. SSH mac mini 還原 cron
ssh mac-mini → revert tp-request-scheduler.sh + .env

# 5. 公告 user：「收藏短暫異常已還原；可繼續使用」
```

---

## 步驟 5 — Post-deploy smoke（5 min 內）

§22 task list 有 11 個 smoke check：
- D1 schema verify (PRAGMA poi_favorites)
- API user-bound：login + /favorites 載入 + 加 1 個 + 重整 + 重複 409 + 刪除 204
- API companion smoke：service token 寫 1 筆 → 201 + audit_log + companion_request_actions
- 越權測試：completed status / submitter 不存在 / self-reported scope → 401 + 對應 reason
- Quota：同 requestId 第 2 次 → 409 COMPANION_QUOTA_EXCEEDED
- Frontend cutover：舊 `/saved` URL → 404、新 `/favorites` → OK
- poi-search public：anonymous `curl /api/poi-search?q=test` → 200
- Cleanup verify：`git grep saved-pois` 必 0 matches（archive 例外）

詳見 `openspec/changes/poi-favorites-rename/tasks.md` §22.

---

## 步驟 6 — Cleanup PR（後續 soak ≥ 1 week 後）

```
- migration 0051：DROP TABLE saved_pois
- 移除 dual-read code path
- archive openspec/changes/poi-favorites-rename/ → archive/
```
