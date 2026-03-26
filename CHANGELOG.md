# Changelog

All notable changes to Tripline will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.1.1] - 2026-03-27

### Changed
- TripPage SCOPED_STYLES 從 143 行精簡到 29 行 — 基礎樣式搬到 tokens.css `@layer base`
- tokens.css 新增 page-level base styles（day-header、skeleton、timeline glass、info-panel、appearance cards 等）
- 樣式查找位置從 3 處（tokens.css + SCOPED_STYLES + inline）減為 2 處（tokens.css + inline）

## [1.0.1.0] - 2026-03-26

V2 Cutover — 移除所有 V1 程式碼，V2 成為唯一正式版。

### Changed
- SPA 單一入口 — main.tsx 移除 V1/V2 switching，直接載入 BrowserRouter
- Vite 單入口建置 — 移除 v2.html 雙入口，統一由 index.html 出發
- CSS 統一 — tokens.css 成為唯一 CSS 檔案（Tailwind CSS 4 @theme）
- apiFetchRaw 抽至 useApi.ts 共用模組，加入 reportFetchResult 離線偵測
- toTimelineEntry/toHotelData 改接 object 型別，消除 5 個 `as unknown as` 型別斷言
- TripPage 清除 15 組 `-v2` CSS class 後綴

### Removed
- V1 入口：mainV1.tsx、mainV2.tsx、v2.html
- V1 頁面：TripPage(V1)、ManagePage(V1)、AdminPageV2（冗餘）
- V1 元件：Toast(V1)、RequestStepper(V1)
- V1 CSS：style.css、shared.css、map.css、manage.css、admin.css、setting.css
- 過渡程式：v2routing.ts、features.json、progress.jsonl
- V1/V2 比較測試和 CSS 依賴測試

### Fixed
- scroll-to-now 選擇器從 `.tl-now` 修正為 `[data-now]`
- ManagePage 回覆分隔線 `border-none` 與 `border-t` 衝突
- map-highlight 動畫遷移至 tokens.css（從已刪除的 map.css）

## [1.0.0.0] - 2026-03-25

React SPA 架構完成里程碑 — 從 vanilla JS 全面遷移至 React + TypeScript。

### Added
- React SPA 架構 — Vite 多入口 + React Router + 4 頁 lazy loading（TripPage、ManagePage、AdminPage、SettingPage）
- 6 套色彩主題（陽光/晴空/和風/森林/櫻花/星夜）× 深淺模式切換
- PWA 離線模式 — Service Worker + NetworkFirst 快取 + 離線 Toast 通知
- Day Map 互動地圖 — Google Maps 嵌入 + 動線連線 + 多天總覽（`?showmap=1`）
- Tailwind CSS v4 Blue-Green 升級基礎建設 — tokens.css + V1/V2 路由切換
- Admin V2 cutover — 第一個全 Tailwind inline 頁面上線
- QuickPanel Bottom Sheet — 替代 Speed Dial 的快捷面板
- InfoSheet 手機版 multi-detent — 半版/滿版手勢切換
- Tripline 品牌重塑 — 手寫風 SVG logo + `/trip/{id}` URL routing
- Loading Skeleton 骨架屏 — shimmer 動畫 + fade-in 過渡
- 毛玻璃材質 — StickyNav + InfoSheet + QuickPanel backdrop blur
- 旅伴請求四態 stepper（open → received → processing → completed）
- 每日問題報告系統（daily-check + Telegram 通知）
- Staging CI/CD — PR CI pipeline + SW 驗證
- D1 備份腳本（dump-d1.js）+ 備份納入版控

### Changed
- Manage/Admin 頁面加入 Cloudflare Access 401/403 redirect
- `?trip=` query string 相容舊版 URL，自動轉為 React Router 路由
- 匯出功能重寫 — 完整行程資料 + 5 個附屬文件
- 「建議」改名為「解籤」+「問事情」廟宇問事風格

### Fixed
- PUT /days/:num 遺漏 source、mapcode、location_json 欄位
- Admin V2 cutover 修復 10 項 — stale closure、AbortController、Content-Type、401 redirect 防護
- SPA manage/admin CSS hotfix 循環（22 個 PR）→ Blue-Green 策略根治
- shared.css 刪除 187 行 dead admin-* CSS
- workbox build Browserslist 錯誤（根目錄 shell wrapper 誤讀）
- entries PATCH/DELETE D1 error handling
- 四層 UTF-8 encoding 防堵 — curl 亂碼根治
- SW navigateFallbackDenylist 排除 Access 保護頁面

### Removed
- Vanilla JS 入口（app.js、manage.js、admin.js）— 改由 React 接管
- dist/ 從版控移除 — 由 Cloudflare Pages build
- Tunnel/Agent Server 殘留程式碼
- V1 AdminPage + V1/V2 比對 E2E tests

## [0.x] - 2026-02 ~ 2026-03-17

### Added
- Cloudflare D1 資料庫 — trips/days/entries/restaurants/shopping/trip_docs/audit_log/requests/permissions
- Cloudflare Pages Functions API — 完整 CRUD + audit trail + rollback
- 旅伴請求系統（requests API + ManagePage）
- 權限管理系統（permissions API + AdminPage）
- 設定頁（SettingPage）— 主題切換 + 深淺模式 + 字體大小
- 全站 inline SVG icon（Material Symbols Rounded）
- CSS HIG 設計規範（12 條）+ 自動測試守護
- Markdown 行程檔 → D1 遷移腳本

## [0.0] - 2026-02-01

### Added
- Initial commit — 靜態 HTML 沖繩五日自駕遊行程表
- Markdown 行程檔格式
