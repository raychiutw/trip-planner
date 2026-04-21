# Tasks: pr8-lighthouse-ci

TDD 順序：紅（測試） → 綠（實作） → 重構

## F001 — `lighthouserc.json`

### F001-T1 紅：lighthouse-config.test.ts 失敗測試
- 建 `tests/unit/lighthouse-config.test.ts`
- 讀 `lighthouserc.json`，assert 可被 JSON.parse 解析
- assert `ci.collect.numberOfRuns >= 3`
- assert `ci.collect.url` 長度 === 3（含 root / trip / stop）
- assert `ci.assert.assertions` 含 `largest-contentful-paint`
- assert `ci.assert.assertions` 含 `total-blocking-time`
- assert `ci.assert.assertions` 含 `cumulative-layout-shift`
- 跑測試，確認因「檔案不存在」失敗

### F001-T2 綠：建立 `lighthouserc.json`
- 位置：根目錄 `lighthouserc.json`
- 內容含 3 個 URL（使用 `{BASE_URL}` template）、numberOfRuns: 3、4 項 assertion（全部 warn）
- upload target: `temporary-public-storage`
- 跑 F001 測試，確認全綠

### F001-T3 重構
- 確認 JSON 格式一致（縮排 2 空格）
- 確認 assertion 閾值與 proposal.md 一致

---

## F002 — `.github/workflows/lighthouse.yml`

### F002-T1 紅：lighthouse-workflow.test.ts 失敗測試
- 建 `tests/unit/lighthouse-workflow.test.ts`
- 讀 `.github/workflows/lighthouse.yml`，assert 檔案存在
- assert 含 `treosh/lighthouse-ci-action`
- assert `on.push.branches` 含 `master`
- assert 含 `configPath: './lighthouserc.json'`
- 跑測試，確認因「檔案不存在」失敗

### F002-T2 綠：建立 `.github/workflows/lighthouse.yml`
- trigger: `push: branches: [master]` + `workflow_dispatch`
- 對象：production URL `https://trip-planner-dby.pages.dev`
- 步驟：checkout → setup-node@v4 → npm ci → sleep 30 → treosh/lighthouse-ci-action@v12
- uploadArtifacts: true
- env: `BASE_URL` 傳給 lighthouserc.json
- 跑 F002 測試，確認全綠

### F002-T3 重構
- 確認 YAML 縮排一致（2 空格）
- 確認 step 命名清晰（繁中或英文皆可）

---

## F003 — `docs/lighthouse-ci.md` + `TODOS.md`

### F003-T1（豁免 TDD — 純文件）
- 建 `docs/lighthouse-ci.md`，說明：perf budget 原則、如何看 report、未來 roadmap
- 更新 `TODOS.md` — 加「Lighthouse blocking gate（2 週 baseline 後）」段落
