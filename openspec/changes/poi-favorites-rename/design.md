## Context

旅伴 request 181 處理失敗暴露三個獨立但糾纏的問題：(1) tp-request scheduler 用 V2 OAuth client_credentials Bearer 認證、token user_id 為 null，但 `saved-pois.ts:67` 強制 `auth.userId`，造成 401；(2) D1/API/前端命名 `saved` 與 UI「收藏」語意脫節；(3) 既有 SavedPoisPage 開發未對齊 DESIGN.md token 規範，產生 token drift。autoplan 4 phase review 進一步揭露 6 個 critical / 12 個 high gap，含 companion gate 假認證、migration 順序爆 5xx、audit_log NOT NULL 違規、跨 tp-* skill auth header rename 漏列、SKILL.md 缺乏 top-level discoverability。

當前約束：
- Cloudflare Pages SPA + D1（single-writer），CI workflow 順序固定為 migration → app deploy
- V2 OAuth cutover phase 2 已完成（migration 0047），auth 機制純 user_id-based
- TODOS.md P0 service-token email = ADMIN_EMAIL 已修（commit 2026-05-03 階段），但 audit changedBy 對 companion 路徑要走 sentinel 不是 fallback ADMIN_EMAIL
- Single-user dogfooding context（user 跟 HuiYun 兩個 owner + 旅伴），可承擔 hard cutover 短窗口 5xx

利害關係人：
- product owner（user）：4 User Challenges 維持 single big PR + hard cutover + full rename + accept systematic mockup-first gate + DUC1 batch flow delete-only
- tp-request scheduler 自動處理旅伴 request
- 既有 prod favorites 資料（migration 0047 後 user_id-keyed pure schema）

## Goals / Non-Goals

**Goals:**

- companion 路徑 POST `/api/poi-favorites` 正常處理旅伴「加入收藏」request（解 request 181 痛點）
- D1 / API / frontend / skill / doc 全 stack `saved` → `poi-favorites` 統一命名（user explicit 偏好）
- 廢除 DESIGN.md L298 asymmetric labels，UI label 全部「收藏」+ eyebrow 補 ownership
- token drift 6 項全對齊 DESIGN.md 共用 token / shared component
- `/api/poi-search` 公開讀取修復（修 prod 198 筆 401）
- 系統化 mockup-first gate 寫進 tp-team SKILL.md + CLAUDE.md（一次設定終身受益）
- 6 個 critical 全修：companion 真實 gate / migration 5xx 窗口 / audit NOT NULL / 401 debug log / 跨 skill auth rename / SKILL.md TTHW

**Non-Goals:**

- 不引入新 favorites 種類（trip-favorites / route-favorites 等延伸命名空間，預留但本 change 不做）
- 不改其他 API endpoint（trip-pois / entries / requests 等不動）
- 不改 secret / token 實際 provisioning 流程（spec 規範 pre-flight verify，但實際 token mint 由現有 admin script 處理）
- 不拆 PR（user 確認單一大 PR 承擔 review/rollback 風險）
- 不留 backward-compat redirect 或 alias（user 確認 hard cutover）
- 不 batch add-to-trip（DUC1：batch flow delete-only，加入行程仍 per-card link）
- 不獨立修 unified-layout-plan.md（task #10 走獨立 chore PR）

## Decisions

### D1. Migration 改 expand-contract pattern（推翻原 spec 直接 RENAME）

**Decision**: 採三階段 migration：
1. **Migration 0050**：CREATE TABLE `poi_favorites` 結構同 saved_pois + 加 `companion_request_actions` 新表，**不**動 saved_pois。同時跑 `INSERT INTO poi_favorites SELECT * FROM saved_pois`（資料複製）。
2. **App deploy（同 PR）**：handler 走 `poi_favorites`，但保留 dual-read fallback（先試 poi_favorites，failure 再試 saved_pois）以保險中間狀態。
3. **Migration 0051（後續 PR，soak ≥ 1 week）**：DROP TABLE saved_pois、移除 dual-read code path。

**Rationale**: `.github/workflows/deploy.yml:12-17` migration 先於 Pages deploy。直接 RENAME `saved_pois` → `poi_favorites` 會造成 migration apply 後、app deploy 完成前的 100% 5xx 窗口。expand-contract 在 D1 single-writer 環境下是 zero-downtime 標準解。

**Alternatives rejected**:
- 原 spec 直接 ALTER TABLE RENAME（Codex/Claude 兩個 model 一致 critical）
- maintenance window + 503 page（user 排斥）
- D1 view alias（D1 view 不可寫，POST/PATCH 仍 break）

