# POI Favorites Rename + Companion Mapping + 頁面 Redesign

- **Date**: 2026-05-04
- **Status**: Draft（待 user review → writing-plans）
- **Owner**: lean.lean@gmail.com
- **Pipeline**: tp-team — Think (brainstorming) → Plan → Build → Review → Test → Ship → Reflect
- **Branch convention**: `feat/poi-favorites-rename`（單一大 PR）
- **Trigger**: `/investigate` 確認 request 181「將 MARUMARO 北谷店 加入收藏」無法處理的根因 + 需求升級為命名重構 + 頁面重設計

---

## 1. 動機與問題

### 1.1 起因（已驗證根因）
Request id=181 由 lean.lean@gmail.com submit 至 trip `okinawa-trip-2026-Ray`，message「將 MARUMARO 北谷店 加入收藏」。tp-request 處理後 reply「無法自動加入收藏 — 此功能需在 web 介面手動操作（綁定使用者帳號）」 — 未實際加入收藏。

根因（`/investigate` 已確認）：
1. `_middleware.ts` companion scope 白名單列出 `saved-pois` 4 條 path（line 202-205）
2. `saved-pois.ts` POST handler 第 67 行強制 `auth.userId`，service token user_id=null 即拒絕
3. `tp-request/references/security.md:21` 描述「auth.user_id 必須是 request 提交者」對映，但 handler 沒實作
4. tp-request LLM 看到此矛盾，直接寫 reply 回避，不嘗試 API call（api_logs 顯示 source=companion 為 0 筆）

### 1.2 命名問題
- 中文 UI 用「我的收藏」「收藏」，但程式碼底層用 `saved`，語意不對齊（saved 偏「儲存」/「暫存」，與「收藏」心智模型不同）
- 用戶 message 多次提到「saved 不符合情境」

### 1.3 設計問題
- 既有 `SavedPoisPage` 與 `AddSavedPoiToTripPage` 開發時未先產 mockup、未對齊 DESIGN.md token 規範
- 多選 toolbar + TripPickerPopover 是 scope creep（DESIGN.md 沒規範）

---

## 2. 範圍邊界

### 2.1 In scope
- D1 table `saved_pois` rename → `poi_favorites`，column `saved_at` → `favorited_at`
- API endpoint `/api/saved-pois*` rename → `/api/poi-favorites*`
- saved-pois.ts handler 補上 companion mapping 分支（D6 路線 A）
- Frontend file / component / route / type / 變數命名全 stack rename
- UI label 統一「收藏」（廢除 DESIGN.md L298 asymmetric labels）
- 頁面 redesign：mockup-driven，含 token drift 修正、region pill 補完、batch flow 重設
- tp-request skill 4 個 doc 更新（含「加入收藏」流程教學）
- 認證 header 文件 cleanup：CF-Access-Client-Id → V2 OAuth Bearer
- DESIGN.md 同步更新

### 2.2 Out of scope（明確排除）
- ❌ 引入新 favorites 種類（trip-favorites / route-favorites 等延伸命名空間）
- ❌ 改其他 API endpoint（trip-pois / entries / requests 等）
- ❌ 改 secret / token provisioning 流程（只改 doc 文字，環境變數設定不動）
- ❌ unified-layout-plan.md 移除（獨立 chore PR — task #10 處理）
- ❌ openspec/changes/archive/ 裡的歷史 reference（保留歷史）

---

## 3. 鎖定 Decisions（D1–D7 + 補充）

| ID | 議題 | 決定 |
|---|---|---|
| D1 | 命名（中譯英） | `poi-favorites`（升級自 favorites，更精準） |
| D2 | DB migration | 原地 RENAME — migration 0050 |
| D3 | API path | Hard cutover — 同 PR ship server/client/skill |
| D4 | UI label | 全部統一「收藏」（廢除 asymmetric） |
| D5-1 | Mockup 流程 | DESIGN.md 為 SoT；既有 review + 缺口用 `/tp-claude-design` 產新 |
| D5-2 | PoiFavoritesPage batch flow | 重新設計（不沿用 popover） |
| D5-3 | AddPoiFavoriteToTripPage | 並列產 mockup，對齊 DESIGN.md L578-612 |
| D6 | Companion 對映 | body.requestId → trip_requests.submitted_by → users.id；handler-level helper |
| D7 | Frontend route | `/favorites` + `/favorites/:id/add-to-trip`（不留 backward-compat redirect） |
| 補充 1 | PR 切法 | 一個大 PR ship 全部 |
| 補充 2 | CSS class | 一次 rename 到位（`.saved-*` → `.favorites-*`） |
| 補充 3 | Cleanup | unified-layout-plan.md 拉獨立 chore PR（task #10）|
| 補充 4 | Auth doc | tp-shared/references.md auth header 從 CF-Access 改 V2 Bearer |

