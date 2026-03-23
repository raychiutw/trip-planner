# UX 全面升級 + 6 套主題配色 — 設計文件

## 一、主題系統擴充（3 → 6 套）

### 1.1 新增主題色彩 Token

所有主題透過 `body.theme-{name}` class selector 定義，遵循既有架構（不使用 `[data-theme]`）。

#### Forest（森林綠）

| Token | Light | Dark |
|---|---|---|
| `--color-accent` | `#4A8C5C` | `#7EC89A` |
| `--color-accent-subtle` | `#E2F0E6` | `#1A2A1E` |
| `--color-accent-bg` | `#D0E4D6` | `#243D2A` |
| `--color-background` | `#F0F5EE` | `#161C18` |
| `--color-secondary` | `#DCE8DE` | `#202A22` |
| `--color-tertiary` | `#C8D8CC` | `#2A362E` |
| `--color-hover` | `#D4E0D6` | `#263028` |
| `--color-foreground` | `#1E2E22` | `#D8E8DC` |
| `--color-muted` | `#5C7A62` | `#8AB090` |
| `--color-accent-foreground` | `#F0F5EE` | `#161C18` |
| `--color-border` | `#B0C8B6` | `#304038` |
| `--color-success` | `#3D8E5A` | `#7EC89A` |

#### Sakura（櫻花粉）

| Token | Light | Dark |
|---|---|---|
| `--color-accent` | `#D4708A` | `#F0A0B8` |
| `--color-accent-subtle` | `#FDE8EE` | `#2A181E` |
| `--color-accent-bg` | `#F8D0DA` | `#3D2028` |
| `--color-background` | `#FFF5F7` | `#1C1618` |
| `--color-secondary` | `#F5E0E6` | `#2A2024` |
| `--color-tertiary` | `#E8CED6` | `#362A30` |
| `--color-hover` | `#F0D8DE` | `#302428` |
| `--color-foreground` | `#2E1820` | `#F0D8E0` |
| `--color-muted` | `#8A6070` | `#B88898` |
| `--color-accent-foreground` | `#FFF5F7` | `#1C1618` |
| `--color-border` | `#D8B8C4` | `#403038` |
| `--color-success` | `#5A9A78` | `#8AD0A0` |

#### Ocean（深海藍）

| Token | Light | Dark |
|---|---|---|
| `--color-accent` | `#1A6B8A` | `#60C0E0` |
| `--color-accent-subtle` | `#D8EEF5` | `#142028` |
| `--color-accent-bg` | `#C0DEE8` | `#1E3442` |
| `--color-background` | `#EFF7FA` | `#101A1E` |
| `--color-secondary` | `#D4E8F0` | `#1A2830` |
| `--color-tertiary` | `#B8D4E0` | `#243440` |
| `--color-hover` | `#CCE0EA` | `#202E38` |
| `--color-foreground` | `#0E2830` | `#D0E8F0` |
| `--color-muted` | `#4A7888` | `#80B8C8` |
| `--color-accent-foreground` | `#EFF7FA` | `#101A1E` |
| `--color-border` | `#A0C4D4` | `#2A3E48` |
| `--color-success` | `#3D8E6A` | `#70D0A0` |

### 1.2 主題個性化 Token

在 `:root` 新增可被主題覆寫的個性化 token：

```css
:root {
  --theme-header-gradient: none;            /* Day Header 漸層背景 */
  --theme-font-weight-headline: var(--font-weight-semibold);
  --theme-line-height-body: var(--line-height-normal);
  --theme-section-gap: var(--spacing-6);    /* section 間距 */
}
```

各主題覆寫：
- **Sky** light：`--theme-header-gradient: linear-gradient(90deg, var(--color-accent-bg) 0%, var(--color-accent) 100%)`；dark 同理但用暗色系
- **Zen** light/dark：`--theme-font-weight-headline: var(--font-weight-medium)`、`--theme-line-height-body: var(--line-height-relaxed)`、`--theme-section-gap: var(--spacing-8)`
- **Forest**：`--theme-header-gradient: linear-gradient(135deg, var(--color-accent-bg) 0%, var(--color-secondary) 100%)`（斜角漸層）
- **Sakura**：Day Header 加微妙粉色漸層
- **Ocean**：Day Header 加水平深淺藍漸層

### 1.3 hook + 設定頁擴充

`useDarkMode.ts`：
```typescript
export type ColorTheme = 'sun' | 'sky' | 'zen' | 'forest' | 'sakura' | 'ocean';
const THEME_CLASSES = ['theme-sun', 'theme-sky', 'theme-zen', 'theme-forest', 'theme-sakura', 'theme-ocean'] as const;
const THEME_COLORS: Record<ColorTheme, { light: string; dark: string }> = {
  sun:    { light: '#F47B5E', dark: '#3D2A20' },
  sky:    { light: '#2870A0', dark: '#1E3040' },
  zen:    { light: '#9A6B50', dark: '#342820' },
  forest: { light: '#4A8C5C', dark: '#243D2A' },
  sakura: { light: '#D4708A', dark: '#3D2028' },
  ocean:  { light: '#1A6B8A', dark: '#1E3442' },
};
```

