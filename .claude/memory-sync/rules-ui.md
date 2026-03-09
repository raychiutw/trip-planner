# UI 規則

- **無框線設計**：不用 `border` 分隔，改用背景色差、間距、圓角、`box-shadow`；唯一例外 `.timeline` 的 `border-left`
- **卡片統一**：section 白色圓角卡片，子元素不另設底色
- **全站 inline SVG**（Material Symbols Rounded），不用 emoji；新增 icon 加到 `js/icons.js` 的 `ICONS`
- **設定頁** `setting.html`：行程切換 + 色彩模式（Light/Auto/Dark）
- 左側選單 drawer（shared.js 控制）、展開收合 ＋/－、Day 標籤 📍 Day N
- 底部面板三段式吸附（50%/75%/90% dvh），backdrop 防捲動穿透
- 連續捲動模式：scroll 追蹤更新 URL hash + pill highlight；手動點擊後 600ms 內不更新
- 標題列：行程頁左對齊無底線；設定頁/編輯頁居中 + `--bg` 底色 + 底線 + `::before` 36px 佔位
- Speed Dial 開啟時 backdrop 阻止背景捲動，深色模式加深透明度
- FAB（＋）在 index.html 右下角，連結 edit.html?trip={slug}
