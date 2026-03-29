## api-poi-fields

### Requirements
1. `findOrCreatePoi` 新增 address, phone, email, website, country 參數
2. 找到現有 POI 時，COALESCE 更新：只填入目前為 NULL 的欄位（不覆蓋已有值）
3. INSERT 新 POI 時寫入所有 16 個欄位
4. TypeScript 型別更新：data 參數加入新欄位（全部 optional）

### Acceptance Criteria
- PUT /days/:num 帶 address 的 hotel → pois.address 有值
- PUT /days/:num 已有 address 的 POI → address 不被覆蓋
- tsc 零錯誤
