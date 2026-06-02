# 編輯行程頁 per-POI 備註（取代 entry-level 備註）

- **Date**: 2026-06-02
- **Status**: Draft（待 user review → writing-plans）
- **Owner**: lean.lean@gmail.com
- **Pipeline**: tp-team — Think (brainstorming) → Plan → Build → Review → Test → Ship → Reflect
- **Branch convention**: `feat/entry-poi-note`（單一大 PR，方案 B）
- **Trigger**: 使用者需求「編輯行程頁 選擇正選/備選景點時要可以編輯備註」+ 升級為「per-POI 備註取代 entry-level 備註 + migration + DROP 欄位」

---

## 1. 動機與問題

### 1.1 需求
- 一個停留點可有 1 正選（master）+ N 備選（alternate）POI。
- 目前「備註」是 **entry-level**（`trip_entries.note`，整個停留點共用一條），無法為每個候選 POI 各自註記（例：候選餐廳 A「必點山苦瓜炒麵」、B「週三休息」）。
- 使用者要：**每個正選/備選景點各自可編輯備註**，並以此**取代** entry-level 備註。

### 1.2 現況資料模型（git pull 後最新，2026-06-02 核對）
- `trip_pois` 整表已 **DROP**（migration 0060–0062）。
- `trip_entry_pois`（junction：entry × poi）自 migration 0059 起有 `description / note / reservation / reservation_url` 欄位。
- `trip_entry_pois.note` = **per-(entry, poi)** 備註，已由 `fetchEntryPoisByEntries`（`_merge.ts`）surface 到 master / alternates / stopPois response（read path 就緒）。
- `trip_entries.note` = entry-level 備註，仍存在（0062 沒 drop）。

| Note | 資料表 | 寫入路徑（現況） | Timeline 顯示 | EditEntryPage |
|------|--------|------------------|---------------|---------------|
| 整體備註 | `trip_entries.note` | `PATCH /entries`（有） | `entry.note` inline「+加備註」可編輯 | 備註 section（可編輯） |
| per-POI 備註 | `trip_entry_pois.note` | 僅新增時可帶（`POST /trip-pois`），**無 UPDATE 路徑** | 展開的 POI 卡片 `poi.note`（唯讀顯示） | **完全沒有** |

---

## 2. 範圍邊界

### 2.1 In scope
- 新增 per-POI 備註 **UPDATE** 端點 `PATCH /api/trips/:id/entries/:eid/pois/:poiId`。
- Migration `0078`：backfill `trip_entries.note` → master `trip_entry_pois.note`，再 `DROP COLUMN trip_entries.note`。
- Cutover 全部 `trip_entries.note` 觸點（方案 B 單一 PR 需原子性，見 §3.3）。
- EditEntryPage：移除 entry-level 備註 section；master + 每個 alternate 加 per-POI 備註編輯。
- TimelineRail：顯示改 master note；inline 快速編輯 repoint 到 master 的 per-POI note。
- `mapDay.ts`：timeline entry `note` 來源改 master（primary stopPoi）。
- Export / Import JSON round-trip：entry note 改掛 master poi note。
- EditEntryPage layout 變更 → mockup-first gate `/tp-claude-design`。

### 2.2 Out of scope（明確排除）
- ❌ 為 per-POI 的 `description / reservation / reservation_url` 加編輯 UI（本次只做 `note`，YAGNI；端點結構保留未來擴充）。
- ❌ 改 `trip_notes`（行程筆記功能，migration 0073）— 與本案 `note` 同名但不同表，不動。
- ❌ 改正選/備選的結構操作（setMaster / addAlternate / reorder 既有行為不變）。
- ❌ entry-level 備註的「保留為 stop-level 備註」選項（使用者已選方案 2 取代）。

---

## 3. 鎖定 Decisions

