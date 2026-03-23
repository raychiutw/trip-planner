## Why

掃描發現多個中低嚴重度品質和技術債問題：API handler 中 `json()` helper 重複 15 次、`Env`/`AuthData` interface 重複宣告、CSS 主題 token 不完整（5 個 light theme 缺 badge/plan tokens）、`@types/react` 放在 dependencies 而非 devDependencies、`functions/` 被 tsconfig exclude 導致 API 層沒有 type checking。

## What Changes

- **M12**: 抽取共用 `json()` helper 到 `_utils.ts`，所有 API handler import 使用
- **M13**: 抽取共用 `Env`、`AuthData` interface 到 `_types.ts`
- **M19**: 補齊 5 個 light theme 的 `--color-badge-*` 和 `--color-plan-*` tokens
- **M17**: 移除 `shared.css` theme-sun.dark 中重複的 badge token 宣告
- **M20**: 將 `@types/react`、`@types/react-dom`、`typescript` 從 dependencies 移到 devDependencies
- **M21**: 新增 `tsconfig.functions.json` 讓 functions/ 也受 type checking

## Capabilities

### New Capabilities
- `api-code-quality`: API 共用模組抽取 + type checking 擴展
- `css-theme-completeness`: CSS 主題 token 完整性修正

### Modified Capabilities
（無既有 spec 層級行為變更）

## Impact

- **API**：新增 `functions/api/_utils.ts`、`_types.ts`，修改所有 API handler import
- **CSS**：`css/shared.css` 主題區塊
- **建置**：`package.json`、新增 `tsconfig.functions.json`
- **測試**：css-hig.test.js 應自動通過（token 補齊不影響現有測試）