---

## 4. 整體架構

```
                    ┌─────────────────────────┐
                    │    user @ web SPA        │
                    │   (V2 OAuth session)     │
                    └────────────┬────────────┘
                                 │ HTTP
                                 ▼
┌────────────────────────────────────────────────────────────┐
│  functions/api/_middleware.ts                               │
│  • V2 OAuth session / Bearer token 認證 → auth.userId        │
│  • CSRF + UTF-8 + companion-scope 白名單（rename 後新路徑）   │
└────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────┐
│  /api/poi-favorites          (POST/GET)                     │
│  /api/poi-favorites/:id      (DELETE / GET)                 │
│  /api/poi-favorites/:id/add-to-trip   (fast-path)           │
│                                                             │
│  ★ POST handler 兩個分支：                                   │
│    A) user-bound (auth.userId 來自 V2 session)                │
│    B) companion (auth.isServiceToken + X-Request-Scope:       │
│       companion → body.requestId → trip_requests              │
│       .submitted_by → users.id) ← 新增                       │
└────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  D1 table: poi_favorites  │
                    │  (rename from saved_pois)  │
                    └─────────────────────────┘

並行：tp-request skill (.claude/skills/tp-request/) 處理「加入收藏」
      請求時，POST /api/poi-favorites with body.requestId。
```

### 4.1 全 stack rename map

| 層 | 舊 | 新 |
|---|---|---|
| D1 table | `saved_pois` | `poi_favorites` |
| D1 column | `saved_at` | `favorited_at` |
| D1 index | `idx_saved_pois_poi` | `idx_poi_favorites_poi` |
| API path | `/api/saved-pois*` | `/api/poi-favorites*` |
| Server file | `functions/api/saved-pois.ts` (+ `[id].ts`, `[id]/add-to-trip.ts`) | `functions/api/poi-favorites.ts` (+ `[id].ts`, `[id]/add-to-trip.ts`) |
| Client page | `SavedPoisPage.tsx`, `AddSavedPoiToTripPage.tsx` | `PoiFavoritesPage.tsx`, `AddPoiFavoriteToTripPage.tsx` |
| Frontend route | `/saved`, `/saved-pois/:id/add-to-trip` | `/favorites`, `/favorites/:id/add-to-trip` |
| Type | `SavedPoi`, `SavedPoiUsage` | `PoiFavorite`, `PoiFavoriteUsage` |
| 變數 | `savedPois`, `savedKeySet`, `isSaved` | `poiFavorites`, `favoriteKeySet`, `isPoiFavorited` |
| UI label | 「我的收藏」、「儲存到收藏」 | 「收藏」、「加入收藏」 |
| CSS class | `.saved-*` | `.favorites-*` |
| Migration | — | `0050_rename_saved_pois_to_poi_favorites.sql` + rollback |
| Test files | `tests/api/saved-pois*.test.ts` | `tests/api/poi-favorites*.test.ts` |

---

## 5. Migration 0050

### 5.1 現行 schema（D1 prod）
```sql
CREATE TABLE saved_pois (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  poi_id    INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  saved_at  TEXT NOT NULL DEFAULT (datetime('now')),
  note      TEXT,
  UNIQUE (user_id, poi_id)
);
CREATE INDEX idx_saved_pois_poi ON saved_pois(poi_id);
```

### 5.2 Migration 0050 內容
**檔名**：`migrations/0050_rename_saved_pois_to_poi_favorites.sql`

