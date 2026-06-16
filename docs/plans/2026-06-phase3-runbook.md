# Phase 3 執行 runbook — 移除全域 admin 殘留（最後階段，cleanup）

**前置**：Phase 1（v2.55.5）+ Phase 2（v2.55.6 + rotate）已上 prod。admin 移除**安全目標已達成**（isAdmin 已無 true 來源、service token 走 ops scope、舊 admin token 全 revoke）。Phase 3 是移除 dead 殘留 + migration，**安全價值低**（不做也無風險），完整性需要。

**性質**：**57 檔 atomic**（移除 `AuthData.isAdmin` 欄位 → 35 consumer 同時 tsc 紅，一起改才綠）+ D1 migration。branch `feat/remove-global-admin-phase3` 已開。

## 前置驗證（先做）
- 確認今晚（2026-06-16 20:00/20:30 UTC）cron 用新 ops token 跑 OK（auth-cleanup/refresh:google/daily-check/quota-monitor 無 401）→ 確認雙接受的 admin fallback 確實無觸發者，移除安全。
- `rg -c "auth\.isAdmin" functions/` 重抓精確清單（grep 本地輸出有污染，用 Grep tool）。

## 改動（一個 atomic PR）

### 1. 移除雙接受 + isAdmin 來源（核心，斷 admin 路徑）
- `_auth.ts:44` `hasOpsScope`：`return scopes.includes(scope) || scopes.includes('admin')` → `return scopes.includes(scope)`（移除 admin fallback）。
- `_middleware.ts:466` service token：`isAdmin = safeScopes.includes('admin')` → 整個移除（連同 `isAdmin` 不再 attach，見 #3）。
- `_middleware.ts` user-session 3 處（Phase 1 已設 `isAdmin: false`）：連同 #3 一起把 `isAdmin` 從 auth 物件移除。

### 2. 移除 isAdmin bypass + requireAdmin（_auth.ts）
- `hasPermission`（~:44）、`requireTripReadAccess`（~:92）、`hasWritePermission`（~:114）：移除 `if (isAdmin) return true/pass` + **移除 `isAdmin` 參數**（signature 改）。
- `requireAdmin`（:21-25）：整個刪除（Phase 3 後唯一 caller 是 test-alert，#5 一起刪）。
- `requirePoiWrite:70`、`requireTripWrite`：`hasWritePermission(db, auth, tripId, false)` → 去掉第四參數 `false`。

### 3. 移除 AuthData.isAdmin 欄位
- `src/types/api.ts:140` `isAdmin: boolean;` → 刪除。
- `_middleware.ts` auth 物件（dev mock :315、V2 session :429、user bearer :489、service :489）不再含 `isAdmin`。

### 4. 35 個 consumer（atomic — #3 後全 tsc 紅）
- 用 Grep tool `auth\.isAdmin` 抓全清單。多數是 `hasWritePermission(db, auth, id, auth.isAdmin)` / `hasPermission(..., auth.isAdmin)` → 去掉第四參數（配合 #2 signature 改）。
- `requests.ts:37/41/125`、`trips.ts:202`(showAll，Phase 1 已改 hasOpsScope，確認無殘留 isAdmin)、`pois/[id].ts`、各 `trips/[id]/**` handler。
- `permissions.ts` / `permissions/[id].ts`：移除 isAdmin 分支 + per-trip `role='admin'` 防守碼（#6 migration 配套）。
- `my-trips.ts`、`trips/[id]/audit*`：Phase 1 已改 owner gate，確認無殘留。

### 5. 刪 test-alert + ADMIN_EMAIL
- 刪 `functions/api/admin/test-alert.ts` + `tests/unit/cf-alert-observability.test.ts`（或其 test-alert 段）。
- `_types.ts:13` `ADMIN_EMAIL: string;` → 刪除。CF dashboard 移除 `ADMIN_EMAIL` env（運維）。
- 確認 `ADMIN_EMAIL` 無其他 runtime 消費（Phase 1 確認唯一用途是 user-session isAdmin，已移除）。`provision-admin-cli-client.js` 的 `ADMIN_EMAIL_OVERRIDE` 是 build-time owner 對映，獨立保留。

### 6. migration — trip_permissions role CHECK 去 'admin'
標準 swap（0047:77-91 模板，trip_permissions 無 children FK）：
```sql
CREATE TABLE trip_permissions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member','viewer')),  -- 去 'admin'
  UNIQUE (user_id, trip_id)
);
INSERT INTO trip_permissions_new SELECT id,user_id,trip_id,role FROM trip_permissions;
-- 若有 role='admin' row → CHECK violation ABORT（已確認無 code 寫此值，prod 應為 0；
--   保險：先 SELECT COUNT(*) WHERE role='admin'，非 0 則先 UPDATE → 'member' 或人工處理）
DROP TABLE trip_permissions; ALTER TABLE trip_permissions_new RENAME TO trip_permissions;
ANALYZE trip_permissions;
```
注意 D1 deploy ↔ migration apply 不 atomic（見 [[project_d1_migration_phase_split]]）：CHECK 收緊，先 apply migration 再 merge PR（或確認無 'admin' row 後同步）。

### 7. tests（22 檔）+ CLAUDE.md
- 22 個含 `isAdmin` 的 test：移除 `mockAuth({isAdmin:...})`、`hasWritePermission(...,isAdmin)` 第四參數、helpers.ts `mockAuth` 的 `isAdmin` default。`ops-scope-gate.test.ts` 的「legacy admin scope 雙接受 → true」test 改成「admin scope 不再通配」。`middleware-service-token.integration.test.ts` 的 admin-scope-token test 改。
- `CLAUDE.md:3` `Admin: lean.lean@gmail.com.` → 移除或改「無全域 admin，owner/permissions + service-token ops scope」。

## 驗證 + ship
- `tsc` clean（57 檔一起綠）+ unit 全綠 + 受影響 integration 逐檔。
- service token ops token 打維運 endpoint 仍 200（不靠 isAdmin）。
- owner/member 寫自己 trip + viewer 擋寫 回歸不變。
- 走 /simplify → /tp-code-verify + /review → /cso --diff → /ship → /land-and-deploy → /canary。

## 拆分選項（若不想一次 57 檔）
- **3a（小，可獨立 ship）**：#1 移除雙接受 + service isAdmin → false（保留 AuthData.isAdmin 欄位 dead）。斷所有 admin 來源，實質完成。改動 ~5 檔。
- **3b/c（大 cleanup）**：#2-7 移除 dead 欄位 + migration + test-alert。57 檔 atomic，乾淨 context。
- 3a 後 isAdmin 永遠 false（無安全風險），3b/c 純 code 整潔，可從容做。
