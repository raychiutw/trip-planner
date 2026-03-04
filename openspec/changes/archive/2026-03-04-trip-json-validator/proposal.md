## Why

行程 JSON 由 AI（render-trip skill）產生或修改，目前缺乏結構化驗證機制。常見問題：欄位遺漏（如餐廳缺 hours）、餐次不完整、營業時間與到訪時間衝突等。需要一套自動化驗證器，在每次修改行程 JSON 時即時檢查，確保品質規則（R1-R9）全數通過才放行。

## What Changes

- **更新 `rules-json-schema.md`**：對齊實際 JSON 結構（目前嚴重過時），加入 `breakfast`、`checkout` 等新欄位定義
- **新增 Schema 驗證層**：檢查 JSON 欄位存在性（必填/選填），確保結構完整
- **新增 Quality 驗證層**：實作 R1-R9 品質規則的自動化檢查
  - R2 增強：航程感知餐次檢查（依 flights 到達/出發時間判斷首末日午晚餐需求）
  - R8 新增：早餐欄位完整性（hotel.breakfast 必填，含 included + note）
  - R9 新增：AI 亮點精簡（highlights.summary ≤ 50 字，不列舉景點）
- **新增 Claude Code Hook**：post-tool-call hook，修改 `data/trips/*.json` 後自動跑驗證，紅燈則停下
- **更新 render-trip skill**：加入 R8、R9 規則說明
- **更新現有行程 JSON**：補齊 `breakfast`、`checkout` 欄位，精簡 highlights summary
- **新增 Template JSON**：`data/examples/template.json`，從實際 JSON 萃取的新版骨架，供 render-trip skill 產生新行程時參考

## Capabilities

### New Capabilities
- `trip-json-validation`: 行程 JSON 的兩層驗證機制（Schema 欄位存在性 + Quality 品質規則 R1-R9），含 Claude Code hook 即時 gate

### Modified Capabilities
- `trip-enrich-rules`: 新增 R8（早餐欄位）、R9（AI 亮點精簡）規則，R2 增強為航程感知餐次檢查

## Impact

- **測試檔**：新增 `tests/json/quality.test.js`（Quality 層）、擴充 `tests/json/schema.test.js`（Schema 層，目前只涵蓋 2/4 行程）
- **JSON 結構**：`data/trips/*.json` 新增 `hotel.breakfast`、`hotel.checkout` 欄位
- **Memory 規則檔**：`rules-json-schema.md` 全面更新對齊實際結構
- **Skill 檔**：`.claude/commands/render-trip.md` 新增 R8、R9
- **Hook 設定**：`.claude/settings.json` 新增 post-tool-call hook
- **範例檔**：新增 `data/examples/template.json`
- **連動**：hotel 結構變更影響 checklist/backup 中的飯店資訊；highlights.summary 精簡不影響 tags
