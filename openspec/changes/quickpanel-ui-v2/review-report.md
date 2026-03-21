# Code Review Report: quickpanel-ui-v2

**Reviewer**: Code Reviewer (Opus)
**Date**: 2026-03-21
**Decision**: **REQUEST CHANGES**

---

## Summary

本次改動將 QuickPanel 從 drill-down 架構簡化為純 grid 選單，行程切換和外觀設定移至 InfoSheet。整體架構方向正確，程式碼品質良好，但有 2 項 Critical 問題必須修復。

---

## Plan Alignment

提案要求 7 項改動，tasks.md 列出 4 大類共 10 項 checkbox，全部勾選完成。

| 提案項目 | 實作狀態 | 備註 |
|----------|---------|------|
| FAB 點開後隱藏 | OK | opacity:0 + pointer-events:none |
| 面板高度 85vh/85dvh | OK | fallback + @supports |
| 3x3 grid（9 項上半部） | OK | Section A(4) + B(5) = 9 |
| 卡牌樣式 | OK | background + radius-sm + shadow-md + font-size-footnote |
| 行程/外觀改走 InfoSheet | OK | drill-down 已移除 |
| QuickPanel 移除 drill-down | OK | 純 grid，無 view state |
| Focus 外框修復 | OK | :focus:not(:focus-visible) |

---

## Issues

### Critical (must fix)

#### C-1: TripPage appearance sheet 缺少 `data-theme` attribute

**檔案**: `src/pages/TripPage.tsx` 第 935-938 行

TripPage 的 appearance case 中 `color-theme-card` button 沒有加上 `data-theme={t.key}` attribute，但 E2E 測試 `tests/e2e/quick-panel.spec.js` 第 285、291、312、319 行使用 `.color-theme-card[data-theme="sky"]` 等選取器。

對照 `src/pages/SettingPage.tsx` 第 222 行，設定頁有加 `data-theme={t.key}`，TripPage 遺漏了。

**影響**:
- E2E 測試第 8、9 組（主題切換即時生效 + Night 主題選擇）共 4 個 test case 會因找不到元素而 timeout 失敗
- tasks.md 勾選的 "4.2 npm test 全過" 不包含 E2E，E2E 跑下去一定會 fail

**修復**: 在 TripPage.tsx 第 937-938 行之間加上 `data-theme={t.key}`：

```tsx
<button
  key={t.key}
  className={clsx('color-theme-card', t.key === colorTheme && 'active')}
  data-theme={t.key}          // <-- 補上
  onClick={() => setTheme(t.key)}
>
```

---

#### C-2: `sheetContent` useMemo 缺少 `currentDay` 依賴

**檔案**: `src/pages/TripPage.tsx` 第 955 行

`sheetContent` 的 useMemo 在 `case 'today-route'`（第 856 行）使用了 `currentDay`，但依賴陣列中沒有 `currentDay`。

**影響**: 如果使用者在 `today-route` sheet 開啟狀態下切換天數，sheet 內容不會隨 `currentDay` 更新。這違反 React Hooks 規則（exhaustive-deps），且 TypeScript strict mode 下的 ESLint 應該會警告。

**修復**: 在第 955 行依賴陣列中加入 `currentDay`：

```tsx
}, [activeSheet, flightsData, checklistData, backupData, emergencyData, suggestionsData,
    tripDrivingStats, currentDay, handleSheetClose, sheetTrips, sheetTripsLoading,
    activeTripId, handleTripChange, colorMode, setColorMode, colorTheme, setTheme, isDark]);
```

---

### Important (should fix)

#### I-1: `handleSheetClose` 列在 useMemo 依賴但未在內部使用

**檔案**: `src/pages/TripPage.tsx` 第 955 行

`handleSheetClose` 出現在 `sheetContent` 的依賴陣列中，但 switch 內部所有 case 都沒有引用它。多餘的依賴不會造成錯誤，但會導致不必要的重算。

**修復**: 從依賴陣列中移除 `handleSheetClose`。

---

#### I-2: trip-select sheet 的載入中文字使用 inline Tailwind-like class 而非已定義常數

**檔案**: `src/pages/TripPage.tsx` 第 892 行

```tsx
<div className="text-center p-10 text-[var(--color-muted)]">載入中...</div>
```