```sql
-- Migration 0050: rename saved_pois → poi_favorites
--
-- 命名升級為 favorites taxonomy v1，預留未來 trip-favorites 等延伸。
-- Hard cutover — 同 PR ship server/client/skill rename。
-- D1 is SQLite 3.42+，支援 ALTER TABLE RENAME COLUMN。
-- saved_pois 沒 children FK 依賴，純 rename 安全。

-- 1. Rename table
ALTER TABLE saved_pois RENAME TO poi_favorites;

-- 2. Rename column saved_at → favorited_at
ALTER TABLE poi_favorites RENAME COLUMN saved_at TO favorited_at;

-- 3. Rename index (SQLite 沒 ALTER INDEX RENAME — DROP + CREATE)
DROP INDEX idx_saved_pois_poi;
CREATE INDEX idx_poi_favorites_poi ON poi_favorites(poi_id);

-- UNIQUE (user_id, poi_id) auto-index 跟 table rename 自動延續，不用手動。

-- 4. Refresh query planner stats
ANALYZE poi_favorites;
```

### 5.3 Rollback
**檔名**：`migrations/rollback/0050_rename_rollback.sql`

```sql
ALTER TABLE poi_favorites RENAME TO saved_pois;
ALTER TABLE saved_pois RENAME COLUMN favorited_at TO saved_at;
DROP INDEX idx_poi_favorites_poi;
CREATE INDEX idx_saved_pois_poi ON saved_pois(poi_id);
ANALYZE saved_pois;
```

### 5.4 Edge cases
- 空表 migration：本機 dev DB 可能無資料 → ALTER 仍 work
- Concurrent write race：D1 single-writer，migration 期間 client write fail（acceptable，<1s 視窗）
- 既有 prod 資料：保留 id/user_id/poi_id/note/timestamp 不變

---

## 6. API + Companion Mapping

### 6.1 4 個 endpoint rename 對照

| 舊 | 新 |
|---|---|
| `POST /api/saved-pois` | `POST /api/poi-favorites` |
| `GET /api/saved-pois` | `GET /api/poi-favorites` |
| `DELETE /api/saved-pois/:id` | `DELETE /api/poi-favorites/:id` |
| `POST /api/saved-pois/:id/add-to-trip` | `POST /api/poi-favorites/:id/add-to-trip` |

### 6.2 新增：Companion User Mapping helper

**新檔**：`functions/api/_companion.ts`

```typescript
import { AppError } from './_errors';
import type { Env } from './_types';

/**
 * 將 companion request 的 submitter 對映為 user_id。
 * 只在 X-Request-Scope: companion + 提供 requestId 時生效。
 *
 * 安全邊界（不可違反）：
 *   1. request status 必須是 processing 或 open（防 replay completed request）
 *   2. trip_requests.submitted_by → users.email case-insensitive 比對
 *   3. 任何步驟失敗統一回 null（fail-closed，避免 oracle 洩漏 request 存在性）
 *   4. caller 在 auth.isServiceToken 為 true 時才呼叫（避免 V2 user 被覆蓋）
 */
export async function resolveCompanionUserId(
  env: Env,
  request: Request,
  requestId: number | undefined,
): Promise<{ userId: string; requestId: number } | null> {
  if (request.headers.get('X-Request-Scope') !== 'companion') return null;
  if (!requestId || !Number.isInteger(requestId) || requestId <= 0) return null;

  const row = await env.DB
    .prepare(
      `SELECT tr.submitted_by, tr.status, u.id AS user_id
       FROM trip_requests tr
       LEFT JOIN users u ON LOWER(u.email) = LOWER(tr.submitted_by)
       WHERE tr.id = ?`,
    )
    .bind(requestId)
    .first<{ submitted_by: string; status: string; user_id: string | null }>();

  if (!row) return null;
  if (row.status !== 'processing' && row.status !== 'open') return null;
  if (!row.user_id) return null;

  return { userId: row.user_id, requestId };
}
```

### 6.3 POST `/api/poi-favorites` 修改重點

