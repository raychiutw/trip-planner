## Why

POI Schema V2 上線後，pois 表有 16 個欄位但 API `findOrCreatePoi` 只寫入 11 個。飯店 100% 缺 google_rating 和 maps，所有 POI 100% 缺 address。tp-* skill 產出行程時也不會填這些欄位。使用者回報「POI 不完整」但系統無法自動補齊。

根因：
1. API `PUT /days/:num` 的 `findOrCreatePoi` 沒有 address/phone/email/website 參數
2. `migrate-pois.js` 從舊表遷移時沒帶 hotel 的 google_rating 和 maps
3. tp-create / tp-edit skill 不知道 pois 表有哪些欄位該填
4. tp-patch skill 還是操作舊的 trip_entries 結構，沒更新到 POI V2

## What Changes

- **API `findOrCreatePoi` 擴充**：接受完整 pois 欄位（address, phone, email, website, country）
- **tp-* skill 更新**：tp-create / tp-edit / tp-patch 的 SKILL.md 加入 POI V2 欄位規格
- **資料修復腳本**：backfill 現有 POI 缺漏欄位（google_rating, maps, address）
- **tp-check 規則擴充**：檢查 POI 欄位完整度（新增 R16-R18）

## Capabilities

### New Capabilities
- `api-poi-fields`: API findOrCreatePoi 支援完整 pois 欄位
- `skill-poi-spec`: tp-* skill 的 POI V2 欄位產出規格
- `poi-backfill`: 現有資料批次補齊腳本

### Modified Capabilities

（無現有 spec 需修改）

## Impact

**後端**：
- `functions/api/trips/[id]/days/[num].ts` — findOrCreatePoi 擴充參數
- `functions/api/pois/[id].ts` — PATCH 端點已有，確認欄位覆蓋完整

**Skills**：
- `.claude/skills/tp-create/SKILL.md` — POI 欄位產出規格
- `.claude/skills/tp-edit/SKILL.md` — 同上
- `.claude/skills/tp-patch/SKILL.md` — 更新到 POI V2 API
- `.claude/skills/tp-check/SKILL.md` — 新增 R16-R18

**腳本**：
- `scripts/backfill-pois.js`（新增）— 批次補齊 google_rating, maps, address

**無 UI 變更、無 migration。**
