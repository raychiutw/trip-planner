# POI Favorites Rename — Session Handoff

- **Date**: 2026-05-04
- **Branch**: `feat/poi-favorites-rename`（2 commits ahead of master）
- **OpenSpec change**: `poi-favorites-rename`
- **Total tasks**: 196
- **Completed**: 11（5.6%）
- **Status**: paused at milestone — ready to resume

---

## 接續工作命令

```bash
# 切回 feature branch
git checkout feat/poi-favorites-rename
git log --oneline -5  # 應看到 2 個 feat commit on top of eef3569 master

# 接續 OpenSpec apply
# Claude Code: /opsx:apply poi-favorites-rename
# 或讀 openspec/changes/poi-favorites-rename/tasks.md 從 task 3.1 開始

# Re-run migration tests verify still green
npm run test -- migration-0050 --run
# 預期：4 files / 18 tests 全綠
```

---

## 已完成 Task Map

### ✅ Task 1.x — Pre-flight verification（部分）

| | Task | Status |
|---|---|---|
| 1.1 | D1 SQLite version verify | ✅ skipped — 函式被禁用，但 expand-contract pattern 不需要 |
| 1.2 | TRIPLINE_API_TOKEN provisioning | ⚠️ **BLOCKER** — admin 待 provision（見下方） |
| 1.3 | SSH mac mini cron path/token | ⏳ 待 user SSH 操作（task 19.x cutover 階段才生效） |
| 1.4 | OAuth provision script 加 companion scope | ✅ `scripts/provision-admin-cli-client.js` 已 update（admin 待 re-run） |

### ✅ Task 2.x — Migration 0050（除 2.8 preview smoke）

| | Task | Status |
|---|---|---|
| 2.1 | 紅燈 test poi_favorites schema | ✅ tests/unit/migration-0050-rename.test.ts (7 tests) |
| 2.2 | 紅燈 test companion_request_actions | ✅ tests/unit/migration-0050-companion-actions.test.ts (4 tests) |
| 2.3 | 紅燈 test data copy | ✅ tests/unit/migration-0050-data-copy.test.ts (3 tests) |
| 2.4 | 紅燈 test audit_log column | ✅ tests/unit/migration-0050-audit-log.test.ts (3 tests) |
| 2.5 | Forward migration SQL | ✅ migrations/0050_rename_saved_pois_to_poi_favorites.sql |
| 2.6 | Rollback SQL | ✅ migrations/rollback/0050_rename_rollback.sql |
| 2.7 | 跑 test 全綠 | ✅ 18 tests passing |
| 2.8 | preview env smoke | ⏳ task 1.3 mac mini cron 後才有意義 |

### ✅ Task 12.1, 12.2 — Mockup user sign-off

- ✅ `docs/design-sessions/2026-05-04-favorites-redesign.html`（v4 final，1900+ 行）
- ✅ User sign-off 2026-05-04（4 輪 iteration：emoji→SVG / TitleBar 規範 / phone bottom bar / form 4 fields + 2-col + 提交按鈕置中 / TitleBar 靠左）

---

## ⚠️ Pre-flight BLOCKER — admin 動作（merge 前必過）

`TRIPLINE_API_TOKEN` 未 provisioned in Cloudflare Pages env。companion path 全 401 風險。

### 補完步驟

```bash
# Step 1: admin re-run provision script（已加 companion scope）
# 需要 .env.local 含 CLOUDFLARE_API_TOKEN / CF_ACCOUNT_ID / D1_DATABASE_ID
node scripts/provision-admin-cli-client.js

# Script 會印出 client_secret（一次性，DB 只存 hash）
# 例: Generated client_secret: tp_xxx_yyy
# 存到 mac mini cron .env 為 TRIPLINE_API_CLIENT_SECRET

# Step 2: 用 client_secret + client_id 跟 /api/oauth/token 換 access_token
curl -s -X POST https://trip-planner-dby.pages.dev/api/oauth/token \
  -d "grant_type=client_credentials" \
  -d "client_id=tripline-internal-cli" \
  -d "client_secret=tp_xxx_yyy"
# Response: { "access_token": "eyJ...", "scope": "admin trips:read trips:write companion" }

# Step 3: 把 access_token 設成 Pages secret TRIPLINE_API_TOKEN
echo "<access_token>" | npx wrangler pages secret put TRIPLINE_API_TOKEN --project-name trip-planner

# Step 4: 加 TP_REQUEST_CLIENT_ID env binding
echo "tripline-internal-cli" | npx wrangler pages secret put TP_REQUEST_CLIENT_ID --project-name trip-planner

# Step 5: 驗證
npx wrangler pages secret list --project-name trip-planner | grep -E "TRIPLINE_API_TOKEN|TP_REQUEST_CLIENT_ID"
# 應該都看到
```