```typescript
// functions/api/poi-favorites.ts (rename from saved-pois.ts)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  const body = await parseJsonBody<{ poiId?: number; note?: string; requestId?: number }>(context.request);

  // 解析 effective userId：先用 V2 user session，沒有則嘗試 companion mapping
  let effectiveUserId = auth.userId;
  let companionRequestId: number | undefined;
  if (!effectiveUserId && auth.isServiceToken) {
    const companion = await resolveCompanionUserId(context.env, context.request, body.requestId);
    if (companion) {
      effectiveUserId = companion.userId;
      companionRequestId = companion.requestId;
    }
  }

  if (!effectiveUserId) {
    throw new AppError('AUTH_REQUIRED', '需 V2 OAuth 登入或 companion mode 才能收藏');
  }

  // Rate limit bucket 用 effective userId（companion 也限速）
  if (!auth.isAdmin) {
    const bucket = `poi-favorites-post:${effectiveUserId}`;
    const bump = await bumpRateLimit(context.env.DB, bucket, RATE_LIMITS.POI_FAVORITES_WRITE);
    if (!bump.ok) { /* 429 */ }
  }

  // ...validation, INSERT 用 effectiveUserId

  // companion mode 寫 audit_log
  if (companionRequestId) {
    await logAudit(context.env.DB, {
      tripId: null,
      tableName: 'poi_favorites',
      recordId: row.id as number,
      action: 'insert',
      changedBy: `companion:${companionRequestId}`,
      diffJson: JSON.stringify({ via: 'companion', requestId: companionRequestId, poiId: body.poiId }),
    });
  }
};
```

### 6.4 GET / DELETE / add-to-trip 同步處理
- **GET**：companion 從 `?requestId=N` query param 取
- **DELETE**：companion 從 body.requestId 取
- **add-to-trip**：companion 從 body.requestId 取，ownership 用 resolved userId 比對 `saved.user_id`

四個 endpoint 共用同一個 `resolveCompanionUserId` helper。

### 6.5 Middleware 白名單 rename

```typescript
// _middleware.ts COMPANION_ALLOWED:
{ method: 'GET',   pattern: /^\/api\/poi-favorites(\/\d+)?$/ },
{ method: 'POST',  pattern: /^\/api\/poi-favorites$/ },
{ method: 'DELETE', pattern: /^\/api\/poi-favorites\/\d+$/ },
{ method: 'POST',  pattern: /^\/api\/poi-favorites\/\d+\/add-to-trip$/ },
```

### 6.6 安全邊界 audit
- ✅ Replay 防護：requestId 必須 processing/open
- ✅ 越權防護：resolved userId 來自 `trip_requests.submitted_by`，不是 service token 持有者
- ✅ Oracle 防護：失敗統一 fail-closed null
- ✅ Rate limit：用 resolved userId 為 bucket
- ✅ Audit trail：companion 寫入記 `changedBy: 'companion:<requestId>'`

### 6.7 錯誤回應對照

| 情境 | HTTP | code |
|---|---|---|
| 沒 auth、沒 companion mapping | 401 | AUTH_REQUIRED |
| poiId invalid | 400 | DATA_VALIDATION |
| POI 不存在 | 404 | DATA_NOT_FOUND |
| 重複收藏 | 409 | DATA_CONFLICT |
| Rate limit | 429 | RATE_LIMITED |
| Companion: requestId 任何問題 | 401 | AUTH_REQUIRED（fail-closed） |

---

## 7. Frontend Rename + UI Label

### 7.1 檔案 rename（git mv）
- `src/pages/SavedPoisPage.tsx` → `src/pages/PoiFavoritesPage.tsx`
- `src/pages/AddSavedPoiToTripPage.tsx` → `src/pages/AddPoiFavoriteToTripPage.tsx`

### 7.2 Route 變更（`src/entries/main.tsx`）
- `/saved` → `/favorites`
- `/saved-pois/:id/add-to-trip` → `/favorites/:id/add-to-trip`
- **不保留 backward-compat redirect**（hard cutover，舊連結 404）

### 7.3 Nav 配置（DesktopSidebar + GlobalBottomNav）
- key `'saved'` → `'favorites'`
- href `/saved` → `/favorites`
- DesktopSidebar label 「我的收藏」 → 「收藏」
- GlobalBottomNav label 「收藏」（不變）
- activePatterns 移除 `/^\/saved\b/` 與 `/^\/saved-pois\//`

