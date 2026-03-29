## Tasks

### Phase 1: API 擴充
- [ ] T1.1: `functions/api/trips/[id]/days/[num].ts` — findOrCreatePoi 加 address/phone/email/website/country 參數
- [ ] T1.2: findOrCreatePoi 找到現有 POI 時 COALESCE 更新 NULL 欄位
- [ ] T1.3: 確認 `PATCH /pois/:id` 支援所有 16 個欄位

### Phase 2: Skill 更新
- [ ] T2.1: tp-create SKILL.md — 加 POI V2 欄位產出規格表
- [ ] T2.2: tp-edit SKILL.md — 同上
- [ ] T2.3: tp-patch SKILL.md — 改用 PATCH /pois/:id API
- [ ] T2.4: tp-check SKILL.md — 新增 R16（hotel rating）、R17（maps/latlng）、R18（hotel address）
- [ ] T2.5: tp-request SKILL.md — trip-plan 模式引用 R16-R18

### Phase 3: 資料修復
- [ ] T3.1: `scripts/backfill-pois.js` — 查缺漏 + WebSearch + PATCH 更新
- [ ] T3.2: 跑 --dry-run 確認缺漏清單
- [ ] T3.3: 跑正式 backfill（先備份 D1）
- [ ] T3.4: 驗證結果（缺漏數降到 0）

### 測試
- [ ] T4.1: integration — findOrCreatePoi INSERT 新 POI 帶 address → pois.address 有值
- [ ] T4.2: integration — findOrCreatePoi SELECT 已有 POI + COALESCE → 只填 NULL 不覆蓋
- [ ] T4.3: unit — backfill-pois --dry-run 輸出缺漏清單格式正確
- [ ] T4.4: unit — backfill-pois PATCH 成功更新
- [ ] T4.5: unit — backfill-pois WebSearch 失敗 → 跳過不中斷
