## 1. 品質規則與 Skill 更新

- [ ] 1.1 更新 `trip-quality-rules.md`：R13 規則加入 source-based 驗證等級定義（ai→fail, user→warning）
- [ ] 1.2 更新 `tp-create.md`：Phase 2 agent prompt 加入「所有 POI 標記 source: "ai"」
- [ ] 1.3 更新 `tp-edit.md`：加入 source 標記邏輯（使用者指定名稱→user，模糊描述→ai）
- [ ] 1.4 更新 `tp-issue.md`：同 tp-edit 的 source 標記邏輯
- [ ] 1.5 更新 `tp-patch.md`：source 欄位不受 patch 影響（保留原值）

## 2. Template 與 Schema 測試

- [ ] 2.1 更新 `data/examples/template.json`：所有 POI 範例加入 `"source": "ai"`
- [ ] 2.2 更新 `tests/json/schema.test.js`：新增 source 欄位存在性與值域檢查（非豁免 POI 須有 source: "user"|"ai"）
- [ ] 2.3 更新 `tests/json/quality.test.js`：R13 測試邏輯依 source 區分 warning/fail

## 3. 行程資料遷移

- [ ] 3.1 為所有 7 個行程 JSON 中的非豁免 POI 批次新增 `"source": "ai"`

## 4. 驗證

- [ ] 4.1 執行 `npm test` 確認所有測試通過
- [ ] 4.2 對每個行程執行 tp-check，確認 R13 source-based 驗證正確運作
