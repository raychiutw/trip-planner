# Trip-Planner 專案優化掃描報告

**日期**：2026-03-22
**掃描團隊**：Reviewer A（前端）、Reviewer B（API）、Reviewer C（CSS+建置）、Challenger（11 視角）

---

## 總覽

| 嚴重度 | 數量 | 說明 |
|--------|------|------|
| 🔴 高  | 7    | 需優先修復 — 安全風險、資料完整性、效能瓶頸 |
| 🟡 中  | 24   | 建議改善 — 品質提升、技術債清理 |
| 🟢 低  | 18   | 可選優化 — 微調、打磨 |

---

## 🔴 高嚴重度（7 項）

### H1. [API 安全] restaurants POST schema 不匹配
- **檔案**：`functions/api/trips/[id]/entries/[eid]/restaurants.ts:50-58`
- **問題**：INSERT 使用 `parent_type` + `parent_id`，但 `restaurants` 表的 FK 是 `entry_id`。此端點在 runtime 會失敗。
- **建議**：改用 `entry_id` 欄位

### H2. [API 安全] requests status CHECK constraint 不一致
- **檔案**：`functions/api/requests/[id].ts:49`
- **問題**：API 驗證 `['open','received','processing','completed']`，但 DB constraint 是 `('open','closed')`。寫入會違反 DB 約束。
- **建議**：統一 API 與 DB schema 的狀態值

### H3. [資安] JWT 不驗簽名
- **檔案**：`functions/api/_middleware.ts:43-52`
- **問題**：`decodeJwtPayload` 只做 base64 解碼，不驗證簽名。若繞過 Cloudflare Access，任何人可偽造身份。
- **建議**：用 Access public key 驗簽，或確認 100% 路由都受 Access 保護

### H4. [資安] Service Token 不驗值
- **檔案**：`functions/api/_middleware.ts:210-218`
- **問題**：只要 header 存在就給 admin 權限，不驗證 header 值是否正確。若有路由繞過 Access，任意 header 值即獲 admin。
- **建議**：server-side 驗證 client ID 值比對 env variable

### H5. [API 品質] PUT days/:num 非原子寫入
- **檔案**：`functions/api/trips/[id]/days/[num].ts:180-249`
- **問題**：先 batch 刪舊資料，再逐一 INSERT。若中途失敗，資料半刪半寫。
- **建議**：合併所有 DELETE + INSERT 為單一 `db.batch()` 呼叫

### H6. [前端效能] Timeline isToday 每次 render 重算，破壞 useMemo
- **檔案**：`src/components/trip/Timeline.tsx:37`
- **問題**：`new Date().toISOString().split('T')[0]` 在 render body 計算，是 useMemo 的依賴 → memo 被完全繞過。
- **建議**：用 `useMemo` 包裹 isToday，或從 parent 傳入

### H7. [前端效能] DaySection 每次 render 產生新 timeline array
- **檔案**：`src/pages/TripPage.tsx:164`
- **問題**：`.map(toTimelineEntry)` 每次產生新 array reference → 子元件 memo 全部失效。
- **建議**：用 `useMemo` 包裹 timeline mapping，keyed on `day?.timeline`

---

## 🟡 中嚴重度（24 項）

### 前端

| # | 問題 | 檔案 |
|---|------|------|
| M1 | `usePrintMode` togglePrint 有 stale closure 風險 | `src/hooks/usePrintMode.ts:37-54` |
| M2 | Weather cache 無過期/清除機制 | `src/lib/weather.ts:104` |
| M3 | Body scroll lock 邏輯在 InfoSheet + QuickPanel 重複 ~60 行 | `src/components/trip/InfoSheet.tsx:65-82`, `QuickPanel.tsx:75-92` |
| M4 | `DayNav` long-press timer unmount 時未清除（memory leak） | `src/components/trip/DayNav.tsx:140-153` |
| M5 | `Record<string, unknown>` + `as unknown as` 型別斷言遍佈 mapDay | `src/lib/mapDay.ts`, `TripPage.tsx:102-103` |
| M6 | `toTimelineEntry` 遺失 `id`，Timeline key 退化為 index | `src/lib/mapDay.ts:85-127` |
| M7 | `weather_json` 原始 key 檢測是 fragile workaround | `src/pages/TripPage.tsx:102-107` |
| M8 | Sentry 同步 import 到所有 4 個 entry（~30-50KB） | `src/entries/*.tsx` |
| M9 | `useTrip` loading=false 但 day 資料還沒到（假完成） | `src/hooks/useTrip.ts:201` |

### API

| # | 問題 | 檔案 |
|---|------|------|
| M10 | `requestId \|\| null` falsy coercion（0 → null） | `functions/api/_audit.ts:19` |
| M11 | `hasPermission` 在 requests.ts 重複定義 | `functions/api/requests.ts:27-34` |
| M12 | `json()` helper 在 15 個檔案 copy-paste | 所有 API 檔案 |
| M13 | `Env` / `AuthData` interface 重複宣告 | 所有 API 檔案 |
| M14 | hotel shopping 查詢未加入 Promise.all | `functions/api/trips/[id]/days/[num].ts:50-53` |
| M15 | 無 request body size 限制 | 所有 PUT/POST/PATCH handler |
| M16 | `(context.data as any)?.auth` 型別不一致 | 多個 API 檔案 |

