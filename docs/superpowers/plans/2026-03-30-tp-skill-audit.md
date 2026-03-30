# tp-* Skill 深度審計與修復計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 審計全部 14 個 tp-* skill，修正過時引用、已廢棄 API endpoint、矛盾指令、過時本地檔案路徑，使所有 skill 與當前 D1 API + POI V2 架構完全一致。

**Architecture:** tp-* skills 分兩類：行程資料操作（tp-check/create/edit/rebuild/rebuild-all/request/patch）透過 D1 API 操作，code pipeline（tp-team/code-verify）控制開發流程。多個 skill 仍殘留已遷移前的 MD 檔案路徑與已廢棄的 restaurants/shopping API endpoints。

**Tech Stack:** Claude Code skills (Markdown)、Cloudflare D1 API、POI V2 schema

---

## 審計發現摘要

| # | 嚴重度 | Skill | 問題 |
|---|--------|-------|------|
| F1 | **🔴 Critical** | tp-edit, tp-request, tp-rebuild | 引用已廢棄的 `/restaurants/{rid}` 和 `/shopping/{sid}` API endpoints |
| F2 | **🔴 Critical** | tp-rebuild-all | 整個 skill 基於不存在的 `data/trips-md/` 目錄，完全失效 |
| F3 | **🔴 Critical** | tp-request | 安全白名單與執行流程矛盾：禁止 PUT /days 但修改流程展示 PUT /days |
| F4 | **🟡 Medium** | tp-quality-rules | 開頭引用 `data/trips-md/`，應改為 API 操作語境 |
| F5 | **🟡 Medium** | tp-shared/references.md | POI 欄位數寫「16 個」，實際 20 個（缺 lat/lng/email/website） |
| F6 | **🟡 Medium** | tp-check | 嵌入表格引用不存在的 `/tp-deploy` |
| F7 | **🟡 Medium** | tp-create | tripId 命名規則矛盾：Phase 0 示範 PascalCase owner，底部規則寫全小寫 |
| F8 | **🟡 Medium** | tp-shared/references.md | 缺少統一 trip-pois endpoint 的記載，仍隱含舊 restaurants/shopping 分離模型 |
| F9 | **🟢 Low** | tp-create | Step 2b browse 腳本混用 require + await（CommonJS 不能頂層 await） |
| F10 | **🟢 Low** | tp-shared | curl 模板 vs tp-create 的 node helper 兩套模式不一致 |
| F11 | **🟢 Low** | openspec/config.yaml | 列出 `tp-deploy` 但此 skill 不存在於 .claude/skills/ |
| F12 | **🟢 Low** | 全體 | 規則編號跳號（R5/R6/R9 不存在），不影響功能但影響可讀性 |

---

## Task 1: 修復已廢棄 API Endpoints（F1 — tp-edit, tp-request, tp-rebuild）

**Files:**
- Modify: `.claude/skills/tp-edit/SKILL.md:47-51`
- Modify: `.claude/skills/tp-request/SKILL.md:148-153`
- Modify: `.claude/skills/tp-rebuild/SKILL.md:43-44`

**背景：** POI V2 統一了 restaurants 和 shopping 為 `trip-pois` 端點。舊端點已不存在：
- ~~POST .../entries/{eid}/restaurants~~ → `POST .../entries/{eid}/trip-pois`
- ~~PATCH/DELETE .../restaurants/{rid}~~ → `PATCH/DELETE .../trip-pois/{tpid}`
- ~~POST .../entries/{eid}/shopping~~ → `POST .../entries/{eid}/trip-pois`
- ~~PATCH/DELETE .../shopping/{sid}~~ → `PATCH/DELETE .../trip-pois/{tpid}`

- [ ] **Step 1: 修復 tp-edit/SKILL.md**

將第 47-51 行：
```markdown
   - **新增餐廳**：POST `/api/trips/{tripId}/entries/{eid}/restaurants`
   - **修改/刪除餐廳**：PATCH/DELETE `/api/trips/{tripId}/restaurants/{rid}`
   - **新增購物（entry 下）**：POST `/api/trips/{tripId}/entries/{eid}/shopping`
   - **修改/刪除購物**：PATCH/DELETE `/api/trips/{tripId}/shopping/{sid}`
```

替換為：
```markdown
   - **新增 POI（餐廳/購物）**：POST `/api/trips/{tripId}/entries/{eid}/trip-pois`
   - **修改/刪除 POI**：PATCH/DELETE `/api/trips/{tripId}/trip-pois/{tpid}`
```

- [ ] **Step 2: 修復 tp-request/SKILL.md**

