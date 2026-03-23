## Context

前端 6 個 JS 檔（3,146 行）、6 個 CSS 檔（1,567 行）、4 個 HTML 頁面。API 層 20 個 Pages Functions（1,565 行 TS）已是 TypeScript。測試 15 檔（4,737 行）用 Vitest + jsdom。

## Goals / Non-Goals

**Goals:**
- 前端 JS → React + TypeScript，全棧 TS
- 組件化 app.js（1,789 行 → ~15 個組件）
- Vitest + React Testing Library 測試
- 保留 Cloudflare Access 路徑保護（/manage/、/admin/）
- 保留現有 CSS（不改 SCSS）

**Non-Goals:**
- 不改 CSS（不轉 SCSS、不改 HIG token 系統）
- 不改 Pages Functions API
- 不改 D1 schema
- 不引入狀態管理庫（Redux/Zustand），用 React hooks 即可
- 不做 SSR/SSG

## Decisions

### 1. 多入口 Vite build（非 SPA）

4 個獨立 HTML 入口，各自 mount 獨立的 React app。不用 React Router。

**理由**：
- `/manage/` 和 `/admin/` 受 Cloudflare Access 保護，必須是真正的 URL 請求
- 4 頁之間幾乎無共享狀態，SPA routing 沒有實質好處
- 簡化部署（不需 SPA fallback routing 設定）

```
vite.config.ts:
  build.rollupOptions.input:
    main:    index.html
    setting: setting.html
    manage:  manage/index.html
    admin:   admin/index.html
```

### 2. 目錄結構

```
src/
  pages/
    TripPage.tsx          ← js/app.js 的入口
    SettingPage.tsx        ← js/setting.js
    ManagePage.tsx         ← js/manage.js
    AdminPage.tsx          ← js/admin.js
  components/
    trip/                  ← app.js 拆解出的組件
      Timeline.tsx
      DayCard.tsx
      DayNav.tsx
      Restaurant.tsx
      Shop.tsx
      InfoBox.tsx
      Hotel.tsx
      MapLinks.tsx
      HourlyWeather.tsx
      InfoPanel.tsx
      SpeedDial.tsx
      Footer.tsx
      Countdown.tsx
      DrivingStats.tsx
    shared/
      StickyNav.tsx
      TripSelect.tsx
      Icon.tsx             ← icons.js → React component
  hooks/
    useTrip.ts             ← fetch + 狀態管理
    useApi.ts              ← apiFetch helper
    useAuth.ts             ← manage/admin 認證
    useWeather.ts          ← Open-Meteo API
  lib/
    mapRow.ts              ← map-row.js
    sanitize.ts            ← escHtml, sanitizeHtml
    localStorage.ts        ← lsGet, lsSet, lsRemove
    constants.ts           ← DRIVING_WARN_MINUTES, TRANSPORT_TYPES 等
  types/
    trip.ts                ← API response 型別
    api.ts                 ← request/permission 型別
  entries/
    main.tsx               ← index.html 的 React 入口
    setting.tsx            ← setting.html 的 React 入口
    manage.tsx             ← manage/index.html 的 React 入口
    admin.tsx              ← admin/index.html 的 React 入口
css/                       ← 保持不變
functions/                 ← 保持不變
```

### 3. CSS 整合策略

不改 CSS 內容，只改引入方式：
- 每個入口 TSX `import '../css/shared.css'` + 頁面專屬 CSS
- CSS class name 不改，直接用 `className="day-header"` 字串
- 不引入 CSS Modules 或 styled-components

### 4. 測試策略

| 現在 | 遷移後 |
|------|--------|
| Vitest + jsdom + 手動 innerHTML | Vitest + React Testing Library |
| `render.test.js`（105 tests） | 拆為各組件測試（Timeline.test.tsx 等） |
| `api-mapping.test.js`（74 tests） | 保持，改 import 路徑 |
| `naming-convention.test.js` | 擴充涵蓋 TSX |
| `css-hig.test.js` | 保持不變 |
| Playwright E2E | 保持不變（測最終 HTML） |

### 5. 遷移策略：逐頁遷移

不一次全改，按頁面逐步遷移：
1. 先建腳手架 + types + lib（不影響現有頁面）
2. 遷移最簡單的 admin 頁
3. 遷移 setting 頁
4. 遷移 manage 頁
5. 最後遷移最複雜的 trip 主頁（app.js）
6. 每遷完一頁，跑測試確認，commit

## Risks / Trade-offs

- **風險**：app.js 拆解時可能遺漏互動邏輯（nav tracking、scroll、print mode）→ 用 E2E 測試守護
- **風險**：Cloudflare Pages build 時間增加（Vite build ~10s vs 現在 0s）→ 可接受
- **風險**：CSS class 與 React className 不一致 → 保持原 class name 不改，降低風險
- **取捨**：不用 CSS Modules，犧牲 scope 隔離換取零 CSS 改動
- **取捨**：多入口而非 SPA，犧牲頁面切換速度換取 Access 安全性
