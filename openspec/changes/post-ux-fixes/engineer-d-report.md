# Engineer D 修復報告

修復日期：2026-03-20
修復範圍：Challenger 發現的 2 個 🔴 + 3 個 🟡 問題

---

## 修復清單

### 🔴 #9a — dn-active-label 被 overflow:hidden 裁切

**檔案**：`css/style.css`

**修改內容**：
- `.sticky-nav`：`overflow: hidden` 改為 `overflow-x: hidden; overflow-y: visible`，允許 label 垂直方向溢出
- `.dh-nav-wrap`：加 `padding-bottom: 20px`，為 label 提供實際空間
- `.dh-nav`：加 `overflow-y: visible`，確保垂直方向不裁切

**同時修復 🟡 #9b（長標籤截斷）**：
- `.dn-active-label`：加 `max-width: 120px; overflow: hidden; text-overflow: ellipsis;`

---

### 🔴 E.2 — print-mode 與 @media print border 不一致

**檔案**：`css/style.css`（@media print 區塊，約 line 405-407）

**修改內容**：
- `.tl-card, .info-card`：`border: 1px solid var(--color-border) !important` 改為 `border: none !important`
- `.day-header`：`border-bottom: 1px solid var(--color-border) !important` 改為 `border-bottom: none !important`

統一與 `.print-mode` 無框線設計一致，修復 WYSIWYG 原則被打破的問題。

---

### 🟡 N.2 — SpeedDial stagger delay 缺 child 7-8

**檔案**：`css/style.css`（speed-dial stagger 區塊）

**修改內容**：在 `:nth-child(6)` 後補上：
```css
.speed-dial.open .speed-dial-item:nth-child(7) { transition-delay: 180ms; }
.speed-dial.open .speed-dial-item:nth-child(8) { transition-delay: 210ms; }
```

---

### 🟡 N.3 — InfoSheet .dragging class 無對應 CSS

**驗證結果**：搜尋 `css/style.css` 確認 `.info-sheet-panel.dragging { transition: none; }` 已存在於 line 632，**本項無需修改**。

---

### 🟡 N.1 — TripPage:794 殘留 as unknown as

**檔案**：`src/pages/TripPage.tsx`（line 794）

**修改前**：
```typescript
? <TodayRouteSheet events={currentDay.timeline.map((e) => toTimelineEntry(e as unknown as Record<string, unknown>))} />
```

**修改後**（與 F.14 line 162 相同模式）：
```typescript
? <TodayRouteSheet events={currentDay.timeline.map((e) => typeof e === 'object' && e !== null ? toTimelineEntry(e as unknown as Record<string, unknown>) : toTimelineEntry({}))} />
```

改用 `typeof` + null check guard，再用 `as unknown as Record<string, unknown>` 轉型（TypeScript 要求 interface 不能直接 `as Record`，需先經 `unknown`）。fallback 使用 `toTimelineEntry({})` 與 line 162 的 Timeline 元件保持一致。

---

## tsc 修正（後續）

**問題**：F.12-F.15 + N.1 修改後，`npx tsc --noEmit` 報 4 個 TS2352 錯誤：`Day`/`Hotel`/`Entry` interface 無 index signature，不能直接 `as Record<string, unknown>`。

**修正位置**（`src/pages/TripPage.tsx`）：
- line 100-101：`day as Record<...>` → `day as unknown as Record<...>`，同時修正 `?? {}` 邏輯改為 `day &&` guard
- line 155：`hotel as Record<...>` → `hotel as unknown as Record<...>`
- line 162：`e as Record<...>` → `e as unknown as Record<...>`
- line 794：`e as Record<...>` → `e as unknown as Record<...>`

**結果**：`npx tsc --noEmit` 零錯誤（clsx 預存錯誤除外）。

---

## 摘要

| 問題 | 嚴重度 | 狀態 |
|------|--------|------|
| #9a dn-active-label 被 overflow:hidden 裁切 | 🔴 | 已修復 |
| #9b dn-active-label 長標籤截斷 | 🟡 | 已修復（隨 #9a 一併處理） |
| E.2 @media print border 與 .print-mode 不一致 | 🔴 | 已修復 |
| N.2 SpeedDial stagger delay 缺 child 7-8 | 🟡 | 已修復 |
| N.3 .info-sheet-panel.dragging 無 CSS | 🟡 | 已存在，無需修改 |
| N.1 TripPage:794 殘留 as unknown as | 🟡 | 已修復 |