將第 148-153 行：
```markdown
      - **新增餐廳**：POST `/api/trips/{tripId}/entries/{eid}/restaurants`
      - **修改/刪除餐廳**：PATCH/DELETE `/api/trips/{tripId}/restaurants/{rid}`
      - **新增購物（entry 下）**：POST `/api/trips/{tripId}/entries/{eid}/shopping`
      - **修改/刪除購物**：PATCH/DELETE `/api/trips/{tripId}/shopping/{sid}`
```

替換為：
```markdown
      - **新增 POI（餐廳/購物）**：POST `/api/trips/{tripId}/entries/{eid}/trip-pois`
      - **修改/刪除 POI**：PATCH/DELETE `/api/trips/{tripId}/trip-pois/{tpid}`
```

- [ ] **Step 3: 修復 tp-rebuild/SKILL.md**

將第 43-44 行：
```markdown
   - **修改餐廳**：PATCH `/api/trips/{tripId}/restaurants/{rid}`
   - **修改購物**：PATCH `/api/trips/{tripId}/shopping/{sid}`
```

替換為：
```markdown
   - **修改 POI（餐廳/購物）**：PATCH `/api/trips/{tripId}/trip-pois/{tpid}`
```

- [ ] **Step 4: 驗證無其他舊端點殘留**

Run: `grep -r "restaurants\|shopping.*sid" .claude/skills/tp-*/`
Expected: 無匹配（僅殘留 shop.category 等非 endpoint 引用）

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/tp-edit/SKILL.md .claude/skills/tp-request/SKILL.md .claude/skills/tp-rebuild/SKILL.md
git commit -m "fix(skills): replace deprecated restaurants/shopping endpoints with unified trip-pois"
```

---

## Task 2: 重寫 tp-rebuild-all（F2 — 完全過時）

**Files:**
- Modify: `.claude/skills/tp-rebuild-all/SKILL.md` (full rewrite)

**背景：** 整個 skill 基於掃描 `data/trips-md/` 目錄、`npm run build`、編輯本地 MD 檔案。D1 API 遷移後這些全部失效。需重寫為 API-based 批次操作。

- [ ] **Step 1: 重寫 tp-rebuild-all/SKILL.md**

```markdown
---
name: tp-rebuild-all
description: Use when batch-rebuilding all trip itineraries to fix quality rule violations.
user-invocable: true
---

批次重建所有行程，逐一執行 R0-R18 品質規則全面重整。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## API 設定

API 設定、curl 模板、Windows encoding 注意事項見 tp-shared/references.md

## 步驟

1. 取得所有行程清單：
   ```bash
   curl -s "https://trip-planner-dby.pages.dev/api/trips"
   ```
2. 逐一對每個行程執行 `/tp-rebuild` 的重整邏輯（含 before/after tp-check）
3. 每完成一個行程顯示進度 + tp-check 完整模式 report（after-fix）
4. 全部完成後顯示總結

## 進度顯示格式

```
處理中：1/7 okinawa-trip-2026-Ray
✓ 完成 1/7：okinawa-trip-2026-Ray
tp-check: 🟢 10  🟡 2  🔴 0

處理中：2/7 okinawa-trip-2026-HuiYun
✓ 完成 2/7：okinawa-trip-2026-HuiYun
tp-check: 🟢 11  🟡 1  🔴 0

...

全部完成！7/7 行程已重整。
```

## 注意事項

- 所有資料讀寫均透過 API，不操作本地檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）
```

- [ ] **Step 2: 驗證新內容不引用本地檔案路徑**

Run: `grep -n "data/trips-md\|data/dist\|npm run build\|npm test" .claude/skills/tp-rebuild-all/SKILL.md`
Expected: 無匹配

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/tp-rebuild-all/SKILL.md
git commit -m "fix(skills): rewrite tp-rebuild-all from local MD to D1 API"
```

---

## Task 3: 修復 tp-request 安全白名單矛盾（F3）

**Files:**
- Modify: `.claude/skills/tp-request/SKILL.md:139-153`

**背景：** Section 3c-0 禁止 `PUT /api/trips/{tripId}/days/{num}`（不可覆寫整天），但 section 3d.e 的修改流程展示了 PUT /days 作為選項。旅伴請求的安全邊界應限制為 PATCH entry，不允許覆寫整天。

- [ ] **Step 1: 移除 3d.e 中的 PUT /days 選項**

將 tp-request/SKILL.md 第 139-153 行中覆寫整天的 curl 範例區塊移除，只保留 PATCH entry + trip-pois 選項。

