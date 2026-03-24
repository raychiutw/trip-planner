# Tripline 專案報告

**日期**：2026-03-25
**專案**：trip-planner（Tripline）
**網址**：https://trip-planner-dby.pages.dev/
**技術棧**：React + TypeScript + Vite + Cloudflare Pages + D1

---

## 專案概要

Tripline 是一個行程共享網站，讓旅伴即時查看、編輯行程，內建 AI 行程分析、旅伴請求系統、權限管理。目前服務沖繩旅行團，正朝產品化方向發展。

---

## 三月開發數據

| 指標 | 數值 |
|------|------|
| 總 commits | 516 |
| PR 數量 | 70（#15 → #110） |
| 程式碼變更 | +387,000 / -145,125 行 |
| feat commits | 35 |
| fix commits | 82 |
| refactor commits | 7 |

---

## 重大里程碑

### Phase 1-7：基礎功能建設（3月初）

| 階段 | 內容 |
|------|------|
| UI 基礎 | Claude web 風格色碼、深色/淺色模式、卡片統一設計 |
| 選單重構 | 漢堡選單 → 左側滑入抽屜（Claude app sidebar 風格） |
| 導覽列 | sticky nav + Day pills + 車程統計 |
| Emoji → SVG | 全站 Icon 從 Emoji 改為 Inline SVG（Rounded 風格） |
| 行程編輯 | 自然語言編輯功能 + edit.html |
| 資訊面板 | 桌機持久側邊欄 + 交通統計 + 建議優先度標示 |
| OpenSpec | 導入 openspec 流程管理功能開發 |

### Phase 8：品牌重塑（PR #100）

- 產品命名為 **Tripline**
- Logo 設計：三波紋穿越 SVG + Caveat 手寫字體
- Favicon 更新：三波紋圖示（32x32, 16x16, apple-touch-icon）
- URL routing 改為 `/trip/:tripId`

### Phase 9：SPA 架構改造（PR #101）

**最大的架構決策**：4 個獨立 HTML 入口 → 單一 SPA（React Router + lazy loading）

- 消除多頁面架構的路徑計算問題
- React 狀態跨頁保留（dark mode、選中行程）
- CSS 碎片化解決（4 套 → 共用載入）
- 刪除 setting.html（功能併入行程頁）
- Tailwind CSS 引入（漸進式遷移）

### Phase 10：UI 細節打磨（PR #102-#110）

- 手機版 sticky-nav Logo（32px 三波紋）
- trip_docs API 改公開讀取
- QuickPanel section A/B 分隔線 + drag handle
- Handle 短線樣式反覆迭代（5 個 PR：#106-#110）

### Phase 11：功能改善 + 品牌個性化（本次 session）

- **URL 行程切換**：`?trip=xxx` 比對已發布行程 → 比對不到用 `is_default` 預設行程
- **舊版 query string 相容**：`?trip=` 轉為 React Router `/trip/:tripId` 路由
- **HuiYun 建議資料修正**：移除過期亂碼問題，重新產生 AI 建議
- **命名個性化**：「建議」→「🔮 解籤」、「問建議」→「問事情」（廟宇問事風格）

---

## 架構演進

```
3月初          →  3月中          →  3月底
─────────────────────────────────────────
4 HTML 入口      React 元件化      單一 SPA
原生 CSS         CSS Tokens        Tailwind 漸進遷移
Emoji icons      SVG icons         SVG + 品牌 Logo
vanilla JS       React + TS        React Router + lazy
本地 MD 檔       D1 database       D1 + API + audit log
無認證           CF Access          Zero Trust + Service Token
```

---

## 技術棧現況

### 前端
- **框架**：React 18 + TypeScript（strict mode）
- **建置**：Vite 多入口（已簡化為單入口 SPA）
- **路由**：React Router v6（`/trip/:tripId`、`/manage`、`/admin`）
- **樣式**：原生 CSS tokens + Tailwind（漸進遷移中）
- **狀態**：React hooks + localStorage（6 個月 TTL）

### 後端
- **平台**：Cloudflare Pages（Functions）
- **資料庫**：Cloudflare D1（SQLite）
- **認證**：Cloudflare Access（Zero Trust）
- **API**：RESTful，公開讀取 + 認證寫入

### 開發工具
- **CI/CD**：GitHub Actions（tsc + test + build + verify-sw）
- **流程**：gstack 7 階段 pipeline（Think → Plan → Build → Review → Test → Ship → Reflect）
- **功能管理**：OpenSpec（Explore → Propose → Apply → Archive）
- **通訊**：Discord bot + Telegram bot（Claude Code 整合）

---

## 資料庫結構

```
trips → days → entries → restaurants
                      → shopping
      → hotels
      → trip_docs（flights/checklist/backup/suggestions/emergency）
      → audit_log
      → requests（旅伴請求）
      → permissions
```

- 10 張表，FK cascade 關聯
- audit_log 記錄所有修改 + snapshot + rollback
- D1 Time Travel 作為災難恢復機制

---

## 已知問題

| 問題 | 影響 | 狀態 |
|------|------|------|
| Chrome 手機版捲動彈回（非行程頁） | 已用 `.page-simple` class 解決 | ✅ 已解決 |
| Handle 短線 dark mode 可見度 | 經 5 個 PR 迭代解決 | ✅ 已解決 |
| `@googlemaps/js-api-loader` 缺少 | tsc + build 失敗 | ⚠️ 待解決 |

---

## 開發模式觀察

### 什麼運作良好

1. **gstack pipeline 確保品質**：即使是 1 行 CSS 也走完整 Review 流程，避免累積技術債
2. **Discord/Telegram bot 整合**：旅伴可直接在群組反映問題，Claude 即時處理
3. **D1 + API 架構**：資料操作全透過 API，前後端解耦乾淨
4. **OpenSpec 流程**：大功能有完整的 Explore → Propose → Apply → Archive 追蹤

### 什麼需要改善

1. **Handle 短線迭代了 5 個 PR**（#106-#110）：CSS 細節在手機上的表現難以預測，需要更好的手機預覽流程
2. **npm test 在 pipeline 中重複執行**：Build、Review、Test 各跑一次，可以優化
3. **simplify 和 review 的掃描範圍重疊**：兩個階段都在做 code quality 檢查

### 產品化方向

- 品牌已建立（Tripline + 三波紋 Logo）
- 命名個性化開始（解籤/問事情 — 廟宇問事風格）
- URL 分享功能完善（`?trip=xxx` 相容舊版 + React Router）
- 下一步：多行程支援、公開分享頁、行程模板

---

## 關鍵決策記錄

| 決策 | 選擇 | 理由 |
|------|------|------|
| 多頁面 → SPA | React Router | 消除路徑問題 + 狀態保留 |
| CSS 方案 | 原生 tokens + Tailwind 漸進遷移 | 不一次性重寫，降低風險 |
| Service Worker | `navigateFallback: null` | 避免 SW 和 React Router 衝突 |
| 預設行程機制 | DB `is_default` 欄位 | URL 比對不到時有合理 fallback |
| 「建議」改名 | 解籤 + 問事情 | 廟宇問事雙關，品牌個性化 |
| 認證架構 | Cloudflare Access | 免自建 auth，Zero Trust 成員自動授權 |

---

*報告由 Claude Code 自動生成，基於 git history + codebase 分析*
