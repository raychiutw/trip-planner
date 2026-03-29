## skill-poi-spec

### Requirements
1. tp-create SKILL.md 加入 POI V2 欄位產出規格表（每個 type 的必填/建議欄位）
2. tp-edit SKILL.md 同上
3. tp-patch SKILL.md 改用 PATCH /pois/:id API（取代舊 trip_entries 操作）
4. tp-check SKILL.md 新增 R16（飯店 google_rating）、R17（maps 或 latlng）、R18（飯店 address）
5. tp-request 的 trip-plan 模式回覆 POI 完整性時，引用 R16-R18 規則

### Acceptance Criteria
- tp-create 產出的飯店 POI 包含 google_rating + maps + address
- tp-check 對缺 google_rating 的飯店報 warning
- tp-patch 能用 PATCH /pois/:id 補齊 pois 表欄位
