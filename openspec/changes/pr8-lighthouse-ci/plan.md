# Plan: pr8-lighthouse-ci

## 執行順序

```
F001: lighthouserc.json（config 優先，後續都依賴它）
  ↓
F002: .github/workflows/lighthouse.yml（workflow 引用 config）
  ↓
F003: docs/lighthouse-ci.md + TODOS.md（純文件，最後補）
```

## F001 詳細步驟

1. 建 `tests/unit/lighthouse-config.test.ts`（紅）
2. 跑 `npm test`，確認測試失敗（因 lighthouserc.json 不存在）
3. 建 `lighthouserc.json`（綠）
4. 跑 `npm test`，確認 F001 測試全綠
5. commit: `test(lighthouse): F001 red — lighthouserc.json 測試`
6. commit: `feat(ci): F001 green — 加 lighthouserc.json`

## F002 詳細步驟

1. 建 `tests/unit/lighthouse-workflow.test.ts`（紅）
2. 跑 `npm test`，確認測試失敗（因 lighthouse.yml 不存在）
3. 建 `.github/workflows/lighthouse.yml`（綠）
4. 跑 `npm test`，確認 F002 測試全綠
5. commit: `test(lighthouse): F002 red — workflow YAML 測試`
6. commit: `feat(ci): F002 green — 加 Lighthouse CI workflow`

## F003 詳細步驟

1. 建 `docs/lighthouse-ci.md`（純文件，豁免 TDD）
2. 更新 `TODOS.md` 加 blocking gate roadmap
3. commit: `docs(lighthouse): F003 — Lighthouse CI 說明 + TODOS roadmap`

## Commit 拆分策略

| Commit | 內容 |
|--------|------|
| `docs(openspec): propose pr8-lighthouse-ci` | 5 個 OpenSpec 檔案 |
| `test(lighthouse): F001 red — lighthouserc.json 測試` | lighthouse-config.test.ts |
| `feat(ci): F001 green — 加 lighthouserc.json` | lighthouserc.json |
| `test(lighthouse): F002 red — workflow YAML 測試` | lighthouse-workflow.test.ts |
| `feat(ci): F002 green — 加 Lighthouse CI workflow` | lighthouse.yml |
| `docs(lighthouse): F003 — Lighthouse CI 說明 + TODOS roadmap` | docs/ + TODOS.md |

## 風險

| 風險 | 緩解 |
|------|------|
| `{BASE_URL}` 替換機制在 lhci 不支援 | 直接硬寫 URL，design.md 已說明 |
| treosh/lighthouse-ci-action@v12 API 變更 | 測試只驗 action 名稱字串，不驗參數細節 |
| Workflow 在本 PR merge 前不會真正執行 | 預期行為，已在 prompt 說明 |
