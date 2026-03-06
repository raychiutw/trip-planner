## 1. 品質規則與搜尋策略更新

- [x] 1.1 更新 `.claude/commands/trip-quality-rules.md`：新增 R13 POI 真實性驗證規則（定義驗證時機、來源區分、處理方式）
- [x] 1.2 更新 `.claude/commands/search-strategies.md`：所有搜尋流程加入「先驗證 POI 存在性」前置步驟，搜不到時回報而非繼續填欄位

## 2. Skill 更新

- [x] 2.1 更新 `.claude/commands/tp-create.md`：Phase 2 agent prompt 加入「驗證 POI 存在性，搜不到則替換為真實店家」
- [x] 2.2 更新 `.claude/commands/tp-patch.md`：agent prompt 加入「搜不到 POI 時回報不存在，不設 unknown」
- [x] 2.3 更新 `.claude/commands/tp-edit.md`：使用者指定的 POI 搜不到時，保留資料 + warning + 加入 suggestions 高優先卡
- [x] 2.4 更新 `.claude/commands/tp-issue.md`：同 tp-edit 處理邏輯

## 3. tp-check R13 檢查

- [x] 3.1 更新 tp-check 邏輯：新增 R13 離線檢查（列出缺少 googleRating 的非豁免 POI 為 warning，不阻擋通過）

## 4. 驗證

- [x] 4.1 執行 `npm test` 確認所有測試通過
- [x] 4.2 對每個行程執行 tp-check，確認 R13 warning 正確輸出
