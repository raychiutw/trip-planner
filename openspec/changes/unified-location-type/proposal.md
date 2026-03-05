## Why

目前行程 JSON 有 4 種 location 容器（timeline `locations[]`、restaurant `.location`、shop `.location`、gasStation `.station.location`），結構幾乎相同（`name`/`googleQuery`/`appleQuery`/`mapcode?`），但存在命名不一致（gasStation 多包一層 `station`）、欄位填寫率落差大（shop location 僅一個行程有填）、且缺乏統一型別定義。這使得未來導入座標推導（lat/lng → URL/mapcode 自動化）時，需要逐一處理 4 種不同結構，增加複雜度。

現在統一可以：一次定義 `MapLocation` type、一次寫 render 邏輯、一次寫驗證規則。

## What Changes

- **定義 `MapLocation` 統一型別**：`{ name, googleQuery, appleQuery, mapcode?, label? }`，所有 location 容器共用
- **`label` 欄位開放所有容器使用**：原本只有 timeline 有 `label`，現在 restaurant/shop/gasStation 也可選用（多地點標註場景）
- **gasStation infoBox 扁平化** **BREAKING**：移除 `station` wrapper，`name`/`address`/`hours`/`service`/`phone`/`location` 提升到 infoBox 頂層
- **`renderMapLinks` 維持不變**：底層渲染函數已天然支援統一型別，無需修改
- **gasStation render 邏輯調整**：配合扁平化更新 `app.js` 的 gasStation case
- **schema.test.js 新增 MapLocation 驗證**：確保所有 location 物件符合統一型別
- **quality.test.js 新增 R11 規則**：驗證 location 完整性（所有景點/餐廳/購物/加油站都有 location）
- **遷移現有 gasStation 資料**：將 2 個行程的 gasStation `.station.*` 扁平化

## Capabilities

### New Capabilities
- `map-location-type`: 統一 MapLocation 型別定義、schema 驗證、R11 品質規則

### Modified Capabilities
- `trip-json-validation`: gasStation infoBox 結構從 `station.*` 扁平化為頂層欄位；新增 MapLocation 型別驗證
- `trip-enrich-rules`: 新增 R11 地圖導航完整性規則（所有 location 容器必填且符合 MapLocation 格式）

## Impact

**檔案影響範圍：**

| 類別 | 檔案 | 變更 |
|------|------|------|
| JS | `js/app.js` | gasStation render 扁平化（~15 行） |
| 測試 | `tests/json/schema.test.js` | MapLocation 驗證、gasStation 結構更新 |
| 測試 | `tests/json/quality.test.js` | R11 location 完整性規則 |
| 資料 | `data/trips/okinawa-trip-2026-Ray.json` | gasStation 扁平化 |
| 資料 | `data/trips/okinawa-trip-2026-HuiYun.json` | gasStation 扁平化 |
| Spec | `openspec/specs/trip-json-validation/spec.md` | MapLocation 型別、gasStation 結構 |
| Spec | `openspec/specs/trip-enrich-rules/spec.md` | R11 規則 |

**對 checklist/backup/suggestions 的連動影響：** 無。本次變更不影響 days 結構，不新增/移除天數或景點。gasStation 扁平化是 infoBox 內部結構調整，不影響上層連動機制。

**Breaking Change：** gasStation infoBox 的 `station` wrapper 移除。影響範圍限定在 `app.js` 的 gasStation render case 和 2 個沖繩行程 JSON。
