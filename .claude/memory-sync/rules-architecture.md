# 架構參考

## CSS/JS 拆分規則

| 檔案 | 載入頁面 | 內容 |
|------|---------|------|
| `css/shared.css` | 全部 | variables, reset, body, `.page-layout`, `.container`, `.sticky-nav`, `.trip-btn`, dark mode base |
| `css/style.css` | index only | timeline, weather, hotel, nav, cards, FAB, info-panel, print, menu drawer, sidebar, dark/print mode |
| `css/edit.css` | edit only | Claude 聊天風格 UI、問候語、issue 列表、底部輸入卡片, dark mode |
| `css/setting.css` | setting only | setting page layout, trip list, color mode cards |
| `js/shared.js` | 全部 | `escHtml`, `escUrl`, `sanitizeHtml`, `stripInlineHandlers`, LS helpers, dark mode, `GH_OWNER`/`GH_REPO` |
| `js/icons.js` | 全部 | `ICONS` SVG registry, `EMOJI_ICON_MAP` emoji→icon, `icon`, `iconSpan`, `emojiToIcon` |
| `js/app.js` | index only | 所有 render/weather/nav/routing 函式（依賴 shared.js + menu.js + icons.js） |
| `js/edit.js` | edit only | Claude 聊天風格、時段問候語、GitHub API issue 列表、底部輸入區、行程切換 |
| `js/setting.js` | setting only | 讀取 trips.json 渲染行程清單、色彩模式切換（Light/Auto/Dark） |

## 桌機資訊面板

- `isDesktop()` 使用 User-Agent 偵測：只有手機判為非桌機，平板及桌機均視為桌機
- CSS `@media (min-width: 768px)` 控制 sidebar，`@media (min-width: 1200px)` 控制三欄佈局
- 三欄：sidebar (260px) + content (flex:1) + info-panel (280px)

## 交通統計

- `calcDrivingStats()` 從 `timeline[].transit` 篩選交通類型，按類型分組
- 每日統計可收合，開車超過 120 分鐘以警告樣式顯示
- `calcTripDrivingStats(days)` 彙總全旅程，渲染於航班區段下方

## AI 修改行程功能（edit.html）

```
Trip 頁面 → FAB → edit.html?trip={slug} → 輸入文字 → POST GitHub Issue (label: trip-edit)
/tp-request → 讀 Issue → 改 MD → build → test → commit push → close Issue
```

- **GitHub PAT**：Fine-Grained，僅 `Issues: Read+Write`
- **白名單**：只允許修改 `data/trips-md/{slug}/**`
