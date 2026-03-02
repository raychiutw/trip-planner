## MODIFIED Requirements

### Requirement: CSS 變數

淺色模式中所有引用品牌主色的地方 SHALL 使用 `var(--blue)` 而非硬編碼 `#C4704F`。

#### 原有內容保持不變

| 變數 | 值 | 用途 |
|------|-----|------|
| `--card-bg` | `#EDE8E3` | 卡片 / sidebar / info-panel 背景 |
| `--white` | `#FFFFFF` | 頁面背景（body） |
| `--blue` | `#C4704F` | Day header 背景、focus 高亮 |

#### 新增規範

亮色模式中所有引用品牌主色的地方 SHALL 使用 `var(--blue)` 而非硬編碼 `#C4704F`。需修改的位置：

| 檔案 | 選擇器 | 屬性 | 舊值 | 新值 |
|------|--------|------|------|------|
| menu.css | `.menu-item-current` | `color` | `#C4704F` | `var(--blue)` |
| edit.css | `.edit-spark` | `color` | `#C4704F` | `var(--blue)` |
| edit.css | `.edit-send-btn:not(:disabled)` | `background` | `#C4704F` | `var(--blue)` |
| setting.css | `.trip-btn.active` | `border-left-color` | `#C4704F` | `var(--blue)` |
| setting.css | `.trip-btn.active` | `box-shadow` | `#C4704F` | `var(--blue)` |
| setting.css | `.color-mode-card.active` | `border-color` | `#C4704F` | `var(--blue)` |
| setting.css | `.color-mode-card.active` | `box-shadow` | `#C4704F` | `var(--blue)` |

改為變數後，對應的 `body.dark` 覆蓋規則（使用 `#D4845E` 的）SHALL 刪除，因為 `body.dark` 已將 `--blue` 設為 `#D4845E`。

需刪除的 dark 覆蓋規則：
- menu.css: `body.dark .menu-item-current { color: #D4845E }`
- setting.css: `body.dark .color-mode-card.active { border-color: #D4845E; box-shadow: ... }`
- setting.css: `body.dark .setting-trip-list .trip-btn.active { border-left-color: #D4845E; box-shadow: ... }`

#### Scenario: 亮色模式外觀不變

- **WHEN** 頁面處於亮色模式
- **THEN** 所有上述元素的 computed color/background/border-color SHALL 仍為 `#C4704F`（因 `--blue` 在亮色模式即為 `#C4704F`）

#### Scenario: 深色模式自動套用 --blue 值

- **WHEN** 頁面切換至深色模式
- **THEN** 上述元素 SHALL 自動使用 `#D4845E`（`body.dark` 的 `--blue` 值），無需額外覆蓋規則
