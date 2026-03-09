# 測試規則

- 僅程式碼 / JSON / MD 行程變更才跑測試；文件變更不需跑
- **commit 前必須測試全過，不得跳過**（pre-commit hook 自動執行）
- 觸發規則：
  - `data/trips-md/**/*.md` → `npm test`
  - `js/app.js` / `js/shared.js` / `js/icons.js` / `css/style.css` / `css/shared.css` / `index.html` → `npm test` + `npm run test:e2e`
  - `js/edit.js` / `css/edit.css` / `edit.html` → `npm test`
  - `setting.html` / `js/setting.js` / `css/setting.css` → `npm test`

## 測試目錄結構

```
tests/
├── unit/
│   ├── css-hig.test.js        ← CSS HIG 12 條規則自動守護
│   ├── edit.test.js           ← edit 頁面相關
│   ├── escape.test.js         ← escHtml, escUrl, stripInlineHandlers
│   ├── load-fallback.test.js  ← 載入降級
│   ├── ls-migration.test.js   ← localStorage 遷移
│   ├── render.test.js         ← 所有 render 函式
│   ├── routing.test.js        ← fileToSlug, slugToFile
│   ├── skeleton.test.js       ← skeleton loading
│   └── validate.test.js       ← validateTripData, validateDay, renderWarnings
├── integration/
│   └── render-pipeline.test.js ← 真實 JSON → render → HTML 驗證
├── json/
│   ├── schema.test.js         ← validateTripData 驗證 + 品質檢查
│   ├── quality.test.js        ← 行程品質規則驗證
│   └── registry.test.js       ← trips.json 檔案參照驗證
└── e2e/
    ├── trip-page.spec.js      ← Trip 頁面真實瀏覽器互動
    ├── edit-page.spec.js      ← Edit 頁面互動
    └── setting-page.spec.js   ← Setting 頁面互動
```

## 實作細節

- `tests/setup.js` 先載入 `js/shared.js` → `js/menu.js` → `js/icons.js`，再載入全域 stub
- `js/app.js` 和 `js/shared.js` 末尾有條件式 `module.exports`（瀏覽器忽略，Node.js/Vitest 可 require）
- E2E 測試 mock Weather API（`page.route`），避免外部網路依賴
- Node.js v22+ 內建 localStorage 與 jsdom 衝突 → `tests/setup.js` 用 in-memory mock 覆蓋

## tp-check 工作流程（必須遵守）

- **修改行程 MD 後，必須執行 `/tp-check` 驗證品質規則**
- `npm test` 只檢查 schema 結構，不檢查語意品質（如 R1 偏好順序、R4 blogUrl 完整性）
- 正確流程：修改 → tp-check → 根據紅燈修正 → 再 tp-check → 全綠才算完成
- tp-check 是唯讀工具，只產出報告不修改檔案
