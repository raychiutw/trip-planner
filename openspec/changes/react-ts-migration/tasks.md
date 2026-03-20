## 1. 專案腳手架

- [x] 1.1 安裝依賴：react, react-dom, @types/react, @types/react-dom, typescript, @vitejs/plugin-react
- [x] 1.2 建立 `vite.config.ts`：多入口（4 個 HTML）、Cloudflare Pages 相容
- [x] 1.3 建立 `tsconfig.json`：strict mode、react-jsx、path aliases
- [x] 1.4 建立 `src/` 目錄結構（entries/, pages/, components/, hooks/, lib/, types/）
- [x] 1.5 建立 4 個入口 TSX + placeholder 頁面組件
- [x] 1.6 驗證 `vite build` 成功（275ms，4 個 HTML 正確打包）

## 2. TypeScript 型別 + 共用模組

- [x] 2.1 建立 `src/types/trip.ts`：Trip, Day, Entry, Restaurant, Shopping, Hotel 等 API response 型別
- [x] 2.2 建立 `src/types/api.ts`：Request, Permission, AuditLog, WebhookLog 型別
- [x] 2.3 遷移 `js/map-row.js` → `src/lib/mapRow.ts`
- [x] 2.4 遷移 `js/shared.js` → `src/lib/localStorage.ts` + `src/lib/sanitize.ts`
- [x] 2.5 遷移 `js/icons.js` → `src/components/shared/Icon.tsx`
- [x] 2.6 建立 `src/hooks/useApi.ts`（apiFetch helper）
- [x] 2.7 建立 `src/lib/constants.ts`（DRIVING_WARN_MINUTES 等常數）

## 3. 簡單頁面遷移

- [x] 3.1 遷移 AdminPage（js/admin.js → src/pages/AdminPage.tsx + src/entries/admin.tsx）
- [x] 3.2 遷移 SettingPage（js/setting.js → src/pages/SettingPage.tsx + src/entries/setting.tsx）
- [x] 3.3 遷移 ManagePage（js/manage.js → src/pages/ManagePage.tsx + src/entries/manage.tsx）
- [x] 3.4 tsc --noEmit 零錯誤 + vite build 成功 + npm test 423 passed

## 4. TripPage 遷移（app.js 拆解）

- [x] 4.1 建立 TripPage 骨架 + resolveAndLoad 邏輯（src/pages/TripPage.tsx）
- [x] 4.2 建立 `src/hooks/useTrip.ts`（fetch meta + days + info 資料）
- [x] 4.3 遷移 DayNav 組件（日期導航列 + 左右箭頭 overflow）
- [x] 4.4 遷移 Timeline + DayCard 組件（時間軸渲染核心）
- [x] 4.5 遷移 Restaurant、Shop、InfoBox 組件（entry 子內容）
- [x] 4.6 遷移 Hotel 組件
- [x] 4.7 遷移 MapLinks 組件（Google/Apple/Naver map 連結）
- [x] 4.8 遷移 HourlyWeather 組件 + weather lib
- [x] 4.9 遷移 InfoPanel + 9 個子組件（Flights, Checklist, Backup, Emergency, Suggestions, TripStatsCard, InfoSheet）
- [x] 4.10 遷移 SpeedDial（手機快速選單 FAB）
- [x] 4.11 遷移 Footer + DrivingStats + Countdown
- [x] 4.12 遷移列印模式（usePrintMode）、dark mode（useDarkMode）
- [x] 4.13 tsc 零錯誤 + vite build 297ms + npm test 423 passed

## 5. 測試遷移

- [x] 5.1 安裝 @testing-library/react, @testing-library/jest-dom
- [x] 5.2 遷移純邏輯測試（mapRow、escape）→ 改 import 到 src/lib/
- [x] 5.3 render 測試加遷移註解，暫保留測 js/app.js（Option B）
- [x] 5.4 api-mapping 測試暫保留（函式尚未遷移到 src/）
- [x] 5.5 setting-api、load-fallback 暫保留
- [x] 5.6 naming-convention 測試擴充掃描 src/lib/ 檔案
- [x] 5.7 css-hig 測試不變，確認通過
- [x] 5.8 npm test 423 passed ✅

## 6. 清理 + 部署

- [x] 6.1 舊 `js/*.js` 暫保留（部分測試仍依賴），待測試全面遷移 RTL 後再移除
- [x] 6.2 更新 `package.json`：加入 dev/build/preview/typecheck scripts
- [x] 6.3 更新 wrangler.toml：pages_build_output_dir → "dist"
- [x] 6.4 更新 CLAUDE.md 專案結構（加入 src/ 目錄、vite.config.ts、tsconfig.json）
- [x] 6.5 更新 openspec/config.yaml context（React 19 + TS + Vite）
- [x] 6.6 tsc 零錯誤 + npm test 423 passed + vite build 302ms
- [x] 6.7 tsc 零錯誤 + npm test 423 passed — 待 Cloudflare Pages 設定 build command 後 deploy
