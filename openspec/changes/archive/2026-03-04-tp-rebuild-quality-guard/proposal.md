## Why

`/tp-rebuild-all` 全面重整後審計發現系統性問題：
- R7 規則缺乏明確的「生成」checklist，導致 agent 只做驗證（修正既有 category）卻跳過生成（為缺少 infoBox 的飯店新建 shopping infoBox）。RayHus 全 5 天飯店皆無 `hotel.infoBoxes`。
- R2 一日遊（KKday/Klook）規則寫「不補午餐」，但實際應有午餐 timeline entry 表示「已含在行程中」，只是不附餐廳推薦。
- R4/R6 的 `titleUrl`、`blogUrl` 規則未明確允許 `null`，agent 遇到查不到的情況時行為不一致。

## What Changes

- **R7 強化**：在 `/tp-rebuild.md` 的 R7 加入明確的飯店購物 infoBox 生成 checklist（「每間飯店必須有 hotel.infoBoxes shopping」），區分「驗證既有」與「生成缺漏」兩階段
- **R2 一日遊午餐**：一日遊團體行程改為「插入午餐 timeline entry（標示已含在團體行程中），不附 restaurants 推薦」
- **titleUrl/blogUrl 可選**：R4 的 `titleUrl` 找不到官網時為 `null`（已有此規則），R4/R5/R6 的 `blogUrl` 查不到適合的繁中文章時允許 `null`

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `trip-enrich-rules`：R2 一日遊午餐行為變更（不補午餐 → 插入無推薦 entry）、R4/R5/R6 blogUrl 允許 null、R7 新增飯店購物 infoBox 生成 checklist

## Impact

- 檔案影響：`.claude/commands/tp-rebuild.md`（規則文字更新）
- Spec 影響：`openspec/specs/trip-enrich-rules/spec.md`（R2/R4/R5/R6/R7 scenario 更新）
- 無 JSON 結構變更、無 JS/CSS/HTML 變更、無 checklist/backup/suggestions 連動