### 7.4 各頁面內部 rename
- 變數：`saved` → `poiFavorites`、`savedKeySet` → `favoriteKeySet`、`isSaved` → `isPoiFavorited`
- fetch URL：`/api/saved-pois*` → `/api/poi-favorites*`
- title prop：「我的收藏」→「收藏」
- ExplorePage：heart toggle fetch URL、`savedKeySet` → `favoriteKeySet`、「儲存到收藏」 → 「加入收藏」
- AddStopPage：tab key `'saved'` → `'favorites'`、變數 `savedPois` → `poiFavorites`
- LoginPage:546 「我的收藏跟著你」 → 「收藏跟著你」

### 7.5 Type rename（`src/types/api.ts`）
- `SavedPoi` → `PoiFavorite`
- `SavedPoiUsage` → `PoiFavoriteUsage`

### 7.6 CSS class 全 rename
- `.saved-*` → `.favorites-*`（`.saved-error-title` → `.favorites-error-title` 等）

### 7.7 SPA cache（service worker）
- 確認 `vite.config.ts` PWA 設定：`skipWaiting: true` + `clientsClaim: true`
- 沒設則加上去（避免老 SPA client 在 deploy 後仍打 `/api/saved-pois`）

### 7.8 Naming consistency check
```bash
git grep -nE "saved[-_]?pois|SavedPoi|savedPois|isSaved\b|/saved\b|saved-error|saved-count" \
  -- src/ functions/api/ css/ tests/
# 必須 0 matches（archive/ 與 docs/2026-04-* 例外）
```

---

## 8. 頁面 Redesign / DESIGN.md 對齊

### 8.1 SavedPoisPage 對齊度 audit（差距清單）

#### Token drift（必修）
1. `saved-eyebrow` → `tp-page-eyebrow`
2. `saved-skeleton-card` → `tp-skel` 共用 class
3. `saved-empty-cta` → `tp-empty-cta`
4. `saved-error` → `PageErrorState` shared component

#### 功能缺口
5. **Hero region pill filter**（DESIGN.md L630 規定但未實作）— reuse ExplorePage 邏輯

#### Scope creep（DESIGN.md 沒提）
6. **多選 toolbar + TripPickerPopover「加入行程」批次** — 決議 **C) 重新設計 batch flow**

#### 未明確處理
7. **partial state**（trips fetch 失敗隱藏 usage badge silently）— 需 verify 與容錯

### 8.2 Mockup 流程（Build phase 第一步）

```
Step 1: invoke /tp-claude-design 產 2 個 HTML mockup
  → docs/design-sessions/2026-05-04-favorites-redesign.html
    a) PoiFavoritesPage 含：
       - tp-page-eyebrow / tp-skel / tp-empty-cta tokens
       - PageErrorState shared component
       - region pill + type filter row
       - batch flow（重新設計）
    b) AddPoiFavoriteToTripPage（DESIGN.md L578-612 spec 為基礎）：
       - 6-field form
       - 7-state matrix 完整呈現

Step 2: 用戶 review + iterate（多輪）→ 定版

Step 3: 同步更新 DESIGN.md L578-657
  - SavedPoisPage 規格 → PoiFavoritesPage 規格
  - 補進 batch flow 規範
  - 文字「我的收藏」「saved_pois」全 rename
  - L298 asymmetric labels 廢除

Step 4: React 重構
  - 嚴格對照 mockup
  - /design-html 協助轉 production HTML/CSS
  - /design-review verify 視覺
```

**重要**：mockup 與 DESIGN.md update 是 hard gate — 沒 user 簽核 mockup 不進 code 重構。

### 8.3 AddPoiFavoriteToTripPage spec（DESIGN.md L578-612 既有）
- Page (full)，不是 modal
- Form fields (6)：trip / day / position / anchorEntryId / startTime / endTime
- Stay duration heuristic by POI type
- Endpoint `POST /api/poi-favorites/:id/add-to-trip`
- 7-state spec：loading / empty / conflict / error / success / optimistic / partial

---

## 9. Skill / Doc Update

