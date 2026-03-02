# Spec: desktop-layout

桌機版佈局修正。

## 三欄填滿

- `≥1200px` media query：`#tripContent` 的 `max-width` 改為 `none`
- `.page-layout` 加 `gap: 12px` 三欄等間距
- 三欄結構：sidebar (260px) + content (flex:1) + info-panel (280px)

## 漢堡選單修復

**問題**：sidebar collapsed 時，桌機縮小視窗寬度，漢堡選單不可按

**解法**：sidebar `.collapsed` 狀態時，在 `.sticky-nav` 內顯示 `.dh-menu` 按鈕

```css
/* menu.css */
.sidebar.collapsed ~ .container .dh-menu {
    display: flex;
}
```