| ID | 議題 | 決定 |
|----|------|------|
| D1 | 備註語意 | per-(entry, poi) `trip_entry_pois.note`，取代 entry-level |
| D2 | 「正選備註」對映 | master row（`sort_order=1`）的 `trip_entry_pois.note` |
| D3 | Cutover 分階段 | **方案 B — 單一 PR 直接 DROP**（使用者確認，接受 exhaustive cutover 風險） |
| D4 | 新端點 OCC | LWW（**不** bump `entry_pois_version`，與既有 note autosave 一致，避免誤殺 swap token）；可選 soft guard 未來再加 |
| D5 | Migration 合併策略 | master note 空 → 用 entry note；兩者都有 → 換行串接（避免資料遺失） |
| D6 | Timeline 編輯 | 顯示 master note + 保留 inline 快速編輯（repoint 到 master 的 per-POI note） |
| D7 | EditEntryPage layout | 走 mockup-first gate `/tp-claude-design` 先出 mockup → 簽核 → 才寫 React |

### 3.1 新端點規格
```
PATCH /api/trips/:id/entries/:eid/pois/:poiId
body: { note: string | null }
```
- 權限：`requireAuth` + `hasWritePermission` + `verifyEntryBelongsToTrip` + 驗證 `poiId` 確實是該 entry 的 trip_entry_pois row（否則 404 / DATA_NOT_FOUND）。
- 驗證：`detectGarbledText`（UTF-8 亂碼）；`note` trim 後空字串 → 寫 `null`（clear）；長度上限對齊既有（1000）。
- 行為：`UPDATE trip_entry_pois SET note = ?, updated_at = ? WHERE entry_id = ? AND poi_id = ?`。**不** bump `entry_pois_version`。
- audit log：`trip_entry_pois` update + diff。
- 回傳：更新後的 row（或 `{ ok: true }`）。

### 3.2 Migration `0078_drop_trip_entries_note.sql`
1. **Backfill**：對每個 entry 的 master row（`sort_order=1`），
   - master note 空 → `SET note = trip_entries.note`；
   - 兩者皆非空 → `SET note = trip_entry_pois.note || char(10) || trip_entries.note`（換行串接）。
   - 以 `UPDATE ... FROM`（或 correlated subquery）實作，僅處理 `trip_entries.note` 非空者。
2. **DROP**：先 `DROP INDEX`（若有 referencing）→ `ALTER TABLE trip_entries DROP COLUMN note`。
3. `ANALYZE trip_entries; ANALYZE trip_entry_pois;`

### 3.3 Cutover 觸點清單（方案 B 必須原子完成）
**寫入（6 建立路徑）— note 改寫到 master entry_poi，不再寫 `trip_entries.note`：**
1. `functions/api/trips/[id]/days/[num].ts`（PUT day 取代 timeline）
2. `functions/api/trips/[id]/days/[num]/entries.ts`（POST entry）
3. `functions/api/trips/[id]/entries/[eid]/copy.ts`（複製 entry）
4. `functions/api/share/[token]/clone.ts`（複製分享行程）
5. `functions/api/trips/import.ts`（匯入）
6. `functions/api/poi-favorites/[id]/add-to-trip.ts`（收藏加入行程）

**編輯 / 讀取：**
7. `functions/api/trips/[id]/entries/[eid].ts`：`PATCH` 的 `ALLOWED_FIELDS` 移除 `'note'`、textFields 移除 `note`；`GET` 不再回 entry note（`master.note` 已在）。
8. `src/lib/mapDay.ts`：timeline entry `note` 來源 `raw.note` → `primaryStopPoi.note`。
9. `src/components/trip/TimelineRail.tsx`：顯示沿用 `entry.note`（來源已轉）；inline 編輯 repoint。
10. `src/pages/EditEntryPage.tsx`：移除 entry-level 備註 section + state；加 per-POI 編輯。

**Export / Import：**
11. `src/lib/tripExport.ts` + `functions/api/trips/_import.ts` / `import.ts`：JSON round-trip 的 entry note 改掛 master poi note（schema 調整 + 安全驗證沿用）。

