# Changelog

All notable changes to Tripline will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.1.8.0] - 2026-04-12

### Added
- PATCH trip-pois 支援 entry_id 欄位：可透過 API 搬移 POI 到不同 entry，含同行程驗證
- mergePoi 回傳餐廳 lat/lng 座標：前端可取得 POI 地理位置

### Changed
- 地圖 pin 優先使用首選餐廳座標：餐廳 entry 若無自身 location，自動 fallback 到 sort_order=0 餐廳的 lat/lng
- tp-create 範本每天必建早餐(08:00)、午餐(12:00)、晚餐(18:00) entry，travel 以首選餐廳位置計算車程

## [1.1.7.0] - 2026-04-12

### Changed
- 餐廳推薦改為首選/備案分層渲染：第一順位完整顯示（hero card），其他順位以精簡列表呈現，點擊展開詳情

## [1.1.6.0] - 2026-04-12

### Added
- POST /api/trips/{id}/days/{dayNum}/entries endpoint：旅伴請求可建立不存在的 entry（如早餐），不再塞到不相關的 entry 下
- companion scope whitelist 加入 POST entries，tp-request/tp-edit skill 同步更新指引

### Changed
- daily-check Telegram 修復摘要格式改為「總數:N 修復:M 不處理:L」，取代原先易混淆的「修復 0/2 項」
- tp-request skill 三條鐵律：POI 語意歸屬檢查、誠實回覆禁止假裝成功
- reply request ID 改由前端渲染（ManagePage 顯示 #N，不存入 reply 資料）

### Fixed
- request-job log 路徑修正到 scripts/logs/tp-request/（含 plist stdout/stderr 路徑 + launchd 重載）
- API server log 補 Claude 處理結果（success/failed）

## [1.1.5.0] - 2026-04-07

### Added
- 事件驅動請求處理：CF Workers POST 後 webhook 觸發 Mac Mini API server 即時處理（取代 cron 輪詢）
- SSE 即時狀態推送：`/api/requests/:id/events` endpoint，前端自動收到 open → processing → completed/failed 狀態更新
- `useRequestSSE` React hook：EventSource 連線 + 自動降級 10 秒短輪詢
- Mac Mini API server (`scripts/tripline-api-server.ts`)：Bun HTTP server，D1 即佇列，mutex 處理迴圈，15 分鐘 Claude CLI timeout
- launchd job (`scripts/tripline-job.sh`)：每 15 分鐘卡住偵測（20 分鐘 stale threshold）+ 遺漏處理
- 處理者追蹤：`processed_by` 欄位記錄 `'api'`（即時）或 `'job'`（排程），前端顯示對應 icon
- iOS 原生風格狀態 badge：pill 形 rounded-full，4 態 + spinner + elapsed time + checkmark/X SVG
- 聊天式請求列表：最新在底部，sentinel 頂部向上捲載入更舊，optimistic append 取代 reload

### Changed
- 請求狀態機簡化為 4 態：open → processing → completed/failed（移除 received）
- PATCH handler：自動更新 `updated_at`，支援 `processed_by` 欄位，`failed` 狀態繞過 forward-only
- GET /api/requests 支援 `sort=asc` + `after/afterId` cursor（ASC 分頁）
- Badge 顏色改用 CSS 變數，支援 6 主題 x light/dark mode
- SSE endpoint 加 `hasPermission` 權限檢查

### Fixed
- Node.js 25 localStorage polyfill（修復 78 個 pre-existing 測試失敗）
- `mapRow` 測試：JSON_FIELDS 同步 V2 cleanup
- SSE hook：移除 `status` 從 useEffect deps（防止重複連線）
- SSE endpoint：加 `cancel()` 清理 timer（防止 client 斷線後 timer 洩漏）
- API server：`TRIPLINE_API_SECRET` 空字串改為 reject（fail-closed）
- .env.local 解析：修正 base64 `=` 截斷問題

## [1.1.4.3] - 2026-04-06

### Changed
- `trip_docs_v2` 表重命名為 `trip_docs`（migration 0022），移除 V2 後綴
- 所有 API handlers / scripts / docs 中的 `trip_docs_v2` 參照更新為 `trip_docs`
- "POI Schema V2" 標記改為 "POI Schema"

## [1.1.4.2] - 2026-04-06

### Fixed
- CI tsc functions 紅燈：修正 _middleware.ts / _poi.ts / rollback.ts / [num].ts / [type].ts 共 35 個 pre-existing strictness errors

## [1.1.4.1] - 2026-04-06

### Removed
- Legacy V1 表 hotels / restaurants / shopping / trip_docs（migration 0021 DROP）
- rollback.ts 移除 trip_docs 白名單
- dump-d1.js / init-local-db.js 移除 4 張 legacy 表
- mapRow JSON_FIELDS 移除 'location'（改由 API handler parse）

### Fixed
- 天氣功能不顯示：API handler 解析 trip_entries.location JSON string 為物件

### Changed
- Location interface 擴充完整欄位（name, googleQuery, appleQuery, mapcode, geocode_status）