`SettingPage.tsx`：
```typescript
const COLOR_THEMES = [
  { key: 'sun',    label: '陽光', desc: 'Sunshine' },
  { key: 'sky',    label: '晴空', desc: 'Clear Sky' },
  { key: 'zen',    label: '和風', desc: 'Japanese Zen' },
  { key: 'forest', label: '森林', desc: 'Deep Forest' },
  { key: 'sakura', label: '櫻花', desc: 'Cherry Blossom' },
  { key: 'ocean',  label: '深海', desc: 'Deep Ocean' },
];
```

設定頁 `.color-theme-grid` 改為 `grid-template-columns: repeat(3, 1fr)` 固定 3 欄（2 行 × 3 欄），手機 2 欄。

---

## 二、10 項 UX 改善

### 2.1 Day Header 視覺層級

**改法**：Light mode 的 `.day-header` 加左邊 4px accent 色邊條 + accent-subtle 底色。

```css
.day-header {
  border-left: 4px solid var(--color-accent);
  background: var(--color-accent-subtle);
  /* 有 --theme-header-gradient 時疊加漸層 */
  background-image: var(--theme-header-gradient);
}
body.dark .day-header {
  background: var(--color-accent-bg);
  background-image: var(--theme-header-gradient);
}
```

### 2.2 SpeedDial 扁平化

移除 `SPEED_DIAL_GROUPS` 中間層，改為 8 個直達按鈕的 grid：

```
DIAL_ITEMS（扁平）:
  flights      ✈  航班資訊      → sheet
  checklist    ✓  出發確認      → sheet
  emergency    🚨 緊急聯絡     → sheet
  backup       ↩  備案         → sheet
  suggestions  💡 AI 建議      → sheet
  today-route  📍 今日路線     → sheet（新增）
  driving      🚗 交通統計     → sheet
  tools        ⚙  設定         → group（保留，含切換行程/外觀/下載/列印）
```

渲染改為 2×4 或自動 grid（`grid-template-columns: repeat(auto-fill, minmax(64px, 1fr))`），每個按鈕 icon + 標籤，一鍵直達。

### 2.3 天氣方塊簡化

- 移除 `hw-block-loc`（location badge），地點資訊移到 `hw-summary` 標題列
- 每格簡化為 3 層：時間 → icon+溫度（同行）→ 降雨%
- 格子寬度從 `60px` 減為 `52px`，手機可容納更多格
- 高降雨格加 `background: var(--color-info-bg)` 淡藍底色

### 2.4 餐廳 Mini Card

```
┌─┬──────────────────────────────────────┐
│▎│ 餐廳名（accent 粗體）  [類別 pill]  [G][N] │
│▎│ ★ 4.5 · $$$ · 11:00-21:00                  │
│▎│ 備註文字（muted，clamp 2 行）              │
│▎│ 🔗 可預約 · 電話預約                        │
└─┴──────────────────────────────────────┘
```

CSS：
```css
.restaurant-choice {
  background: var(--color-accent-subtle);
  border-left: 3px solid var(--color-accent);
  border-radius: var(--radius-sm);
  padding: var(--spacing-3) var(--spacing-4);
  margin: var(--spacing-2) 0;
}
.restaurant-meta-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
}
```

### 2.5 Desktop InfoPanel 充實

在 `Countdown` 和 `TripStatsCard` 之間加入：

1. **TodaySummary** — 顯示當天景點清單（名稱 + 時間），可點擊跳轉
2. **天氣概覽** — 今天溫度範圍 + 天氣 icon（一行式）
3. **快速連結** — 航班、緊急聯絡、備案、今日路線的 icon button row

Props 需從 TripPage 傳入 `currentDay: Day | null`、`onQuickAction: (key: string) => void`。

### 2.6 今日地圖總覽

新增 `TodayRouteSheet` 組件，顯示當天所有景點的地圖連結列表：

```
📍 今日路線
1. 09:00 明洞商圈        [Google] [Naver]
2. 11:30 景福宮          [Google] [Naver] [Apple]
3. 14:00 北村韓屋村      [Google] [Naver]
```

資料來源：`currentDay.timeline` 的 `maps` 欄位。

入口：
- SpeedDial 的 `today-route` 按鈕
- InfoPanel 的快速連結 row

### 2.7 主題個性化

見 1.2 節的 `--theme-*` token 設計。