> ⚠️ 風險：方案 B 的 DROP 在同 PR，§3.3 任一觸點漏改 → prod「no such column」。**緩解**：實作前用 `grep -rn "\.note\b"` + `trip_entries.note` 全面 audit；每個建立路徑配 TDD（驗 note 落在 master entry_poi）；deploy 順序 merge → backend → migration（先 DROP 會炸 in-flight 舊 backend）。

---

## 4. 架構與資料流

### 4.1 寫入流（per-POI 備註）
```
EditEntryPage / TimelineRail
  → PATCH /entries/:eid/pois/:poiId { note }
  → UPDATE trip_entry_pois.note WHERE entry_id+poi_id (LWW)
```

### 4.2 讀取流（顯示）
```
GET /days/:num → fetchEntryPoisByEntries → stopPois[].note (含 master sort_order=1)
  → mapDay.toTimelineEntry: entry.note = primaryStopPoi.note
  → TimelineRail 顯示 master note；POI 卡片各顯各自 note（既有）
```

### 4.3 元件邊界
- **新端點** 為 leaf：只負責 per-POI note 寫入，與結構操作（master/alternates）解耦。
- **mapDay** 是純資料 transform（leaf，不 import component）— 只改 note 來源一行。
- **TimelineRail** 既有 `noteAutosave` hook 改 save target，draftNote 來源改 master note，其餘 inline edit UI 不動。

---

## 5. Testing（TDD 紅 → 綠 → 重構）
- **Backend 端點**：成功更新 / 權限拒絕 / poi 不屬 entry（404）/ 亂碼拒絕 / 空值 clear（→ null）。
- **6 建立路徑**：各驗 note 寫入 master entry_poi（非 trip_entries）。
- **Migration backfill**：3 種合併情境（master 空、entry 空、兩者皆有→串接）。
- **`PATCH /entries`**：帶 note 應被忽略 / 拒收（不再在 ALLOWED_FIELDS）。
- **Frontend**：EditEntryPage per-POI 編輯 + 無 entry-level section；TimelineRail 顯示 + 編輯 master note；export/import round-trip note 保留。
- 工具：Vitest + RTL，對齊既有 `tests/` 結構。

---

## 6. Deploy（單一 PR，方案 B）
```
merge PR → backend deploy（已 cutover，不碰 trip_entries.note）→ apply migration 0078（backfill + DROP）
```
- 順序不可顛倒：先 DROP → in-flight 舊 backend「no such column」fail。
- Migration 套用前 backend 必須完成 cutover（§3.3 全部）。
- `/canary` 監控部署後 console error（新端點 + migration）。

---

## 7. 風險與緩解
| 風險 | 緩解 |
|------|------|
| 方案 B 漏改觸點 → prod no such column | grep 全面 audit + 每路徑 TDD + plan-eng-review / review gate |
| Migration backfill 合併產生重複 note | D5 串接策略 + backfill 測試；master 既有 note 極少（多為 null） |
| repoint TimelineRail 編輯打錯 poiId | 從 stopPois sort_order=1 取 master poiId，缺 master 時 disable 編輯 |
| EditEntryPage N+1 備註欄 layout 變形 | mockup-first gate /tp-claude-design 先簽核 layout |
| export/import schema breaking | round-trip 測試鎖；schemaVersion 既有機制 |

---

## 8. 後續（pipeline 接續）
1. `writing-plans` 產出 implementation plan（task 排序：migration → 端點 → 建立路徑 cutover → mapDay → mockup → EditEntryPage → TimelineRail → export/import → 測試）。
2. Build：`/tp-claude-design` mockup → 簽核 → TDD 紅綠重構 → `/simplify`。
3. Review：`/tp-code-verify` + `/review`（不可跳）。
4. Test：`/cso --diff`（不可跳）+ `/qa`。
5. Ship：`/ship` → `/land-and-deploy` → `/canary`。
