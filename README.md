# Tripline

專為小團體量身打造的旅遊行程網站，讓每位旅伴都能輕鬆查閱行程、即時掌握天氣與交通資訊。

🔗 **線上 Demo**：[https://trip-planner-dby.pages.dev/](https://trip-planner-dby.pages.dev/)

---

## 功能特色

### 行程瀏覽

- 📋 **多行程支援** — 同時管理多套旅遊計畫，一鍵切換
- 🗓️ **每日時間軸** — 景點、餐廳、購物、飯店依時間排列，清晰呈現一天行程
- 🍽️ **三選一餐廳推薦** — 每個用餐時段提供三間選擇，含評分、價位與地圖連結
- 🗺️ **多地圖支援** — 每個景點直連 Google Maps、Apple Maps、Naver Maps

### 即時資訊

- 🌤️ **天氣預報** — 行程日期在 16 天預報範圍內自動顯示逐時天氣
- 🚗 **交通資訊就地呈現** — 每個停留點之間直接顯示交通時間、距離、方式，不必跳到統計卡
- ⏳ **倒數計時器** — 顯示距離出發還有幾天

### 外觀與體驗

- 🌙 **深色模式** — 支援淺色、深色、跟隨系統三種模式
- 🎨 **3 套色彩主題** — 陽光（Sunshine）、晴空（Clear Sky）、和風（Japanese Zen）
- 🖨️ **列印模式** — A4 排版最佳化，可直接列印或輸出 PDF
- 📱 **響應式設計** — 手機、平板、桌機均有對應排版
- ⚡ **PWA 體驗** — 可加入主畫面，離線瀏覽快取

### 旅伴協作

- 💬 **旅伴請求系統** — 傳送「改行程」或「問建議」請求給行程管理員
- 📧 **每日健康日報** — 透過 Gmail 自動寄送當日行程摘要

### 匯出與備份

- 💾 **下載行程** — 支援 PDF、Markdown、JSON、CSV 四種格式

---

## 截圖

> 截圖存放於 `docs/` 目錄。

![每日行程流程](docs/daily-report-flow.png)

---

## 技術文件

- [ARCHITECTURE.md](ARCHITECTURE.md) — 系統組成、資料流、信任邊界、部署拓撲
- [CONTRIBUTING.md](CONTRIBUTING.md) — 新手上路、測試、commit 慣例、常見任務
- [DESIGN.md](DESIGN.md) — 設計系統與視覺規範（暖色有機風、Apple HIG、6 套主題）
- [CLAUDE.md](CLAUDE.md) — 開發流程與 gstack pipeline
- [TODOS.md](TODOS.md) — 已知待辦與 follow-up
- [SPEC.md](SPEC.md) — 進行中的多階段規格（目前：POI Unification 三階段計劃）
- [CHANGELOG.md](CHANGELOG.md) — 版本紀錄
