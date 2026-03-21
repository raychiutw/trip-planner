# QC Report — fab-bottom-panel（第二輪）

**日期**：2026-03-21
**驗證者**：QC
**Reviewer 狀態**：已 APPROVE（第二輪）

---

## 逐項驗證結果

### 核心功能

#### 1. QuickPanel.tsx — 14 項 grid、FAB 上下箭頭、drill-down、body scroll lock

- **14 項 grid**：`PANEL_ITEMS` 陣列共 14 項（A=4, B=6, C=4），分布正確。**PASS**
- **FAB 上下箭頭**：使用單一上箭頭 SVG（`M12 8l-6 6h12z`），開啟時 CSS `.quick-panel.open .quick-panel-arrow { transform: rotate(180deg); }` 旋轉為下箭頭，符合設計。**PASS**
- **drill-down**：支援 `grid`、`trip-select`、`appearance` 三種視圖切換，trip-select 呼叫 `apiFetch<TripListItem[]>('/trips')`，appearance 顯示色彩模式（3 選項）與主題色（6 選項）。**PASS**
- **body scroll lock**：使用 `document.body.style.position = 'fixed'` + `savedBodyScrollY.current` 鎖定捲動，與 InfoSheet 同樣模式。**PASS**

#### 2. TripPage.tsx — SpeedDial → QuickPanel 替換、SPA 行程切換（resolveKey，無 reload）

- **SpeedDial → QuickPanel**：`import QuickPanel from '../components/trip/QuickPanel'`，無 SpeedDial import。**PASS**
- **SPA 行程切換**：`handleTripChange` 呼叫 `setResolveKey((k) => k + 1)`，`useEffect` 依賴 `[resolveKey]` 重新觸發 resolve，不做 `window.location.reload()`。**PASS**

#### 3. Night 主題 — shared.css `.theme-night`、useDarkMode.ts、SettingPage.tsx

- **shared.css**：`body.theme-night` 與 `body.theme-night.dark` CSS 規則均存在，含完整 CSS 變數（accent、background 等）。**PASS**
- **useDarkMode.ts**：`ColorTheme` 型別包含 `'night'`，`THEME_CLASSES` 包含 `'theme-night'`，`THEME_COLORS` 有 `night` 條目。**PASS**
- **SettingPage.tsx**：`COLOR_THEMES` 陣列包含 `{ key: 'night', label: '夜城', desc: 'Night City' }`。**PASS**

#### 4. ThemeArt.tsx — night-light / night-dark SVG 裝飾存在

- `NightLightHeader`、`NightDarkHeader` 函式存在，含城市天際線剪影 SVG。
- `NightLightDivider`、`NightDarkDivider` 存在。
- `NightLightFooter`、`NightDarkFooter` 存在。
- `DayHeaderArt` content 對應表有 `'night-light'` 和 `'night-dark'` 鍵值。
- NavArt `case 'night-light'` 和 `case 'night-dark'` 均存在。

**PASS**

---

### Bug 修復

#### 5. mapDay.ts — buildLocation fallback（地名非 URL 時作為 name）

```typescript
const isUrl = maps ? /^https?:/i.test(maps) : false;
const nameValue: string | undefined =
  (name ?? undefined) || (!isUrl && maps ? maps : undefined) || undefined;
return {
  name: nameValue,
  googleQuery: isUrl ? (maps ?? undefined) : undefined,
  ...
};
```

非 URL 的 maps 值會作為 `name` 的 fallback，避免產生空查詢 `?q=`。**PASS**

#### 6. style.css — `.restaurant-meta a min-height: var(--tap-min)`

```css
.restaurant-meta a { color: var(--color-foreground); font-weight: 600; text-decoration: underline; min-height: var(--tap-min); display: inline-flex; align-items: center; }
```

`min-height: var(--tap-min)` 存在，搭配 `display: inline-flex`。**PASS**

---

### 品質修復

#### 7. QuickPanel sheet 有 `role="dialog"` + `aria-modal="true"` + `aria-label="快速選單"`

```tsx
<div
  className="quick-panel-sheet"
  role="dialog"
  aria-modal="true"
  aria-label="快速選單"
>
```

三個屬性均存在。**PASS**

#### 8. Backdrop scroll prevention 用原生 `addEventListener` + `{ passive: false }`

```tsx
backdrop.addEventListener('wheel', prevent, { passive: false });
backdrop.addEventListener('touchmove', prevent, { passive: false });
```

使用原生 addEventListener，非 React synthetic 事件。**PASS**

#### 9. style.css — `.quick-panel-sheet` 有 `50vh` fallback + `@supports dvh`

```css
.quick-panel-sheet {
    max-height: 50vh; /* fallback for browsers without dvh */
    ...
}
@supports (height: 1dvh) {
    .quick-panel-sheet { max-height: 50dvh; }
}
```

50vh fallback 和 @supports dvh 均存在。**PASS**

