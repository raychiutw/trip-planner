# F-1 DestinationArt 工程師報告

## 結果

- `npx tsc --noEmit` — 0 errors
- `npm test` — 440 passed, 0 failed

## 架構

### 新檔案
- `src/components/trip/DestinationArt.tsx` — 獨立元件，不修改 ThemeArt.tsx

### 修改檔案
- `css/style.css` — 新增 `.destination-art` CSS + sticky-nav z-index 分層
- `src/pages/TripPage.tsx` — import DestinationArt，嵌入 sticky-nav

## 設計決策

### 目的地 SVG 主題（5 個）

| 目的地 | 元素 | light opacity | dark opacity |
|--------|------|--------------|-------------|
| okinawa | 海浪、風獅爺、珊瑚、熱帶魚、扶桑花 | 0.15-0.35 | 0.08-0.20 |
| busan | 廣安大橋、海鷗、海浪、釜山塔 | 0.12-0.20 | 0.06-0.12 |
| kyoto | 鳥居、楓葉、竹林、寺廟屋簷 | 0.12-0.18 | 0.06-0.10 |
| banqiao | 林家花園亭閣、夜市紅燈籠、老街屋簷 | 0.12-0.20 | 0.06-0.12 |
| generic | 飛機、指南針、行李箱（fallback） | 0.12 | 0.08 |

### tripId → 目的地映射
```ts
resolveDestination(tripId):
  startsWith('okinawa') → 'okinawa'
  startsWith('busan')   → 'busan'
  startsWith('kyoto')   → 'kyoto'
  startsWith('banqiao') → 'banqiao'
  fallback              → 'generic'
```

### CSS 分層
```
.sticky-nav (position: sticky — 已由 shared.css 設定)
  └─ .destination-art (position: absolute, inset: 0, z-index: 0)
  └─ nav-brand, DayNav, NavArt (position: relative, z-index: 1)
```

### SVG 規格
- viewBox: `0 0 480 48`
- preserveAspectRatio: `xMidYMid slice`（填滿寬度，居中裁切）
- 簡約線條風格，低對比度背景用途

## 注意事項
- DestinationArt 用 `memo` 包裝，只在 `tripId` 或 `dark` 變化時重新渲染
- 不干擾 DayNav pill 的可讀性：所有元素 opacity 極低
- dark mode 整體再降 opacity 以配合深色背景
- `.sticky-nav > [aria-hidden="true"]` 的 mask-image 規則會自動套用到 DestinationArt

---

# F-2 DayArt 工程師報告

## 結果

- `npx tsc --noEmit` — 0 errors
- `npm test` — 440 passed, 0 failed

## 新檔案

- `src/lib/dayArtMapping.ts` — POI 關鍵字 → ArtKey 映射表 + `extractArtKeys()` 函式
- `src/components/trip/DayArt.tsx` — 動態 Day Header SVG 裝飾元件

## 修改檔案

- `src/pages/TripPage.tsx` — DaySection 中 `DayHeaderArt` → `DayArt`，移除 DayHeaderArt import

## 架構

### 關鍵字映射（dayArtMapping.ts）

共 ~50 個關鍵字映射到 26 種 ArtKey：
- 水上活動：浮潛、海灘、水族館、夕陽
- 文化宗教：神社、城、寺、鳥居、花園
- 購物美食：市場、夜市、AEON、拉麵、咖啡
- 交通：機場、租車、電車
- 自然：公園、山、橋、島
- 住宿：Hotel、溫泉
- 地標：博物館、塔、燈塔
- fallback：指南針

### DayArt 生成邏輯

1. 從 `entries` 的 title 提取關鍵字
2. `extractArtKeys()` 用 `String.includes()` 做比對，取前 3 個不重複的 ArtKey
3. 每個 ArtKey 放在不同 slot（x=130, x=55, x=10，從右到左）
4. viewBox 同 DayHeaderArt: `0 -10 200 100`
5. 無匹配 → fallback 指南針

### light/dark mode

- `artElement()` 接收 `dark: boolean`，每個 SVG 元素內部條件切換：
  - light: 使用原色（#2A8EB0, #E86A4A, #7A6A56 等），opacity 0.20-0.30
  - dark: 使用亮色調（#7EC0E8, #F4A08A, #D4A88E 等），opacity 0.10-0.15

## 效能

- DayArt 使用 `memo`，只在 `entries` 或 `dark` 變化時重新渲染
- `extractArtKeys` 使用 `useMemo` 避免每次 render 重新計算
- ThemeArt.tsx 的 `DayHeaderArt` 不再被 TripPage import（tree-shaking 會移除）
