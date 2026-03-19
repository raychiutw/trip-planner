## Context

trip-planner 目前有三種主題（sun / sky / zen），每種主題有 light / dark 兩套 CSS 變數，定義於 `css/shared.css`。晴空（sky）主題的 light 配色色差不足：`--accent`（#3B88B8）、`--accent-bg`（#D5E8F5）、`--bg-secondary`（#F0F7FA）等層次過於接近，在實際手機螢幕下難以區分。

插畫元件 `ThemeArt.tsx` 目前 `DayHeaderArt` container 佔 day-header 右側 60%，裝飾感偏弱。Sticky nav 目前沒有主題裝飾。

Speed Dial 現有 8 個項目，icon 以 CSS 控制尺寸（內嵌 SVG），目前沒有明確的 SVG width/height override。下載功能尚未實作。

列印模式 `.print-mode .tl-card { background: #fff; }` 已針對 tl-card 設置，但 `info-card` 與 `day-header` 未統一覆蓋，且部分規則缺少 `backdrop-filter: none`。

## Goals / Non-Goals

**Goals:**
- 晴空 light 模式 7 個 CSS 變數色差加大，確保 UI 層次在手機螢幕可辨識
- DayHeaderArt 插畫右側覆蓋比例由 60% → 80%，sky light SVG 元素同步放大
- sticky nav 加入淡色主題裝飾（NavArt），sky light 顯示海鷗
- `.day-header` min-height 100px
- 列印模式卡片、info-card、day-header 統一純白 + 移除 backdrop-filter
- Speed Dial icon 28px，新增 download 項目與 DownloadSheet 底部彈窗
- DownloadSheet 支援 PDF / Markdown / JSON / CSV 四種格式下載

**Non-Goals:**
- 不異動 sky dark 或 sun / zen 主題色彩
- 不修改 Cloudflare D1 schema 或 API 端點
- 不調整 desktop sidebar 或桌機版 layout

## Decisions

### D1：色差加大幅度

選擇每個變數約深化 10–15%，不超過 20%，確保整體仍屬淺色主題，不至於讓晴空主題看起來像中色調。具體映射：

| 變數 | 舊值 | 新值 |
|------|------|------|
| `--accent` | `#3B88B8` | `#2870A0` |
| `--accent-bg` | `#D5E8F5` | `#B8D4E8` |
| `--accent-subtle` | `#E5F0F8` | `#D0E4F2` |
| `--border` | `#D0E4EE` | `#A0C0D8` |
| `--text-muted` | `#7A9AAA` | `#587888` |
| `--bg-secondary` | `#F0F7FA` | `#E0EDF5` |
| `--bg-tertiary` | `#E0EEF4` | `#C8DDE8` |

### D2：插畫放大策略

DayHeaderArt container 改為 `width: '80%'`，使插畫覆蓋更大範圍，產生更強裝飾感。Sky light header 的熱氣球 g transform 從 `translate(140,8)` 改為 `translate(160,6)`，海鷗 path 座標與 stroke 放大。其他主題的 SVG 元素同樣按比例調整，確保不超出 viewBox（200×80）。

替代方案：修改 viewBox 比例。但改 viewBox 會影響所有主題，且現有座標都依 200×80 設計，保持 viewBox 較安全。

### D3：NavArt 新元件

在 `ThemeArt.tsx` 新增 `NavArt` function component，由 TripPage 透過 props 傳入主題與 dark mode，注入至 `StickyNav` 的 aria-hidden 裝飾 div。NavArt 使用 SVG 高度 24px，寬度 100%，天空主題 light 顯示淡色海鷗；dark 顯示星點；其他主題同理（sun 顯示波浪，zen 顯示花瓣）。

### D4：列印模式規則整合

在 `css/style.css` 新增統一規則：

```css
.print-mode .tl-card,
.print-mode .info-card {
  background: #FFFFFF;
  border: 1px solid #E0E0E0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.print-mode .day-header {
  background: #FFFFFF;
  border-bottom: 1px solid #E0E0E0;
}
@media print {
  .tl-card, .info-card { background: #FFFFFF !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  .day-header { background: #FFFFFF !important; border-bottom: 1px solid #E0E0E0 !important; }
}
```

既有 `.print-mode .tl-card { background: #fff; }` 規則保留（本次新增規則會 cascade 覆蓋）。

### D5：DownloadSheet 架構

DownloadSheet 為獨立 React 元件，接收 `tripId`、`tripName`、`isOpen`、`onClose` props。

- **PDF**：呼叫 `window.print()`（瀏覽器原生列印 → PDF）
- **Markdown**：呼叫 `GET /api/trips/:id/days`，再依序 `GET /api/trips/:id/days/:num`，組裝 MD 字串，透過 Blob + `URL.createObjectURL` 下載
- **JSON**：呼叫 `GET /api/trips/:id`（meta）+ `/days`，合併原始 JSON，Blob 下載
- **CSV**：從 days JSON 攤平 entries → 組裝 CSV 字串，Blob 下載

下載檔名格式：`{tripName}-{YYYY-MM-DD}.{ext}`。

## Risks / Trade-offs

- [風險] NavArt 若注入點設計不當，可能影響 sticky-nav 高度 → 緩解：SVG 設為 `position: absolute`，`pointer-events: none`，不佔用 flex 空間
- [風險] DownloadSheet Markdown 組裝需多次 API 請求，行程天數多時速度慢 → 緩解：顯示 loading 狀態，不阻塞 UI
- [風險] sky theme 色差加大後，`--scrollbar-thumb`（#B8D0DC）與新 `--bg-secondary`（#E0EDF5）的對比需確認 → 接受：捲軸顏色深於背景即可，不再改 scrollbar 變數
- [風險] `@media print` 規則使用 `!important` 可能與既有規則衝突 → 緩解：只在 @media print 區塊使用，範圍明確

## Open Questions

- NavArt 是否需要對所有主題（sun/sky/zen）都實作，或僅 sky？→ 計畫全部實作，保持架構一致性
- DownloadSheet CSV 欄位定義：entry time, title, maps, rating, travel_time, travel_distance？→ 以此為基礎欄位