### 9.1 tp-request SKILL.md 更新
- L75 安全摘要：「saved-pois 4 條 path」→「poi-favorites 4 條 path」
- 步驟 3d.e 端點對照補：「加入收藏 → POST /api/poi-favorites（body 含 requestId）」
- **新增** 步驟 3d-FAV「加入收藏」流程（見 9.4）

### 9.2 tp-request security.md 更新
- L13-19 saved-pois 4 條 path → poi-favorites 4 條 path
- L21 companion 邊界註記「已由 `_companion.ts` resolveCompanionUserId 實作」
- 加入：companion 寫入 audit_log 規範

### 9.3 tp-shared/references.md 認證 header cleanup
```diff
-- **認證**: Service Token headers（寫入操作必填）
-  - `CF-Access-Client-Id`: `$CF_ACCESS_CLIENT_ID`
-  - `CF-Access-Client-Secret`: `$CF_ACCESS_CLIENT_SECRET`
+- **認證**: V2 OAuth client_credentials Bearer token（寫入操作必填）
+  - `Authorization: Bearer $TRIPLINE_API_TOKEN`
+  - Token 取得：`POST /api/oauth/token` with `grant_type=client_credentials` + `client_id` + `client_secret`
```

curl 模板對齊：
```bash
curl -s -X POST \
  -H "Authorization: Bearer $TRIPLINE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Request-Scope: companion" \
  --data @/tmp/...
  "https://trip-planner-dby.pages.dev/api/poi-favorites"
```

### 9.4 新增：tp-request「加入收藏」流程指南

新增段落到 tp-request/SKILL.md：

```markdown
### 3d-FAV. 加入收藏流程（旅伴 message「將 X 加入收藏」）

判斷規則：message 含「加入收藏」「收藏 X」「儲存到收藏」+ 具體 POI 名 → 進此流程。

步驟：
1. 從 message 解析 POI 名 → 用 Google Maps 驗證（鐵律 R0）
2. 查 pois master：`GET /api/pois?name=X` 取 poiId（或 `POST /api/pois/find-or-create` 建立）
3. POST 加入收藏：
   curl -s -X POST \
     -H "Authorization: Bearer $TRIPLINE_API_TOKEN" \
     -H "Content-Type: application/json" \
     -H "X-Request-Scope: companion" \
     --data '{"poiId":<poi_id>,"note":"<optional>","requestId":<request.id>}' \
     "https://trip-planner-dby.pages.dev/api/poi-favorites"
4. 處理回應：
   - 201 → reply「已將「X」加入你的收藏 ❤️」
   - 409 (DATA_CONFLICT) → reply「「X」已經在你的收藏裡了」
   - 404 (DATA_NOT_FOUND poi) → reply「沒找到「X」這個地點，請改用 Google Maps 上的店名」
   - 401 → reply「無法處理（auth 異常），請聯繫行程主人」（不暴露細節）
5. 完成請求：PATCH /api/requests/{id} status=completed + reply
```

### 9.5 .codex 鏡像同步
- `.codex/skills/tp-request/SKILL.md`
- `.codex/skills/tp-request/references/security.md`

### 9.6 其他 doc 連帶更新
| 檔案 | 變更 |
|---|---|
| `DESIGN.md` | L298 廢除 asymmetric labels；L317/484/565-657 saved → favorites + 補 batch flow（mockup 定版後）|
| `CLAUDE.md` | grep `saved-pois`，rename |
| `ARCHITECTURE.md` | grep `saved`，rename |
| `CHANGELOG.md` | v2.22.0 entry（`/ship` 自動生成）|
| `tests/api/saved-pois*.test.ts` × 3 | git mv → `poi-favorites*.test.ts` + 內容對齊 |
| `tests/unit/explore-page.test.tsx` 等 | 內容更新 |
| `openspec/specs/saved-pois-schema/` | 若 active 則 rename |

### 9.7 Doc 更新驗證
```bash
git grep -nE "saved[-_]?pois|SavedPoi|/api/saved-pois|CF-Access-Client-Id|CF_ACCESS_CLIENT" \
  -- ':!docs/2026-04-2*' ':!openspec/changes/archive/' ':!*.lock'
# active 範圍應為 0 matches
```

