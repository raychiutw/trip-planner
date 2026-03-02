## 1. sticky-nav 置頂無間距

- [x] 1.1 修改 css/style.css 的 .sticky-nav 覆寫：top: 12px → 0，margin: 12px 0 → 0
- [x] 1.2 修改 css/style.css 的 @media (min-width: 768px) .sticky-nav：margin: 12px auto → 0 auto

## 2. 漢堡 → ✕ 關閉動畫

- [x] 2.1 在 css/menu.css 新增 body.menu-open .dh-menu .hamburger-icon span 三條線變形規則（translateY + rotate + opacity）
