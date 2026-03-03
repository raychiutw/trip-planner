## 1. 更新 shared.css — CSS 變數與桌機 font-size

- [x] 1.1 在 `css/shared.css` 的 `:root` 中將 `--white` 從 `#FFFFFF` 改為 `#FAF9F5`
- [x] 1.2 在 `css/shared.css` 的 `:root` 中將 `--bg` 從 `#FFFFFF` 改為 `#FAF9F5`
- [x] 1.3 在 `css/shared.css` 的 `:root` 中將 `--gray-light` 從 `#FAF9F7` 改為 `#FAF9F5`
- [x] 1.4 在 `css/shared.css` 的 `:root` 中將 `--accent` 從 `#8B8580` 改為 `#C4956A`
- [x] 1.5 確認 `css/shared.css` 的 `body.dark` 區塊中 `--accent: #C4845E` 維持不變（不得修改）
- [x] 1.6 在 `css/shared.css` 末尾新增 `@media (min-width: 768px)` 區塊，在 `:root` 中覆蓋：`--fs-display: 2rem; --fs-lg: 1.125rem; --fs-md: 1rem; --fs-sm: 0.8125rem;`

## 2. 更新 style.css — Day header light mode 覆蓋

- [x] 2.1 在 `css/style.css` 的 `.day-header` 基底規則之後，新增以下 light mode 覆蓋規則：
  ```css
  body:not(.dark) .day-header {
      background: var(--card-bg);
      color: var(--text);
  }
  ```
- [x] 2.2 確認 `.day-header` 基底規則（`background: var(--blue); color: var(--white);`）維持不變，不得刪除或修改

## 3. 更新 style.css — Suggestion 優先度色彩

- [x] 3.1 將 `css/style.css` 中 `.sg-priority-high` 的亮色背景 opacity 從 `0.08` 改為 `0.15`：`background: rgba(239, 68, 68, 0.15);`
- [x] 3.2 將 `css/style.css` 中 `.sg-priority-medium` 的亮色背景 opacity 從 `0.08` 改為 `0.15`：`background: rgba(234, 179, 8, 0.15);`
- [x] 3.3 在 `css/style.css` 中新增 `.sg-priority-low` 亮色背景規則：`background: rgba(34, 197, 94, 0.10); border-radius: 6px; padding: 8px 10px;`
- [x] 3.4 將 `css/style.css` 中 `.sg-priority-low h4::before` 的 `background` 從 `#F97316` 改為 `#22C55E`
- [x] 3.5 在 `css/style.css` 的 `body.dark` 段落新增深色 low 背景覆蓋：`body.dark .sg-priority-low { background: rgba(34, 197, 94, 0.15); }`
- [x] 3.6 確認 `body.dark .sg-priority-high` 與 `body.dark .sg-priority-medium` 深色背景值（`0.12` opacity）維持不變

## 4. 確認 edit.css — Send 按鈕規則

- [x] 4.1 確認 `css/edit.css` 中 `.edit-send-btn:not(:disabled)` 的背景色引用 `var(--accent, var(--blue))`（不需修改，accent 值由 shared.css 繼承）
- [x] 4.2 確認 `css/edit.css` 中 `.edit-send-btn`（disabled 狀態基底）的背景色為 `var(--border, var(--gray-light))`，文字色為 `var(--text-muted, var(--gray))`
- [x] 4.3 確認 `body.dark .edit-send-btn` 覆蓋維持 `background: #3D3A37; color: #9B9590;`，不受 light mode accent 變更影響

## 5. 驗證與收尾

- [x] 5.1 執行 `npm test` 確認所有 unit test 通過（純 CSS 變更，預期不影響測試結果）
- [ ] 5.2 手動目視確認 `index.html` 在 light mode 下：day-header 顯示暖米色底色（`#F5F0E8`）而非舊有暖灰色
- [ ] 5.3 手動目視確認 `index.html` 在 dark mode 下：day-header 仍顯示橘色（`#C4845E`），未受影響
- [ ] 5.4 手動目視確認 `index.html` 在 light mode 下：suggestion 卡片 high/medium 背景色比修改前更明顯；low 優先度卡片顯示淡綠色背景，圓點為綠色
- [ ] 5.5 手動目視確認 `edit.html` 在 light mode 下：send 按鈕 enabled 狀態顯示 `#C4956A` 橘色
- [ ] 5.6 手動目視確認三頁在桌機（≥768px）下整體文字密度比修改前更精緻（字型略小一級）
- [ ] 5.7 確認 `css/shared.css` 的 `body.dark` 區塊中所有 dark mode 色彩值均未被修改