---

## 10. Testing 策略（TDD 紅綠重構）

### 10.1 TDD 7 階段順序

| 階段 | 紅燈 test | 綠燈實作 |
|---|---|---|
| 1 | `tests/unit/migration-0050-rename.test.ts` | `migrations/0050_*.sql` |
| 2 | `tests/unit/companion-resolver.test.ts` | `functions/api/_companion.ts` |
| 3 | `tests/api/poi-favorites.integration.test.ts` (rename + 擴張 companion case) | `functions/api/poi-favorites.ts` POST companion 分支 |
| 4 | `tests/api/poi-favorites-add-to-trip.integration.test.ts` (rename) | `functions/api/poi-favorites/[id]/add-to-trip.ts` companion 分支 |
| 5 | `tests/api/poi-favorites-rate-limit.integration.test.ts` (rename) | rate limit bucket key 用 effectiveUserId |
| 6 | `tests/unit/poi-favorites-page.test.tsx` (rename + token drift fix + region pill) | `src/pages/PoiFavoritesPage.tsx` |
| 7 | `tests/e2e/qa-flows.spec.js` (路徑 update) | `src/entries/main.tsx` route + nav |
| 重構 | 全綠後 `/simplify` + `/tp-code-verify` | DRY、test fixture helper、命名 final check |

### 10.2 必測 security 邊界

| 攻擊面 | Test case |
|---|---|
| Replay attack | 用已 completed request 的 id → 401 |
| Cross-user privilege escalation | service token 持有者 ≠ submitter，仍只能寫 submitter 的池 |
| Oracle 列舉 | 不存在 / status 不對 / submitter 沒帳號 → 統一 401 |
| Rate limit bypass | service token 重複用同 requestId → bucket 用 effective userId 限速 |
| Audit trail | companion 寫入記 `changedBy: 'companion:<requestId>'` |

### 10.3 Companion resolver test cases（`companion-resolver.test.ts`）
- A: scope=companion + valid requestId + status=processing → 回 userId
- B: scope ≠ companion → 回 null
- C: status=completed → 回 null
- D: requestId 不存在 → 回 null
- E: submitter email 沒對應 users row → 回 null
- F: requestId 為負數 / 非整數 → 回 null

### 10.4 Coverage 目標
- `_companion.ts`: 100%
- `poi-favorites.ts` POST companion 分支: 100%
- migration 0050: 1 個 test 覆蓋 schema 完整性
- frontend page: 5-state coverage 不降，加 region pill / batch flow 等新 case（mockup 定版後）

### 10.5 Test 觸發策略
- TDD：每個 commit 紅 → 綠
- pre-push：`npm run test` 全綠
- pre-merge：CI 跑全 test suite
- post-deploy：smoke test manual gate

---

## 11. 上線 Runbook

### 11.1 PR merge 前
1. `wrangler d1 migrations apply trip-planner-db --local` 跑通
2. `npm run test` 全綠
3. `/tp-code-verify` 通過
4. `/cso --diff` 通過
5. `/qa` UI 變更測試通過
6. `/review` PR diff 通過

### 11.2 PR merge 時
1. `/ship` 自動 squash WIP commits + bump VERSION + CHANGELOG
2. CI pass + preview deploy 過 smoke test
3. Merge → CI 自動跑 `wrangler d1 migrations apply --remote`

### 11.3 Manual smoke runbook（部署後 5 分鐘內）

1. **DB schema verify**
   ```bash
   wrangler d1 execute trip-planner-db --remote \
     --command "PRAGMA table_info(poi_favorites)"
   # 確認：id / user_id / poi_id / favorited_at / note / UNIQUE(user_id,poi_id)
   ```

2. **API user-bound smoke**
   - 登入 web → `/favorites` 載入 OK
   - 加 1 個收藏 → 201 + UI 出現 → 重整仍在
   - 重複加 → 409
   - 刪除 → 204 + UI 移除