**注意**：access_token 有 expiry，本 PR 用法是 long-lived（cron 每次重新 mint 或用 refresh）— spec 待 implementation 階段確認 token life 策略。

---

## 剩餘 185 tasks（按 group 分）

| Group | Task # | Topic | Estimated | Dependencies |
|---|---|---|---|---|
| 3.x | 3.1-3.5 (5) | Rate limit atomic INSERT ON CONFLICT + bucket isolation | 30 min | — |
| 4.x | 4.1-4.15 (15) | _companion.ts helper（resolveCompanionUserId + requireFavoriteActor）| 1-2 hr | 1.4 done |
| 5.x | 5.1-5.8 (8) | Middleware 變更（companion gate 雙重門禁 + poi-search whitelist）| 1 hr | 4.x done |
| 6-9.x | (~32) | 4 endpoint handlers（POST/GET/DELETE/add-to-trip + companion 分支）| 4-6 hr | 4.x + 5.x done |
| 10.x | 10.1-10.18 (18) | Frontend file/route/nav/var rename | 2 hr | 6-9.x done |
| 11.x | 11.3-11.10 (8) | PoiFavoritesPage React TDD（mockup-driven）| 3-4 hr | 10.x done |
| 12.x | 12.3-12.11 (9) | AddPoiFavoriteToTripPage React TDD（4 fields + 2-col + 提交置中）| 2-3 hr | 11.x done |
| 13.x | (8) | CSS class rename + PageErrorState/EmptyState shared component 抽取 | 1 hr | 11-12.x |
| 14.x | (6) | 跨 tp-* skill auth header rename | 30 min | — |
| 15.x | (7) | tp-request SKILL.md 加「加入收藏」flow + 401 debug checklist | 30 min | 14.x |
| 16.x | (5) | mockup-first systematic gate 寫進 tp-team SKILL.md + CLAUDE.md | 20 min | — |
| 17.x | (9) | DESIGN.md 廢除 asymmetric labels + favorites rename | 1 hr | — |
| 18.x | (5) | .dev.vars.example + archive banner + DESIGN history | 20 min | — |
| 19.x | (5) | mac mini cron sync（pre-merge gate）| user 動作 | 1.2/1.3 done |
| 20.x | (11) | Pre-merge verification（lint/test/build/review/cso/qa）| 1-2 hr | 全部 done |
| 21.x | (2) | Deploy 順序 | CI 自動 | merge |
| 22.x | (11) | Post-deploy smoke | 30 min | deploy done |
| 23.x | (6) | Rollback playbook | reference only | — |
| 24.x | (4) | Cleanup PR（後續 0051 DROP saved_pois）| 後續 PR | soak ≥ 1 week |
| 25.x | (2) | 額外 task | — | — |

**總估計**：18-30 hr CC（不計 user 動作 + soak time）

---

## 重要 context（下個 session 必讀）

### 5 User Challenges resolved（autoplan dual model 推翻 spec，user 維持原方向）

1. **UC1 single big PR** — user 維持，承擔 30+ 檔 review/rollback 風險（dogfooding-only）
2. **UC2 hard cutover** — user 維持（不留 alias）
3. **UC3 mockup-first systematic** — user accept（寫進 tp-team SKILL.md + CLAUDE.md）— task 16.x
4. **UC4 full rename poi-favorites** — user 維持（vs models 推「favorites」/「不 rename」）
5. **DUC1 batch flow delete-only** — user accept（vs models 推 batch add-to-trip）

