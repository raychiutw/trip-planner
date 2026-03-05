## Tasks: design-token-cleanup

### Group 1：Token 定義

在 `css/shared.css` 的 `:root` 新增新 token 變數定義，並在 `body.dark` 補上深色模式覆蓋值。

- [ ] 1.1 在 `:root` 新增 `--accent-light: #F5EDE8`
- [ ] 1.2 在 `:root` 新增 `--accent-muted: #F5EDE0`
- [ ] 1.3 在 `body.dark` 新增 `--accent-light: #302A25`
- [ ] 1.4 在 `body.dark` 新增 `--accent-muted: #302A22`
- [ ] 1.5 在 `:root` 新增 `--shadow-sm: 0 1px 4px rgba(0,0,0,0.06)`
- [ ] 1.6 在 `:root` 新增 `--shadow-md: 0 4px 12px rgba(0,0,0,0.12)`
- [ ] 1.7 在 `:root` 新增 `--shadow-lg: 0 6px 16px rgba(0,0,0,0.2)`
- [ ] 1.8 在 `:root` 新增 `--shadow-ring: 0 0 0 2px var(--accent)`
- [ ] 1.9 在 `:root` 新增 `--radius-sm: 8px`
- [ ] 1.10 在 `:root` 新增 `--radius-md: 12px`
- [ ] 1.11 在 `:root` 新增 `--radius-full: 99px`
- [ ] 1.12 在 `:root` 新增 `--priority-high-bg: rgba(239, 68, 68, 0.15)` 與 `--priority-high-dot: #EF4444`
- [ ] 1.13 在 `:root` 新增 `--priority-medium-bg: rgba(234, 179, 8, 0.15)` 與 `--priority-medium-dot: #EAB308`
- [ ] 1.14 在 `:root` 新增 `--priority-low-bg: rgba(34, 197, 94, 0.10)` 與 `--priority-low-dot: #22C55E`
- [ ] 1.15 在 `body.dark` 新增 priority 深色覆蓋：`--priority-high-bg: rgba(239, 68, 68, 0.22)`、`--priority-high-dot: #FCA5A5`
- [ ] 1.16 在 `body.dark` 新增 priority 深色覆蓋：`--priority-medium-bg: rgba(234, 179, 8, 0.22)`、`--priority-medium-dot: #FDE047`
- [ ] 1.17 在 `body.dark` 新增 priority 深色覆蓋：`--priority-low-bg: rgba(34, 197, 94, 0.15)`、`--priority-low-dot: #86EFAC`

---

### Group 2：變數重命名

從 `css/shared.css` 刪除舊別名定義，並在全部 CSS 檔案中以新變數名稱取代舊引用。

- [ ] 2.1 從 `:root` 刪除 `--blue: var(--accent)` 宣告
- [ ] 2.2 從 `:root` 刪除 `--blue-light: #F5EDE8` 宣告（已由 `--accent-light` 取代）
- [ ] 2.3 從 `:root` 刪除 `--sand: #C4704F` 宣告
- [ ] 2.4 從 `:root` 刪除 `--sand-light: #F5EDE0` 宣告（已由 `--accent-muted` 取代）
- [ ] 2.5 從 `body.dark` 刪除 `--blue`、`--blue-light`、`--sand`、`--sand-light` 宣告
- [ ] 2.6 在 `css/shared.css` 中將所有 `var(--blue)` 取代為 `var(--accent)`
- [ ] 2.7 在 `css/style.css` 中將所有 `var(--blue)` 取代為 `var(--accent)`
- [ ] 2.8 在 `css/style.css` 中將所有 `var(--blue-light)` 取代為 `var(--accent-light)`
- [ ] 2.9 在 `css/style.css` 中將所有 `var(--sand)` 取代為 `var(--accent)`
- [ ] 2.10 在 `css/style.css` 中將所有 `var(--sand-light)` 取代為 `var(--accent-muted)`
- [ ] 2.11 在 `css/menu.css` 中將所有 `var(--blue)` 取代為 `var(--accent)`、`var(--blue-light)` 取代為 `var(--accent-light)`
- [ ] 2.12 更新 `.print-mode` 與 `@media print` 區塊中的變數宣告（`--blue` → `--accent`、`--blue-light` → `--accent-light` 等）

---

### Group 3：Info Box 深色修復

簡化 `css/style.css` 中 dark mode info-box 的選擇器寫法，同時補上缺漏的型別。

- [ ] 3.1 刪除 `css/style.css` 中逐一列舉型別的深色選擇器：
  ```css
  body.dark .info-box.reservation,
  body.dark .info-box.parking,
  body.dark .info-box.souvenir,
  body.dark .info-box.restaurants { background: var(--blue-light); }
  ```
- [ ] 3.2 以以下單一選擇器取代（使用重命名後的變數）：
  ```css
  body.dark .info-box { background: var(--accent-light); }
  ```

---

### Group 4：Shadow 替換

在各 CSS 檔案中將硬寫的 `box-shadow` 數值替換為對應的 token 變數。