### D2. Companion gate 雙重門禁：scope + clientId

**Decision**: companion mapping 啟用條件升級：
```
X-Request-Scope: companion (existing self-reported header) AND
auth.scopes.includes('companion') (new OAuth scope) AND
auth.clientId === env.TP_REQUEST_CLIENT_ID (new env binding to mac mini cron client)
```

**Rationale**: `_middleware.ts:41-44` 註解明示 `X-Request-Scope` 是 self-reported telemetry，任何 valid Bearer 都能 claim。dual model 一致 critical：companion gate 必須含真正 auth gate。OAuth scope 由 token 簽發時固定（不可偽造），clientId 鎖定 mac mini cron 唯一發行的 client。

**Alternatives rejected**:
- HMAC `X-Companion-Token: hmac(requestId + secret)`（每個 request 算 signature，cron 端要管 secret，複雜）
- IP allowlist（mac mini IP 不固定）
- 純 scope 不綁 clientId（任何 admin issuance 含 companion scope 都通過，攻擊面大）

### D3. requireFavoriteActor unified helper

**Decision**: 抽 `functions/api/_companion.ts` exported `requireFavoriteActor(context, body)` helper，回 `{ userId, isCompanion, requestId, audit: { changedBy, tripId } }`。4 個 endpoint（POST / GET / DELETE / add-to-trip）統一呼叫，handler 不重複 effective-userId 解析、bucket key、audit 組裝。

**Rationale**: dual model 一致 high — 4 處 copy-paste 是 DRY 違規 + 未來新 endpoint 容易漏。helper 統一封裝是「explicit over clever」（autoplan principle 5）。middleware-level injection 雖更乾淨但侵入 middleware 更難 test。

**Alternatives rejected**:
- middleware 直接 inject `auth.userId`（侵入 middleware、跨 endpoint 副作用大、test 隔離差）
- 4 endpoint 各自 helper 函式（DRY 違反）

### D4. Replay 防護：guarded claim + companion_request_actions UNIQUE table

**Decision**: 兩層防護：
1. `_companion.ts` SQL 改 guarded claim：`UPDATE trip_requests SET status='processing' WHERE id=? AND status='processing' RETURNING submitted_by`，只在 status 確實是 processing 時 atomic 取走，避免 status race。
2. 新 table `companion_request_actions(request_id, action, poi_id, created_at)` UNIQUE `(request_id, action)`：每個 request 對每個 action（`favorite_create` / `favorite_delete` / `add_to_trip`）只能寫一筆。INSERT 衝突 → 409 `COMPANION_QUOTA_EXCEEDED`。

**Rationale**: 原 spec helper 「先讀 status 再寫 favorite」有 TOCTOU race（admin PATCH status mid-resolve）。原 spec UNIQUE `(user_id, poi_id)` 不防同 requestId 灌入 100 不同 poi 攻擊。dual model 一致 high。

### D5. audit_log.trip_id NOT NULL 兼容

**Decision**: companion 寫入時 `tripId='system:companion'` sentinel 字串。**不**改 schema nullable（避免破壞既有 NOT NULL 不變式 + 影響其他 audit 流程）。

**Rationale**: schema migration 改 nullable 範圍大，影響其他 audit consumer 的 query 假設。sentinel 是 minimal change + 可被 grep。文件規範 `'system:'` prefix 為 system-generated audit。

### D6. /api/poi-search public-read whitelist

**Decision**: middleware 加 `if (request.method === 'GET' && url.pathname === '/api/poi-search') { ... return next(); }`，同 `/api/route` / `/api/public-config` pattern。

**Rationale**: poi-search 是 OSM Nominatim proxy 純讀取無 user data，依 V2 OAuth cutover 設計本應是 anonymous public read。漏列是 cutover 過程的疏漏。修補 1 行即可。

### D7. 系統化 mockup-first gate

**Decision**: 寫進 `.claude/skills/tp-team/SKILL.md` Build phase + 根目錄 `CLAUDE.md` 作為硬規範：所有新 page / new component（≥1 layout 變化）必須走 `/tp-claude-design` 產 HTML mockup → user sign-off → 才寫 React。

**Rationale**: dual model 一致此 PR 個別 mockup-first 是治標不治本。系統化規範一次設定終身受益，避免 design drift 重演（spec section 1.3 真正根因）。User accept UC3。

### D8. 跨 tp-* skill auth header 同步 rename