### Mockup v4 final decisions（4 輪 iteration 後）

- **TitleBar title 靠左**（flex:1，對齊 css/tokens.css:1277-1289）
- **TitleBar action pill 樣式**（icon + label，padding 0 14px + radius-md + height 44px + RWD 手機 icon-only）
- **Form 4 fields 純時間驅動**（廢除 position radio + anchorEntryId）— design.md D14
- **Desktop form 2-col grid**（trip+day / startTime+endTime，max-width 720px）
- **「加入行程」primary button 置中放 form 下方**（不在 TitleBar 右側 — deviation from production migration 慣例）
- **Phone form button 自動 full-width**
- **Icon 全用 inline SVG（不 emoji）**

### Critical findings 已對應到 tasks

- **EC1 companion gate self-reported** → task 5.6 雙重門禁
- **EC2 migration → app deploy 5xx 窗口** → migration 0050 expand-contract（不動 saved_pois）
- **EC3 audit_log.trip_id NOT NULL** → tripId='system:companion' sentinel
- **DX-F2.1 401 single-bucket** → companion_failure_reason field 已加（migration 0050 ✅）
- **DX-F3.2 跨 tp-* skill auth header** → task 14.x grep + rename
- **DX-F6.1 SKILL.md TTHW 60+min** → task 15.x「加入收藏」H3 段

### 小心地雷

1. **vitest test env**：unit/ 預設 jsdom；用 D1 Miniflare 的 test 必加 `// @vitest-environment node` directive
2. **本機 D1 broken**：`wrangler d1 migrations apply --local` 從 0040 開始 conflict（pre-existing tables）— 這跟我們無關，跳過 local apply 用 vitest D1 fixture
3. **D1 sqlite_version() 函式禁用**：用 expand-contract pattern 避開 ALTER TABLE RENAME COLUMN 需求
4. **OpenSpec name rule**：change name 必須 letter-start（不能 `2026-05-04-...` 這種日期 prefix）— 已用 `poi-favorites-rename`

---

## Files 變動 snapshot

```
A  .openspec/changes/poi-favorites-rename/  (8 檔，OpenSpec change)
A  docs/design-sessions/2026-05-04-favorites-redesign.html  (mockup v4)
A  docs/superpowers/specs/2026-05-04-poi-favorites-rename-design.md  (brainstorming spec)
A  docs/superpowers/checkpoints/2026-05-04-poi-favorites-rename-handoff.md  (本檔)

A  migrations/0050_rename_saved_pois_to_poi_favorites.sql
A  migrations/rollback/0050_rename_rollback.sql

A  tests/unit/migration-0050-rename.test.ts
A  tests/unit/migration-0050-companion-actions.test.ts
A  tests/unit/migration-0050-data-copy.test.ts
A  tests/unit/migration-0050-audit-log.test.ts

M  scripts/provision-admin-cli-client.js  (allowedScopes 加 companion)
M  openspec/changes/poi-favorites-rename/tasks.md  (task 1/2 status update)

(unrelated, working tree only - 不混進 PR)
M  CLAUDE.md  (GBrain config — 與 favorites work 無關)
```

---

## Pipeline 對齊

```
✅ Think    — superpowers:brainstorming + /investigate
✅ Plan     — /autoplan 4 phase + /opsx:propose（spec/design/tasks）
✅ Mockup   — /tp-claude-design v4 + user sign-off
🔄 Build    — /opsx:apply 進行中（task 1-2 done, 3-25 pending）
⏳ Review   — /tp-code-verify + /review（task 20.x）
⏳ Test     — /cso --diff + /qa（task 20.x）
⏳ Ship     — /ship → /land-and-deploy → /canary（task 21-22）
⏳ Reflect  — /retro
```

---

## Last commit

```
841e668 feat(migration): 0050 expand-contract phase 1 + companion infrastructure
e7880cd feat(openspec): poi-favorites-rename change + mockup v4 sign-off
eef3569 v2.21.3 fix(v2-cutover): trip_requests.mode rip-out phase 2 — DROP COLUMN (#473)  ← master
```

下個 session 接續 task 3.1（rate limit atomic test）。
