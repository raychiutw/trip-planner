## 1. StickyNav 毛玻璃強化

- [x] 1.1 修改 `css/shared.css` `.sticky-nav`：背景不透明度從 ~92% 降至 ~72%，blur 從 20px 提升至 24px，saturate 從 180% 提升至 200%

## 2. Sheet Panel 毛玻璃

- [x] 2.1 修改 `css/style.css` `.info-sheet-panel`：加入 backdrop-filter blur + 降低背景不透明度
- [x] 2.2 修改 `css/style.css` `.quick-panel-sheet`：同上

## 3. 測試

- [x] 3.1 執行 `npx tsc --noEmit` + `npm test` 確認全過