修改 3d.e 為：
```markdown
   e. 依修改類型選擇對應 API（限白名單內操作）：
      - **修改單一 entry**（title/time/description/location/travel 等）：
        ```bash
        curl -s -X PATCH \
          -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
          -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
          -H "X-Request-Scope: companion" \
          -H "Content-Type: application/json" \
          -d '{...修改欄位...}' \
          "https://trip-planner-dby.pages.dev/api/trips/{tripId}/entries/{eid}"
        ```
      - **新增 POI（餐廳/購物）**：POST `/api/trips/{tripId}/entries/{eid}/trip-pois`
      - **修改/刪除 POI**：PATCH/DELETE `/api/trips/{tripId}/trip-pois/{tpid}`
      - **更新 doc**（checklist/backup/suggestions 等）：
        `PUT /api/trips/{tripId}/docs/{type}` + JSON body（doc 結構規格見 tp-shared/references.md「Doc 結構規格」）
```

注意：同時修復了舊 restaurants/shopping endpoint（與 Task 1 的 Step 2 合併）。

- [ ] **Step 2: 驗證白名單一致性**

對照 3c-0 白名單和 3d.e 操作清單，確認每個 3d.e 中使用的 API 都在白名單內：
- ✅ PATCH /entries/{eid} — 在白名單
- ✅ POST /entries/{eid}/trip-pois — 在白名單
- ✅ PATCH/DELETE /trip-pois/{tpid} — 在白名單
- ✅ PUT /docs/{type} — 在白名單
- ✅ PATCH /requests/{id} — 在白名單

Run: `grep -n "PUT.*days" .claude/skills/tp-request/SKILL.md`
Expected: 僅 3c-0 禁止列表出現，3d.e 不出現

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/tp-request/SKILL.md
git commit -m "fix(skills): resolve tp-request security whitelist contradiction — remove PUT /days from modify flow"
```

---

## Task 4: 修復 tp-quality-rules 過時引用（F4）

**Files:**
- Modify: `.claude/skills/tp-quality-rules/SKILL.md:9`

- [ ] **Step 1: 更新開頭描述**

將第 9 行：
```markdown
產生或修改 `data/trips-md/` 下的行程 MD 檔案時，必須遵守以下所有品質規則。
```

替換為：
```markdown
產生或修改行程資料時（透過 D1 API），必須遵守以下所有品質規則。
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/tp-quality-rules/SKILL.md
git commit -m "fix(skills): update tp-quality-rules to reference D1 API instead of local MD files"
```

---

## Task 5: 修正 tp-shared/references.md 過時資訊（F5, F8）

**Files:**
- Modify: `.claude/skills/tp-shared/references.md:31-36`

- [ ] **Step 1: 更正 POI 欄位數量並補齊遺漏欄位**

將第 31 行：
```markdown
pois 表 16 個欄位，API `PUT /days/:num` 的 `findOrCreatePoi` 全部支援。
```

替換為：
```markdown
pois 表 20 個欄位（id, type, name, description, note, address, phone, email, website, hours, google_rating, category, maps, mapcode, lat, lng, country, source, created_at, updated_at），API `PUT /days/:num` 的 `findOrCreatePoi` 全部支援。
```

- [ ] **Step 2: 新增統一 trip-pois endpoint 說明**

在 references.md 的「資料所有權」section（第 48 行）之後新增：

```markdown

### API 操作端點

| 操作 | 端點 | 說明 |
|------|------|------|
| 新增 POI 到 entry | `POST /api/trips/{id}/entries/{eid}/trip-pois` | 餐廳、購物統一端點 |
| 修改 trip_pois | `PATCH /api/trips/{id}/trip-pois/{tpid}` | 覆寫欄位（NULL = 繼承 master） |
| 刪除 trip_pois | `DELETE /api/trips/{id}/trip-pois/{tpid}` | 移除關聯 |
| 修改 pois master | `PATCH /api/pois/{id}` | admin 端點 |
```

- [ ] **Step 3: 驗證欄位數量**

Run: `grep -c "pois 表 20 個欄位" .claude/skills/tp-shared/references.md`
Expected: 1

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/tp-shared/references.md
git commit -m "fix(skills): correct POI field count to 20, add unified trip-pois endpoint docs"
```

---

## Task 6: 移除 tp-check 中不存在的 /tp-deploy 引用（F6）

**Files:**
- Modify: `.claude/skills/tp-check/SKILL.md:148`

- [ ] **Step 1: 移除 /tp-deploy 行**

將嵌入表格中：
```markdown
| `/tp-deploy` | 不嵌入 | — |
```

