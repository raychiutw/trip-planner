## ADDED Requirements

### Requirement: body.dark 須定義 --card-bg 變數

`body.dark` 中 SHALL 定義 `--card-bg: #292624`，確保所有使用 `var(--card-bg)` 的元素在深色模式下顯示正確的深色底色。

#### Scenario: 深色模式卡片底色正確

- **WHEN** 頁面處於深色模式（`body.dark`）
- **THEN** `#tripContent section`、`footer`、`.sticky-nav`、`.info-panel`、`.info-card` 的 computed background-color SHALL 為 `#292624`

#### Scenario: 漸層遮罩使用正確的深色底色

- **WHEN** 頁面處於深色模式且 nav pills 可捲動
- **THEN** `.dh-nav-wrap::before/after` 的漸層 SHALL 從 `#292624` 開始（而非 `#EDE8E3`）

### Requirement: 刪除與 CSS 變數值重複的 body.dark 覆蓋規則

所有 `body.dark` 覆蓋規則中，若硬編碼值等同於 `body.dark` 已定義的 CSS 變數值，SHALL 刪除該規則。具體需刪除的規則：

**style.css：**
- `body.dark .map-link { color: #D4845E; background: #302A25 }` — 等同 `--blue` + `--blue-light`
- `body.dark .map-link.mapcode { color: var(--sand); background: var(--sand-light) }` — 已用變數
- `body.dark .hotel-sub { background: #302A25 }` — 等同 `--blue-light`
- `body.dark .driving-stats-warning { background: transparent }` — 已是 transparent
- `body.dark .info-card { background: #292624 }` — 等同 `--card-bg`
- `body.dark .ov-card { background: #302A25 }` — 等同 `--blue-light`

**menu.css：**
- `body.dark .sidebar-toggle { color: #E8E5E0 }` — 等同 `--text`
- `body.dark .sidebar-toggle:hover { background: #302A25 }` — 等同 `--blue-light`
- `body.dark .sidebar .menu-item { color: #E8E5E0 }` — 等同 `--text`
- `body.dark .sidebar .menu-item:hover { background: #302A25 }` — 等同 `--blue-light`
- `body.dark .sidebar .sidebar-section-title { color: #9B9590 }` — 等同 `--gray`

**edit.css：**
- `body.dark .edit-issue-item { background: #292624 }` — 等同 `--white`
- `body.dark .edit-issue-title { color: #E8E5E0 }` — 等同 `--text`
- `body.dark .edit-textarea { color: #E8E5E0 }` — 等同 `--text`
- `body.dark .edit-send-btn:not(:disabled) { background: #C4704F; color: #fff }` — 亮色也是同值

#### Scenario: 刪除冗餘規則後深色模式外觀不變

- **WHEN** 刪除上述規則後頁面處於深色模式
- **THEN** 所有受影響元素的 computed style SHALL 與刪除前完全一致

### Requirement: 保留具差異性的 body.dark 覆蓋規則

以下規則的硬編碼值不等於任何現有 CSS 變數，MUST 保留：

- `.hw-block { background: #3D3A37 }` — 刻意比 `--white` 亮
- `.info-box.reservation / .parking / .souvenir / .restaurants` — 深色才加底色
- `.info-header { background: #3D3A37 }` — 強調標題列
- `.menu-drawer { background: #1A1816 }` — 手機 drawer 用頁面底色
- 所有 `:hover` 狀態的覆蓋 — hover 色需獨立控制
- `.sidebar { background: #1A1816 }` — sidebar 用頁面底色
- `.edit-add-btn / .edit-trip-select { background: #3D3A37 }` — 控件色
- `.color-mode-card { background: #292624 }` — 設定頁卡片
- `.trip-warnings / .trip-warning-item` — 警告用 rgba 色
- `.edit-status.success / .error` — 狀態文字色
- `.edit-input-card { box-shadow }` — 深色陰影加深

#### Scenario: 保留的規則清單完整

- **WHEN** 清理完成後檢查各 CSS 檔案的 `body.dark` 區段
- **THEN** 上述列表中的每條規則 SHALL 仍存在於對應的 CSS 檔案中
