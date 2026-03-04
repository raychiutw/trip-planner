## Architecture

在現有 `tests/json/quality.test.js` 新增測試案例，不改動測試架構。

## Approach

### 1. R3 餐廳數量測試修改

現有測試：
```js
it('R3: restaurants infoBox has >= 3 restaurants', ...)
```

改為：
```js
it('R3: restaurants infoBox has 1-3 restaurants', () => {
  // >= 1（至少一家）且 <= 3（最多三家）
  // 使用者已提供的數量優先，不強制補到 3
});
```

### 2. R5 飯店 blogUrl 測試（新增）

```js
it('R5: non-home hotels have blogUrl field', () => {
  // 跳過 hotel.name === '家' 的在地行程
  // 檢查 hotel.blogUrl 欄位存在（值可為 string 或 null）
});
```

### 3. R7 飯店 shopping infoBox 測試（新增）

```js
it('R7: non-home hotels have shopping infoBox in hotel.infoBoxes', () => {
  // 跳過 hotel.name === '家'
  // 檢查 hotel.infoBoxes 存在且含 type=shopping
  // 檢查 shops 陣列 >= 3
});
```

### 4. R1/R3 餐廳 category 對齊 foodPreferences 測試（新增）

```js
it('R1/R3: restaurant categories align with foodPreferences order', () => {
  // 讀取 meta.foodPreferences
  // 若無 foodPreferences 則跳過
  // 檢查每個 restaurants infoBox 的餐廳 category 順序
  // 第 1 家 category 含偏好 0、第 2 家含偏好 1、第 3 家含偏好 2
});
```

## Affected Files

| 檔案 | 變更 |
|------|------|
| `tests/json/quality.test.js` | 修改 R3 數量測試 + 新增 R5/R7/R1 測試 |
| `openspec/specs/trip-enrich-rules/spec.md` | R3 scenario 更新 |

## Risks

- R1/R3 category 對齊測試可能對現有資料太嚴格 → 先用 warn（console.warn）而非 fail，待資料全面補齊後改為 strict