- [ ] 4.1 `css/shared.css`：將 `focus-visible` 的 `0 0 0 2px var(--blue)` 替換為 `var(--shadow-ring)`
- [ ] 4.2 `css/style.css`：將 `.edit-fab` 的 `0 4px 12px rgba(0,0,0,0.2)` 替換為 `var(--shadow-md)`
- [ ] 4.3 `css/style.css`：將 `.edit-fab:hover` 的 `0 6px 16px rgba(0,0,0,0.3)` 替換為 `var(--shadow-lg)`
- [ ] 4.4 `css/style.css`：將 `.hw-block.hw-now` 的 `0 0 0 2px var(--blue)` 替換為 `var(--shadow-ring)`
- [ ] 4.5 `css/style.css`：將 `.info-fab` 的 `0 4px 12px rgba(0,0,0,0.2)` 替換為 `var(--shadow-md)`
- [ ] 4.6 `css/edit.css`：將 `.message-system` 的 `0 1px 4px rgba(0,0,0,0.06)` 替換為 `var(--shadow-sm)`
- [ ] 4.7 `css/edit.css`：將 `.edit-input-card` 的 `0 2px 12px rgba(0,0,0,0.07)` 替換為 `var(--shadow-md)`
- [ ] 4.8 `css/edit.css`：將 `body.dark .edit-input-card` 的 `0 2px 12px rgba(0,0,0,0.25)` 替換為 `var(--shadow-md)`
- [ ] 4.9 `css/edit.css`：將 `body.dark .message-system` 的 `0 1px 4px rgba(0,0,0,0.2)` 替換為 `var(--shadow-sm)`

---

### Group 5：Radius 替換

在各 CSS 檔案中將硬寫的 `border-radius` 數值替換為對應的 token 變數。

- [ ] 5.1 `css/style.css`：將 `#tripContent section` 的 `border-radius: 12px` 替換為 `var(--radius-md)`
- [ ] 5.2 `css/style.css`：將 `.day-header` 的 `border-radius: 12px 12px 0 0` 保持不動（非對稱形狀，不 token 化）
- [ ] 5.3 `css/style.css`：將 `footer`、`.sticky-nav`、`.info-card` 的 `border-radius: 12px` 替換為 `var(--radius-md)`
- [ ] 5.4 `css/style.css`：將 `.ov-card` 的 `border-radius: 10px` 替換為 `var(--radius-sm)`
- [ ] 5.5 `css/style.css`：將 `.dn` 的 `border-radius: 12px` 替換為 `var(--radius-md)`
- [ ] 5.6 `css/style.css`：將 `.hw-block` 的 `border-radius: 10px` 替換為 `var(--radius-sm)`
- [ ] 5.7 `css/style.css`：將 `.info-box` 的 `border-radius: 8px` 替換為 `var(--radius-sm)`
- [ ] 5.8 `css/style.css`：將 `.status-tag` 的 `border-radius: 8px` 替換為 `var(--radius-sm)`
- [ ] 5.9 `css/style.css`：將 `.tl-head`、`.hotel-sub`、`.hw-error` 的 `border-radius: 8px` 替換為 `var(--radius-sm)`
- [ ] 5.10 `css/style.css`：將 `.trip-warnings`、`.trip-warning-item` 的 `border-radius: 6px` 替換為 `var(--radius-sm)`
- [ ] 5.11 `css/style.css`：將 `.map-link` 的 `border-radius: 6px` 替換為 `var(--radius-sm)`
- [ ] 5.12 `css/style.css`：將 `.flight-row` 的 `border-radius: 12px` 替換為 `var(--radius-md)`
- [ ] 5.13 `css/style.css`：將 `.hl-tag` 的 `border-radius: 99px` 替換為 `var(--radius-full)`
- [ ] 5.14 `css/shared.css`：將 `.trip-btn` 的 `border-radius: 10px` 替換為 `var(--radius-sm)`
- [ ] 5.15 `css/edit.css`：將 `.message-system` 的 `border-radius: 12px` 替換為 `var(--radius-md)`
- [ ] 5.16 `css/setting.css`：將 `.color-mode-card` 的 `border-radius: 12px` 替換為 `var(--radius-md)`

---

### Group 6：Priority 色彩替換

在 `css/style.css` 中將 `.sg-priority-*` 的硬寫色碼替換為 token 變數。

- [ ] 6.1 將 `.sg-priority-high` 的 `background: rgba(239, 68, 68, 0.15)` 替換為 `background: var(--priority-high-bg)`
- [ ] 6.2 將 `.sg-priority-medium` 的 `background: rgba(234, 179, 8, 0.15)` 替換為 `background: var(--priority-medium-bg)`
- [ ] 6.3 將 `.sg-priority-low` 的 `background: rgba(34, 197, 94, 0.10)` 替換為 `background: var(--priority-low-bg)`
- [ ] 6.4 將 `.sg-priority-high h4::before` 的 `background: #EF4444` 替換為 `background: var(--priority-high-dot)`
- [ ] 6.5 將 `.sg-priority-medium h4::before` 的 `background: #EAB308` 替換為 `background: var(--priority-medium-dot)`
- [ ] 6.6 將 `.sg-priority-low h4::before` 的 `background: #22C55E` 替換為 `background: var(--priority-low-dot)`

---

### Group 7：驗證

CSS 純視覺變更，無自動化測試，以人工比對確認。

- [ ] 7.1 Light mode：逐一確認首頁、設定頁、編輯頁的所有元件視覺與變更前完全一致
- [ ] 7.2 Dark mode：切換深色模式後，確認以下元件外觀正確：nav pill（`.dn`）、timeline dot、info-box 各型別（含 `.shopping`、`.gas-station`）、FAB 按鈕陰影、建議卡片三種優先度
- [ ] 7.3 Focus ring：用鍵盤 Tab 瀏覽，確認 `.sidebar-toggle`、`.dh-menu`、`.dn` 等元件的 focus ring（`--shadow-ring`）顯示正常
- [ ] 7.4 靜態分析：搜尋全站 CSS，確認不再出現 `var(--blue)`、`var(--blue-light)`、`var(--sand)`、`var(--sand-light)` 字串（print mode 區塊亦同）
- [ ] 7.5 靜態分析：確認已 token 化的 box-shadow 硬寫值不再出現於 `css/style.css`、`css/edit.css`
