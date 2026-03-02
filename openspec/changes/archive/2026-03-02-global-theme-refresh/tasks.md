## 1. 更新 shared.css — CSS 變數基礎

- [x] 1.1 在 `css/shared.css` 的 `:root` 中新增 `--fs-display: 2.5rem` 與 `--fs-sm: 0.875rem`，將 `--fs-md` 從 `1.15rem` 更新為 `1.125rem`
- [x] 1.2 在 `css/shared.css` 的 `:root` 中新增色彩變數：`--bg: #FFFFFF`、`--bubble-bg: #F0EDE8`、`--text: #1A1A1A`、`--text-muted: #6B6B6B`、`--border: #E5E0DA`
- [x] 1.3 在 `css/shared.css` 的 `:root` 中新增 `--accent: #8B8580`，並更新 `--card-bg` 為 `#F5F0E8`，新增 `--blue: var(--accent)` 別名
- [x] 1.4 在 `css/shared.css` 的 `body.dark` 區塊中新增／更新 dark mode 色彩變數：`--bg: #1A1A1A`、`--card-bg: #2B2B2B`、`--bubble-bg: #3D3A35`、`--text: #E8E8E8`、`--text-muted: #9B9B9B`、`--border: #3A3A3A`
- [x] 1.5 將 `css/shared.css` 的 `body` 預設 `font-size` 更新為 `var(--fs-md)`

## 2. 替換 style.css 硬編碼 font-size

- [x] 2.1 搜尋 `css/style.css` 中所有 `font-size` 宣告，將 `1.4rem`、`1.25rem`、`1.2rem` 替換為 `var(--fs-lg)`
- [x] 2.2 搜尋 `css/style.css` 中所有 `font-size` 宣告，將 `1.15rem`、`1rem`、`0.9rem`、`0.9em` 替換為 `var(--fs-md)`
- [x] 2.3 搜尋 `css/style.css` 中所有 `font-size` 宣告，將 `0.85rem`、`0.85em`、`0.82rem`、`0.8em`、`0.75rem` 替換為 `var(--fs-sm)`

## 3. 替換 menu.css 硬編碼 font-size

- [x] 3.1 搜尋 `css/menu.css` 中所有 `font-size` 宣告，將 `0.75rem` 替換為 `var(--fs-sm)`
- [x] 3.2 搜尋 `css/menu.css` 中所有 `font-size` 宣告，將 `1rem`、`0.9rem`、`0.9em` 替換為 `var(--fs-md)`

## 4. 替換 edit.css 硬編碼 font-size

- [x] 4.1 搜尋 `css/edit.css` 中所有 `font-size` 宣告，將 `1.4rem`、`1.25rem`、`1.2rem` 替換為 `var(--fs-lg)`
- [x] 4.2 搜尋 `css/edit.css` 中所有 `font-size` 宣告，將 `1rem`、`0.9rem`、`0.9em` 替換為 `var(--fs-md)`
- [x] 4.3 搜尋 `css/edit.css` 中所有 `font-size` 宣告，將 `0.85rem`、`0.85em`、`0.82rem`、`0.8em`、`0.75rem` 替換為 `var(--fs-sm)`

## 5. 替換 setting.css 硬編碼 font-size

- [x] 5.1 搜尋 `css/setting.css` 中所有 `font-size` 宣告，將 `0.85rem`、`0.82rem` 替換為 `var(--fs-sm)`
- [x] 5.2 搜尋 `css/setting.css` 中所有 `font-size` 宣告，將 `1rem`、`0.9rem` 替換為 `var(--fs-md)`

## 6. 更新 style.css 配色引用

- [x] 6.1 將 `css/style.css` 中所有硬編碼色彩值（`#C4704F` 等）改為引用對應 CSS variable
- [x] 6.2 確認 `.day-header` 背景色引用 `var(--accent)`、文字色引用 `var(--bg)`
- [x] 6.3 確認 `body`、`section`、`.info-card`、`footer`、`.sidebar`、`.info-panel`、`.sticky-nav` 引用 `var(--bg)` 或 `var(--card-bg)`
- [x] 6.4 確認 `:focus-visible` 的 `box-shadow` 引用 `var(--accent)` 而非硬編碼色值

## 7. 更新 menu.css dark mode 配色

- [x] 7.1 確認 `css/menu.css` 中 dark mode 相關選擇器的背景色、文字色、邊線色均引用 shared.css 中的 CSS variables
- [x] 7.2 確認 `css/menu.css` 中無殘留硬編碼顏色值（`#C4704F`、`#EDE8E3` 等舊色值）

## 8. 更新 edit.css 配色

- [x] 8.1 確認 `css/edit.css` 中的使用者氣泡（`.user-bubble` 或等效選擇器）背景色引用 `var(--bubble-bg)`
- [x] 8.2 確認 `css/edit.css` 中的其他配色引用均改為 CSS variables，移除硬編碼色值

## 9. 更新 setting.css 配色

- [x] 9.1 確認 `css/setting.css` 中的配色引用均改為 CSS variables，移除硬編碼色值
- [x] 9.2 確認 `css/setting.css` dark mode 覆蓋區塊使用 `body.dark` 選擇器且引用正確 variables

## 10. 驗證與收尾

- [x] 10.1 執行 `npm test` 確認所有 unit test 通過
- [x] 10.2 手動目視確認三頁（index.html、edit.html、setting.html）在 light mode 與 dark mode 下配色與字型正常
- [x] 10.3 確認 `css/style.css`、`css/menu.css`、`css/edit.css`、`css/setting.css` 中不存在 `font-size` 硬編碼 rem/em/px 值（`10px`、`8px` icon 細節除外）
- [x] 10.4 確認 `--blue` 別名保留於 `:root`（TODO：後續 clean-up change 中移除別名並全面替換為 `--accent`）