**Decision**: spec section 9 加 sub-section grep `.claude/skills/tp-*/` 與 `.codex/skills/tp-*/` 所有 `CF-Access-Client-Id` 出現處（tp-edit / tp-create / tp-rebuild / tp-patch / tp-shared / tp-search-strategies / tp-quality-rules / tp-check / tp-daily-check 等）逐一 rename 為 `Authorization: Bearer $TRIPLINE_API_TOKEN`。

**Rationale**: dual model 一致 DX-F3.2 critical — 只 update tp-request 但其他 tp-* skill 也用同 pattern，會集體 broken。

### D9. SKILL.md「加入收藏」top-level discoverability

**Decision**: tp-request `SKILL.md` 主檔加 H3 段「3d.j 加入收藏 sub-flow」（不是 references 內），含完整 5 步 curl + decision rule（message 含「加入收藏」「收藏 X」→ 進此 path）+ 401 debug 3-step checklist。

**Rationale**: 30 秒 skim SKILL.md 必須掃到此能力，否則 TTHW 估 60+ min（DX-F6.1 critical）。

### D10. server-side companion failure structured log

**Decision**: client 維持 401 + uniform message（fail-closed oracle 防護）。server 端 `audit_log.companion_failure_reason` field 寫真實原因 enum（`invalid_request_id` / `status_completed` / `submitter_unknown` / `self_reported_scope` / `client_unauthorized` / `quota_exceeded`）。

**Rationale**: dual goal — debug 友善（dev 看 audit_log）+ 不洩漏 oracle 給 attacker。401 single-bucket 不影響 client，但 server 必須能 differentiate（DX-F2.1 critical）。

### D11. body 欄位命名 `companionRequestId`

**Decision**: body 欄位從原 spec `requestId` 改名為 `companionRequestId`，避免與 POI 自身 request id 概念混淆。

**Rationale**: DX-F1.1 high — 新 dev / AI agent 第一次寫 curl 時看到 `poiId` + `requestId` 容易混淆。`companionRequestId` 顯名表意。

### D12. UI label「收藏」+ eyebrow 補 ownership

**Decision**: TitleBar / DesktopSidebar / GlobalBottomNav 全部「收藏」（廢除 asymmetric）。但 PoiFavoritesPage hero 的 eyebrow 寫「YOUR FAVORITES POOL / 你的跨行程收藏池」、empty CTA 文案明示「個人」語境，補回 ownership disambiguation。

**Rationale**: DM1 dual agree — TitleBar = bottom nav 文字重複會掉 ownership，eyebrow 是 DESIGN.md L286 慣例位置補語意。User accept UC4 維持 full rename，但 UI label 統一不抵觸補 eyebrow。

### D13. PoiFavoritesPage hierarchy 規則 + viewport breakpoints + 8-state matrix + a11y

**Decision**: 
- Hierarchy：< 10 favorites 隱藏 filters；50 favorites grid 為主、controls 在 hero 下方 12px；> 200 sticky search + pagination + count 降為 meta
- Viewport：1024+ 3-col / 640-1023 2-col / <430 1-col、max-width 1040px
- 8-state matrix：原 5-state（loading / empty / error / data / optimistic-delete）+ 新 3 個（bulk-action busy / pagination / filter-no-results）— add-to-trip 409 conflict 由 AddPoiFavoriteToTripPage 處理（per-card 走全頁面）
- a11y：filter chip `role="group" + aria-pressed`（不是 `role="tab"`）、selection checkbox `aria-label={'選取 ${row.poiName}'}`、optimistic-delete `aria-live`

**Rationale**: dual voices Phase 2 一致 critical — 原 spec 抽象度過高 mockup 階段會發散。鎖定具體規則為 mockup 階段提供 boundary。

### D14. AddPoiFavoriteToTripPage 規範（mockup-driven 簡化）

**Decision**: **4-field 純時間驅動 form**（trip / day / startTime / endTime），不沿用 DESIGN.md L578-612 既有 6-field 規範。Server 依 startTime 自動計算 sort_order 插入點，不接受 position / anchorEntryId 參數。Desktop 2-col grid（max-width 720px）、phone stack 單欄。「加入行程」primary button 置中放在 form 欄位下方（`.tp-form-actions` wrapper），TitleBar 右側不含 confirm action（取消由左側返回 button 處理）。stay-duration heuristic 仍生效（預填 startTime/endTime by POI type）。7-state matrix 不變。