### CSS / 建置

| # | 問題 | 檔案 |
|---|------|------|
| M17 | `--color-badge-*` 在 theme-sun.dark 重複宣告 | `css/shared.css:191-192` |
| M18 | `.sticky-nav` 規則未加 page scope，跨頁衝突風險 | `css/admin.css:11`, `css/manage.css:366` |
| M19 | Light theme 缺少 badge/plan color tokens（5 個主題） | `css/shared.css` 多處 |
| M20 | `@types/react` 和 `typescript` 放在 dependencies 而非 devDependencies | `package.json:30-31,37` |
| M21 | `functions/` 被 tsconfig exclude → API 沒有 type checking | `tsconfig.json:20` |

### 其他

| # | 問題 | 檔案 |
|---|------|------|
| M22 | `shopping` 表多態關聯無 FK，可能產生孤兒記錄 | `migrations/0002_trips.sql:88-103` |
| M23 | `days` 表 NOT NULL 約束只靠 API 層 | `migrations/0010_days_not_null.sql` |
| M24 | `requests` 表 `title`/`body` NOT NULL 但新 API 只寫 `message` | `migrations/0001_init.sql:5-6` |

---

## 🟢 低嚴重度（18 項）

| # | 問題 | 檔案 |
|---|------|------|
| L1 | QuickPanel 靜態 filter 每次 render 重算 | `QuickPanel.tsx:181-183` |
| L2 | sheetContent useMemo 依賴 13 個值 | `TripPage.tsx:932` |
| L3 | AdminPage `(err as Error).message` 無 instanceof check | `AdminPage.tsx:65,135,152` |
| L4 | `docs` state 型別用 `unknown`，消費端要 cast | `useTrip.ts:40,53` |
| L5 | Focus trap 邏輯在 InfoSheet + QuickPanel 重複 | `InfoSheet.tsx:247-266`, `QuickPanel.tsx:122-141` |
| L6 | ManagePage 直接 import marked 而非用 renderMarkdown | `ManagePage.tsx:10` |
| L7 | Close button SVG 在 3 個 page 重複（可用 Icon 元件） | `SettingPage, ManagePage, AdminPage` |
| L8 | ManagePage 用 raw fetch 而非 apiFetch | `ManagePage.tsx:124,144,228` |
| L9 | HourlyWeather daysUntil 無 timezone 感知 | `HourlyWeather.tsx:31-37` |
| L10 | marked 同步 import 拉大 bundle | `src/lib/sanitize.ts:85` |
| L11 | useDarkMode auto 模式不監聽系統主題切換 | `src/hooks/useDarkMode.ts` |
| L12 | `.nav-close-btn` 缺 `cursor: pointer` | `css/shared.css:666` |
| L13 | print-mode 雙路徑需同步維護 | `css/style.css:380-552` |
| L14 | Vite 無 manualChunks 策略 | `vite.config.ts` |
| L15 | Dev proxy 指向 production | `vite.config.ts:40` |
| L16 | CSS selector test 未涵蓋 manage/admin | `tests/unit/css-selector.test.js:15-18` |
| L17 | 無認證端點 integration test | `tests/` |
| L18 | `Number(num)` 未驗 NaN | 多個 API 路由檔案 |

---

## Challenger 11 視角重點質疑

| 視角 | 最關鍵質疑 |
|------|-----------|
| 📋 需求 | `js/` 舊版仍存在，雙軌維護成本 |
| 💻 程式 | PUT days 非原子寫入（H5）、shopping 多態無 FK（M22） |
| ✅ 品質 | API middleware + auth 零測試覆蓋 |
| 🔒 資安 | JWT 不驗簽（H3）、Service Token 不驗值（H4） |
| ⚡ 效能 | useTrip 初載全天並發 19 請求；無 React.lazy |
| 🐛 漏洞 | marked `^17.0.4` 大版本自動升級 + XSS 歷史 |
| ♿ 無障礙 | Timeline 核心元件零 ARIA 標記 |
| 🌐 相容性 | CSP `unsafe-inline`、`color-mix` 舊瀏覽器不支援 |
| 📊 資料 | days NOT NULL 只靠 API（M23）、requests schema 不一致（M24） |
| 💰 成本 | 每個 4xx 都寫 D1 log → 掃描攻擊可耗盡免費配額 |
| 🎨 UX | loading 假完成 → 使用者點 Day 仍在載入（M9） |

---

## 建議修復優先順序

### 第一批：安全 + 資料完整性（H1-H5）
修復 API schema 不匹配、認證漏洞、非原子寫入

### 第二批：前端效能（H6-H7, M1-M9）
Timeline memo 修復、bundle 優化、重複邏輯抽取

### 第三批：API 品質（M10-M16）
共用工具抽取、型別統一、body size 限制

### 第四批：CSS + 建置 + 測試（M17-M24, L1-L18）
主題 token 補齊、tsconfig 修正、測試覆蓋補齊

---

## 做得好的地方

- SQL 全部使用 parameterized queries，無 injection 風險
- ALLOWED_FIELDS 白名單限制寫入欄位
- Audit log 完整記錄所有變更 + 支援 rollback
- CSRF Origin 驗證設計合理
- CSS design token 系統完整（8 主題 × light/dark）
- CSS HIG 合規性有自動化測試
- React 元件分離乾淨，memo/useCallback 使用普遍