### 2.8 DayNav 完整版設計

#### 資訊架構

```
┌─────────────────────────────────────────────────────┐
│  ‹  │ 3/20四 │ 3/21五 │ 3/22六✦│ 3/23日 │ 3/24一 │  ›  │
└─────────────────────────────────────────────────────┘
                              ▲ active pill
```

- Pill 文字從純數字 `1` 改為 `{MM/DD}{星期縮寫}`，例如 `3/20四`
- Active pill 保持 accent 底色 + 白字
- 今日 pill 加底部小圓點（`::after` 偽元素，accent 色）
- 長行程（>10天）pill 縮窄為 `3/20`（省略星期）

#### Tooltip

Desktop hover / mobile 長按時顯示 tooltip 氣泡：

```
┌─────────────────┐
│ Day 7 — 3/25（二）│
│ 首爾 → 釜山      │
└─────────────────┘
```

- 資料來源：`DaySummary.label`
- CSS：`position: absolute; bottom: 100%; transform: translateX(-50%)`
- 動畫：`opacity 0→1`，`var(--transition-duration-fast)`

#### 元件 Props 擴充

```typescript
interface DayNavProps {
  days: DaySummary[];
  currentDayNum: number;
  onSwitchDay: (dayNum: number) => void;
  todayDayNum?: number;  // 新增：今天是第幾天（用於標記今日 pill）
}
```

Pill 內文字生成邏輯：
```typescript
function formatPillLabel(day: DaySummary, totalDays: number): string {
  if (!day.date) return String(day.day_num);
  const d = new Date(day.date);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  if (totalDays > 10) return `${mm}/${dd}`;
  const weekdays = '日一二三四五六';
  return `${mm}/${dd}${weekdays[d.getDay()]}`;
}
```

### 2.9 「此刻」引導

`TimelineEvent.tsx`：
- 新增 `isNow?: boolean`、`isPast?: boolean` props
- `isNow=true` → `.tl-event` 加 `.tl-now` class
- `isPast=true` → `.tl-event` 加 `.tl-past` class

CSS：
```css
.tl-now .tl-flag { color: var(--color-accent); }
.tl-now .tl-card {
  box-shadow: 0 0 0 2px var(--color-accent), var(--shadow-md);
}
.tl-now .tl-flag-num::after {
  content: '';
  width: 8px; height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  animation: pulse 2s infinite;
}
.tl-past { opacity: 0.55; }
.tl-past .tl-card { box-shadow: none; }

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}
```

`Timeline.tsx` 判斷邏輯：
- 比對 `entry.time`（格式 `HH:MM` 或 `HH:MM-HH:MM`）與 `new Date()` 的 `HH:MM`
- 前一個 entry 的 end time < now < 當前 entry 的 end time → `isNow=true`
- end time < now → `isPast=true`
- 僅在當天（`day.date === today`）啟用

### 2.10 手勢操作

#### P0 — Swipe 切天

新增 `useSwipeDay(containerRef, { onSwipeLeft, onSwipeRight })` hook：
- `touchstart` 記錄起點
- `touchmove` 計算水平位移（>10px 時 `preventDefault` 阻止垂直捲動）
- `touchend` 判斷：水平位移 >50px 且速度 >0.3px/ms → 觸發切天
- Container：`.day-content` 或 `.timeline` 的 wrapper div

#### P1 — 展開收合動畫

用 `grid-template-rows: 0fr → 1fr` 技巧：
```css
.tl-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--transition-duration-normal) var(--transition-timing-function-apple); }
.tl-event.expanded .tl-body { grid-template-rows: 1fr; }
.tl-body > * { overflow: hidden; }
```

#### P2 — Bottom Sheet 慣性

修改 InfoSheet 的 `touchend` 判斷：
- 計算手指離開時速度（最後 100ms 的位移 / 時間）
- 速度 > 0.5px/ms → 按速度方向 snap（無論位置）
- 速度 ≤ 0.5px/ms → 按位置 snap（維持現有 30px threshold 邏輯）

---

## 三、Icon 使用

所有新增 icon 走 `ICONS` registry（`Icon.tsx`），不使用 emoji。需新增的 icon key：
- `route`（今日路線用）
- `pulse-dot`（如需獨立 icon；否則用 CSS `::after`）

---

## 四、無框線設計

所有新增元素遵循無框線設計規範：
- 不使用 `border` 分隔元素，改用背景色差 + 間距
- `border-radius` 僅使用 5 級 token（xs/sm/md/lg/full）
- `box-shadow` 使用 `--shadow-md` 或 `--shadow-lg`

例外：Day Header 左邊條 `border-left: 4px solid var(--color-accent)` 和餐廳卡片 `border-left: 3px solid var(--color-accent)` 為裝飾性標記，不違反無框線原則。