**Rationale**: User 在 mockup review 階段（2026-05-04）做出三個 taste call：(a) 4 fields 比 6 fields 心智負擔小、time-based 排序對齊「行程是時間軸」直覺；(b) TitleBar title 靠左 + form 內置中提交是用戶偏好的 layout（雖然 production migration 規範用 right-side `.is-primary`）；(c) desktop 2-col grid 比單欄更善用桌機水平空間。User 是 product owner taste call，spec 對齊 mockup 為 SoT。

**Trade-off**: deviation from production migration 慣例（terracotta-preview-v2:5243「TitleBar shell（左返回 + 中標題 + 右建立 action）」），由本 change 引入 form-內置中按鈕新 pattern。若未來其他 form page 跟進此 pattern，DESIGN.md 應加章節記錄；若僅本頁特例，則作為 page-level deviation 註記。

**Alternatives rejected**:
- 6-field 顯式 position（autoplan 原 spec）— time-based 已隱含 ordering，position 是 redundant cognitive load
- TitleBar 右側 `.is-primary`（production migration 慣例）— user 選 form 內置中
- 全頁單欄（max-width 560px）— desktop 浪費水平空間

### D15. Batch flow scope reduce 為 delete-only

**Decision**: PoiFavoritesPage 多選 toolbar 只保留「全選 / 取消 / 刪除」三個 action，不做 batch add-to-trip。加入行程一律走 per-card link `/favorites/:id/add-to-trip` fast-path。

**Rationale**: DUC1 user accept dual model 共識 — batch add-to-trip 在不同 trip / day / 時段 / conflict 處理會讓 mockup 發散。per-card single-item 流程已穩定（DESIGN.md L578-612）。

### D16. Rate limit 改 atomic + bucket 隔離

**Decision**: `_rate_limit.ts` 從 read-then-replace 改為 `INSERT ... ON CONFLICT(bucket) DO UPDATE SET count = ...` 單 SQL atomic。bucket key 拆兩個：`poi-favorites-post:user:${userId}`（V2 user）vs `poi-favorites-post:companion:${requestId}`（companion，配 D4 單 request 單 action 已有額外限制）。

**Rationale**: 原 read-then-replace 在 100 burst 下會 race underflow。dual model 一致 high。bucket 隔離避免 companion 攻擊耗光 user web 端 quota。

### D17. PR 切法：single big PR（user 維持 UC1）

**Decision**: 全部變更 ship 一個 PR。pre-merge gate：
1. SSH mac mini verify cron path + token
2. Local + preview migration apply 跑通
3. CI tsc + test + test:api + build + verify-sw 全綠
4. /tp-code-verify + /review + /cso --diff 過

**Rationale**: User UC1 確認，承擔 30+ 檔 review/rollback 風險。dual model 推薦拆 PR，user 認 dogfooding context 可接受。

### D18. SPA cache + rollback playbook

**Decision**: SW `skipWaiting + clientsClaim` 已啟（`vite.config.ts:35-40`）。rollback playbook 加步驟 5：deploy 一個 dummy `/sw.js` 含 `self.registration.unregister()` + `clients.matchAll().then(c => c.forEach(x => x.navigate(x.url)))` 強制全 client reload。

**Rationale**: hard cutover + skipWaiting 中間有 race window — user form submit 時 SW 切版可能炸。dual model 一致 high — playbook 必含 reverse SW unregister。

### D19. Pre-flight verification gates（merge blocker）

**Decision**: spec 加 section 5.0 pre-flight checks，merge 前必過：
1. `wrangler d1 execute --remote --command "SELECT sqlite_version()"` 確認 ≥ 3.25
2. `TRIPLINE_API_TOKEN` 已 provisioned（`wrangler secret list` verify）
3. mac mini cron `tp-request-scheduler.sh` path + token 已同步（SSH verify）
4. OAuth `companion` scope 已加進 provision script + mac mini client 已換新 token

**Rationale**: 任一缺漏 → companion path 全 401 / migration ALTER 失敗 / cron 全 404。critical 級風險不允許 open question 等實作時才發現。

## Risks / Trade-offs

[Risk] 30+ 檔 single big PR review fatigue → 漏抓 bug → **Mitigation**: pre-merge gate 強制 /review + /cso --diff + autoplan 已 catch 6 critical / 12 high；review 階段 reviewer 拿 task #11 對照清單

[Risk] expand-contract pattern 在 dual-read 期間有 read amplification（兩 table 都查）→ **Mitigation**: dual-read 只在 D1 prepare 時 try-catch，hot path 不變；soak ≥ 1 week 再 drop saved_pois

