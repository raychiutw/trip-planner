## 1. 全站 Accent 色碼更新

- [x] 1.1 `shared.css` `:root` — 將 `--accent: #C4956A` 改為 `#C4704F`，`--sand: #C4956A` 改為 `#C4704F`
- [x] 1.2 `shared.css` `body.dark` — 將 `--accent: #C4845E` 改為 `#D4845E`，`--sand: #D4A373` 改為 `#D4A070`
- [x] 1.3 `style.css` `.print-mode` — 將硬寫 `--sand: #C4956A` 改為 `#C4704F`
- [x] 1.4 `style.css` `@media print body` — 將硬寫 `--sand: #C4956A` 改為 `#C4704F`
- [x] 1.5 `style.css` `body.dark .info-fab` — 移除 fallback `#C4704F`（因 `--accent` 本身已是 `#C4704F` 系列）

## 2. 送出按鈕圖示更換

- [x] 2.1 `edit.js` — 將 `#submitBtn` 內的紙飛機 SVG path 替換為 filled 向上箭頭 SVG

## 3. 測試驗證

- [x] 3.1 搜索所有測試檔案中的舊色碼（`#C4956A`、`#C4845E`、`#D4A373`），更新為新色碼（無匹配，無需更新）
- [x] 3.2 執行 `npm test` 確認 unit/integration 測試全過
- [x] 3.3 執行 `npm run test:e2e` 確認 E2E 測試全過