#### 10. useDarkMode.ts — ocean 遷移寫回 localStorage（lsSet）

```typescript
if (saved === 'ocean') {
  lsSet('colorTheme', 'night');  // 一次性持久化遷移
  return 'night';
}
```

使用 `lsSet` 寫回 localStorage，持久化遷移。**PASS**

#### 11. 返回按鈕文字為「返回選單」

**FAIL**

實際文字為「返回」，並非規格要求的「返回選單」。

```tsx
/* TripSelectView，第 262 行 */
<span>返回</span>   // 應為「返回選單」

/* AppearanceView，第 290 行 */
<span>返回</span>   // 應為「返回選單」
```

兩處（TripSelectView 和 AppearanceView）均未符合規格。

---

### 刪除確認

#### 12. SpeedDial.tsx 不存在

`src/components/trip/SpeedDial.tsx` 檔案不存在（Glob 查詢無結果）。**PASS**

#### 13. DownloadSheet.tsx 不存在

`src/components/trip/DownloadSheet.tsx` 檔案不存在（Glob 查詢無結果）。**PASS**

#### 14. CSS 無 `.speed-dial-*` 和 `.download-*` 殘留

style.css 和 shared.css 均無 `.speed-dial` 或 `.download-sheet` / `.download-backdrop` / `.download-option` 規則。**PASS**

#### 15. z-index token 為 `--z-quick-panel`（非 `--z-speed-dial`）

shared.css 定義 `--z-quick-panel: 350`；style.css 的 QuickPanel 區段使用 `z-index: var(--z-quick-panel)`（第 593 行）；backdrop 也使用 `z-index: calc(var(--z-quick-panel) - 1)`（第 580 行）。無 `--z-speed-dial` 殘留。**PASS**

---

### 測試

#### 16. quick-panel.test.js 有邏輯測試（非只字串比對）

以下均為邏輯測試：
- `parsePanelItems()` 函式靜態解析 TSX 原始碼，逐項驗證 key/icon/label/action/section 四欄位完整性。
- Section 分布（A=4, B=6, C=4）計數驗證。
- key 唯一性（`new Set(keys).size === keys.length`）。
- download action key 必須符合 `/^download-/` 正規表達式。
- `parseThemeKeys()` 驗證 THEME_OPTIONS 結構，確認含 night 且不含 ocean。

非單純字串比對，具備結構性邏輯驗證。**PASS**

#### 17. quick-panel.spec.js 無 `waitForTimeout`

全文搜尋：無 `waitForTimeout` 呼叫（第 383 行僅為注釋「取代 waitForTimeout」）。所有等待皆使用 assertion-based 方式（`waitFor`、`toBeVisible`、`toHaveCount`、`toHaveClass` 等）。**PASS**

---

## 總結

| # | 項目 | 狀態 |
|---|------|------|
| 1 | QuickPanel 14 項 grid、FAB 箭頭旋轉、drill-down、scroll lock | PASS |
| 2 | TripPage SpeedDial→QuickPanel、SPA 切換 resolveKey | PASS |
| 3 | Night 主題 shared.css、useDarkMode、SettingPage | PASS |
| 4 | ThemeArt night-light / night-dark SVG 裝飾 | PASS |
| 5 | mapDay.ts buildLocation fallback | PASS |
| 6 | style.css .restaurant-meta a min-height | PASS |
| 7 | QuickPanel sheet ARIA role/modal/label | PASS |
| 8 | Backdrop scroll prevention 原生 addEventListener passive:false | PASS |
| 9 | .quick-panel-sheet 50vh fallback + @supports dvh | PASS |
| 10 | useDarkMode ocean 遷移寫回 lsSet | PASS |
| 11 | 返回按鈕文字「返回選單」 | **FAIL** |
| 12 | SpeedDial.tsx 已刪除 | PASS |
| 13 | DownloadSheet.tsx 已刪除 | PASS |
| 14 | CSS 無 .speed-dial-* / .download-* 殘留 | PASS |
| 15 | z-index token 為 --z-quick-panel | PASS |
| 16 | quick-panel.test.js 邏輯測試 | PASS |
| 17 | quick-panel.spec.js 無 waitForTimeout | PASS |

**PASS：16 / 17**
**FAIL：1 / 17**

---

## FAIL 詳情

### 第 11 項：返回按鈕文字不符規格

**問題**：規格要求文字為「返回選單」，實際為「返回」。

**位置**：
- `src/components/trip/QuickPanel.tsx` 第 262 行（TripSelectView）
- `src/components/trip/QuickPanel.tsx` 第 290 行（AppearanceView）

**修正方式**：將兩處 `<span>返回</span>` 改為 `<span>返回選單</span>`。

---

**QC 結論**：本次改動整體品質良好，16 項通過。唯第 11 項返回按鈕文字與規格不符，需工程師修正後重新確認。
