## 1. SW 驗證 Script

- [x] 1.1 新增 `scripts/verify-sw.js`：build 後驗證 dist/sw.js 內容（6 項檢查）
- [x] 1.2 在 `package.json` 加入 `"verify-sw": "node scripts/verify-sw.js"` script

## 2. GitHub Actions CI Pipeline

- [x] 2.1 新增 `.github/workflows/ci.yml`：PR 觸發 tsc + test + build + verify-sw
- [x] 2.2 確認 .npmrc 的 legacy-peer-deps 在 CI 環境也生效

## 3. 團隊規則更新

- [x] 3.1 更新 `.claude/skills/tp-team/references/workflow.md`：加入 staging 流程（feature branch → PR → CI → merge）
- [x] 3.2 更新 `CLAUDE.md`：加入 CI/CD 流程說明

## 4. 測試

- [x] 4.1 執行 `npm run build && node scripts/verify-sw.js` 確認驗證通過
- [x] 4.2 執行 `npx tsc --noEmit` + `npm test` 確認全過