[Risk] companion gate clientId 綁定 mac mini cron 唯一 client，若未來多 cron 環境（PRD vs UAT）需要多 client → **Mitigation**: env binding 可改 array TP_REQUEST_CLIENT_IDS（CSV split），目前單 client 不需要

[Risk] User 維持 single big PR + hard cutover → user form submit 在 deploy 中 5xx → **Mitigation**: rollback playbook D18 + SW unregister + dogfooding-only context user 確認可接受

[Risk] companion_request_actions 新 table 增加每次 companion POST 的 INSERT 成本 → **Mitigation**: 同 transaction 內 + UNIQUE 約束無 INDEX 額外負擔；旅伴 request 量 < 5/day 不影響效能

[Risk] migration 0050 + 0051 兩段，user 必須在第一個 PR 後另開 cleanup PR drop saved_pois → **Mitigation**: spec 13 後續工作明列、task #10 同類 cleanup 已有 precedent；CHANGELOG 記錄

[Risk] OAuth `companion` scope 加入後，既有 admin scope token 不含 companion，舊 token 全失效 → **Mitigation**: 新發 mac mini token 含 admin + companion 雙 scope，admin 既有功能不影響；rollback 條件含「companion 失敗 → revert OAuth scope 變更」

[Risk] D1 SQLite 版本驗證（pre-flight D19）若 < 3.25，整個 expand-contract pattern 跑不通 → **Mitigation**: D1 在 2024 中以後升 SQLite 3.45+，prod 應通過；若不通過則改純 CREATE TABLE + INSERT SELECT pattern（不需 RENAME COLUMN）

## Migration Plan

### Pre-flight（merge blocker）
1. `wrangler d1 execute trip-planner-db --remote --command "SELECT sqlite_version()"` 確認 ≥ 3.25
2. `wrangler secret list --remote` verify `TRIPLINE_API_TOKEN` 存在
3. SSH mac mini → `cat scripts/tp-request-scheduler.sh` 確認 base URL + token env var 已對齊新規範
4. OAuth `companion` scope 加進 admin provision script + dry-run mint 新 token 含 `admin + companion` scopes

### Deploy 順序
1. **PR merge** → CI 自動：
   - `wrangler d1 migrations apply --remote` 跑 migration 0050（CREATE poi_favorites + companion_request_actions + INSERT SELECT 複製資料）
   - `wrangler pages deploy` ship app（dual-read mode）
2. **Manual smoke**（5 分鐘內）：
   - login web → `/favorites` 載入 OK + 加 1 個收藏 + 重整仍在 + 重複 409 + 刪除 204
   - mock companion request：D1 INSERT 一筆 trip_requests（status=processing, submitted_by=lean.lean@gmail.com）+ curl POST `/api/poi-favorites` with Bearer + `X-Request-Scope: companion` + body.companionRequestId + body.poiId → 預期 201 + audit_log 多 1 row（changedBy='companion:<id>'）
   - 越權測試：trip_requests.status=completed → 401；submitted_by 不存在 email → 401
   - SPA cache 驗證：舊 `/saved` URL → 404；新 `/favorites` → OK
   - poi-search 公開讀取：anonymous `curl /api/poi-search?q=test` → 200
3. **Update mac mini cron**（同步 update token + path）
4. **Soak ≥ 1 week**：監控 `/api/poi-favorites` 5xx 率 + companion 失敗率 + audit_log 趨勢
5. **Cleanup PR（後續）**：migration 0051 DROP saved_pois + 移除 dual-read code path

### Rollback strategy
- post-deploy 5 min 內：`/api/poi-favorites` 5xx >1% 持續 1 min OR favorites empty 異常 OR D1 schema integrity 異常
- 步驟：
  1. `git revert <merge-commit>`
  2. **不需要** revert migration 0050（poi_favorites + saved_pois 共存，舊 app revert 後會走回 saved_pois）
  3. SW reverse unregister deploy（dummy `/sw.js`）
  4. Mac mini cron 還原 path + token
  5. OAuth provision script 移除 companion scope（其他 admin token 不影響）
  6. 公告 user：「收藏短暫異常已還原；可繼續使用」

## Open Questions

無 — 所有 autoplan phase 1-3.5 已 cover，剩餘細節留 implementation phase 處理：
- mockup 階段 PoiFavoritesPage / AddPoiFavoriteToTripPage 視覺設計（user sign-off gate）
- companion_request_actions table 的 retention policy（保留 30 days？永久？— 由 daily-check cleanup 決定）
- expand-contract dual-read 的具體 fallback timeout（initial 3s → 1s → 0s 漸減 by deploy）
