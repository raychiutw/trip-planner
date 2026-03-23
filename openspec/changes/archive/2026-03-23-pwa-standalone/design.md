## Context

網站目前沒有 Web App Manifest，加入主畫面後仍在 Safari 中開啟。`<meta name="theme-color">` 固定為 `#F47B5E`，dark mode 和不同主題時 status bar 顏色衝突。

## Goals / Non-Goals

**Goals:**
- 加入 manifest.json 支援 standalone 模式
- 所有 HTML 入口加入 Apple PWA meta tags
- 動態 theme-color 隨主題/dark mode 變化
- 產生 PWA icon

**Non-Goals:**
- 不做 Service Worker / 離線快取（後續 change）
- 不做 Push Notification

## Decisions

### D1. manifest.json 配置
```json
{
  "name": "旅行規劃師",
  "short_name": "旅行規劃",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FBF3E8",
  "theme_color": "#F47B5E",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### D2. Apple PWA Meta Tags
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="旅行規劃師">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
```

### D3. 動態 theme-color
在 `useDarkMode` hook 的 theme/mode 變化時，更新 `<meta name="theme-color">`：
```typescript
const bg = getComputedStyle(document.body).getPropertyValue('--color-background').trim();
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
```

### D4. Icon 生成
使用現有 favicon（`public/favicon.svg`）作為基底，生成 192x192 和 512x512 的 PNG icon。使用簡單的 canvas API 或 CLI 工具。

## Risks / Trade-offs

- **[Risk] iOS Safari PWA 有已知限制（無 Service Worker background sync）** → Mitigation：目前只做 standalone 模式，不依賴進階 PWA 功能
- **[Risk] theme-color 更新可能有閃爍** → Mitigation：在 CSS 變數套用後同步更新，延遲極小
