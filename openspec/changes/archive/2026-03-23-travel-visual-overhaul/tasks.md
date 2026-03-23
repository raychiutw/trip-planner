## 1. SVG 背景插畫

- [x] 1.1 建立 `images/bg-sun-light.svg`（椰子樹、太陽光芒、海浪、飛機、雲朵，暖橘黃色系，opacity 40–50%）
- [x] 1.2 建立 `images/bg-sun-dark.svg`（sun 元素深色版，opacity 22–30%）
- [x] 1.3 建立 `images/bg-sky-light.svg`（熱氣球、海鷗、雲朵、帆船、海浪，天藍色系，opacity 40–50%）
- [x] 1.4 建立 `images/bg-sky-dark.svg`（sky 元素深色版，opacity 22–30%）
- [x] 1.5 建立 `images/bg-zen-light.svg`（鳥居、櫻花枝、飄落花瓣、遠山、禪圓，紫粉色系，opacity 40–50%）
- [x] 1.6 建立 `images/bg-zen-dark.svg`（zen 元素深色版，opacity 22–30%）
- [x] 1.7 在 `css/style.css` 新增背景插畫 CSS 規則（依 `.theme-{name}` × `body.dark` 切換 `background-image`，加上 `background-size: cover; background-attachment: fixed; background-position: center`）
- [x] 1.8 在 `css/style.css` 新增列印模式隱藏背景插畫規則（`.print-mode body, @media print`）

## 2. 卡片半透明化

- [x] 2.1 在 `css/style.css` 中，將卡片背景改為半透明 + `backdrop-filter: blur(6px)`（淺色模式）
- [x] 2.2 在 `css/style.css` 中，新增深色半透明背景規則
- [x] 2.3 在 `css/style.css` 中，新增列印模式還原不透明規則
- [x] 2.4 驗證文字對比度：確認淺色與深色模式下主要文字對比度均 > 4.5:1

## 3. Sticky Nav 改造

- [x] 3.1 修改 `src/pages/TripPage.tsx`：nav-brand 顯示行程名稱
- [x] 3.2 修改 `src/pages/TripPage.tsx`：移除 `<div className="nav-actions">` 區塊
- [x] 3.3 在 `css/style.css` 中，移除 `.nav-actions`、`.nav-action-btn`、`.nav-action-label` 樣式
- [x] 3.4 在 `css/style.css` 中，新增 `.nav-brand` 文字截斷樣式

## 4. Speed Dial 擴展

- [x] 4.1 修改 `src/components/trip/SpeedDial.tsx`：新增 `onPrint` prop
- [x] 4.2 修改 `src/components/trip/SpeedDial.tsx`：新增 printer 與 settings 項目
- [x] 4.3 修改 `src/components/trip/SpeedDial.tsx`：printer/settings 特殊處理
- [x] 4.4 修改 `src/pages/TripPage.tsx`：傳入 `onPrint={togglePrint}`
- [x] 4.5 確認無媒體查詢隱藏 Speed Dial
- [x] 4.6 更新 transition-delay 對應 8 個項目

## 5. Build + 測試

- [x] 5.1 執行 `npm run build`，確認建置成功
- [x] 5.2 更新 E2E：nav-brand 顯示行程名稱
- [x] 5.3 更新 E2E：Speed Dial 包含 printer 與 settings
- [x] 5.4 更新 E2E：nav-actions 不存在
- [ ] 5.5 執行 E2E 測試通過