## [1.1.4.0] - 2026-04-01

### Changed
- DayMap 路線從直線 Polyline 改為 Google Maps Directions API 實際道路路線
- 路線載入完成前不渲染連線（不再顯示直線 fallback）
- 車程 label 位置改用 Directions API leg 路徑中點

### Added
- `useDirectionsRoute` hook — Directions API 整合、快取、自動 fallback
- `sortPinsByOrder` 共用排序工具函式
- 路線快取（LRU 20 entry 上限）、routes library 按需載入
- Directions API 回傳空路線防護 + console.warn 錯誤日誌
- waypoints 上限 25（Google API 硬限制防護）

## [1.1.3.0] - 2026-03-30

### Changed
- ManagePage 重設計為 iMessage chat 氣泡風格 — 用戶訊息右側 coral 氣泡，AI 回覆左側 sand 氣泡含引用條
- 輸入框改為 pill 形狀，1→5 行自動撐高，修改/提問 toggle 移到輸入框上方
- 訊息排序改為最新在下，開啟時自動捲到底部，往上捲載入舊訊息
- Status 顯示從 stepper 進度條改為氣泡下方小 badge
- `[data-reply-content]` CSS 從 inline `<style>` 遷移到 `tokens.css`

### Removed
- `RequestStepper` 不再由 ManagePage 使用（元件保留供未來使用）
- `SCOPED_STYLES` inline style block

## [1.1.2.0] - 2026-03-30

### Added
- `trip_docs_v2` + `trip_doc_entries` 正規化表 — 取代 JSON blob 的 `trip_docs.content`
- `DocCard` 統一文件渲染元件 — 按 section 分組，支援 markdown content
- Migration 0019 `normalize_docs.sql` — 建立新 relational schema
- `migrate-docs-to-v2.js` 遷移腳本 — 直接操作 D1（wrangler d1 execute）
- API backward compat：PUT 仍接受舊 JSON 格式，自動展開為 entries
- entries 數量上限 200 防護

### Changed
- `GET/PUT /api/trips/:id/docs/:type` 改讀寫 `trip_docs_v2 + trip_doc_entries`
- `useTrip` 移除 JSON double-unwrap，直接使用 API 回傳的 `{ title, entries }`
- `TripPage` 5 個 doc switch case 統一用 `DocCard` 渲染
- `rollback.ts` ALLOWED_TABLES 加入新表
- `dump-d1 / init-local-db / import-to-staging / gen-seed-sql` 同步新表

### Removed
- `Flights.tsx` / `Checklist.tsx` / `Backup.tsx` / `Suggestions.tsx` / `Emergency.tsx` 舊元件
- `TripDoc` type interface（已無用）

## [1.1.1.0] - 2026-03-28

### Added
- POI 正規化：新增 `pois` master 表 + `trip_pois` fork 引用表
- MarkdownText `inline` 模式 — `marked.parseInline()` 避免破壞 TEL/URL 格式
- `buildWeatherDay()` — 從 entries 座標即時推導天氣查詢位置（取代 DB 存儲）
- `migrate-pois.js` / `migrate-trip-docs.js` 資料遷移腳本
- `gen-seed-sql.js` seed SQL 生成工具 + 本地/staging seed 資料

### Changed
- **DB 表名統一**：`days`→`trip_days`、`entries`→`trip_entries`、`requests`→`trip_requests`、`permissions`→`trip_permissions`
- **DB 欄位統一**：`body`→`description`、`rating`→`google_rating`、`details`→`description`、移除 `_json` 後綴
- **mapRow 接入 pipeline**：useTrip + TripPage 套用 `mapRow()` 確保 snake_case→camelCase 轉換
- mapDay 加入 `google_rating` snake_case fallback 確保 API 回傳正確映射
- Hotel/InfoBox/Shop/Restaurant 統一使用 MarkdownText 渲染
- TripPage export（MD/CSV）使用 snake_case 欄位名讀取 raw API data
- API 端點全面更新（17 檔案 — 表名 + 欄位名 + rollback column list）
- Rollback TABLE_COLUMNS 修正（hotels: details→description + 加 location）
- 清除所有舊欄位名 fallback（body/rating/details/address）

### Removed
- `FIELD_MAP` 手動映射常數
- `Weather` interface — 天氣改為即時推導
- `weather_json` DB 欄位 + API response ghost weather field

## [1.0.2.1] - 2026-03-28

### Fixed
- 文字反白（::selection）背景色與頁面底色太接近，改用 `color-mix(accent, 30%)` 確保所有主題可見

## [1.0.2.0] - 2026-03-27

### Added
- Requests API cursor-based 分頁 — `limit`/`before`/`beforeId` 參數，回傳 `{ items, hasMore }`
- ManagePage infinite scroll — IntersectionObserver 觸底自動載入下一頁
- Request message Markdown 渲染 — marked.js + sanitizeHtml（原本為純文字）
- Hotel details Markdown 渲染 — marked.parseInline + sanitizeHtml
- `renderMarkdown()` 共用 helper（ManagePage reply + message 共用）

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
