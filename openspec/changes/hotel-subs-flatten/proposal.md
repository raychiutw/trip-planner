## Why

`hotel.subs[]` 是一條與 `hotel.infoBoxes[]` 平行的渲染路徑。翻查所有行程 JSON 後，每一筆 subs 條目的 `type` 均為 `"parking"`。這代表 subs 並未提供獨特的資料模型，只是重複了 infoBoxes 已能表達的停車場資訊，卻多了一條獨立的渲染迴圈（`renderHotel` 第 268–276 行）。subs 迴圈另外支援 `note` 欄位，但對應的 `renderInfoBox case 'parking'`（第 122–128 行）目前尚未支援 `note`，造成功能不對稱。

維護兩條平行路徑長期有下列代價：
- 程式碼重複：停車場資訊有兩種寫法，未來任何渲染調整都必須同步兩處。
- Schema 複雜度：`schema.test.js` 須同時驗證 subs 與 parking infoBox 兩套結構。
- 新人理解成本：不清楚何時應用 subs、何時應用 infoBoxes。

## What Changes

> **BREAKING**：移除 `hotel.subs[]` 欄位。現有 subs 條目須遷移至 `hotel.infoBoxes[]`。

1. **資料遷移**：`okinawa-trip-2026-Ray.json`（4 筆）與 `okinawa-trip-2026-HuiYun.json`（6 筆）的 subs parking 條目，移入各自飯店的 `hotel.infoBoxes[]`。物件形狀不變，僅改換容器。
2. **渲染調整**：`renderInfoBox case 'parking'` 加入 `note` 欄位支援（1 行）；`renderHotel` 移除 subs 迴圈（9 行）。
3. **Schema 測試更新**：`schema.test.js` 移除 subs 相關驗證，parking infoBox 驗證新增選填 `note` 欄位檢查。
4. **文件同步**：`rules-json-schema.md` 的 Hotel 定義移除 `subs` 欄位說明。

## Capabilities

- **Modified** `trip-json-validation`：hotel 物件結構移除 `subs[]`；parking infoBox 新增 `note` 為選填字串欄位。
- **Modified** `trip-enrich-rules`：R7「自駕飯店停車場」情境由寫入 `hotel.subs` 改為寫入 `hotel.infoBoxes`。

## Impact

- `okinawa-trip-2026-Ray.json`、`okinawa-trip-2026-HuiYun.json`：subs 遷移至 infoBoxes（**資料破壞性變更**）。
- `okinawa-trip-2026-RayHus.json`、`banqiao-trip-2026-Onion.json`、其他行程：無 subs，不需修改。
- `js/app.js`：渲染邏輯簡化，外觀輸出不變（parking infoBox 新增 note 顯示）。
- `tests/json/schema.test.js`：測試覆蓋範圍不縮減，改為驗證新結構。
- `checklist`、`backup`、`suggestions`：不受影響。