第 40 行已定義 `LOADING_CLASS = 'text-center p-10 text-[var(--color-muted)]'`，應復用。

**修復**: 改為 `<div className={LOADING_CLASS}>載入中...</div>`。

---

### Suggestions (nice to have)

#### S-1: QuickPanel scroll lock cleanup 不還原捲動位置

**檔案**: `src/components/trip/QuickPanel.tsx` 第 79-83 行

cleanup function 只清除 body style 但不呼叫 `window.scrollTo(0, savedBodyScrollY.current)`。若元件在 open 狀態下卸載，頁面會停在 top: 0 位置。

**備註**: 此模式與 InfoSheet 一致，屬既有設計。如果決定修，兩個元件都應一起改。列為 S 級。

#### S-2: Section A+B 合併渲染可簡化

**檔案**: `src/components/trip/QuickPanel.tsx` 第 163-186 行

sectionA 和 sectionB 分別 `.map()` 但放在同一個 `.quick-panel-grid` 內，渲染邏輯完全相同。可合併為 `[...sectionA, ...sectionB].map(...)` 減少重複。

---

## Checklist Review (8+2)

| # | 項目 | 結果 | 備註 |
|---|------|------|------|
| 1 | 正確性 | FAIL | C-1 缺 data-theme 導致 E2E 必敗；C-2 缺 currentDay 依賴 |
| 2 | 可讀性 | PASS | 命名清晰，結構分明，注釋充分 |
| 3 | 測試覆蓋 | PASS* | unit test 28 cases + E2E 17 cases，覆蓋全面。*但 E2E 中 4 case 因 C-1 會失敗 |
| 4 | 架構影響 | PASS | drill-down 移除乾淨，sheet 委派至 TripPage 正確 |
| 5 | 效能 | PASS | useMemo/useCallback 正確使用，grid 靜態渲染無多餘 re-render |
| 6 | 安全性 | PASS | 無外部輸入拼接、無 dangerouslySetInnerHTML |
| 7 | 向後相容 | PASS | 舊元件（SpeedDial/DownloadSheet）已完全移除且有守護測試 |
| 8 | Design Pattern | PASS | 符合 SOLID，QuickPanel 純展示 + callback 向上傳遞 |
| 9 | 技術債 | OK | I-1 多餘依賴、I-2 未復用常數 |
| 10 | 跨模組 side effect | PASS | body scroll lock 與 InfoSheet 不衝突（React 18 batching） |

### tp-code-verify

| 規則 | 結果 | 備註 |
|------|------|------|
| naming | PASS | CSS class: kebab-case；JS: camelCase；常數: UPPER_SNAKE |
| css-hig | PASS | 全使用 design token（--radius-sm, --shadow-md, --font-size-footnote 等） |
| coding-standards | PASS | min-height: var(--tap-min) 觸控目標；border: none 無框線；inline SVG |
| react-best-practices | FAIL | C-2 useMemo 依賴不完整 |
| code-review-rules | PASS | cancelled guard 正確（第 306 行）；apiFetch 正確使用 |

### tp-ux-verify

| 規則 | 結果 | 備註 |
|------|------|------|
| font-size token | PASS | --font-size-footnote 是 11 級 Apple text style 之一 |
| spacing 4pt grid | PASS | --spacing-1/2/3/4/5 全為 4pt 倍數 |
| border-radius token | PASS | --radius-sm / --radius-lg |
| transition duration | PASS | --transition-duration-fast/normal/slow |
| overlay | PASS | --color-overlay |
| 觸控目標 | PASS | --tap-min: 44px |
| focus 處理 | PASS | :focus:not(:focus-visible) 正確隱藏程式化 focus ring |

---

## What Was Done Well

1. **QuickPanel 簡化做得乾淨** -- drill-down 邏輯完全移除，view state 消失，元件職責單一
2. **CSS token 使用一致** -- 所有樣式值都透過 design token，無硬編碼魔術數字
3. **測試覆蓋全面** -- unit test 檢查結構完整性、E2E 覆蓋 10 個使用者場景
4. **body scroll lock** -- 與 InfoSheet 採用相同 pattern，iOS Safari 安全
5. **a11y** -- role="dialog", aria-modal, aria-label, aria-expanded 全部正確

---

## Verdict

**REQUEST CHANGES** -- 請修復 C-1 和 C-2 後重新提交。I-1、I-2 建議一併處理。