3. **API companion smoke**
   - 取 Bearer token：`POST /api/oauth/token` with `grant_type=client_credentials` + `client_id` + `client_secret`（或讀 `$TRIPLINE_API_TOKEN` 環境變數，視 mac mini cron 配置）
   - D1 INSERT 一筆 trip_requests（status=processing, submitted_by=lean.lean@gmail.com）
   - curl POST `/api/poi-favorites` with Bearer + `X-Request-Scope: companion` + body.requestId + body.poiId
   - 預期：201 + poi_favorites 表多 1 row（user_id = lean 的 user.id, favorited_at = now）
   - 預期：audit_log 多 1 row（changedBy='companion:<id>'）

4. **越權測試**
   - 同上但 trip_requests.status=completed → 401
   - 同上但 trip_requests.submitted_by 是不存在 email → 401

5. **Frontend cutover smoke**
   - SPA 部署後 service worker skipWaiting 生效
   - 舊 `/saved` URL → 404
   - 新 `/favorites` URL → OK

6. **Cleanup verify**
   ```bash
   git grep -nE "saved[-_]?pois|SavedPoi|/saved\b|saved-error|saved-count" \
     -- src/ functions/api/ css/ tests/
   # 必須 0 matches
   ```

---

## 12. Risk & Rollback

### 12.1 已知風險
| 風險 | 影響 | 緩解 |
|---|---|---|
| migration apply 失敗 | favorites 表不存在，所有 API 5xx | rollback SQL 已備、wrangler d1 backup bookmark |
| SPA cache 老 client 打舊 path | 舊 client 短期 404 | service worker skipWaiting + clientsClaim |
| companion mapping 拒絕真實 companion request | tp-request 無法加收藏 | smoke runbook 第 3 步必測 |
| TRIPLINE_API_TOKEN 沒設 | tp-request 全 401 | PR pre-merge 確認 secret 已 provision，否則補 issue |
| 越權繞過（resolved userId 不對） | 加到別人收藏池 | 5 大 security test case 必過 |

### 12.2 Rollback 條件
- post-deploy 5 min 內：`/api/poi-favorites` 5xx >1% 持續 1 min
- 或 favorites 頁面 empty 異常
- 或 D1 schema integrity 異常

### 12.3 Rollback 步驟
1. `git revert <merge-commit>` 還原 code
2. `wrangler d1 execute trip-planner-db --remote --file migrations/rollback/0050_rename_rollback.sql`
3. Re-deploy 還原 SPA
4. 公告 user：「收藏功能短暫異常，已還原。原 /saved 路徑可繼續使用」

---

## 13. 後續工作（不在此 PR）

| 工作 | 估計 | 觸發條件 |
|---|---|---|
| Cleanup PR：移除 unified-layout-plan.md | 0.5d | 獨立 chore PR（task #10）|
| 評估 user-bound bearer token mint 架構 | spike 1d | 若未來其他 endpoint 也需 companion mapping |
| 引入 trip-favorites / route-favorites | 視 demand | 命名空間已預留 |
| 全面 audit DESIGN.md 對齊度 | 多 PR | 用 mockup-first 流程，每頁逐步補 |
| openspec/specs/saved-pois-schema 改名 | 0.5d | 確認 active 後 rename |

---

## 14. Open Questions

1. **`TRIPLINE_API_TOKEN` 已 provisioned 嗎？** PR pre-merge 必須確認，否則 tp-request 全 401。
2. **openspec/specs/saved-pois-schema/** 是 active 還是 archive？ build 時確認。
3. **CSS class rename 對 e2e selector 影響？** `tests/e2e/qa-flows.spec.js` 內若有 `.saved-*` selector 需同步更新。

---

## 15. Pipeline 確認

```
✅ Think    — superpowers:brainstorming + /investigate (本 doc)
⏳ Plan     — superpowers:writing-plans 產 implementation plan（待 user 確認 spec 後）
⏳ Build    — feature branch + TDD 紅綠 + /simplify
⏳ Review   — /tp-code-verify + /review
⏳ Test     — /cso --diff + /qa + 5 security test cases
⏳ Ship     — /ship → /land-and-deploy → /canary
⏳ Reflect  — /retro
```

---

**Status**: Draft（待 user review）
**Next**: user 看完此 spec → 接受 → invoke `superpowers:writing-plans` 產 implementation plan
