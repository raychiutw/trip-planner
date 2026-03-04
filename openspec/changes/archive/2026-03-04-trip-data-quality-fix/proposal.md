## Why

2026-03-04 兩輪全面審計 + gas-station-rule 實作後重新檢查，四個行程 JSON 仍存在多處機械性資料品質問題。這些問題不需要外部搜尋或人工判斷，可以自動批次修正。

## What Changes

批次修正四個行程 JSON 中的結構性 / 欄位值問題：

1. **`reservation: null` → `"不需訂位"`**：Ray 16 處、RayHus 10 處、Onion 66 處（共 ~92 處）
2. **空 `breakfast.note: ""` 移除**：Ray 3 處、RayHus 6 處（含 null 值的 included 保留，只移除空字串 note）
3. **HuiYun 飯店停車場 subs 補 `price`**：5 處 parking subs 缺 price 欄位，需從 note 欄位提取或標註「免費」
4. **R1 餐廳排序修正**：Onion 4+ 處、RayHus 8 處 restaurants 未按 foodPreferences 順序排列

## Capabilities

### Modified Capabilities
- `trip-json-validation`: 無新增規則，僅修正資料使其通過既有驗證

## Impact

- **資料檔案**：4 個行程 JSON 批次修改
- **測試**：修正後既有 385 測試應全數通過
- **規則檔 / JS / CSS**：無變更
