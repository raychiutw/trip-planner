# Spec: collapsed-sidebar-width

收合狀態 sidebar 寬度修正，確保 icon 在捲動條可見時不被裁切。

## 變數定義

```css
/* css/shared.css */
--sidebar-w-collapsed: 64px;   /* 原值 56px */
```

## 尺寸計算依據

| 元素 | 尺寸 |
|------|------|
| `.item-icon`（icon 容器） | `24px × 24px` |
| `.sidebar .menu-item` 左右 padding | `10px 12px`（展開時），收合時 icon 置中 |
| 捲動條寬度（自訂） | 6px（`css/shared.css` `::-webkit-scrollbar { width: 6px }`） |
| 最小安全寬度 | 24px（icon）+ 6px（scrollbar）+ 2 × 8px（視覺邊距）= 46px |
| 新寬度 64px | icon(24) + scrollbar(6) + 左右各 17px 空間，充足 |

## sidebar-header padding（收合時）

```css
/* css/menu.css */
.sidebar.collapsed .sidebar-header { justify-content: center; padding: 8px 4px; }
```

原值 `padding: 8px` 在 64px 寬度下 toggle 按鈕（32px）左右各 16px，視覺上偏左側（因 justify-content: center 起點不同）。改為 `8px 4px` 配合 `justify-content: center` 在新寬度達成視覺置中。

## 捲動條可見性

`.sidebar-nav` 已有 `overflow-y: auto`，在內容高度超過 sidebar 時自動顯示捲動條。64px 寬度可容納捲動條（6px）而不裁切 icon（24px）。

## 邊界條件

- 收合寬度只在 `@media (min-width: 768px)` 內生效（`.sidebar.collapsed` 規則在該媒體查詢區塊內）
- 展開寬度 `--sidebar-w: 260px` 不受影響
- sidebar 動畫由 `transition: width var(--sidebar-transition)` 自動套用新寬度，無需額外修改
