## 0. 基礎建設

- [x] 0.1 新建 `css/tokens.css` — 從 shared.css 複製 @theme block（token 定義）+ 6 主題深淺模式切換 + @keyframes + 全域 reset + Tailwind v4 imports（`@import "tailwindcss/theme"` + `@import "tailwindcss/utilities"`）
- [x] 0.2 驗證卡點 — Playwright 測試 tokens.css 獨立載入時 Tailwind utilities 生效（computed styles 正確），確認無 Layer 衝突。**此步驟失敗則整個方案重新評估**
- [x] 0.3 修改 `src/entries/main.tsx` — 加入 V1/V2 路由切換邏輯（query string `?v2=1`/`?v1=1` + localStorage `tripline-v2`），V1 和 V2 各用獨立的 `React.lazy` import
- [x] 0.4 路由切換 unit test — 驗證 5 個案例：預設 V1、`?v2=1` → V2、`?v1=1` → 強制 V1、localStorage V2、`?v1=1` 覆蓋 localStorage

## 1. RequestStepperV2

- [x] 1.1 新建 `src/components/shared/RequestStepperV2.tsx` — import tokens.css，所有樣式改 Tailwind inline，功能邏輯從 V1 複製，保留所有 aria-*/role 屬性
- [x] 1.2 RequestStepperV2 unit test — 4 種狀態渲染（open, received, processing, completed）+ a11y 屬性驗證
- [x] 1.3 E2E 截圖比對 — V1 vs V2 computed styles 比對（7 個屬性），手機 + 桌機 + 深色模式

## 2. ToastV2

- [x] 2.1 新建 `src/components/shared/ToastV2.tsx` — import tokens.css，Tailwind inline，保留 role="status" + aria-live="polite" + aria-atomic="true"
- [x] 2.2 ToastV2 unit test — visible/hidden 切換 + icon 種類 + a11y 屬性驗證
- [x] 2.3 E2E 截圖比對 — V1 vs V2 computed styles + 滑入/滑出動畫

## 3. AdminPage（V2 cutover 完成）

- [x] 3.1 新建 `src/pages/AdminPageV2.tsx` — import tokens.css + ToastV2，全 Tailwind inline
- [x] 3.2 AdminPageV2 unit test — 權限列表渲染 + 新增/刪除操作 + 錯誤處理
- [x] 3.3 E2E 截圖比對 — V1 vs V2（手機 + 桌機 + 深色模式 + 6 主題）
- [x] 3.4 互動狀態檢查 — hover/focus/active/disabled + 所有 aria-* 屬性
- [x] 3.5 Cutover — 刪除 V1 AdminPage，rename AdminPageV2→AdminPage，main.tsx /admin 永遠走 V2，移除 V1/V2 比對 E2E

## 4. ManagePageV2

- [ ] 4.1 新建 `src/pages/ManagePageV2.tsx` — import tokens.css + RequestStepperV2 + ToastV2，全 Tailwind inline，含 chat layout + input bar
- [ ] 4.2 ManagePageV2 unit test — 請求清單渲染 + 送出流程 + chat input 狀態
- [ ] 4.3 E2E 截圖比對 — V1 vs V2（手機 + 桌機 + 深色模式）+ Markdown 渲染一致性
- [ ] 4.4 互動狀態檢查 — hover/focus/active/disabled + input focus 狀態

## 5. TripPageV2

- [ ] 5.1 盤點 TripPage 所有子元件清單（20+ 個），決定各自 V2 策略（全 Tailwind / 沿用）
- [ ] 5.2 逐一新建子元件 V2 版本（由小到大）— 每個元件 import tokens.css，Tailwind inline
- [ ] 5.3 新建 `src/pages/TripPageV2.tsx` — 整合所有子元件 V2 版本
- [ ] 5.4 TripPageV2 unit test — 各子元件 V2 渲染 + 狀態管理
- [ ] 5.5 E2E 截圖比對 — V1 vs V2 行程頁主版面（手機 + 桌機 + 深色模式）
- [ ] 5.6 E2E 功能驗證 — QuickPanel / InfoSheet / 地圖載入 / 列印模式

## 6. 切換預設 + 線上驗證

- [ ] 6.1 各功能單元依序切換預設為 V2（`?v1=1` 保留回退）
- [ ] 6.2 Production `?v2=1` 線上測試 — 所有頁面正常
- [ ] 6.3 Production 預設 V2 後 `?v1=1` 回退測試 — 舊版仍正常

## 7. Phase 2 最終清理

- [ ] 7.1 刪除舊版元件檔案（RequestStepper.tsx、Toast.tsx、ManagePage.tsx、AdminPage.tsx、TripPage.tsx + 子元件）
- [ ] 7.2 刪除舊 CSS — shared.css、style.css、map.css
- [ ] 7.3 main.tsx 移除 V1/V2 切換邏輯 — 只保留 V2 路徑
- [ ] 7.4 `git mv` rename 所有 V2 → 原名（如 ManagePageV2.tsx → ManagePage.tsx）
- [ ] 7.5 `npx tsc --noEmit` — 確認所有 import 路徑正確
- [ ] 7.6 E2E 全站回歸 — 跑所有現有 spec 確認無壞
