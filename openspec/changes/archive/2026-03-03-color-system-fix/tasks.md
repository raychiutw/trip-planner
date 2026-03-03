## 1. shared.css 變數系統擴充

- [x] 1.1 `:root` — `--gray-light` 從 `#FAF9F5` 改為 `#EDEBE8`
- [x] 1.2 `:root` — 新增 `--hover-bg: #EDE8E0`
- [x] 1.3 `:root` — 新增 `--error: #D32F2F`、`--error-bg: #FFEBEE`、`--success: #10B981`
- [x] 1.4 `body.dark` — 新增 `--hover-bg: #3D3A37`、`--error: #FCA5A5`、`--error-bg: rgba(220, 38, 38, 0.12)`、`--success: #6EE7B7`
- [x] 1.5 `body.dark .trip-btn` — 硬寫 `#3D3A37` 改為 `var(--hover-bg)`

## 2. style.css 深色模式硬寫修正

- [x] 2.1 `body.dark .info-header` — 移除 `!important`，`background` 改為 `var(--hover-bg)`、`color` 改為 `var(--text)`
- [x] 2.2 `.info-header` base — 移除 `!important`，改用更高 specificity 或 cascade 順序控制
- [x] 2.3 `body.dark .hw-block` — `#3D3A37` 改為 `var(--hover-bg)`
- [x] 2.4 `body.dark .info-box.reservation/parking/souvenir/restaurants` — 統一改為 `background: var(--blue-light)`
- [x] 2.5 `body.dark .map-link:hover` — `#5A5651` 改為 `var(--hover-bg)`，`color` 改為 `var(--text)`
- [x] 2.6 移除獨立的 `body.dark .map-link:hover` 規則（因 base hover 已改為用變數）

## 3. style.css 淺色模式修正

- [x] 3.1 `.map-link:hover` — `background: #333; color: #fff` 改為 `background: var(--hover-bg); color: var(--text)`
- [x] 3.2 `.map-link.apple:hover` — 同 3.1 方式修正
- [x] 3.3 `.map-link.mapcode:hover` — 同 3.1 方式修正
- [x] 3.4 `.map-link.apple` — `color: #333` 改為 `color: var(--text)`
- [x] 3.5 `.map-link .apple-icon svg` — `fill: #333` 改為 `fill: var(--text)`
- [x] 3.6 `.map-link.apple:hover .apple-icon svg` — `fill: #fff` 改為 `fill: currentColor`
- [x] 3.7 `.hw-update-time` — 移除 `opacity: 0.7`，確認已有 `color: var(--gray)`
- [x] 3.8 `.countdown-date` — 移除 `opacity: 0.7`，確認已有 `color: var(--gray)`

## 4. style.css 語意色替換

- [x] 4.1 `.trip-warnings` — `background: #FFEBEE` 改為 `var(--error-bg)`、`color: #D32F2F` 改為 `var(--error)`
- [x] 4.2 `.trip-warning-item` — `background: #FEE2E2` 改為 `var(--error-bg)`
- [x] 4.3 `.trip-error` — `color: #D32F2F` 改為 `var(--error)`
- [x] 4.4 `.driving-stats-badge` — `background: #DC2626` 改為 `var(--error)`
- [x] 4.5 移除 `body.dark .trip-warning-item` 和 `body.dark .trip-warnings` 的獨立深色覆蓋（因 base 已用變數）

## 5. style.css 共用修正

- [x] 5.1 `.tl-event::before` — `border: 2px solid var(--white)` 改為 `var(--card-bg)`
- [x] 5.2 `.sheet-handle` — `background: var(--gray-light, #FAF9F7)` 改為 `var(--border)`
- [x] 5.3 `.sticky-nav` — 加 `margin-bottom: 12px` 與 Day 1 間隔
- [x] 5.4 `.info-header` base — 調整 specificity，確保不用 `!important` 也能正確覆蓋

## 6. menu.css 修正

- [x] 6.1 `.sidebar` — `border-right: 1px solid var(--gray-light)` 改為 `var(--border)`
- [x] 6.2 `.menu-drawer` — `background: var(--gray-light)` 改為 `var(--card-bg)`
- [x] 6.3 `body.dark .sidebar` — `background: var(--bg)` 改為 `var(--card-bg)`，移除 `border-right-color` 覆蓋（因 base 已用 --border）
- [x] 6.4 `body.dark .menu-drawer` — `background: var(--bg)` 改為 `var(--card-bg)`

## 7. edit.css 修正

- [x] 7.1 `.edit-input-card` — `background: #FFFFFF` 改為 `var(--white)`
- [x] 7.2 `body.dark .edit-send-btn` — 改為 `body.dark .edit-send-btn:disabled`（修正 enabled 狀態無橘色 bug）
- [x] 7.3 `.edit-status.success` — `color: #065F46` 改為 `var(--success)`
- [x] 7.4 `.edit-status.error` — `color: #991B1B` 改為 `var(--error)`
- [x] 7.5 `body.dark .edit-status.success` — 移除（因 base 已用變數）
- [x] 7.6 `body.dark .edit-status.error` — 移除（因 base 已用變數）
- [x] 7.7 `.status-dot.open` — `background: #10B981` 改為 `var(--success)`

## 8. setting.css 修正

- [x] 8.1 `.color-mode-preview` — `border: 1px solid rgba(0,0,0,0.08)` 改為 `1px solid var(--border)`
- [x] 8.2 移除 `body.dark .map-link.apple` 獨立色碼覆蓋（因 base 已用 --text 變數）

## 9. 深色模式獨立覆蓋清理

- [x] 9.1 移除 `body.dark .map-link.apple { color: #9B9590 }`（base 改用 `var(--text)` 後自動適配）
- [x] 9.2 移除 `body.dark .map-link.apple .apple-icon svg { fill: #9B9590 }`（同上）
- [x] 9.3 移除 `body.dark .sg-priority-high/medium/low` 獨立覆蓋（base 用 rgba 已適用兩模式）

## 10. 測試驗證

- [x] 10.1 搜索所有測試檔案中的舊色碼（`#FFEBEE`、`#D32F2F`、`#FEE2E2`、`#10B981`、`#065F46`、`#991B1B`、`#333`、`#FFFFFF`、`#3D3A37`、`#5A5651`、`#302A22`、`#302A25`），更新為新值
- [x] 10.2 執行 `npm test` 確認 unit/integration 測試全過
- [x] 10.3 執行 `npm run test:e2e` 確認 E2E 測試全過
