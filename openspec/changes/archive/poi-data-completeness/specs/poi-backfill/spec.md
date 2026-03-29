## poi-backfill

### Requirements
1. `scripts/backfill-pois.js` — 查所有缺漏 POI，WebSearch 補齊，PATCH /pois/:id 更新
2. 支援 --dry-run 模式（只輸出缺漏報告不修改）
3. 支援 --type hotel/restaurant/shopping 篩選
4. 優先補：google_rating > maps > address（影響使用者體驗的順序）
5. 使用 Service Token 認證呼叫 PATCH API
6. 輸出結果報告（補齊數 / 失敗數 / 仍缺漏數）

### Acceptance Criteria
- --dry-run 列出所有缺漏 POI 不修改 DB
- 跑完後 hotel 的 google_rating 缺漏從 12 降到 0
- 跑完後有結果報告
