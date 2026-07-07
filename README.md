# Tripline

專為小團體量身打造的旅遊行程網站，讓每位旅伴都能輕鬆查閱行程、即時掌握天氣與交通資訊。

🔗 **線上 Demo**：[https://trip-planner-dby.pages.dev/](https://trip-planner-dby.pages.dev/)

---

## 功能特色

### 行程瀏覽

- 📋 **多行程支援** — 同時管理多套旅遊計畫，一鍵切換
- 🗓️ **每日時間軸** — 景點、餐廳、購物、飯店依時間排列，清晰呈現一天行程
- 🍽️ **三選一餐廳推薦** — 每個用餐時段提供三間選擇，含評分、價位與地圖連結
- 🗺️ **多地圖支援** — 每個景點直連 Google Maps、Apple Maps、Naver Maps（v2.19.0 改 client 端 `mapsUrl` 從 lat/lng 即時組 URL）

### 行程編輯（v2.19.0+）

- ✏️ **新增 / 編輯行程** — 可改名稱、描述、語言、發布狀態、目的地清單（拖排 / 加 POI / 分配天數）
- 🔁 **正選 / 備選景點** — 同一個行程 entry 可掛 1 個正選 POI + 多個備選 POI（v2.27.0 `trip_entry_pois` junction table），搜尋與收藏都能加入備選
- 🌐 **Google Places 自動補資料** — v2.23.0 起切 Google Maps Platform。POI 即時 `POST /api/pois/:id/enrich` (Place Details API) + 30 天 daily refresh (50/day cap) 自動更新評分 / 營業時間 / 狀態 (active / closed / missing)
- 🚗 **景點重排自動更新車程** — 拖拉景點順序時自動 Google Routes API 重算路徑 (driving / walking / transit)。無 fallback，網路失敗顯示 stale ⚠
- 📅 **多目的地子表** — 跨城市行程可分配每地天數（沖繩 3 天 / 京都 2 天）

### 即時資訊

- 🌤️ **天氣預報** — 行程日期在 16 天預報範圍內自動顯示逐時天氣
- 🚗 **交通資訊就地呈現** — 每個停留點之間直接顯示交通時間、距離、方式，不必跳到統計卡
- ⏳ **倒數計時器** — 顯示距離出發還有幾天

### 外觀與體驗

- 🌙 **深色模式** — 支援淺色、深色、跟隨系統三種模式
- 🎨 **V2 Terracotta 設計系統** — `#D97848` 暖色 accent + cream bg (v2.4.0+，取代舊 Sunshine/ClearSky/Japanese 三主題)
- 🖨️ **列印模式** — A4 排版最佳化，可直接列印或輸出 PDF
- 📱 **響應式設計** — 手機、平板、桌機均有對應排版
- ⚡ **PWA 體驗** — 可加入主畫面，離線瀏覽快取（含 maskable icon v2.33.63）

### 介面架構（v2.4.0+）

- 🖥️ **桌機 3-pane shell（≥1024px）** — 左 sidebar 240px（中文 label nav：聊天 / 行程 / 地圖 / 收藏，未登入加「登入」）+ 中央 timeline + 右 sheet（min(780px, 40vw)）。Trip detail TitleBar action 全 icon-only（探索 🔍 + 切換行程 ⇄ dropdown picker + ⋮ menu）
- 📱 **手機單欄 + bottom nav（<1024px）** — sticky bottom nav 5-tab IA：聊天 / 行程 / 地圖 / 收藏 / 帳號（logged-in）。配合 ActiveTripContext，從 trip 進其他 tab 自動帶入當前 trip context
- 🔗 **URL-driven sheet state** — `/trip/:id?sheet=map|chat` 可深度連結 + 瀏覽器 back/forward 正常。chat tab embed `<ChatPage embedded lockTripId>` trip-scoped AI 聊天
- 🎨 **V2 Terracotta 設計系統** — `#D97848` accent + `#FFFBF5` cream bg + `#2A1F18` warm-dark fg，5 個 auth page 桌機版 split-screen（左 form card、右 brand hero gradient pane）
- 🗺️ **`/trips` landing** — country-keyed peach-gradient trip cards（JP / KR / TW / 其他），點進去 → trip detail
- 🗺️ **POI Master + Entry junction** — `pois` 是 master (AI 維護)，`trip_entry_pois` junction (v2.27.0) 可一 entry 掛多 POI (master sort_order=1 + alternates)。v2.29.0 起 `trip_pois` 已 drop，metadata 改 master / junction 兩處
- 📨 **OAuth invitation** — invitation token HMAC stored，30 天 / 7 天 retention auto sweep (v2.33.61)

### 帳號與認證（v2.4.0+）

- 🔐 **V2 OAuth sole auth** — Cloudflare Access 已全拆，瀏覽器走 self-signup + email/password（`tripline_session` opaque cookie）
- 🤖 **CLI / service tokens** — `/api/oauth/token` `grant_type=client_credentials`（RFC 6749 §4.4）給 scheduler scripts、admin tooling 用
- 📧 **Email verification + password reset** — 自建流程帶 1h TTL token + 限制（rate limit、anti-enumeration）
- 🖥️ **多裝置 session 管理** — `/settings/sessions` 看登入裝置、撤銷單一 session 或一鍵登出全部其他裝置
- 🔌 **OAuth client_apps** — `/settings/connected-apps`（user 端撤銷授權）+ `/developer/apps`（dev 端建立 OAuth client）

### 旅伴協作

- 💬 **旅伴請求系統** — 傳送「改行程」或「問建議」請求給行程管理員
- 📧 **每日健康日報** — 透過 Gmail 自動寄送當日行程摘要

### 匯出與備份

- 💾 **下載行程** — 支援 PDF、Markdown、JSON、CSV 四種格式

---

---

## 技術文件

- [ARCHITECTURE.md](ARCHITECTURE.md) — 系統組成、資料流、信任邊界、部署拓撲
- [CONTRIBUTING.md](CONTRIBUTING.md) — 新手上路、測試、commit 慣例、常見任務
- [DESIGN.md](DESIGN.md) — 設計系統與視覺規範（暖色有機風、Apple HIG、6 套主題）
- [CLAUDE.md](CLAUDE.md) — 開發流程與 gstack pipeline
- [TODOS.md](TODOS.md) — 已知待辦與 follow-up
- [SPEC.md](SPEC.md) — 進行中的多階段規格（目前：POI Unification 三階段計劃）
- [CHANGELOG.md](CHANGELOG.md) — 版本紀錄
