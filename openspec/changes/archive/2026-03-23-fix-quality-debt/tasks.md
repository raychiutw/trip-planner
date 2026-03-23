## 1. API 共用模組抽取

- [x] 1.1 新增 `functions/api/_utils.ts`：export `json()` helper
- [x] 1.2 新增 `functions/api/_types.ts`：export `Env`、`AuthData` interface
- [x] 1.3 修改所有 API handler：import json from `_utils.ts`，移除本地定義
- [x] 1.4 修改所有 API handler：import Env/AuthData from `_types.ts`，移除本地定義

## 2. CSS 主題 token 修正

- [x] 2.1 移除 `css/shared.css` theme-sun.dark 中重複的 `--color-badge-*` 宣告
- [x] 2.2 為 5 個 light theme（zen, forest, sakura, night, sky）補上 `--color-badge-open`、`--color-badge-closed`、`--color-plan-bg`、`--color-plan-text`、`--color-plan-hover`

## 3. 建置配置修正

- [x] 3.1 修改 `package.json`：將 `@types/react`、`@types/react-dom`、`typescript` 移到 devDependencies
- [x] 3.2 新增 `tsconfig.functions.json`：extends base，include functions/**/*
- [x] 3.3 在 `package.json` 加入 `"typecheck:functions"` script

## 4. 測試

- [x] 4.1 執行 `npx tsc --noEmit` 確認前端型別無誤
- [x] 4.2 執行 `npx tsc --noEmit -p tsconfig.functions.json` 確認 API 型別無誤（可有預存問題，記錄但不阻擋）
- [x] 4.3 執行 `npm test` 確認所有測試通過