移除此行。

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/tp-check/SKILL.md
git commit -m "fix(skills): remove nonexistent /tp-deploy reference from tp-check"
```

---

## Task 7: 統一 tp-create tripId 命名規則（F7）

**Files:**
- Modify: `.claude/skills/tp-create/SKILL.md:216-217`

- [ ] **Step 1: 修正命名規則描述**

將第 216-217 行：
```markdown
`{destination}-trip-{year}-{owner}`，**全部小寫**（API 驗證只允許 `[a-z0-9-]`）。
例如：`okinawa-trip-2026-ray`、`yilan-trip-2026-banqiaocircle`
```

替換為：
```markdown
`{destination}-trip-{year}-{owner}`，destination 小寫，owner 保留 PascalCase。
例如：`okinawa-trip-2026-Ray`、`yilan-trip-2026-BanqiaoCircle`
```

- [ ] **Step 2: 驗證 API 實際允許的字元**

Run: `grep -n "tripId\|trip_id.*regex\|pattern\|validate.*id" functions/api/_validate.ts`
Expected: 確認 API 是否允許大寫字母

- [ ] **Step 3: 依 Step 2 結果決定最終規則**

若 API 只允許小寫 → 維持小寫規則，修正 Phase 0 示範和 MEMORY.md
若 API 允許大寫 → 維持 PascalCase owner（與現有 7 個行程一致）

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/tp-create/SKILL.md
git commit -m "fix(skills): align tp-create tripId naming with existing trips (PascalCase owner)"
```

---

## Task 8: 修正 tp-create browse 腳本語法（F9）

**Files:**
- Modify: `.claude/skills/tp-create/SKILL.md:166-189`

- [ ] **Step 1: 修正 Step 2b 腳本**

將混用 require + await 的 CommonJS 腳本改為正確的 async IIFE 或 ESM 語法：

```js
const { execSync } = require('child_process');
const B = process.env.HOME + '/.claude/skills/gstack/browse/dist/browse';

const queries = [
  // [搜尋關鍵字, entryId or null, poiId or null]
  ['景點名稱+地區', 'entryId', null],
  ['餐廳名稱+地區', null, 'poiId'],
];

(async () => {
  for (const [query, eid, pid] of queries) {
    execSync(`"${B}" goto "https://www.google.com/maps/search/${encodeURIComponent(query)}"`, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));
    const text = execSync(`"${B}" text`, { timeout: 10000, encoding: 'utf8' });
    const matches = text.match(/(\d\.\d)/g);
    let rating = null;
    if (matches) for (const m of matches) {
      const n = parseFloat(m);
      if (n >= 1.0 && n <= 5.0) { rating = n; break; }
    }
    console.log(`${query} → ${rating || 'not found'}`);
  }
})();
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/tp-create/SKILL.md
git commit -m "fix(skills): fix tp-create browse script syntax (wrap await in async IIFE)"
```

---

## Task 9: 清理 openspec/config.yaml 中的 tp-deploy 引用（F11）

**Files:**
- Modify: `openspec/config.yaml`

- [ ] **Step 1: 讀取 config.yaml 確認 tp-deploy 位置**

Run: `grep -n "tp-deploy" openspec/config.yaml`

- [ ] **Step 2: 移除或註解 tp-deploy 行**

移除 tp-deploy 條目（skill 不存在且無計畫建立）。

- [ ] **Step 3: Commit**

```bash
git add openspec/config.yaml
git commit -m "fix(config): remove nonexistent tp-deploy from openspec config"
```

---

## Task 10: 最終驗證掃描

- [ ] **Step 1: 掃描所有殘留的過時引用**

```bash
# 舊 endpoint 殘留
grep -rn "restaurants/\|shopping/\[sid\]\|/restaurants/{" .claude/skills/tp-*/
# 本地 MD 檔案路徑殘留
grep -rn "data/trips-md\|data/dist" .claude/skills/tp-*/
# 不存在的 skill 引用
grep -rn "tp-deploy" .claude/skills/tp-*/
```

Expected: 全部無匹配或僅剩語意描述（如 shop.category 中的 "shopping"）

- [ ] **Step 2: 確認所有 skill 的 API endpoint 引用都指向實際存在的路由**

交叉比對 skill 中出現的所有 API 路徑與 `functions/api/` 目錄結構。

- [ ] **Step 3: 輸出修復摘要**

```
tp-* Skill 審計修復完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
修復項目：
  🔴 Critical × 3（已廢棄 endpoint、rebuild-all 重寫、安全白名單矛盾）
  🟡 Medium × 5（過時引用、欄位數量、命名規則）
  🟢 Low × 4（語法修正、config 清理）

涉及檔案：
  .claude/skills/tp-edit/SKILL.md
  .claude/skills/tp-request/SKILL.md
  .claude/skills/tp-rebuild/SKILL.md
  .claude/skills/tp-rebuild-all/SKILL.md
  .claude/skills/tp-quality-rules/SKILL.md
  .claude/skills/tp-shared/references.md
  .claude/skills/tp-check/SKILL.md
  .claude/skills/tp-create/SKILL.md
  openspec/config.yaml
```
